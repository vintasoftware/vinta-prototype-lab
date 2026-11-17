import { useEffect, useState } from 'react'

/** The part of the page the person can see, in page pixels from the top of the layout viewport. */
export interface VisibleBox {
  top: number
  height: number
}

function readVisibleBox(): VisibleBox {
  const viewport = window.visualViewport
  return viewport ? { top: viewport.offsetTop, height: viewport.height } : { top: 0, height: window.innerHeight }
}

/**
 * The part of the page the person can see. On a tablet the browser bars and the on-screen keyboard
 * cover part of the window without resizing it, so `100vh` runs past what shows and the whole page
 * scrolls along with the screen. The viewer sizes itself to this box instead, and while it is
 * mounted the page itself never scrolls or bounces: the screen's own scroller is the only one.
 */
export function useVisibleBox(): VisibleBox {
  const [box, setBox] = useState(readVisibleBox)

  useEffect(() => {
    const update = () =>
      setBox(previous => {
        const next = readVisibleBox()
        return previous.top === next.top && previous.height === next.height ? previous : next
      })
    const viewport = window.visualViewport
    viewport?.addEventListener('resize', update)
    viewport?.addEventListener('scroll', update)
    window.addEventListener('resize', update)

    const root = document.documentElement
    const body = document.body
    const before = { root: root.style.overflow, body: body.style.overflow, overscroll: root.style.overscrollBehavior }
    root.style.overflow = 'hidden'
    body.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'

    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      root.style.overflow = before.root
      body.style.overflow = before.body
      root.style.overscrollBehavior = before.overscroll
    }
  }, [])

  return box
}
