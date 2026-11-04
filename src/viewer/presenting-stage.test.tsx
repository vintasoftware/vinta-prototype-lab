import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { EXIT_BUTTON_DELAY_MS, PresentingStage } from './presenting-stage'

function renderStage(onExit = vi.fn()) {
  const view = render(
    <PresentingStage box={{ top: 20, height: 700 }} onExit={onExit}>
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

  it('stops presenting from its button', () => {
    const { onExit } = renderStage()

    fireEvent.click(screen.getByRole('button', { name: 'Stop presenting' }))

    expect(onExit).toHaveBeenCalledOnce()
  })

  it('hides the button after a moment and brings it back on a touch', () => {
    vi.useFakeTimers()
    renderStage()
    const button = screen.getByRole('button', { name: 'Stop presenting' })
    expect(button).toHaveClass('opacity-90')

    act(() => vi.advanceTimersByTime(EXIT_BUTTON_DELAY_MS))
    expect(button).toHaveClass('opacity-0', 'pointer-events-none')

    act(() => {
      window.dispatchEvent(new PointerEvent('pointerdown'))
    })
    expect(button).toHaveClass('opacity-90')

    act(() => vi.advanceTimersByTime(EXIT_BUTTON_DELAY_MS - 1))
    expect(button).toHaveClass('opacity-90')
  })
})
