import { type RefObject, useCallback, useEffect, useState } from 'react'
import { type AnchorRect, measureAnchor } from '../lib/anchor-rect'
import { resolveAnnotationTarget } from '../lib/annotation-target'
import type { ComponentTree } from '../lib/component-tree'

/**
 * Positions of every element a comment points at, keyed by target.
 *
 * The overlay draws on top of the screen rather than inside it, so it needs the boxes measured from
 * the live DOM. Measuring runs again whenever the screen changes, whenever the frame resizes, and
 * whenever the screen scrolls, which covers what moves an element in practice.
 */
export function useAnchorRects(
  frameRef: RefObject<HTMLElement | null>,
  targets: readonly string[],
  tree: ComponentTree,
  revision: string
): Map<string, AnchorRect> {
  const [rects, setRects] = useState<Map<string, AnchorRect>>(() => new Map())

  const measure = useCallback(() => {
    const frame = frameRef.current
    if (frame === null) {
      setRects(new Map())
      return
    }

    const found = new Map<string, AnchorRect>()
    for (const target of targets) {
      const element = resolveAnnotationTarget(frame, tree, target)
      const rect = element === undefined ? undefined : measureAnchor(element, frame)
      if (rect !== undefined) {
        found.set(target, rect)
      }
    }
    setRects(found)
  }, [frameRef, targets, tree])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` changes when the screen on stage does, and the effect has to measure again then.
  useEffect(() => {
    const frame = frameRef.current
    if (frame === null) {
      // No stage right now — the map is open — so nothing from the last screen may linger.
      measure()
      return
    }

    // Two passes: one now, one after the browser has laid out fonts and images.
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
    // `revision` re-runs the effect when the screen on stage changes.
  }, [frameRef, measure, revision])

  return rects
}
