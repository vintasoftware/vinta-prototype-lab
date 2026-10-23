import { act, fireEvent, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { useKeyHeld } from './use-key-held'

describe('useKeyHeld', () => {
  it('is on while the key is down, and lets go on key up or when the window loses focus', () => {
    const { result } = renderHook(() => useKeyHeld('Alt'))

    act(() => {
      fireEvent.keyDown(window, { key: 'Alt' })
    })
    expect(result.current).toBe(true)
    act(() => {
      fireEvent.keyUp(window, { key: 'Alt' })
    })
    expect(result.current).toBe(false)

    act(() => {
      fireEvent.keyDown(window, { key: 'Alt' })
      fireEvent.blur(window)
    })
    expect(result.current).toBe(false)
  })

  it('ignores other keys', () => {
    const { result } = renderHook(() => useKeyHeld('Alt'))

    act(() => {
      fireEvent.keyDown(window, { key: 'Shift' })
    })

    expect(result.current).toBe(false)
  })
})
