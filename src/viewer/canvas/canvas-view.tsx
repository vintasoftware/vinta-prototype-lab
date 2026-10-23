import { AlertTriangle, ExternalLink, LayoutGrid, Maximize, Scan, Spline, ZoomIn, ZoomOut } from 'lucide-react'
import {
  type KeyboardEvent,
  memo,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import type { NumberedAnnotation } from '../../components/annotation-overlay'
import { useCanvasCamera } from '../../hooks/use-canvas-camera'
import type { FlowLinks } from '../../hooks/use-flow-links'
import { useVisibleFrames } from '../../hooks/use-visible-frames'
import { annotationsForScreen } from '../../lib/annotations'
import {
  CARD_ONLY_ZOOM,
  type Direction,
  fitRect,
  nearestInDirection,
  PAN_STEP,
  panBy,
  type Rect,
  readingOrder,
  ZOOM_STEP,
  zoomAt,
} from '../../lib/canvas-camera'
import { arrangedCanvas, resetCanvas, savedPositions } from '../../lib/canvas-file'
import { arrowDirection, type CanvasFrameBox, type CanvasSection, layoutCanvas } from '../../lib/canvas-layout'
import { FRAME_HEIGHT, VIEWPORT_WIDTH } from '../../lib/constants'
import type { FrameSize } from '../../lib/device-frame'
import { cardSizeAround, type Drawing, drawFlow, edgeKey, MISSING_SIZE, NOTHING_DRAWN } from '../../lib/flow-drawing'
import {
  buildFlowGraph,
  type FlowEdge,
  type FlowNode,
  type FlowNodeKey,
  type Point,
  type Size,
} from '../../lib/flow-graph'
import type { CanvasFile, Prototype } from '../../types'
import { Button, cn } from '../../ui'
import { CanvasFrame, FRAME_ATTRIBUTE } from './canvas-frame'
import { CanvasSectionBox, SECTION_HANDLE_ATTRIBUTE } from './canvas-section'

export interface CanvasViewProps {
  prototype: Prototype
  flow: FlowLinks
  showHotspots: boolean
  /** Whether comment pins are drawn on the frames, as on the stage. */
  showNotes: boolean
  /** The arrow layer: where each control leads. */
  arrows: boolean
  onToggleArrows: () => void
  /** A size set in the device toolbar, for every frame. Without one each screen takes its own. */
  frameSize?: FrameSize
  /** The frame picked: the screen state the viewer has open. */
  selectedKey: FlowNodeKey | undefined
  onSelect: (screenId: string, variant: string) => void
  /** Puts a screen state on the stage. */
  onOpen: (screenId: string, variant: string) => void
  selectedNoteId: string | undefined
  /** A pin clicked on a frame, or its open note closed. */
  onPin: (screenId: string, variant: string, noteId: string | undefined) => void
  /** How the canvas opens: fitted to everything, or centred on the picked frame. */
  opening: 'fit' | 'selection'
  /** Whether sections can be moved and the layout reset: only with the dev server, which saves them. */
  canArrange: boolean
  /** Saves a new arrangement to the prototype's `canvas.json`. */
  onArrange: (canvas: CanvasFile) => Promise<void>
}

/**
 * How many frames start drawing their screens per animation frame. A pan that brings a dozen into
 * view would otherwise render them all in one frame and stutter.
 */
const MOUNTS_PER_FRAME = 2

/** How long the zoom has to rest before the arrows are measured again. */
const REDRAW_DELAY = 120

/** The arrow keys, by the direction they move in. */
const ARROW_KEYS: Readonly<Record<string, Direction>> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
}

/** How far an arrow key moves a focused section, and how far with Shift held, in canvas pixels. */
const SECTION_STEP = { small: 40, large: 400 }

/** How long after the last arrow key a section moved by keyboard is saved. */
const KEYBOARD_SAVE_DELAY = 600

/** One empty list for every frame without pins, so the frames' memo holds across renders. */
const NO_NOTES: readonly NumberedAnnotation[] = []

function frameSizeOf(node: FlowNode, override: FrameSize | undefined): FrameSize {
  return override ?? { width: VIEWPORT_WIDTH[node.screen.viewport], height: FRAME_HEIGHT[node.screen.viewport] }
}

/**
 * Every screen state of a prototype as a frame on one canvas you can pan and zoom, grouped in a
 * section per screen and laid out in the flow graph's columns. The arrows of the flow map are a
 * layer on top.
 *
 * Frames draw their real screens only while they are in view and the canvas is zoomed in enough to
 * read them; the rest are cards with a title. Where controls lead is read first, by the same hidden
 * pass the flow map used, and the frames mount after it, so the two never render every screen at
 * once.
 */
export function CanvasView({
  prototype,
  flow,
  showHotspots,
  showNotes,
  arrows,
  onToggleArrows,
  frameSize,
  selectedKey,
  onSelect,
  onOpen,
  selectedNoteId,
  onPin,
  opening,
  canArrange,
  onArrange,
}: CanvasViewProps) {
  const viewportRef = useRef<HTMLElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const { camera, zoom, moving, setCamera } = useCanvasCamera(contentRef)
  const { visible, watch } = useVisibleFrames(viewportRef)
  // Frames that come into view during a pan draw once it stops, so the pan itself renders nothing.
  const drawn = useStaggeredSet(visible, MOUNTS_PER_FRAME, moving)
  const ready = flow.status === 'ready'

  const graph = useMemo(() => buildFlowGraph(prototype, flow.linksByNode), [prototype, flow.linksByNode])
  const nodeByKey = useMemo(() => new Map(graph.nodes.map(node => [node.key, node])), [graph])
  const cardSize = useCallback(
    (key: FlowNodeKey): Size => {
      const node = nodeByKey.get(key)
      return node === undefined ? MISSING_SIZE : cardSizeAround(node, graph.edges, frameSizeOf(node, frameSize))
    },
    [nodeByKey, graph.edges, frameSize]
  )
  // Where sections were put: the saved file, and any move not saved yet, so a move shows at once.
  const [moved, setMoved] = useState<ReadonlyMap<string, Point>>(() => new Map())
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new saved arrangement replaces the moves it records.
  useEffect(() => setMoved(new Map()), [prototype.canvas])
  const placed = useMemo(() => new Map([...savedPositions(prototype.canvas), ...moved]), [prototype.canvas, moved])
  const layout = useMemo(() => layoutCanvas(graph, cardSize, placed), [graph, cardSize, placed])
  // Sections in reading order, so Tab reads the canvas section by section, frames left to right.
  const sections = useMemo(
    () =>
      readingOrder(layout.sections.map(section => ({ key: section, rect: section }))).map(section => ({
        section,
        // Each frame relative to its section, which is what it is placed in.
        frames: section.frames.map(frame => ({ ...frame, x: frame.x - section.x, y: frame.y - section.y })),
      })),
    [layout]
  )
  // One object per frame for its size, so a render of the canvas leaves the frames alone.
  const frameSizes = useMemo(
    () => new Map(graph.nodes.map(node => [node.key, frameSizeOf(node, frameSize)] as const)),
    [graph, frameSize]
  )
  const frames = useMemo(
    () => layout.sections.filter(section => !section.missing).flatMap(section => section.frames),
    [layout]
  )

  const notesByScreen = useMemo(() => {
    const byScreen = new Map<string, NumberedAnnotation[]>()
    for (const screenId of new Set(prototype.screens.map(screen => screen.id))) {
      byScreen.set(
        screenId,
        annotationsForScreen(prototype.annotations, screenId).map((note, index) => ({ ...note, number: index + 1 }))
      )
    }
    return byScreen
  }, [prototype])

  const viewportSize = useCallback((): Size => {
    const viewport = viewportRef.current
    return { width: viewport?.clientWidth ?? 0, height: viewport?.clientHeight ?? 0 }
  }, [])

  const fitAll = useCallback(() => {
    setCamera(fitRect(layout.bounds, viewportSize()))
  }, [layout.bounds, setCamera, viewportSize])

  const zoomToFrame = useCallback(
    (key: FlowNodeKey | undefined) => {
      const box = key === undefined ? undefined : layout.frameByKey.get(key)
      if (box !== undefined) {
        setCamera(fitRect(box, viewportSize()))
      }
    },
    [layout.frameByKey, setCamera, viewportSize]
  )

  // Opens once the layout is known: on the picked frame when asked to, else on everything.
  const opened = useRef(false)
  useLayoutEffect(() => {
    if (!ready || opened.current || frames.length === 0) {
      return
    }
    opened.current = true
    // Focus goes to the canvas, so its keys work as soon as it opens.
    viewportRef.current?.focus({ preventScroll: true })
    if (opening === 'selection' && selectedKey !== undefined && layout.frameByKey.has(selectedKey)) {
      zoomToFrame(selectedKey)
    } else {
      fitAll()
    }
  }, [ready, frames.length, opening, selectedKey, layout.frameByKey, zoomToFrame, fitAll])

  /** Where on the viewport a keyboard zoom holds still: the picked frame, else the middle. */
  const zoomAnchor = () => {
    const box = selectedKey === undefined ? undefined : layout.frameByKey.get(selectedKey)
    const { width, height } = viewportSize()
    if (box === undefined) {
      return { x: width / 2, y: height / 2 }
    }
    const { x, y, zoom: current } = camera.current
    return { x: x + (box.x + box.width / 2) * current, y: y + (box.y + box.height / 2) * current }
  }

  const zoomBy = (factor: number) => {
    setCamera(zoomAt(camera.current, camera.current.zoom * factor, zoomAnchor()))
  }

  /** Pans just enough to bring a frame into view, centring it when it is out of sight. */
  const bringIntoView = (box: Rect) => {
    const { width, height } = viewportSize()
    const { x, y, zoom: current } = camera.current
    const left = x + box.x * current
    const top = y + box.y * current
    const inView = left >= 0 && top >= 0 && left + box.width * current <= width && top + box.height * current <= height
    if (!inView) {
      setCamera({
        ...camera.current,
        x: width / 2 - (box.x + box.width / 2) * current,
        y: height / 2 - (box.y + box.height / 2) * current,
      })
    }
  }

  // A frame picked from outside the canvas, in the screen list, is brought into view.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a change of the picked frame should move the camera.
  useEffect(() => {
    const box = selectedKey === undefined ? undefined : layout.frameByKey.get(selectedKey)
    if (opened.current && box !== undefined) {
      bringIntoView(box)
    }
  }, [selectedKey])

  const focusFrame = (key: FlowNodeKey) => {
    const button = contentRef.current?.querySelector<HTMLButtonElement>(
      `[${FRAME_ATTRIBUTE}="${CSS.escape(key)}"] button[aria-pressed]`
    )
    button?.focus({ preventScroll: true })
  }

  const selectFrame = (node: FlowNode) => {
    onSelect(node.screen.id, node.screen.variant)
    const box = layout.frameByKey.get(node.key)
    if (box !== undefined) {
      bringIntoView(box)
    }
  }

  // Moving sections. The section is moved on the page while it is dragged, and its frames with it;
  // the arrangement is saved when it is let go.
  const [arrangeError, setArrangeError] = useState<string | undefined>(undefined)
  const [dragging, setDragging] = useState(false)
  const sectionElements = useRef(new Map<string, HTMLElement>())

  const save = useCallback(
    (canvas: CanvasFile) => {
      setArrangeError(undefined)
      onArrange(canvas).catch((thrown: unknown) => {
        setArrangeError(thrown instanceof Error ? thrown.message : String(thrown))
      })
    },
    [onArrange]
  )

  /** Every section where it is now, with one of them moved, as the file will hold them. */
  const arrangementWith = (screenId: string, to: Point): CanvasFile =>
    arrangedCanvas(
      prototype.canvas,
      layout.sections
        .filter(section => !section.missing)
        .map(section => ({ screen: section.screenId, ...(section.screenId === screenId ? to : section) }))
    )

  const moveSection = (screenId: string, to: Point) => {
    setMoved(current => new Map([...current, [screenId, to]]))
  }

  const startSectionDrag = (section: CanvasSection) => (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const element = sectionElements.current.get(section.screenId)
    const start = { x: event.clientX, y: event.clientY }
    let to: Point = { x: section.x, y: section.y }
    setDragging(true)

    const move = (moveEvent: PointerEvent) => {
      const zoomNow = camera.current.zoom
      to = {
        x: section.x + (moveEvent.clientX - start.x) / zoomNow,
        y: section.y + (moveEvent.clientY - start.y) / zoomNow,
      }
      if (element !== undefined) {
        element.style.left = `${to.x}px`
        element.style.top = `${to.y}px`
      }
    }
    const end = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', end)
      window.removeEventListener('pointercancel', end)
      setDragging(false)
      if (to.x !== section.x || to.y !== section.y) {
        moveSection(section.screenId, to)
        save(arrangementWith(section.screenId, to))
      }
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', end)
    window.addEventListener('pointercancel', end)
  }

  const keyboardSave = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const onSectionKeyDown = (section: CanvasSection) => (event: KeyboardEvent<HTMLButtonElement>) => {
    const direction = ARROW_KEYS[event.key]
    if (direction === undefined) {
      return
    }
    event.preventDefault()
    event.stopPropagation()
    const step = event.shiftKey ? SECTION_STEP.large : SECTION_STEP.small
    const to = {
      x: section.x + (direction === 'left' ? -step : direction === 'right' ? step : 0),
      y: section.y + (direction === 'up' ? -step : direction === 'down' ? step : 0),
    }
    moveSection(section.screenId, to)
    const canvas = arrangementWith(section.screenId, to)
    clearTimeout(keyboardSave.current)
    keyboardSave.current = setTimeout(() => save(canvas), KEYBOARD_SAVE_DELAY)
  }
  useEffect(() => () => clearTimeout(keyboardSave.current), [])

  const resetLayout = () => {
    setMoved(new Map())
    save(resetCanvas(prototype.canvas))
  }

  // The wheel pans, and zooms with Ctrl or Cmd held, which is also what a trackpad pinch sends. The
  // listener is added by hand because React's is passive, and the page must not zoom or scroll.
  useEffect(() => {
    const viewport = viewportRef.current
    if (viewport === null) {
      return
    }
    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const unit = event.deltaMode === 1 ? 16 : 1
      if (event.ctrlKey || event.metaKey) {
        const bounds = viewport.getBoundingClientRect()
        const anchor = { x: event.clientX - bounds.left, y: event.clientY - bounds.top }
        setCamera(zoomAt(camera.current, camera.current.zoom * Math.exp(-event.deltaY * unit * 0.01), anchor))
      } else {
        setCamera(panBy(camera.current, -event.deltaX * unit, -event.deltaY * unit))
      }
    }
    viewport.addEventListener('wheel', onWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', onWheel)
  }, [camera, setCamera])

  // Panning by drag, on empty canvas or anywhere with Space held, and pinching with two fingers.
  const spaceHeld = useRef(false)
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const [panning, setPanning] = useState(false)

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    const onFrame =
      event.target instanceof Element &&
      event.target.closest(`[${FRAME_ATTRIBUTE}], [${SECTION_HANDLE_ATTRIBUTE}]`) !== null
    if (event.button !== 0 || (onFrame && !spaceHeld.current && pointers.current.size === 0)) {
      return
    }
    event.currentTarget.setPointerCapture?.(event.pointerId)
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    setPanning(true)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (previous === undefined) {
      return
    }
    const next = { x: event.clientX, y: event.clientY }
    const others = [...pointers.current.entries()].filter(([id]) => id !== event.pointerId)
    const other = others[0]?.[1]
    if (other !== undefined) {
      // Two fingers: zoom by how far apart they moved, about the point between them.
      const bounds = event.currentTarget.getBoundingClientRect()
      const before = Math.hypot(previous.x - other.x, previous.y - other.y)
      const after = Math.hypot(next.x - other.x, next.y - other.y)
      const middle = { x: (next.x + other.x) / 2 - bounds.left, y: (next.y + other.y) / 2 - bounds.top }
      if (before > 0) {
        setCamera(zoomAt(camera.current, camera.current.zoom * (after / before), middle))
      }
    } else {
      setCamera(panBy(camera.current, next.x - previous.x, next.y - previous.y))
    }
    pointers.current.set(event.pointerId, next)
  }

  const onPointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    pointers.current.delete(event.pointerId)
    if (pointers.current.size === 0) {
      setPanning(false)
    }
  }

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.metaKey || event.ctrlKey || event.altKey) {
      return
    }
    const onFrameKey =
      event.target instanceof Element
        ? event.target.closest(`[${FRAME_ATTRIBUTE}]`)?.getAttribute(FRAME_ATTRIBUTE)
        : null

    const inCanvas = event.target instanceof Node && viewportRef.current?.contains(event.target) === true
    if (event.key === ' ') {
      // Space held over the canvas turns a drag into a pan. On a toolbar button it presses the button.
      if (inCanvas) {
        spaceHeld.current = true
        if (onFrameKey === null || onFrameKey === undefined) {
          event.preventDefault()
        }
      }
      return
    }

    const direction = ARROW_KEYS[event.key]
    if (direction !== undefined) {
      event.preventDefault()
      const from = onFrameKey === null || onFrameKey === undefined ? undefined : layout.frameByKey.get(onFrameKey)
      if (from === undefined) {
        const step = { left: [PAN_STEP, 0], right: [-PAN_STEP, 0], up: [0, PAN_STEP], down: [0, -PAN_STEP] }[direction]
        setCamera(panBy(camera.current, step[0] ?? 0, step[1] ?? 0))
        return
      }
      const nextKey = nearestInDirection(
        from,
        frames.filter(frame => frame.key !== from.key).map(frame => ({ key: frame.key, rect: frame })),
        direction
      )
      const nextNode = nextKey === undefined ? undefined : nodeByKey.get(nextKey)
      if (nextNode !== undefined) {
        selectFrame(nextNode)
        focusFrame(nextNode.key)
      }
      return
    }

    if (event.key === '+' || event.key === '=') {
      event.preventDefault()
      zoomBy(ZOOM_STEP)
    } else if (event.key === '-' || event.key === '_') {
      event.preventDefault()
      zoomBy(1 / ZOOM_STEP)
    } else if (event.shiftKey && event.code === 'Digit1') {
      event.preventDefault()
      fitAll()
    } else if (event.shiftKey && event.code === 'Digit2') {
      event.preventDefault()
      zoomToFrame(selectedKey)
    }
  }

  const onFrameKeyDown = useCallback(
    (node: FlowNode, event: KeyboardEvent<HTMLButtonElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault()
        onOpen(node.screen.id, node.screen.variant)
      }
    },
    [onOpen]
  )

  // The arrows are measured from the drawn screens, so they are drawn again whenever what is drawn
  // changes, and after the zoom settles.
  const mounts = useRef(new Map<FlowNodeKey, HTMLDivElement>())
  const rows = useRef(new Map<string, HTMLLIElement>())
  const [drawing, setDrawing] = useState<Drawing>(NOTHING_DRAWN)
  const [hovered, setHovered] = useState<FlowNodeKey | undefined>(undefined)

  const positions = useMemo(() => {
    const map = new Map<FlowNodeKey, { x: number; y: number }>()
    for (const section of layout.sections) {
      for (const frame of section.frames) {
        map.set(frame.key, { x: frame.x, y: frame.y })
      }
    }
    return map
  }, [layout])

  const draw = useCallback(() => {
    const content = contentRef.current
    if (!arrows || !ready || content === null) {
      setDrawing(NOTHING_DRAWN)
      return
    }
    setDrawing(
      drawFlow({
        graph,
        layout: { positions, width: layout.bounds.width, height: layout.bounds.height },
        scale: camera.current.zoom,
        sizeOf: cardSize,
        content,
        mounts: mounts.current,
        rows: rows.current,
        directionOf: (from, to) => {
          const a = layout.frameByKey.get(from)
          const b = layout.frameByKey.get(to)
          return a === undefined || b === undefined ? 'forward' : arrowDirection(a, b)
        },
      })
    )
  }, [arrows, ready, graph, positions, layout, camera, cardSize])

  // biome-ignore lint/correctness/useExhaustiveDependencies: the frames drawn and the zoom change what the arrows are measured from.
  useEffect(() => {
    const timer = setTimeout(draw, REDRAW_DELAY)
    return () => clearTimeout(timer)
  }, [draw, drawn, zoom])

  const frameRef = useCallback((key: FlowNodeKey, element: HTMLElement | null) => watch(key, element), [watch])
  const mountRef = useCallback((key: FlowNodeKey, element: HTMLDivElement | null) => {
    if (element === null) {
      mounts.current.delete(key)
    } else {
      mounts.current.set(key, element)
    }
  }, [])
  const rowRef = useCallback((key: string, element: HTMLLIElement | null) => {
    if (element === null) {
      rows.current.delete(key)
    } else {
      rows.current.set(key, element)
    }
  }, [])
  const select = useCallback((node: FlowNode) => onSelect(node.screen.id, node.screen.variant), [onSelect])
  const open = useCallback((node: FlowNode) => onOpen(node.screen.id, node.screen.variant), [onOpen])
  const pin = useCallback(
    (node: FlowNode, note: NumberedAnnotation | undefined) => onPin(node.screen.id, node.screen.variant, note?.id),
    [onPin]
  )

  if (prototype.screens.length === 0) {
    return (
      <p className='self-center text-muted-foreground text-sm'>
        This prototype has no screens yet, so there is nothing to lay out.
      </p>
    )
  }

  const readable = zoom >= CARD_ONLY_ZOOM
  const right = Math.max(1, layout.bounds.x + layout.bounds.width)
  const bottom = Math.max(1, layout.bounds.y + layout.bounds.height)
  const selectedNode = selectedKey === undefined ? undefined : nodeByKey.get(selectedKey)

  return (
    // The canvas keys work anywhere in it, the toolbar included, so a toolbar click keeps them.
    // biome-ignore lint/a11y/noStaticElementInteractions: it only listens for keys its children receive.
    <div
      className='relative flex h-full w-full flex-col'
      onKeyDown={onKeyDown}
      onKeyUp={event => {
        if (event.key === ' ') {
          spaceHeld.current = false
        }
      }}
    >
      <div className='flex shrink-0 items-center gap-1 border-border border-b bg-card px-3 py-1.5'>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Zoom out'
          title='Zoom out (-)'
          onClick={() => zoomBy(1 / ZOOM_STEP)}
        >
          <ZoomOut />
        </Button>
        <span className='w-12 text-center text-muted-foreground text-xs tabular-nums' aria-live='polite'>
          {Math.round(zoom * 100)}%
        </span>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Zoom in'
          title='Zoom in (+)'
          onClick={() => zoomBy(ZOOM_STEP)}
        >
          <ZoomIn />
        </Button>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Fit everything'
          title='Fit everything (Shift+1)'
          onClick={fitAll}
        >
          <Maximize />
        </Button>
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Zoom to selection'
          title='Zoom to selection (Shift+2)'
          disabled={selectedNode === undefined}
          onClick={() => zoomToFrame(selectedKey)}
        >
          <Scan />
        </Button>
        <span className='mx-1 h-5 w-px bg-border' />
        <Button
          variant={arrows ? 'light' : 'ghost'}
          size='sm'
          aria-pressed={arrows}
          title='Where each control leads (A)'
          onClick={onToggleArrows}
        >
          <Spline />
          Arrows
        </Button>
        <Button
          variant='ghost'
          size='sm'
          disabled={selectedNode === undefined}
          title='Open the picked frame on the stage (Enter)'
          onClick={() => selectedNode !== undefined && onOpen(selectedNode.screen.id, selectedNode.screen.variant)}
        >
          <ExternalLink />
          Open
        </Button>
        {canArrange && (
          <Button
            variant='ghost'
            size='sm'
            disabled={(prototype.canvas?.sections.length ?? 0) === 0 && moved.size === 0}
            title='Put every section back in the columns of the flow'
            onClick={resetLayout}
          >
            <LayoutGrid />
            Reset layout
          </Button>
        )}
        {arrangeError !== undefined && (
          <p role='alert' className='text-destructive text-xs'>
            The layout was not saved: {arrangeError}
          </p>
        )}
        <p className='ml-auto hidden text-muted-foreground text-xs lg:block'>
          Drag or scroll to pan. Ctrl or Cmd and scroll to zoom. Tab or arrows to move between frames.
        </p>
      </div>

      <section
        ref={viewportRef}
        aria-label='Canvas'
        aria-roledescription='canvas'
        // biome-ignore lint/a11y/noNoninteractiveTabindex: the canvas pans with the arrow keys when it has focus.
        tabIndex={0}
        className={cn(
          'relative min-h-0 flex-1 touch-none overflow-hidden bg-muted outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset',
          panning ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      >
        {!ready && (
          <p className='absolute inset-0 flex items-center justify-center text-muted-foreground text-sm'>
            Reading where every control leads… {flow.read} of {flow.total} screen states
          </p>
        )}

        <div
          ref={contentRef}
          className='absolute top-0 left-0 origin-top-left'
          style={{ width: right, height: bottom, visibility: ready ? 'visible' : 'hidden' }}
        >
          {ready &&
            sections.map(({ section, frames: placedFrames }) => (
              <CanvasSectionBox
                key={`section:${section.screenId}`}
                section={section}
                movable={canArrange && !section.missing}
                sectionRef={element => {
                  if (element === null) {
                    sectionElements.current.delete(section.screenId)
                  } else {
                    sectionElements.current.set(section.screenId, element)
                  }
                }}
                onHandlePointerDown={startSectionDrag(section)}
                onHandleKeyDown={onSectionKeyDown(section)}
              >
                {placedFrames.map(box => {
                  const node = nodeByKey.get(box.key)
                  if (node === undefined) {
                    return <MissingCard key={box.key} box={box} screenId={section.screenId} />
                  }
                  const notes = showNotes ? (notesByScreen.get(node.screen.id) ?? NO_NOTES) : NO_NOTES
                  const openComments = (notesByScreen.get(node.screen.id) ?? []).filter(
                    note => note.status !== 'resolved'
                  ).length
                  return (
                    <CanvasFrame
                      key={node.key}
                      node={node}
                      box={box}
                      frameSize={frameSizes.get(node.key) ?? frameSizeOf(node, frameSize)}
                      edges={graph.edges}
                      nodeByKey={nodeByKey}
                      selected={node.key === selectedKey}
                      dimmed={hovered !== undefined && hovered !== node.key && !touches(graph.edges, hovered, node.key)}
                      mounted={readable && drawn.has(node.key)}
                      showHotspots={showHotspots}
                      notes={notes}
                      openComments={openComments}
                      selectedNoteId={selectedNoteId}
                      onPin={pin}
                      frameRef={frameRef}
                      mountRef={mountRef}
                      rowRef={rowRef}
                      onSelect={select}
                      onOpen={open}
                      onHover={setHovered}
                      onKeyDown={onFrameKeyDown}
                    />
                  )
                })}
              </CanvasSectionBox>
            ))}

          {/* Hidden while a section is dragged: they are measured again once it is let go. */}
          {arrows && ready && !dragging && (
            <CanvasArrows drawing={drawing} hovered={hovered} width={right} height={bottom} />
          )}
        </div>
      </section>
    </div>
  )
}

interface CanvasArrowsProps {
  drawing: Drawing
  hovered: FlowNodeKey | undefined
  width: number
  height: number
}

/**
 * The arrow layer: an arrow per destination and a ring around each control that leads there. It
 * can hold thousands of paths, so it renders only when the drawing or the hovered frame changes.
 */
const CanvasArrows = memo(function CanvasArrows({ drawing, hovered, width, height }: CanvasArrowsProps) {
  const related = (edge: FlowEdge) => hovered === undefined || edge.from === hovered || edge.to === hovered

  return (
    <svg
      aria-hidden='true'
      width={width}
      height={height}
      className='pointer-events-none absolute top-0 left-0 overflow-visible'
    >
      <defs>
        <marker
          id='flow-arrow'
          viewBox='0 0 10 10'
          refX='9'
          refY='5'
          markerWidth='8'
          markerHeight='8'
          orient='auto-start-reverse'
        >
          <path d='M 0 0 L 10 5 L 0 10 z' fill='currentColor' className='text-primary' />
        </marker>
        <marker
          id='flow-arrow-faded'
          viewBox='0 0 10 10'
          refX='9'
          refY='5'
          markerWidth='8'
          markerHeight='8'
          orient='auto-start-reverse'
        >
          <path d='M 0 0 L 10 5 L 0 10 z' fill='currentColor' className='text-border' />
        </marker>
      </defs>

      {drawing.rings.map(ring => (
        <rect
          key={ring.key}
          data-flow-ring={ring.kind}
          data-flow-ring-node={ring.node}
          x={ring.rect.x - 2}
          y={ring.rect.y - 2}
          width={ring.rect.width + 4}
          height={ring.rect.height + 4}
          rx={3}
          fill='none'
          strokeWidth={1.5}
          vectorEffect='non-scaling-stroke'
          className={cn(
            ring.kind === 'screen' ? 'stroke-primary' : 'stroke-muted-foreground',
            hovered !== undefined && hovered !== ring.node && 'opacity-30'
          )}
        />
      ))}

      {drawing.arrows.map(arrow => {
        const active = related(arrow.edge)
        return (
          <g key={edgeKey(arrow.edge)} className={cn(!active && 'opacity-25')}>
            <path
              d={arrow.d}
              fill='none'
              strokeWidth={5}
              vectorEffect='non-scaling-stroke'
              className='stroke-background'
            />
            <path
              d={arrow.d}
              fill='none'
              strokeWidth={hovered !== undefined && active ? 2.5 : 1.5}
              strokeDasharray={arrow.backward ? '6 4' : undefined}
              vectorEffect='non-scaling-stroke'
              markerEnd={active ? 'url(#flow-arrow)' : 'url(#flow-arrow-faded)'}
              className={active ? 'stroke-primary' : 'stroke-border'}
            />
          </g>
        )
      })}
    </svg>
  )
})

/** Whether an arrow joins the two nodes, in either direction. */
function touches(edges: readonly FlowEdge[], a: FlowNodeKey, b: FlowNodeKey): boolean {
  return edges.some(edge => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a))
}

/**
 * Follows `target`, adding at most `perFrame` new keys each animation frame and dropping keys at
 * once. What enters view draws a few frames at a time; what leaves it stops drawing right away.
 * While `paused` it holds still, and catches up when let go.
 */
function useStaggeredSet(target: ReadonlySet<string>, perFrame: number, paused: boolean): ReadonlySet<string> {
  const [current, setCurrent] = useState<ReadonlySet<string>>(target)
  const latest = useRef(current)
  latest.current = current

  useEffect(() => {
    if (paused) {
      return
    }
    let raf = 0
    const step = () => {
      const previous = latest.current
      const kept = [...previous].filter(key => target.has(key))
      const added = [...target].filter(key => !previous.has(key)).slice(0, perFrame)
      if (added.length === 0 && kept.length === previous.size) {
        return
      }
      const next = new Set([...kept, ...added])
      latest.current = next
      setCurrent(next)
      if (next.size < target.size) {
        raf = requestAnimationFrame(step)
      }
    }
    step()
    return () => cancelAnimationFrame(raf)
  }, [target, perFrame, paused])

  return current
}

/** Stands in for a screen a control opens but no file defines. */
function MissingCard({ box, screenId }: { box: CanvasFrameBox; screenId: string }) {
  return (
    <article
      data-flow-node={box.key}
      style={{ left: box.x, top: box.y, width: box.width, height: box.height }}
      className='pointer-events-auto absolute flex flex-col justify-center rounded-lg border border-destructive-border border-dashed bg-destructive-subtle px-3 text-destructive'
    >
      <p className='flex items-center gap-1.5 font-medium text-sm'>
        <AlertTriangle className='size-4 shrink-0' />
        <span className='truncate'>No screen “{screenId}”</span>
      </p>
      <p className='mt-1 text-xs'>A control opens it, but no file under screens/ defines it.</p>
    </article>
  )
}
