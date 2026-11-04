import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useVisibleBox } from './use-visible-box'

const original = Object.getOwnPropertyDescriptor(window, 'visualViewport')

/** A visual viewport the test can move, the way a tablet's keyboard and browser bars do. */
function fakeVisualViewport(box: { offsetTop: number; height: number }) {
  const viewport = Object.assign(new EventTarget(), box)
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
  return viewport
}

describe('useVisibleBox', () => {
  afterEach(() => {
    if (original === undefined) {
      Reflect.deleteProperty(window, 'visualViewport')
    } else {
      Object.defineProperty(window, 'visualViewport', original)
    }
  })

  it('follows the visible part of the page as it moves and shrinks', () => {
    const viewport = fakeVisualViewport({ offsetTop: 0, height: 1180 })
    const { result } = renderHook(() => useVisibleBox())
    expect(result.current).toEqual({ top: 0, height: 1180 })

    // The keyboard opens: the visible part shrinks to the top of it.
    act(() => {
      Object.assign(viewport, { offsetTop: 40, height: 700 })
      viewport.dispatchEvent(new Event('resize'))
    })
    expect(result.current).toEqual({ top: 40, height: 700 })
  })

  it('falls back to the window height in a browser with no visual viewport', () => {
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined })
    const { result } = renderHook(() => useVisibleBox())

    expect(result.current).toEqual({ top: 0, height: window.innerHeight })
  })

  it('stops the page itself from scrolling while mounted, and gives the page back after', () => {
    document.documentElement.style.overflow = 'scroll'
    const { unmount } = renderHook(() => useVisibleBox())

    expect(document.documentElement.style.overflow).toBe('hidden')
    expect(document.body.style.overflow).toBe('hidden')
    expect(document.documentElement.style.overscrollBehavior).toBe('none')

    unmount()
    expect(document.documentElement.style.overflow).toBe('scroll')
    expect(document.body.style.overflow).toBe('')
    expect(document.documentElement.style.overscrollBehavior).toBe('')
    document.documentElement.style.overflow = ''
  })
})
