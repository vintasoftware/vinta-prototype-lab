import { useCallback, useEffect, useState } from 'react'
import type { FrameSize } from '../lib/device-frame'

/**
 * The content box of an element, inside its padding, kept up to date as it resizes. The ref is a
 * callback, so an element that leaves and comes back (the stage, around the flow map or
 * presenting) is measured again.
 */
export function useElementSize<T extends HTMLElement>(): [(element: T | null) => void, FrameSize] {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState<FrameSize>({ width: 0, height: 0 })
  const ref = useCallback((next: T | null) => setElement(next), [])

  useEffect(() => {
    if (element === null) {
      return
    }
    // The observer reports once as soon as it starts observing, and again on every resize.
    const observer = new ResizeObserver(([entry]) => {
      if (entry === undefined) {
        return
      }
      const { width, height } = entry.contentRect
      setSize(previous => (previous.width === width && previous.height === height ? previous : { width, height }))
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [ref, size]
}
