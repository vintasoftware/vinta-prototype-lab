import { type RefObject, useCallback, useEffect, useRef, useState } from 'react'

/** Attribute a watched element carries, naming the key it reports under. */
export const VISIBLE_KEY_ATTRIBUTE = 'data-visible-key'

export interface VisibleFrames {
  /** Keys of the elements inside the viewport, or within the margin around it. */
  visible: ReadonlySet<string>
  /** Starts or stops watching one element. Pass it as a ref callback, with the element's key. */
  watch: (key: string, element: Element | null) => void
}

/**
 * Which frames are in view, so only those draw their screens. An `IntersectionObserver` on the
 * frames' cards does the work, with the viewport as its root and a margin around it, so a frame is
 * already drawn when a pan brings it in.
 */
export function useVisibleFrames(viewportRef: RefObject<HTMLElement | null>, margin = '50%'): VisibleFrames {
  const [visible, setVisible] = useState<ReadonlySet<string>>(() => new Set())
  const observer = useRef<IntersectionObserver | undefined>(undefined)
  const watched = useRef(new Map<string, Element>())

  useEffect(() => {
    const root = viewportRef.current
    if (root === null || typeof IntersectionObserver === 'undefined') {
      // No observer to ask, as in a test environment: every frame counts as in view.
      setVisible(new Set(watched.current.keys()))
      return
    }

    const created = new IntersectionObserver(
      entries => {
        setVisible(current => {
          const next = new Set(current)
          for (const entry of entries) {
            const key = entry.target.getAttribute(VISIBLE_KEY_ATTRIBUTE)
            if (key === null) {
              continue
            }
            if (entry.isIntersecting) {
              next.add(key)
            } else {
              next.delete(key)
            }
          }
          return next.size === current.size && [...next].every(key => current.has(key)) ? current : next
        })
      },
      { root, rootMargin: margin }
    )
    observer.current = created
    for (const element of watched.current.values()) {
      created.observe(element)
    }
    return () => {
      created.disconnect()
      observer.current = undefined
    }
  }, [viewportRef, margin])

  const watch = useCallback((key: string, element: Element | null) => {
    const previous = watched.current.get(key)
    if (previous === element) {
      return
    }
    if (previous !== undefined) {
      observer.current?.unobserve(previous)
      watched.current.delete(key)
    }
    if (element !== null) {
      element.setAttribute(VISIBLE_KEY_ATTRIBUTE, key)
      watched.current.set(key, element)
      if (observer.current === undefined) {
        // Without an observer every frame counts as in view.
        setVisible(current => (current.has(key) ? current : new Set([...current, key])))
      } else {
        observer.current.observe(element)
      }
    }
  }, [])

  return { visible, watch }
}
