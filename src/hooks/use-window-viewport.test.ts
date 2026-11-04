import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import { useWindowViewport } from './use-window-viewport'

const originalWidth = window.innerWidth

function resizeWindow(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width })
  window.dispatchEvent(new Event('resize'))
}

describe('useWindowViewport', () => {
  afterEach(() => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: originalWidth })
  })

  it("names the window's viewport and follows it while enabled", () => {
    resizeWindow(1180)
    const { result } = renderHook(() => useWindowViewport(true))
    expect(result.current).toBe('desktop')

    act(() => resizeWindow(820))
    expect(result.current).toBe('tablet')
  })

  it('stops following the window while disabled', () => {
    resizeWindow(1180)
    const { result } = renderHook(() => useWindowViewport(false))

    act(() => resizeWindow(390))
    expect(result.current).toBe('desktop')
  })
})
