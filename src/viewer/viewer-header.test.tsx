import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildPrototypes } from '../lib/discovery'
import { ViewerHeader, type ViewerHeaderProps } from './viewer-header'

const prototypes = buildPrototypes({
  docs: { '../../prototypes/booking/prototype.md': '---\ntitle: Booking\nentry: home\n---\n' },
  annotations: {},
  screens: { '../../prototypes/booking/screens/10-home.tsx': { default: () => null } },
})

function renderHeader(props: Partial<ViewerHeaderProps> = {}) {
  render(
    <ViewerHeader
      prototypes={prototypes}
      slug='booking'
      onOpenPrototype={vi.fn()}
      toggles={{ notes: true, hotspots: false, inspect: false, flow: false, screens: true, doc: true }}
      onToggle={vi.fn()}
      noteCount={0}
      canGoBack={false}
      onBack={vi.fn()}
      onRestart={vi.fn()}
      device={{
        frame: undefined,
        onFrame: vi.fn(),
        defaultSize: { width: 1280, height: 820 },
        defaultName: 'Desktop default',
        zoom: 'fit',
        onZoom: vi.fn(),
      }}
      {...props}
    />
  )
}

describe('ViewerHeader', () => {
  it('shows the viewport switcher and the device toolbar side by side', () => {
    renderHeader({ viewport: 'desktop', onViewportChange: vi.fn() })

    expect(screen.getByRole('tab', { name: 'Desktop' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByRole('combobox', { name: 'Device' })).toBeInTheDocument()
  })

  it('keeps the device toolbar when the switcher is turned off', () => {
    renderHeader()

    expect(screen.queryByRole('tab', { name: 'Desktop' })).not.toBeInTheDocument()
    expect(screen.getByRole('combobox', { name: 'Device' })).toBeInTheDocument()
  })

  it('offers presenting only when there is a screen to present', async () => {
    const onPresent = vi.fn()
    renderHeader({ onPresent })

    await userEvent.click(screen.getByRole('button', { name: 'Present the screen' }))

    expect(onPresent).toHaveBeenCalledOnce()
  })

  it('leaves the present button out without one', () => {
    renderHeader()

    expect(screen.queryByRole('button', { name: 'Present the screen' })).not.toBeInTheDocument()
  })
})
