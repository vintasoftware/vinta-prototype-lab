import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useScreenNavigation } from '../components/prototype-runtime'
import { ScreenLink } from '../components/screen-link'
import { buildPrototypes } from '../lib/discovery'
import type { FlowNodeKey, ScreenLinks } from '../lib/flow-graph'
import { probePrototype } from '../lib/probe-screen'
import { FlowMap } from './flow-map'

function HomeScreen() {
  const { goToScreen } = useScreenNavigation()
  return (
    <div>
      <h1>Good morning</h1>
      <button type='button' onClick={() => goToScreen('review')}>
        Book a visit
      </button>
      <button type='button' onClick={() => goToScreen('review')}>
        Reschedule
      </button>
      <ScreenLink to='terms'>Terms</ScreenLink>
    </div>
  )
}

function ReviewScreen() {
  const { goToScreen, back } = useScreenNavigation()
  return (
    <div>
      <h1>Review your visit</h1>
      <button type='button' onClick={back}>
        Back
      </button>
      <button type='button' onClick={() => goToScreen('review', { variant: 'empty' })}>
        Clear
      </button>
    </div>
  )
}

const ReviewEmptyScreen = () => <h1>Nothing to review</h1>
const LostScreen = () => <h1>Nobody links here</h1>

const prototype = buildPrototypes({
  docs: { '../../prototypes/booking/prototype.md': '---\ntitle: Booking\nentry: home\n---\n' },
  annotations: {},
  screens: {
    '../../prototypes/booking/screens/10-home.tsx': { default: HomeScreen },
    '../../prototypes/booking/screens/20-review.tsx': { default: ReviewScreen },
    '../../prototypes/booking/screens/20-review.empty.tsx': { default: ReviewEmptyScreen },
    '../../prototypes/booking/screens/30-lost.tsx': { default: LostScreen },
  },
})[0]

if (prototype === undefined) {
  throw new Error('the fixture did not build')
}

let linksByNode: Map<FlowNodeKey, ScreenLinks>

describe('FlowMap', () => {
  beforeEach(() => {
    // The probe renders on its own, outside the test renderer, so React must not expect `act()`.
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
    linksByNode = probePrototype(prototype)
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })
  afterEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  const renderMap = (onOpenScreen = vi.fn()) => {
    render(
      <FlowMap
        prototype={prototype}
        flow={{ status: 'ready', linksByNode }}
        showHotspots={false}
        onOpenScreen={onOpenScreen}
      />
    )
    return onOpenScreen
  }

  it('draws one card per screen state, with the real screen inside', () => {
    renderMap()

    expect(screen.getByRole('article', { name: 'Home' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Review' })).toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Review · Empty' })).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Home' })).getByText('Good morning')).toBeInTheDocument()
  })

  it('lists on each card every control and where it leads, one row per destination', () => {
    renderMap()
    const home = screen.getByRole('article', { name: 'Home' })
    const rows = within(home).getAllByRole('listitem')

    expect(rows.map(row => row.textContent)).toEqual(['Book a visit, RescheduleReview', 'Terms“terms” missing'])
  })

  it('lists the controls that go back without pointing them at a screen', () => {
    renderMap()
    // The card's rows; the thumbnail above them holds the same words, hidden from assistive tech.
    const rows = within(screen.getByRole('article', { name: 'Review' })).getByRole('list')

    expect(within(rows).getByText('Previous screen')).toBeInTheDocument()
    expect(within(rows).getByText('Back')).toBeInTheDocument()
  })

  it('marks the entry screen and a screen nothing leads to', () => {
    renderMap()

    expect(within(screen.getByRole('article', { name: 'Home' })).getByText('Entry')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Lost' })).getByText('Unreachable')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Review' })).queryByText('Unreachable')).not.toBeInTheDocument()
  })

  it('stands in a card for a screen that is linked to but does not exist', () => {
    renderMap()

    expect(screen.getByText('No screen “terms”')).toBeInTheDocument()
  })

  it('opens a screen state on stage when its card is clicked', async () => {
    const onOpenScreen = renderMap()

    await userEvent.click(screen.getByRole('button', { name: 'Open Review · Empty' }))

    expect(onOpenScreen).toHaveBeenCalledWith('review', 'empty')
  })

  it('keeps the screens inside the cards out of reach', () => {
    renderMap()

    expect(screen.queryByRole('button', { name: 'Book a visit' })).not.toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: 'Good morning' })).not.toBeInTheDocument()
  })

  it('zooms in steps and fits back to the whole flow', async () => {
    renderMap()
    // With no layout engine the viewport measures 0 wide, so fitting lands on the smallest step.
    expect(screen.getByText('25%')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByText('50%')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(screen.getByText('35%')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Fit the whole flow' }))
    expect(screen.getByText('25%')).toBeInTheDocument()
  })

  it('stops zooming at either end of the range', async () => {
    renderMap()

    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    expect(screen.getByText('25%')).toBeInTheDocument()

    for (let step = 0; step < 10; step += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    }
    expect(screen.getByText('150%')).toBeInTheDocument()
  })

  it('fades the cards an arrow does not join to the one under the pointer', async () => {
    renderMap()
    const home = screen.getByRole('article', { name: 'Home' })
    const review = screen.getByRole('article', { name: 'Review' })
    const lost = screen.getByRole('article', { name: 'Lost' })

    await userEvent.hover(home)

    expect(home).not.toHaveClass('opacity-40')
    expect(review).not.toHaveClass('opacity-40')
    expect(lost).toHaveClass('opacity-40')

    await userEvent.unhover(home)

    expect(lost).not.toHaveClass('opacity-40')
  })

  it('draws every thumbnail in the viewport the viewer asks for', () => {
    const { rerender } = render(
      <FlowMap
        prototype={prototype}
        flow={{ status: 'ready', linksByNode }}
        showHotspots={false}
        onOpenScreen={vi.fn()}
      />
    )
    // The fixture's screens carry no viewport of their own, so they draw as desktop.
    const desktop = screen.getByRole('article', { name: 'Home' }).style.width

    rerender(
      <FlowMap
        prototype={prototype}
        flow={{ status: 'ready', linksByNode }}
        showHotspots={false}
        viewport='mobile'
        onOpenScreen={vi.fn()}
      />
    )

    expect(Number.parseInt(screen.getByRole('article', { name: 'Home' }).style.width, 10)).toBeLessThan(
      Number.parseInt(desktop, 10)
    )
  })

  it('says it is reading while the links are not in yet', () => {
    render(
      <FlowMap
        prototype={prototype}
        flow={{ status: 'reading', linksByNode: new Map() }}
        showHotspots={false}
        onOpenScreen={vi.fn()}
      />
    )

    expect(screen.getByText('Reading where every control leads…')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('says there is no flow for a prototype with no screens', () => {
    render(
      <FlowMap
        prototype={{ ...prototype, screens: [] }}
        flow={{ status: 'ready', linksByNode: new Map() }}
        showHotspots={false}
        onOpenScreen={vi.fn()}
      />
    )

    expect(screen.getByText('This prototype has no screens yet, so there is no flow.')).toBeInTheDocument()
  })
})
