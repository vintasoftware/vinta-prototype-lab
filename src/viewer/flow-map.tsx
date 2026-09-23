import { AlertTriangle, ArrowRight, Maximize, Undo2, ZoomIn, ZoomOut } from 'lucide-react'
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { ScreenThumbnail } from '../components/screen-thumbnail'
import type { FlowLinks } from '../hooks/use-flow-links'
import { DEFAULT_VARIANT } from '../lib/constants'
import { cardSize, type Drawing, drawFlow, edgeKey, MISSING_SIZE, NOTHING_DRAWN, rowCount } from '../lib/flow-drawing'
import {
  buildFlowGraph,
  type FlowControl,
  type FlowEdge,
  type FlowGraph,
  type FlowNode,
  type FlowNodeKey,
  layoutFlowGraph,
  type Point,
  type Size,
} from '../lib/flow-graph'
import type { Prototype, ScreenViewport } from '../types'
import { Badge, Button, cn } from '../ui'

export interface FlowMapProps {
  prototype: Prototype
  flow: FlowLinks
  showHotspots: boolean
  /** Frame to draw every screen in, when the viewer's switcher overrides the screens' own. */
  viewport?: ScreenViewport
  /** Called when a card is clicked. The map is a picture of the flow; the stage is where it runs. */
  onOpenScreen: (screenId: string, variant: string) => void
}

const ZOOM_STEPS = [0.25, 0.35, 0.5, 0.65, 0.8, 1, 1.25, 1.5] as const

/** "Book a visit, Reschedule" or "9:00 AM, 9:30 AM +4". */
function controlsText(controls: FlowControl[]): string {
  const [first, second, ...rest] = controls.map(control => control.label)
  if (first === undefined) {
    return ''
  }
  if (second === undefined) {
    return first
  }
  return rest.length === 0 ? `${first}, ${second}` : `${first}, ${second} +${rest.length}`
}

function nodeName(node: FlowNode): string {
  return node.screen.variant === DEFAULT_VARIANT
    ? node.screen.title
    : `${node.screen.title} · ${node.screen.variantLabel}`
}

/**
 * Every possible path through a prototype, on one canvas: each screen state as a card with the real
 * screen drawn small inside it, and an arrow from each control to the screen it opens.
 *
 * It is read-only by design. The arrows come from clicking the controls in a hidden render of each
 * screen, so the picture is what the screens do; changing it means changing a screen file.
 */
export function FlowMap({ prototype, flow, showHotspots, viewport, onOpenScreen }: FlowMapProps) {
  const graph = useMemo(() => buildFlowGraph(prototype, flow.linksByNode), [prototype, flow.linksByNode])
  const nodeByKey = useMemo(() => new Map(graph.nodes.map(node => [node.key, node])), [graph])

  const sizeOf = useCallback(
    (key: FlowNodeKey): Size => {
      const node = nodeByKey.get(key)
      return node === undefined ? MISSING_SIZE : cardSize(node, graph.edges, viewport)
    },
    [nodeByKey, graph.edges, viewport]
  )
  const layout = useMemo(() => layoutFlowGraph(graph, sizeOf), [graph, sizeOf])

  const viewportRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const mounts = useRef(new Map<FlowNodeKey, HTMLDivElement>())
  const rows = useRef(new Map<string, HTMLLIElement>())

  const [scale, setScale] = useState(1)
  const [hovered, setHovered] = useState<FlowNodeKey | undefined>(undefined)
  const [drawing, setDrawing] = useState<Drawing>(NOTHING_DRAWN)

  const fit = useCallback(() => {
    const viewport = viewportRef.current
    if (viewport === null || layout.width === 0) {
      return
    }
    const fitted = Math.min(viewport.clientWidth / layout.width, viewport.clientHeight / layout.height, 1)
    setScale(Math.max(ZOOM_STEPS[0], Math.floor(fitted * 20) / 20))
  }, [layout.width, layout.height])

  // Open at a zoom that shows the whole flow.
  useLayoutEffect(fit, [fit])

  const draw = useCallback(() => {
    const content = contentRef.current
    if (content === null) {
      setDrawing(NOTHING_DRAWN)
      return
    }
    setDrawing(drawFlow({ graph, layout, scale, sizeOf, content, mounts: mounts.current, rows: rows.current }))
  }, [graph, layout, scale, sizeOf])

  useLayoutEffect(() => {
    draw()
    // Fonts and images settle after the first layout; the arrows move with them.
    const raf = requestAnimationFrame(draw)
    const content = contentRef.current
    const observer = new ResizeObserver(draw)
    if (content !== null) {
      observer.observe(content)
    }
    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
    }
  }, [draw])

  const zoom = (direction: 1 | -1) => {
    setScale(current => {
      const index = ZOOM_STEPS.findIndex(step => (direction > 0 ? step > current : step >= current))
      const next = direction > 0 ? ZOOM_STEPS[index] : ZOOM_STEPS[index - 1]
      return next ?? (direction > 0 ? ZOOM_STEPS[ZOOM_STEPS.length - 1] : ZOOM_STEPS[0]) ?? current
    })
  }

  if (prototype.screens.length === 0) {
    return (
      <p className='self-center text-muted-foreground text-sm'>
        This prototype has no screens yet, so there is no flow.
      </p>
    )
  }

  if (flow.status !== 'ready') {
    return <p className='self-center text-muted-foreground text-sm'>Reading where every control leads…</p>
  }

  const related = (edge: FlowEdge) => hovered === undefined || edge.from === hovered || edge.to === hovered

  return (
    <div className='relative flex h-full w-full flex-col'>
      <div className='flex shrink-0 items-start justify-between gap-3 border-border border-b bg-card px-3 py-2'>
        <div className='flex items-center gap-1'>
          <Button variant='ghost' size='icon-sm' aria-label='Zoom out' onClick={() => zoom(-1)}>
            <ZoomOut />
          </Button>
          <span className='w-10 text-center text-muted-foreground text-xs tabular-nums'>
            {Math.round(scale * 100)}%
          </span>
          <Button variant='ghost' size='icon-sm' aria-label='Zoom in' onClick={() => zoom(1)}>
            <ZoomIn />
          </Button>
          <Button variant='ghost' size='icon-sm' aria-label='Fit the whole flow' onClick={fit}>
            <Maximize />
          </Button>
        </div>
        <p className='max-w-lg text-right text-muted-foreground text-xs'>
          One arrow per destination; every control that opens it is outlined. A dashed arrow returns to an earlier
          screen. Click a card to open that screen on stage.
        </p>
      </div>

      <div ref={viewportRef} className='min-h-0 flex-1 overflow-auto'>
        <div style={{ width: layout.width * scale, height: layout.height * scale }} className='relative'>
          <div
            ref={contentRef}
            style={{ width: layout.width, height: layout.height, transform: `scale(${scale})`, transformOrigin: '0 0' }}
            className='relative'
          >
            {graph.nodes.map(node => (
              <ScreenCard
                key={node.key}
                node={node}
                edges={graph.edges}
                nodeByKey={nodeByKey}
                position={layout.positions.get(node.key) ?? { x: 0, y: 0 }}
                size={sizeOf(node.key)}
                showHotspots={showHotspots}
                {...(viewport === undefined ? {} : { viewport })}
                dimmed={hovered !== undefined && hovered !== node.key && !touches(graph, hovered, node.key)}
                mountRef={element => {
                  if (element === null) {
                    mounts.current.delete(node.key)
                  } else {
                    mounts.current.set(node.key, element)
                  }
                }}
                rowRef={(edgeKey, element) => {
                  if (element === null) {
                    rows.current.delete(edgeKey)
                  } else {
                    rows.current.set(edgeKey, element)
                  }
                }}
                onHover={setHovered}
                onOpen={() => onOpenScreen(node.screen.id, node.screen.variant)}
              />
            ))}

            {graph.missing.map(missing => {
              const position = layout.positions.get(missing.key) ?? { x: 0, y: 0 }
              return (
                <article
                  key={missing.key}
                  data-flow-node={missing.key}
                  style={{ left: position.x, top: position.y, ...MISSING_SIZE }}
                  className='absolute flex flex-col justify-center rounded-lg border border-destructive-border border-dashed bg-destructive-subtle px-3 text-destructive'
                  onMouseEnter={() => setHovered(missing.key)}
                  onMouseLeave={() => setHovered(undefined)}
                >
                  <p className='flex items-center gap-1.5 font-medium text-sm'>
                    <AlertTriangle className='size-4 shrink-0' />
                    <span className='truncate'>No screen “{missing.screenId}”</span>
                  </p>
                  <p className='mt-1 text-xs'>A control opens it, but no file under screens/ defines it.</p>
                </article>
              )
            })}

            <svg
              aria-hidden='true'
              width={layout.width}
              height={layout.height}
              className='pointer-events-none absolute inset-0 overflow-visible'
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
                    <path d={arrow.d} fill='none' strokeWidth={5} className='stroke-background' />
                    <path
                      d={arrow.d}
                      fill='none'
                      strokeWidth={hovered !== undefined && active ? 2.5 : 1.5}
                      strokeDasharray={arrow.backward ? '6 4' : undefined}
                      markerEnd={active ? 'url(#flow-arrow)' : 'url(#flow-arrow-faded)'}
                      className={active ? 'stroke-primary' : 'stroke-border'}
                    />
                  </g>
                )
              })}
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

/** Whether an arrow joins the two nodes, in either direction. */
function touches(graph: FlowGraph, a: FlowNodeKey, b: FlowNodeKey): boolean {
  return graph.edges.some(edge => (edge.from === a && edge.to === b) || (edge.from === b && edge.to === a))
}

interface ScreenCardProps {
  node: FlowNode
  edges: FlowEdge[]
  nodeByKey: ReadonlyMap<FlowNodeKey, FlowNode>
  position: Point
  size: Size
  showHotspots: boolean
  viewport?: ScreenViewport
  dimmed: boolean
  mountRef: (element: HTMLDivElement | null) => void
  rowRef: (edgeKey: string, element: HTMLLIElement | null) => void
  onHover: (key: FlowNodeKey | undefined) => void
  onOpen: () => void
}

function ScreenCard({
  node,
  edges,
  nodeByKey,
  position,
  size,
  showHotspots,
  viewport,
  dimmed,
  mountRef,
  rowRef,
  onHover,
  onOpen,
}: ScreenCardProps) {
  const outgoing = edges.filter(edge => edge.from === node.key)
  const hasRows = rowCount(node, edges) > 0

  return (
    <article
      data-flow-node={node.key}
      aria-label={nodeName(node)}
      style={{ left: position.x, top: position.y, width: size.width, height: size.height }}
      className={cn(
        'absolute flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-sm transition-opacity',
        dimmed && 'opacity-40'
      )}
      onMouseEnter={() => onHover(node.key)}
      onMouseLeave={() => onHover(undefined)}
    >
      <header className='flex h-10 shrink-0 items-center gap-2 px-3'>
        <span className='truncate font-medium text-sm'>{node.screen.title}</span>
        {node.screen.variant !== DEFAULT_VARIANT && <Badge variant='outline'>{node.screen.variantLabel}</Badge>}
        {node.entry && <Badge variant='primary'>Entry</Badge>}
        {node.unreachable && <Badge variant='warning'>Unreachable</Badge>}
      </header>

      <div className='relative mx-2 overflow-hidden rounded-sm border border-border'>
        <ScreenThumbnail
          screen={node.screen}
          showHotspots={showHotspots}
          {...(viewport === undefined ? {} : { viewport })}
          mountRef={mountRef}
        />
        <button
          type='button'
          aria-label={`Open ${nodeName(node)}`}
          onClick={onOpen}
          className='absolute inset-0 cursor-pointer rounded-sm hover:bg-primary/5 focus-visible:ring-2 focus-visible:ring-ring'
        />
      </div>

      {hasRows && (
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
}
