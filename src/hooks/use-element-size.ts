import { type RefObject, useEffect, useState } from 'react'
import type { FrameSize } from '../lib/device-frame'

const UNMEASURED: FrameSize = { width: 0, height: 0 }

/**
 * The inner size of an element, kept up to date as it resizes. Zero until it is measured, and while
 * `enabled` is off or the element is not in the page.
 */
export function useElementSize(ref: RefObject<HTMLElement | null>, enabled = true): FrameSize {
  const [size, setSize] = useState(UNMEASURED)

  useEffect(() => {
    const element = ref.current
    if (!enabled || element === null) {
      return
    }
    // Only a real change updates the state, so a render that changes nothing does not loop.
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
  }, [ref, enabled])

  return size
}
