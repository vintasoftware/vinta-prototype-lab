import { AlertTriangle, ArrowRight, MessageSquare, Undo2, X } from 'lucide-react'
import { type KeyboardEvent, memo, type ReactNode, useLayoutEffect, useRef } from 'react'
import type { NumberedAnnotation } from '../../components/annotation-overlay'
import { NO_NAVIGATION, type ScreenNavigation } from '../../components/prototype-runtime'
import { ScreenThumbnail } from '../../components/screen-thumbnail'
import type { CanvasFrameBox } from '../../lib/canvas-layout'
import { DEFAULT_VARIANT } from '../../lib/constants'
import type { FrameSize } from '../../lib/device-frame'
import { edgeKey, HEADER_HEIGHT, rowCount } from '../../lib/flow-drawing'
import type { FlowControl, FlowEdge, FlowNode, FlowNodeKey } from '../../lib/flow-graph'
import { expandPage } from '../../lib/probe-screen'
import type { PrototypeScreen } from '../../types'
import { Badge, Button, cn } from '../../ui'
import { FramePins } from './frame-pins'

/**
 * How much a frame's title grows to stay readable, by the factor the canvas sets: up to threefold
 * over a drawn screen, where the room above the frame ends at the section's name, and fully over a
 * title-only card.
 */
const TITLE_SCALE = {
  drawn: 'min(3, var(--canvas-label-scale, 1))',
  card: 'var(--canvas-label-scale, 1)',
} as const

/** Marks a frame's card, so a drag that starts on one selects it instead of panning the canvas. */
export const FRAME_ATTRIBUTE = 'data-canvas-frame'

/** "Book a visit, Reschedule" or "9:00 AM, 9:30 AM +4". */
export function controlsText(controls: FlowControl[]): string {
  const [first, second, ...rest] = controls.map(control => control.label)
  if (first === undefined) {
    return ''
  }
  if (second === undefined) {
    return first
  }
  return rest.length === 0 ? `${first}, ${second}` : `${first}, ${second} +${rest.length}`
}

/** "Review" for a screen's default state, "Review · Empty" for another one. */
export function nodeName(node: FlowNode): string {
  return node.screen.variant === DEFAULT_VARIANT
    ? node.screen.title
    : `${node.screen.title} · ${node.screen.variantLabel}`
}

/** A frame made live: the screen it shows now, its own navigation, and the way back out. */
export interface LiveView {
  screen: PrototypeScreen
  navigation: ScreenNavigation
  /** Whether it has clicked away from its own state; the title then offers the way back. */
  away: boolean
  /** Back to the state the frame belongs to, as the "Back to" chip does. */
  onReturn: () => void
  /** Makes the frame inert again, on its own state. */
  onStop: () => void
}

export interface CanvasFrameProps {
  node: FlowNode
  /** Identifies this frame: the node's key, or the node's key and a viewport for a second frame of the state. */
  frameKey: string
  /** The viewport this frame shows, named on its title when the canvas shows each state in two. */
  viewportLabel?: string
  /** A state's second frame: no rows under it and no arrows from it, which the first frame carries. */
  secondary: boolean
  /** Set while the frame is live: it clicks through inside itself. */
  live?: LiveView
  /**
   * Set on the picked frame while Inspect is on: its screen takes the pointer, so a click picks an
   * element in it, the way it does on the stage.
   */
  inspectable?: boolean
  /** Drawn over the screen, as the stage draws its inspect outlines and measurements. */
  overlay?: ReactNode
  /** Marked ready for an engineer to build, in `canvas.json`. */
  ready?: boolean
  box: CanvasFrameBox
  /** The size the screen renders at, before the canvas zoom: its device or viewport. */
  frameSize: FrameSize
  /**
   * The height the screen needs to show all of itself. A frame that is not live is drawn this tall,
   * as a full-page screenshot; a live one goes back to `frameSize` and scrolls, as a device does.
   */
  pageHeight?: number
  edges: readonly FlowEdge[]
  nodeByKey: ReadonlyMap<FlowNodeKey, FlowNode>
  selected: boolean
  dimmed: boolean
  /** Whether the real screen is drawn. Off for a frame out of view, or with the canvas zoomed far out. */
  mounted: boolean
  showHotspots: boolean
  /** The comments to pin on the screen; empty when comments are hidden. */
  notes: readonly NumberedAnnotation[]
  /** Open comments on this screen state, shown on its title whether or not pins are drawn. */
  openComments: number
  selectedNoteId: string | undefined
  onPin: (node: FlowNode, note: NumberedAnnotation | undefined) => void
  frameRef: (key: string, element: HTMLElement | null) => void
  mountRef: (key: string, element: HTMLDivElement | null) => void
  rowRef: (edgeKey: string, element: HTMLLIElement | null) => void
  onSelect: (node: FlowNode) => void
  /** The frame took focus, from Tab or the arrow keys: it is picked and brought into view. */
  onFocusFrame: (node: FlowNode, frameKey: string) => void
  /** A double click on the frame: opens it on the stage, or makes it live, as the canvas decides. */
  onDoubleClick: (node: FlowNode, frameKey: string) => void
  onHover: (key: FlowNodeKey | undefined) => void
  onKeyDown: (node: FlowNode, frameKey: string, event: KeyboardEvent<HTMLButtonElement>) => void
}

/**
 * One screen state on the canvas: a title, the real screen at its own size, and a row for each
 * place its controls lead. The screen is inert; the button over it is the frame's one control, so
 * Tab reaches every frame, a click selects it and a double click or Enter opens it on the stage.
 *
 * A live frame drops that button: its screen clicks through inside the frame, on a navigation of
 * its own, and its title says so and offers the way back.
 */
export const CanvasFrame = memo(function CanvasFrame({
  node,
  frameKey,
  viewportLabel,
  secondary,
  live,
  inspectable = false,
  overlay,
  ready = false,
  box,
  frameSize,
  pageHeight,
  edges,
  nodeByKey,
  selected,
  dimmed,
  mounted,
  showHotspots,
  notes,
  openComments,
  selectedNoteId,
  onPin,
  frameRef,
  mountRef,
  rowRef,
  onSelect,
  onFocusFrame,
  onDoubleClick,
  onHover,
  onKeyDown,
}: CanvasFrameProps) {
  const outgoing = edges.filter(edge => edge.from === node.key)
  const name = viewportLabel === undefined ? nodeName(node) : `${nodeName(node)} (${viewportLabel})`
  const mount = useRef<HTMLDivElement | null>(null)
  const drawn = mounted || live !== undefined
  const shown = live === undefined ? { width: frameSize.width, height: pageHeight ?? frameSize.height } : frameSize

  // A screen that sizes itself from the window (`h-svh`) still scrolls inside a taller frame, so
  // its scrolling areas are let out here as the probe let them out to measure. A live frame draws a
  // new screen (see the thumbnail's key), which scrolls at its device height again.
  useLayoutEffect(() => {
    if (drawn && live === undefined && pageHeight !== undefined && mount.current !== null) {
      expandPage(mount.current, frameSize.height)
    }
  }, [drawn, live, pageHeight, frameSize.height])

  return (
    <article
      ref={element => frameRef(frameKey, element)}
      {...{ [FRAME_ATTRIBUTE]: frameKey }}
      data-flow-node={secondary ? undefined : node.key}
      data-live={live === undefined ? undefined : ''}
      aria-label={name}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        // A live frame is as tall as its device, so its card ends higher than the place kept for it.
        ...(live === undefined ? { height: box.height } : {}),
        ...(selected || live !== undefined ? { outlineWidth: 'calc(3px * var(--canvas-label-scale, 1))' } : {}),
      }}
      className={cn(
        'pointer-events-auto absolute flex flex-col rounded-lg border border-border bg-card shadow-sm transition-opacity',
        selected && 'outline outline-primary',
        live !== undefined && 'outline outline-success',
        dimmed && 'opacity-40'
      )}
      onMouseEnter={() => onHover(node.key)}
      onMouseLeave={() => onHover(undefined)}
    >
      <header className='relative shrink-0' style={{ height: HEADER_HEIGHT }}>
        {/*
          Drawn at the same size on screen however far the canvas is zoomed out, so the title stays
          readable. Over a drawn screen it grows upward, into the room above the frame, and at most
          threefold so it stays clear of the section's name; over a title-only card there is nothing
          to hide, so it grows down over the card.
        */}
        <div
          className={cn(
            'absolute left-0 z-10 flex items-center gap-2 rounded-t-lg bg-card px-3',
            drawn ? 'bottom-0 origin-bottom-left' : 'top-0 origin-top-left'
          )}
          style={{
            height: HEADER_HEIGHT,
            width: `calc(100% / ${TITLE_SCALE[drawn ? 'drawn' : 'card']})`,
            transform: `scale(${TITLE_SCALE[drawn ? 'drawn' : 'card']})`,
          }}
        >
          <span className='truncate font-medium text-sm'>{node.screen.title}</span>
          {node.screen.variant !== DEFAULT_VARIANT && <Badge variant='outline'>{node.screen.variantLabel}</Badge>}
          {viewportLabel !== undefined && <Badge variant='neutral'>{viewportLabel}</Badge>}
          {node.entry && <Badge variant='primary'>Entry</Badge>}
          {node.unreachable && <Badge variant='warning'>Unreachable</Badge>}
          {ready && <Badge variant='success'>Ready for dev</Badge>}
          {live !== undefined && (
            <>
              <Badge variant='success'>Live</Badge>
              {live.away && (
                <Button variant='outline' size='xs' onClick={live.onReturn}>
                  <Undo2 />
                  Back to {node.screen.variant === DEFAULT_VARIANT ? node.screen.title : node.screen.variantLabel}
                </Button>
              )}
              <Button
                variant='ghost'
                size='icon-xs'
                aria-label='Stop the live frame'
                title='Stop the live frame (Esc)'
                onClick={live.onStop}
              >
                <X />
              </Button>
            </>
          )}
          {openComments > 0 && (
            <span
              className='ml-auto flex shrink-0 items-center gap-1 text-muted-foreground text-xs'
              title={`${openComments} open comment${openComments === 1 ? '' : 's'}`}
            >
              <MessageSquare className='size-3.5' />
              {openComments}
            </span>
          )}
        </div>
      </header>

      <div
        className='relative mx-2 overflow-hidden rounded-sm border border-border bg-background'
        // Contained, so a screen's own layout and painting never reach past its frame.
        style={{ width: shown.width + 2, height: shown.height + 2, contain: 'strict' }}
      >
        {drawn ? (
          <ScreenThumbnail
            // A live frame that clicks to another screen draws that one, so a new screen starts fresh.
            key={live === undefined ? 'own' : `${live.screen.id}/${live.screen.variant}`}
            screen={live?.screen ?? node.screen}
            showHotspots={showHotspots}
            size={shown}
            scale={1}
            {...(live !== undefined
              ? { navigation: live.navigation }
              : inspectable
                ? {
                    navigation: {
                      ...NO_NAVIGATION,
                      screenId: node.screen.id,
                      variant: node.screen.variant,
                      showHotspots,
                    },
                  }
                : {})}
            mountRef={element => {
              mount.current = element
              mountRef(frameKey, element)
            }}
          />
        ) : (
          <div aria-hidden='true' className='size-full bg-muted' />
        )}
        {live === undefined && !inspectable && (
          <button
            type='button'
            aria-label={name}
            aria-pressed={selected}
            onClick={() => onSelect(node)}
            onDoubleClick={() => onDoubleClick(node, frameKey)}
            onFocus={event =>
              // Focus from the keyboard brings the frame into view; a click is already on it.
              event.currentTarget.matches(':focus-visible') ? onFocusFrame(node, frameKey) : onSelect(node)
            }
            onKeyDown={event => onKeyDown(node, frameKey, event)}
            className='absolute inset-0 cursor-default rounded-sm outline-none hover:bg-primary/5 focus-visible:bg-primary/5'
          />
        )}
        {drawn && overlay}
        {drawn && notes.length > 0 && (
          <FramePins
            mountRef={mount}
            notes={notes}
            selectedId={selectedNoteId}
            onSelect={note => onPin(node, note)}
            revision={live === undefined ? frameKey : `${frameKey}:${live.screen.id}/${live.screen.variant}`}
          />
        )}
      </div>

      {!secondary && rowCount(node, edges) > 0 && (
        <ul className='flex flex-col px-3 py-2 text-xs'>
          {outgoing.map(edge => {
            const target = nodeByKey.get(edge.to)
            const missing = target === undefined
            return (
              <li
                key={edge.to}
                ref={element => rowRef(edgeKey(edge), element)}
                className='flex h-6 items-center gap-1.5'
              >
                <ArrowRight className={cn('size-3 shrink-0', missing ? 'text-destructive' : 'text-primary')} />
                <span className='min-w-0 truncate text-muted-foreground'>{controlsText(edge.controls)}</span>
                <span
                  className={cn('ml-auto max-w-[55%] shrink-0 truncate font-medium', missing && 'text-destructive')}
                >
                  {target === undefined ? `“${edge.to.replace(/^missing:/, '')}” missing` : nodeName(target)}
                </span>
              </li>
            )
          })}
          {node.backControls.length > 0 && (
            <li className='flex h-6 items-center gap-1.5'>
              <Undo2 className='size-3 shrink-0 text-muted-foreground' />
              <span className='min-w-0 truncate text-muted-foreground'>{controlsText(node.backControls)}</span>
              <span className='ml-auto shrink-0 font-medium text-muted-foreground'>Previous screen</span>
            </li>
          )}
          {node.error !== undefined && (
            <li className='flex h-6 items-center gap-1.5 text-warning' title={node.error}>
              <AlertTriangle className='size-3 shrink-0' />
              <span className='min-w-0 truncate'>Could not read its links: {node.error}</span>
            </li>
          )}
        </ul>
      )}
    </article>
  )
})
