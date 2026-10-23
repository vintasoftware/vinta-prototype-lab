import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { PrototypeScreen } from '../types'
import { NO_NAVIGATION, useScreenNavigation } from './prototype-runtime'
import { ScreenThumbnail } from './screen-thumbnail'

function Home() {
  const { goToScreen } = useScreenNavigation()
  return (
    <button type='button' className='animate-pulse' onClick={() => goToScreen('review')}>
      Book a visit
    </button>
  )
}

const home: PrototypeScreen = {
  id: 'home',
  title: 'Home',
  variant: 'default',
  variantLabel: 'Default',
  viewport: 'mobile',
  order: 10,
  Component: Home,
  source: '',
}

describe('ScreenThumbnail', () => {
  it('draws the screen out of reach, shrunk by the viewport factor, with its animations off', () => {
    const { container } = render(<ScreenThumbnail screen={home} showHotspots={false} />)
    const outer = container.firstElementChild

    expect(outer).toHaveAttribute('inert')
    expect(outer).toHaveAttribute('aria-hidden', 'true')
    expect(outer).toHaveClass('[&_*]:animate-none!')
    expect(outer).toHaveStyle({ width: '195px', height: '422px' })
  })

  it('draws the screen at the size and scale it is given', () => {
    render(<ScreenThumbnail screen={home} showHotspots={false} size={{ width: 1280, height: 820 }} scale={1} />)

    expect(screen.getByRole('button', { hidden: true }).closest('[data-viewport]')).toHaveStyle({
      width: '1280px',
      height: '820px',
      transform: 'scale(1)',
    })
  })

  it('clicks through on the navigation it is given, live', async () => {
    const goToScreen = vi.fn()
    const { container } = render(
      <ScreenThumbnail screen={home} showHotspots={false} navigation={{ ...NO_NAVIGATION, goToScreen }} />
    )

    expect(container.firstElementChild).not.toHaveAttribute('inert')
    await userEvent.click(screen.getByRole('button', { name: 'Book a visit' }))

    expect(goToScreen).toHaveBeenCalledWith('review')
  })
})
