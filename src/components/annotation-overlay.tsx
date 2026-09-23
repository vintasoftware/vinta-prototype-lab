import { X } from 'lucide-react'
import { type AnchorRect, overlayBox, overlayRing } from '../lib/anchor-rect'
import { ANNOTATION_KIND } from '../lib/annotation-kind'
import { OVERLAY_ATTRIBUTE } from '../lib/component-tree'
import { Markdown } from '../lib/markdown'
import type { Annotation } from '../types'
import { Badge, cn } from '../ui'

/** A note plus the number the viewer shows on its pin and in the notes list. */
export interface NumberedAnnotation extends Annotation {
  number: number
}

export interface AnnotationOverlayProps {
  notes: NumberedAnnotation[]
  rects: Map<string, AnchorRect>
  selectedId?: string
  onSelect: (id: string | undefined) => void
}

const CARD_WIDTH = 288
const PIN_SIZE = 24

/**
 * Draws the designers' comments on top of the screen: a ring around each commented element and a
 * numbered pin at its corner. It never touches the screen's own layout, so a prototype renders the
 * same with the overlay off.
 *
 * Its parent supplies the positioning context — the frame it measures against.
 */
export function AnnotationOverlay({ notes, rects, selectedId, onSelect }: AnnotationOverlayProps) {
  return (
    <div {...{ [OVERLAY_ATTRIBUTE]: '' }} className='pointer-events-none absolute inset-0 z-20'>
      {notes.map(note => {
        const rect = rects.get(note.target)
        if (rect === undefined) {
          return null
        }

        const kind = ANNOTATION_KIND[note.kind]
        const selected = note.id === selectedId

        return (
          <div key={note.id}>
            <div
              className={cn('prototype-anchor-ring', kind.ring, selected ? 'opacity-100' : 'opacity-70')}
              style={{ top: rect.top, height: rect.height, ...overlayRing(rect) }}
            />
            <button
              type='button'
              onClick={() => onSelect(selected ? undefined : note.id)}
              aria-label={`Note ${note.number}: ${note.title}`}
              className={cn(
                'pointer-events-auto absolute flex size-6 items-center justify-center rounded-full font-semibold text-xs shadow-sm',
                kind.pin,
                selected && 'ring-2 ring-foreground ring-offset-1'
              )}
              style={{ top: rect.top - 10, left: overlayBox(rect.left - 10, PIN_SIZE).left }}
            >
              {note.number}
            </button>
            {selected && <AnnotationCard note={note} rect={rect} onClose={() => onSelect(undefined)} />}
          </div>
        )
      })}
    </div>
  )
}

interface AnnotationCardProps {
  note: NumberedAnnotation
  rect: AnchorRect
  onClose: () => void
}

function AnnotationCard({ note, rect, onClose }: AnnotationCardProps) {
  const kind = ANNOTATION_KIND[note.kind]

  return (
    <div
      data-slot='annotation-card'
      className='pointer-events-auto absolute z-30 rounded-md border border-border bg-popover p-3 shadow-lg'
      style={{ top: rect.top + rect.height + 10, ...overlayBox(rect.left, CARD_WIDTH) }}
    >
      <div className='flex items-start justify-between gap-2'>
        <div className='flex items-center gap-2'>
          <span className={cn('size-2 rounded-full', kind.dot)} />
          <Badge variant='outline'>{kind.label}</Badge>
        </div>
        <button type='button' onClick={onClose} aria-label='Close note' className='text-muted-foreground'>
          <X className='size-4' />
        </button>
      </div>
      <p className='mt-2 font-semibold text-sm'>{note.title}</p>
      {note.body !== undefined && <Markdown source={note.body} className='text-muted-foreground' />}
      {note.author !== undefined && <p className='mt-2 text-muted-foreground text-xs'>— {note.author}</p>}
    </div>
  )
}
