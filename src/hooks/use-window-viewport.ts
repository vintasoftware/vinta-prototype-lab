import { useEffect, useState } from 'react'
import { viewportOfWidth } from '../lib/device-frame'
import type { ScreenViewport } from '../types'

/** The viewport family of the window itself, kept up to date while `enabled`, for presenting. */
export function useWindowViewport(enabled: boolean): ScreenViewport {
  const [width, setWidth] = useState(() => window.innerWidth)

  useEffect(() => {
    if (!enabled) {
      return
    }
    const update = () => setWidth(window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [enabled])

  return viewportOfWidth(width)
}
