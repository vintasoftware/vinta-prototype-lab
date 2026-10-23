import { act, fireEvent, render, screen } from '@testing-library/react'
import { createRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { PresentingStage } from './presenting-stage'

function renderStage() {
  const onExit = vi.fn()
  render(
    <PresentingStage viewport='mobile' frameRef={createRef()} onExit={onExit} box={{ top: 0, height: 700 }}>
      <h1>The screen</h1>
    </PresentingStage>
  )
  return { onExit }
}

describe('PresentingStage', () => {
  it('shows only the screen and the way out', () => {
    renderStage()

    expect(screen.getByRole('heading', { name: 'The screen' }).parentElement).toHaveAttribute('data-viewport', 'mobile')
    expect(screen.getByRole('button', { name: 'Stop presenting' })).toBeInTheDocument()
  })

  it('leaves on Esc and on the button', () => {
    const { onExit } = renderStage()

    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: 'Stop presenting' }))

    expect(onExit).toHaveBeenCalledTimes(2)
  })

  it('hides the way out after a moment and brings it back on a touch', () => {
    vi.useFakeTimers()
    renderStage()
    const button = screen.getByRole('button', { name: 'Stop presenting' })

    act(() => vi.advanceTimersByTime(2600))
    expect(button).toHaveClass('opacity-0')

    fireEvent.pointerDown(window)
    expect(button).toHaveClass('opacity-90')
  })
})
