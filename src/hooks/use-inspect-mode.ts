import { type RefObject, useEffect } from 'react'
import { OVERLAY_ATTRIBUTE } from '../lib/component-tree'

export interface UseInspectModeOptions {
  frameRef: RefObject<HTMLElement | null>
  enabled: boolean
  /** The element a person clicked, for the tree to select. */
  onPick: (element: Element) => void
  /** The element under the pointer, for the tree to highlight. */
  onHover: (element: Element | undefined) => void
}

/**
 * Turns clicks on the screen into picks in the tree.
 *
 * The listeners run in the capture phase, ahead of React's own, so a click reaches the tree instead
 * of the prototype's navigation — inspecting a button must not follow the link on it. Clicks on the
 * viewer's overlays are left alone, so comment pins stay clickable while inspecting.
 */
export function useInspectMode({ frameRef, enabled, onPick, onHover }: UseInspectModeOptions): void {
  useEffect(() => {
    const frame = frameRef.current
    if (frame === null || !enabled) {
      return
    }

    const isOverlay = (target: EventTarget | null) =>
      target instanceof Element && target.closest(`[${OVERLAY_ATTRIBUTE}]`) !== null

    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element) || isOverlay(event.target)) {
        return
      }
      event.preventDefault()
      event.stopPropagation()
      onPick(event.target)
    }

    const onPointerOver = (event: PointerEvent) => {
      if (!(event.target instanceof Element) || isOverlay(event.target)) {
        return
      }
      onHover(event.target)
    }

    const onPointerLeave = () => onHover(undefined)

    frame.addEventListener('click', onClick, true)
    frame.addEventListener('pointerover', onPointerOver, true)
    frame.addEventListener('pointerleave', onPointerLeave)

    return () => {
      frame.removeEventListener('click', onClick, true)
      frame.removeEventListener('pointerover', onPointerOver, true)
      frame.removeEventListener('pointerleave', onPointerLeave)
      onHover(undefined)
    }
  }, [enabled, frameRef, onHover, onPick])
}
