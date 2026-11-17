import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { EXIT_BUTTON_DELAY_MS, PresentingStage } from './presenting-stage'

function renderStage(onExit = vi.fn(), size?: { width: number; height: number }) {
  const view = render(
    <PresentingStage box={{ top: 20, height: 700 }} size={size} onExit={onExit}>
      <h1>Visit note</h1>
    </PresentingStage>
  )
  return { ...view, onExit }
}

describe('PresentingStage', () => {
  it('fills the visible part of the page with the screen', () => {
    const { container } = renderStage()
    const stage = container.firstElementChild as HTMLElement

    expect(screen.getByRole('heading', { name: 'Visit note' })).toBeInTheDocument()
    expect(stage.style.top).toBe('20px')
    expect(stage.style.height).toBe('700px')
  })

  it('fills the window with the screen when given no size', () => {
    renderStage()

    expect(screen.queryByTestId('presenting-frame')).not.toBeInTheDocument()
  })

  it('keeps the size it is given, at full scale while the window is larger', () => {
    renderStage(vi.fn(), { width: 390, height: 844 })
    const frame = screen.getByTestId('presenting-frame')

    expect(frame.style.width).toBe('390px')
    expect(frame.style.height).toBe('844px')
    expect(within(frame).getByRole('heading', { name: 'Visit note' })).toBeInTheDocument()
  })

  it('scales a frame larger than the window down to fit it', () => {
    let report: ((size: { width: number; height: number }) => void) | undefined
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(callback: (entries: { contentRect: { width: number; height: number } }[]) => void) {
          report = contentRect => callback([{ contentRect }])
        }
        observe() {}
        disconnect() {}
      }
    )
    renderStage(vi.fn(), { width: 1440, height: 900 })

    act(() => report?.({ width: 720, height: 450 }))

    const frame = screen.getByTestId('presenting-frame')
    expect(frame.style.width).toBe('720px')
    expect(frame.style.height).toBe('450px')
  })

  it('stops presenting from its button', async () => {
    const { onExit } = renderStage()

    await userEvent.click(screen.getByRole('button', { name: 'Stop presenting' }))

    expect(onExit).toHaveBeenCalledOnce()
  })

  it('hides the button after a moment and brings it back on a touch', () => {
    vi.useFakeTimers()
    renderStage()
    const button = screen.getByRole('button', { name: 'Stop presenting' })
    expect(button).toHaveClass('opacity-90')

    act(() => vi.advanceTimersByTime(EXIT_BUTTON_DELAY_MS))
    expect(button).toHaveClass('opacity-0', 'pointer-events-none')

    // userEvent never settles under fake timers here, so the touch is fired directly.
    fireEvent.pointerDown(screen.getByRole('heading', { name: 'Visit note' }))
    expect(button).toHaveClass('opacity-90')

    act(() => vi.advanceTimersByTime(EXIT_BUTTON_DELAY_MS - 1))
    expect(button).toHaveClass('opacity-90')
  })
})
