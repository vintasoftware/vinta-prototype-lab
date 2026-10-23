import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SLIDE_DURATION_MS, SlidePanel } from './slide-panel'

function Panel({ open }: { open: boolean }) {
  return (
    <SlidePanel open={open} side='right' widthClass='w-96'>
      <aside aria-label='Doc'>Doc</aside>
    </SlidePanel>
  )
}

describe('SlidePanel', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('keeps a closing panel drawn until it has slid away, hidden from assistive technology meanwhile', () => {
    const { rerender } = render(<Panel open />)
    expect(screen.getByRole('complementary', { name: 'Doc' })).toBeInTheDocument()

    rerender(<Panel open={false} />)
    expect(screen.queryByRole('complementary', { name: 'Doc' })).not.toBeInTheDocument()
    expect(screen.getByText('Doc')).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(SLIDE_DURATION_MS)
    })
    expect(screen.queryByText('Doc')).not.toBeInTheDocument()
  })

  it('slides away a panel that was opened after the first render', () => {
    const { rerender } = render(<Panel open={false} />)
    rerender(<Panel open />)
    rerender(<Panel open={false} />)

    expect(screen.getByText('Doc')).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(SLIDE_DURATION_MS)
    })
    expect(screen.queryByText('Doc')).not.toBeInTheDocument()
  })

  it('closes at once when it does not slide', () => {
    const { rerender } = render(
      <SlidePanel open side='left' widthClass='w-64' animate={false}>
        Screens
      </SlidePanel>
    )
    rerender(
      <SlidePanel open={false} side='left' widthClass='w-64' animate={false}>
        Screens
      </SlidePanel>
    )

    expect(screen.queryByText('Screens')).not.toBeInTheDocument()
  })

  it('turns back when reopened while closing', () => {
    const { rerender } = render(<Panel open />)
    rerender(<Panel open={false} />)
    act(() => {
      vi.advanceTimersByTime(SLIDE_DURATION_MS / 2)
    })

    rerender(<Panel open />)
    act(() => {
      vi.advanceTimersByTime(SLIDE_DURATION_MS)
    })

    expect(screen.getByRole('complementary', { name: 'Doc' })).toBeInTheDocument()
  })
})
