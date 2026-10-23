import { type RefObject, useMemo } from 'react'
import { AnnotationOverlay, type NumberedAnnotation } from '../../components/annotation-overlay'
import { useAnchorRects } from '../../hooks/use-anchor-rects'
import { useComponentTree } from '../../hooks/use-component-tree'

export interface FramePinsProps {
  /** The element the frame's screen renders into. Pins are measured against it. */
  mountRef: RefObject<HTMLDivElement | null>
  notes: readonly NumberedAnnotation[]
  selectedId: string | undefined
  /** A pin clicked, or `undefined` when its open note is closed. */
  onSelect: (note: NumberedAnnotation | undefined) => void
  /** Changes when the frame shows another screen, so the pins are measured again. */
  revision: string
}

/**
 * The comment pins of one frame, found and drawn the way the stage finds and draws them. The frame
 * is zoomed by the canvas; the measuring already corrects for a scaled frame.
 */
export function FramePins({ mountRef, notes, selectedId, onSelect, revision }: FramePinsProps) {
  const tree = useComponentTree(mountRef, revision)
  const targets = useMemo(() => notes.map(note => note.target), [notes])
  const rects = useAnchorRects(mountRef, targets, tree, revision)
  const byId = useMemo(() => new Map(notes.map(note => [note.id, note])), [notes])

  return (
    <AnnotationOverlay
      notes={[...notes]}
      rects={rects}
      {...(selectedId === undefined ? {} : { selectedId })}
      onSelect={id => onSelect(id === undefined ? undefined : byId.get(id))}
      steadyPins
    />
  )
}
