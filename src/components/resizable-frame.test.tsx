import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ResizableFrame } from './resizable-frame'

function renderFrame(scale = 1) {
  const onResize = vi.fn()
  const onReset = vi.fn()
  const view = render(
    <ResizableFrame
      size={{ width: 800, height: 600 }}
      scale={scale}
      caption='800 × 600 · responsive · 100%'
      onResize={onResize}
      onReset={onReset}
    >
      <p>The screen</p>
    </ResizableFrame>
  )
  return { ...view, onResize, onReset }
}

function pointer(type: string, clientX: number, clientY: number) {
  window.dispatchEvent(new PointerEvent(type, { clientX, clientY, bubbles: true }))
}

describe('ResizableFrame', () => {
  it('draws the screen with the caption above it', () => {
    renderFrame()

    expect(screen.getByText('The screen')).toBeInTheDocument()
    expect(screen.getByText('800 × 600 · responsive · 100%')).toBeInTheDocument()
  })

  it('keeps room for the drawn size and scales the frame inside it', () => {
    const { container } = renderFrame(0.5)
    const sizer = container.firstElementChild as HTMLElement
    const scaled = screen.getByText('The screen').parentElement as HTMLElement

    expect(sizer.style.width).toBe('400px')
    expect(sizer.style.height).toBe('300px')
    expect(scaled.style.width).toBe('800px')
    expect(scaled.style.transform).toBe('scale(0.5)')
  })

  it('offers a focusable handle for the width, the height and both, each saying its value', () => {
    renderFrame()

    expect(screen.getByRole('separator', { name: 'Frame width' })).toHaveAttribute('aria-valuenow', '800')
    expect(screen.getByRole('separator', { name: 'Frame height' })).toHaveAttribute('aria-valuenow', '600')
    expect(screen.getByRole('separator', { name: 'Frame size' })).toHaveAttribute('aria-valuetext', '800 × 600')
    for (const handle of screen.getAllByRole('separator')) {
      expect(handle).toHaveAttribute('tabindex', '0')
    }
  })

  it('resizes while a handle is dragged, following the pointer on the window', () => {
    const { onResize } = renderFrame()

    fireEvent.pointerDown(screen.getByRole('separator', { name: 'Frame size' }), {
      button: 0,
      clientX: 100,
      clientY: 100,
    })
    pointer('pointermove', 150, 130)

    expect(onResize).toHaveBeenLastCalledWith({ width: 850, height: 630 })
  })

  it('stops following the pointer once it is let go', () => {
    const { onResize } = renderFrame()

    fireEvent.pointerDown(screen.getByRole('separator', { name: 'Frame width' }), { button: 0, clientX: 0, clientY: 0 })
    pointer('pointerup', 0, 0)
    pointer('pointermove', 300, 0)

    expect(onResize).not.toHaveBeenCalled()
  })

  it('stops following the pointer when it goes away mid-drag', () => {
    const { onResize, unmount } = renderFrame()

    fireEvent.pointerDown(screen.getByRole('separator', { name: 'Frame width' }), { button: 0, clientX: 0, clientY: 0 })
    unmount()
    pointer('pointermove', 300, 0)

    expect(onResize).not.toHaveBeenCalled()
  })

  it('resizes from the keyboard with a handle in focus', async () => {
    const { onResize } = renderFrame()

    screen.getByRole('separator', { name: 'Frame width' }).focus()
    await userEvent.keyboard('{ArrowRight}')
    expect(onResize).toHaveBeenLastCalledWith({ width: 810, height: 600 })

    await userEvent.keyboard('{Shift>}{ArrowLeft}{/Shift}')
    expect(onResize).toHaveBeenLastCalledWith({ width: 750, height: 600 })
  })

  it('resets on a double click on any handle', async () => {
    const { onReset } = renderFrame()

    await userEvent.dblClick(screen.getByRole('separator', { name: 'Frame height' }))

    expect(onReset).toHaveBeenCalledOnce()
  })
})
