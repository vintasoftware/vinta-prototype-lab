// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildPrototypes, resolveScreen } from '../lib/discovery'
import { openingState, stateFromRoute } from './use-prototype-session'

const Screen = () => null

const prototypes = buildPrototypes({
  docs: { '../../prototypes/booking/prototype.md': '---\ntitle: Booking\nentry: review\n---\n' },
  annotations: {},
  screens: {
    '../../prototypes/booking/screens/10-home.tsx': { default: Screen },
    '../../prototypes/booking/screens/20-review.tsx': { default: Screen },
    '../../prototypes/booking/screens/30-receipt.printed.tsx': { default: Screen },
  },
})

const booking = prototypes[0]

describe('resolveScreen', () => {
  it('finds the state that was asked for', () => {
    expect(booking && resolveScreen(booking, { screenId: 'receipt', variant: 'printed' })?.variant).toBe('printed')
  })

  it('falls back to the only state a screen has', () => {
    expect(booking && resolveScreen(booking, { screenId: 'receipt', variant: 'default' })?.variant).toBe('printed')
  })

  it('finds nothing for a screen that does not exist', () => {
    expect(booking && resolveScreen(booking, { screenId: 'checkout', variant: 'default' })).toBeUndefined()
  })
})

describe('openingState', () => {
  it('starts on the entry screen the doc names', () => {
    expect(booking && openingState(booking).current).toEqual({ screenId: 'review', variant: 'default' })
  })
})

describe('stateFromRoute', () => {
  it('opens the screen and state the URL names', () => {
    expect(stateFromRoute(prototypes, { slug: 'booking', screenId: 'receipt', variant: 'printed' }).current).toEqual({
      screenId: 'receipt',
      variant: 'printed',
    })
  })

  it('ignores a screen the prototype does not have', () => {
    expect(stateFromRoute(prototypes, { slug: 'booking', screenId: 'checkout' }).current).toEqual({
      screenId: 'review',
      variant: 'default',
    })
  })

  it('opens the first prototype when the URL names none', () => {
    expect(stateFromRoute(prototypes, {}).slug).toBe('booking')
  })

  it('returns an empty session when there is nothing to open', () => {
    expect(stateFromRoute([], { slug: 'booking' })).toEqual({
      slug: '',
      current: { screenId: '', variant: 'default' },
      history: [],
    })
  })
})

describe('a pick in the URL', () => {
  it('opens on the component the link names', () => {
    const state = stateFromRoute(prototypes, { slug: 'booking', screenId: 'receipt', component: 'total' })

    expect(state.component).toBe('total')
  })

  it('is dropped when the screen the link names is not there', () => {
    const state = stateFromRoute(prototypes, { slug: 'booking', screenId: 'checkout', component: 'total' })

    expect(state.component).toBeUndefined()
  })

  it('is dropped when the variant the link names is not there, since it was made on another one', () => {
    const state = stateFromRoute(prototypes, {
      slug: 'booking',
      screenId: 'receipt',
      variant: 'missing',
      component: 'total',
    })

    expect(state.component).toBeUndefined()
  })
})
