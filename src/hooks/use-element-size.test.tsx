import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useElementSize } from './use-element-size'

/** Captures the observer the hook makes, so the test can report a size the way a browser does. */
let report: ((size: { width: number; height: number }) => void) | undefined
class FakeResizeObserver {
  constructor(callback: (entries: { contentRect: { width: number; height: number } }[]) => void) {
    report = contentRect => callback([{ contentRect }])
  }
  observe() {}
  disconnect() {}
}

function Probe() {
  const [ref, size] = useElementSize<HTMLDivElement>()
  return (
    <div ref={ref} data-testid='box'>
      {size.width} × {size.height}
    </div>
  )
}

describe('useElementSize', () => {
  afterEach(() => {
    report = undefined
  })

  it("follows the element's content box as the observer reports it", () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver)
    render(<Probe />)
    const box = screen.getByTestId('box')
    expect(box).toHaveTextContent('0 × 0')

    act(() => report?.({ width: 900, height: 600 }))
    expect(box).toHaveTextContent('900 × 600')

    act(() => report?.({ width: 700, height: 600 }))
    expect(box).toHaveTextContent('700 × 600')
  })
})
