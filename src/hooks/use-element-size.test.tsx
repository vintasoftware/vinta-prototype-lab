import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useElementSize } from './use-element-size'

/** Captures the observer the hook makes, so the test can say when the element resized. */
let resized: (() => void) | undefined
class FakeResizeObserver {
  constructor(callback: () => void) {
    resized = callback
  }
  observe() {}
  disconnect = vi.fn()
}

function Probe() {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} data-testid='box'>
      {size.width} × {size.height}
    </div>
  )
}

function sizeBox(element: HTMLElement, width: number, height: number) {
  Object.defineProperty(element, 'clientWidth', { configurable: true, value: width })
  Object.defineProperty(element, 'clientHeight', { configurable: true, value: height })
}

describe('useElementSize', () => {
  afterEach(() => {
    resized = undefined
  })

  it('measures the element and measures again when it resizes', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    render(<Probe />)
    const box = screen.getByTestId('box')
    expect(box).toHaveTextContent('0 × 0')

    sizeBox(box, 900, 600)
    act(() => resized?.())

    expect(box).toHaveTextContent('900 × 600')
  })
})
