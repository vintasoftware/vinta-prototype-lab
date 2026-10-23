import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { ResizableFrame } from './resizable-frame'

function renderFrame(scale = 1) {
  const onResize = vi.fn()
  const onReset = vi.fn()
  render(
    <ResizableFrame
      size={{ width: 400, height: 800 }}
      scale={scale}
      caption='400 × 800 · responsive · 100%'
      onResize={onResize}
      onReset={onReset}
    >
      <p>The screen</p>
    </ResizableFrame>
  )
  return { onResize, onReset }
}

describe('ResizableFrame', () => {
  it('shows the screen with its caption', () => {
    renderFrame()

    expect(screen.getByText('The screen')).toBeInTheDocument()
    expect(screen.getByText('400 × 800 · responsive · 100%')).toBeInTheDocument()
  })

  it('takes the drawn size of the zoomed frame and scales the screen to it', () => {
    renderFrame(0.5)

    const sizer = screen.getByText('The screen').parentElement?.parentElement
    expect(sizer).toHaveStyle({ width: '200px', height: '400px' })
    expect(screen.getByText('The screen').parentElement).toHaveStyle({ transform: 'scale(0.5)' })
  })

  it('changes the width while the side handle is dragged, until the pointer is let go', () => {
    const { onResize } = renderFrame()
    const handle = screen.getByRole('separator', { name: 'Drag to change the width' })

    fireEvent.pointerDown(handle, { clientX: 100, clientY: 100 })
    fireEvent.pointerMove(window, { clientX: 150, clientY: 400 })
    expect(onResize).toHaveBeenLastCalledWith({ width: 450, height: 800 })

    fireEvent.pointerUp(window)
    fireEvent.pointerMove(window, { clientX: 300, clientY: 100 })
    expect(onResize).toHaveBeenCalledTimes(1)
  })

  it('changes both sides on the corner handle, in frame pixels when zoomed out', () => {
    const { onResize } = renderFrame(0.5)
    const handle = screen.getByRole('separator', { name: 'Drag to change the size' })

    fireEvent.pointerDown(handle, { clientX: 0, clientY: 0 })
    fireEvent.pointerMove(window, { clientX: 25, clientY: 50 })

    expect(onResize).toHaveBeenLastCalledWith({ width: 450, height: 900 })
  })

  it('resets on a double click on a handle', () => {
    const { onReset } = renderFrame()

    fireEvent.doubleClick(screen.getByRole('separator', { name: 'Drag to change the height' }))

    expect(onReset).toHaveBeenCalled()
  })

  it('resizes from the keyboard on a focused handle', () => {
    const { onResize } = renderFrame()

    fireEvent.keyDown(screen.getByRole('separator', { name: 'Drag to change the width' }), { key: 'ArrowRight' })

    expect(onResize).toHaveBeenLastCalledWith({ width: 410, height: 800 })
  })
})
