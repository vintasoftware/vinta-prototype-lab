import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NO_NAVIGATION, PrototypeRuntime, type ScreenNavigation } from './prototype-runtime'
import { Hotspot, ScreenLink } from './screen-link'

function renderWithRuntime(ui: React.ReactNode, overrides: Partial<ScreenNavigation> = {}) {
  const goToScreen = vi.fn()
  render(<PrototypeRuntime value={{ ...NO_NAVIGATION, goToScreen, ...overrides }}>{ui}</PrototypeRuntime>)
  return { goToScreen }
}

describe('ScreenLink', () => {
  it('opens the screen it names', async () => {
    const { goToScreen } = renderWithRuntime(<ScreenLink to='review'>Book a visit</ScreenLink>)

    await userEvent.click(screen.getByRole('button', { name: 'Book a visit' }))

    expect(goToScreen).toHaveBeenCalledWith('review', undefined)
  })

  it('opens a named state of that screen', async () => {
    const { goToScreen } = renderWithRuntime(
      <ScreenLink to='choose-time' variant='no-slots'>
        Next week
      </ScreenLink>
    )

    await userEvent.click(screen.getByRole('button', { name: 'Next week' }))

    expect(goToScreen).toHaveBeenCalledWith('choose-time', { variant: 'no-slots' })
  })

  it('carries a semantic id so a comment can point at the link', () => {
    renderWithRuntime(
      <ScreenLink to='home' anchorId='reschedule-link'>
        Reschedule
      </ScreenLink>
    )

    expect(screen.getByRole('button', { name: 'Reschedule' })).toHaveAttribute('data-proto-id', 'reschedule-link')
  })
})

describe('Hotspot', () => {
  it('navigates when clicked', async () => {
    const { goToScreen } = renderWithRuntime(<Hotspot to='choose-time' variant='no-slots' label='Next week' />)

    await userEvent.click(screen.getByRole('button', { name: 'Next week' }))

    expect(goToScreen).toHaveBeenCalledWith('choose-time', { variant: 'no-slots' })
  })

  it('covers its parent, so it stays on its target at every viewport', () => {
    renderWithRuntime(<Hotspot to='home' label='Next week' />)

    const hotspot = screen.getByRole('button', { name: 'Next week' })

    expect(hotspot).toHaveClass('inset-0')
    expect(hotspot.getAttribute('style')).toBeNull()
  })

  it('covers the part of the parent it was given', () => {
    renderWithRuntime(
      <Hotspot to='home' label='Chart peak' area={{ top: '10%', left: '40%', width: '20%', height: '30%' }} />
    )

    const hotspot = screen.getByRole('button', { name: 'Chart peak' })

    expect(hotspot).not.toHaveClass('inset-0')
    expect(hotspot).toHaveStyle({ top: '10%', left: '40%', width: '20%', height: '30%' })
  })

  it('stays hidden until the viewer reveals hotspots', () => {
    renderWithRuntime(<Hotspot to='home' label='Next week' />)

    expect(screen.getByRole('button', { name: 'Next week' })).toHaveAttribute('data-visible', 'false')
  })

  it('shows itself when the viewer reveals hotspots', () => {
    renderWithRuntime(<Hotspot to='home' label='Next week' />, { showHotspots: true })

    expect(screen.getByRole('button', { name: 'Next week' })).toHaveAttribute('data-visible', 'true')
  })
})
