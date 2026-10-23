import { AlertTriangle, ArrowRight, MessageSquare, Undo2 } from 'lucide-react'
import { type KeyboardEvent, memo, useRef } from 'react'
import type { NumberedAnnotation } from '../../components/annotation-overlay'
import { ScreenThumbnail } from '../../components/screen-thumbnail'
import type { CanvasFrameBox } from '../../lib/canvas-layout'
import { DEFAULT_VARIANT } from '../../lib/constants'
import type { FrameSize } from '../../lib/device-frame'
import { edgeKey, HEADER_HEIGHT, rowCount } from '../../lib/flow-drawing'
import type { FlowControl, FlowEdge, FlowNode, FlowNodeKey } from '../../lib/flow-graph'
import { Badge, cn } from '../../ui'
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

export interface CanvasFrameProps {
  node: FlowNode
  box: CanvasFrameBox
  /** The size the screen renders at, before the canvas zoom. */
  frameSize: FrameSize
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
  frameRef: (key: FlowNodeKey, element: HTMLElement | null) => void
  mountRef: (key: FlowNodeKey, element: HTMLDivElement | null) => void
  rowRef: (edgeKey: string, element: HTMLLIElement | null) => void
  onSelect: (node: FlowNode) => void
  onOpen: (node: FlowNode) => void
  onHover: (key: FlowNodeKey | undefined) => void
  onKeyDown: (node: FlowNode, event: KeyboardEvent<HTMLButtonElement>) => void
}

/**
 * One screen state on the canvas: a title, the real screen at its own size, and a row for each
 * place its controls lead. The screen is inert; the button over it is the frame's one control, so
 * Tab reaches every frame, a click selects it and a double click or Enter opens it on the stage.
 */
export const CanvasFrame = memo(function CanvasFrame({
  node,
  box,
  frameSize,
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
  onOpen,
  onHover,
  onKeyDown,
}: CanvasFrameProps) {
  const outgoing = edges.filter(edge => edge.from === node.key)
  const name = nodeName(node)
  const mount = useRef<HTMLDivElement | null>(null)

  return (
    <article
      ref={element => frameRef(node.key, element)}
      {...{ [FRAME_ATTRIBUTE]: node.key }}
      data-flow-node={node.key}
      aria-label={name}
      style={{
        left: box.x,
        top: box.y,
        width: box.width,
        height: box.height,
        ...(selected ? { outlineWidth: 'calc(3px * var(--canvas-label-scale, 1))' } : {}),
      }}
      className={cn(
        'pointer-events-auto absolute flex flex-col rounded-lg border border-border bg-card shadow-sm transition-opacity',
        selected && 'outline outline-primary',
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
            mounted ? 'bottom-0 origin-bottom-left' : 'top-0 origin-top-left'
          )}
          style={{
            height: HEADER_HEIGHT,
            width: `calc(100% / ${TITLE_SCALE[mounted ? 'drawn' : 'card']})`,
            transform: `scale(${TITLE_SCALE[mounted ? 'drawn' : 'card']})`,
          }}
        >
          <span className='truncate font-medium text-sm'>{node.screen.title}</span>
          {node.screen.variant !== DEFAULT_VARIANT && <Badge variant='outline'>{node.screen.variantLabel}</Badge>}
          {node.entry && <Badge variant='primary'>Entry</Badge>}
          {node.unreachable && <Badge variant='warning'>Unreachable</Badge>}
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
        style={{ width: frameSize.width + 2, height: frameSize.height + 2, contain: 'strict' }}
      >
        {mounted ? (
          <ScreenThumbnail
            screen={node.screen}
            showHotspots={showHotspots}
            size={frameSize}
            scale={1}
            mountRef={element => {
              mount.current = element
              mountRef(node.key, element)
            }}
          />
        ) : (
          <div aria-hidden='true' className='size-full bg-muted' />
        )}
        <button
          type='button'
          aria-label={name}
          aria-pressed={selected}
          onClick={() => onSelect(node)}
          onDoubleClick={() => onOpen(node)}
          onFocus={() => onSelect(node)}
          onKeyDown={event => onKeyDown(node, event)}
          className='absolute inset-0 cursor-default rounded-sm outline-none hover:bg-primary/5 focus-visible:bg-primary/5'
        />
        {mounted && notes.length > 0 && (
          <FramePins
            mountRef={mount}
            notes={notes}
            selectedId={selectedNoteId}
            onSelect={note => onPin(node, note)}
            revision={node.key}
          />
        )}
      </div>

      {rowCount(node, edges) > 0 && (
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
