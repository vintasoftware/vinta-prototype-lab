import { useCallback, useEffect, useState } from 'react'
import type { FrameSize } from '../lib/device-frame'

/**
 * The inner size of an element, kept up to date as it resizes. The ref is a callback, so an element
 * that leaves and comes back (the stage, around the flow map or presenting) is measured again.
 */
export function useElementSize<T extends HTMLElement>(): [(element: T | null) => void, FrameSize] {
  const [element, setElement] = useState<T | null>(null)
  const [size, setSize] = useState<FrameSize>({ width: 0, height: 0 })
  const ref = useCallback((next: T | null) => setElement(next), [])

  useEffect(() => {
    if (element === null) {
      return
    }
    const update = () =>
      setSize(previous =>
        previous.width === element.clientWidth && previous.height === element.clientHeight
          ? previous
          : { width: element.clientWidth, height: element.clientHeight }
      )
    update()
    const observer = new ResizeObserver(update)
    observer.observe(element)
    return () => observer.disconnect()
  }, [element])

  return [ref, size]
}
