import { useEffect, useState } from 'react'

/** The part of the page the person can see, in page pixels. */
export interface VisibleBox {
  top: number
  height: number
}

function readVisibleBox(): VisibleBox {
  const viewport = window.visualViewport
  return viewport ? { top: viewport.offsetTop, height: viewport.height } : { top: 0, height: window.innerHeight }
}

/**
 * The visible part of the page, kept up to date. On a tablet the browser bars and the on-screen
 * keyboard cover part of the window without resizing it, so the viewer sizes itself to this box.
 * While it is in use the page itself never scrolls or bounces: the screen's own scroller is the
 * only one.
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
    const previous = {
      rootOverflow: root.style.overflow,
      bodyOverflow: document.body.style.overflow,
      rootOverscroll: root.style.overscrollBehavior,
    }
    root.style.overflow = 'hidden'
    document.body.style.overflow = 'hidden'
    root.style.overscrollBehavior = 'none'

    return () => {
      viewport?.removeEventListener('resize', update)
      viewport?.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      root.style.overflow = previous.rootOverflow
      document.body.style.overflow = previous.bodyOverflow
      root.style.overscrollBehavior = previous.rootOverscroll
    }
  }, [])

  return box
}
