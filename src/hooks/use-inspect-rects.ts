import { type RefObject, useCallback, useEffect, useState } from 'react'
import { type AnchorRect, measureAnchor } from '../lib/anchor-rect'

export interface InspectRects {
  selected?: AnchorRect
  hovered?: AnchorRect
}

/**
 * Boxes of the picked and hovered elements, in the frame's coordinates, so the inspect overlay can
 * outline them without touching the screen's own layout.
 */
export function useInspectRects(
  frameRef: RefObject<HTMLElement | null>,
  selected: Element | undefined,
  hovered: Element | undefined,
  revision: string
): InspectRects {
  const [rects, setRects] = useState<InspectRects>({})

  const measure = useCallback(() => {
    const frame = frameRef.current
    if (frame === null) {
      setRects({})
      return
    }

    const selectedRect = selected === undefined ? undefined : measureAnchor(selected, frame)
    const hoveredRect = hovered === undefined ? undefined : measureAnchor(hovered, frame)

    setRects({
      ...(selectedRect === undefined ? {} : { selected: selectedRect }),
      ...(hoveredRect === undefined ? {} : { hovered: hoveredRect }),
    })
  }, [frameRef, hovered, selected])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` changes when the screen on stage does, and the effect has to measure again then.
  useEffect(() => {
    const frame = frameRef.current
    if (frame === null) {
      return
    }

    measure()
    const raf = requestAnimationFrame(measure)

    const observer = new ResizeObserver(measure)
    observer.observe(frame)
    window.addEventListener('resize', measure)
    frame.addEventListener('scroll', measure, true)

    return () => {
      cancelAnimationFrame(raf)
      observer.disconnect()
      window.removeEventListener('resize', measure)
      frame.removeEventListener('scroll', measure, true)
    }
  }, [frameRef, measure, revision])

  return rects
}
