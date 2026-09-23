// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { formatHash, parseHash } from './hash-route'

describe('parseHash', () => {
  it('reads prototype, screen and variant', () => {
    expect(parseHash('#/p/patient-booking/choose-time/no-slots')).toEqual({
      slug: 'patient-booking',
      screenId: 'choose-time',
      variant: 'no-slots',
    })
  })

  it('reads a prototype on its own', () => {
    expect(parseHash('#/p/patient-booking')).toEqual({ slug: 'patient-booking' })
  })

  it('reads the component a link points at', () => {
    expect(parseHash('#/p/patient-booking/home?component=book-follow-up')).toEqual({
      slug: 'patient-booking',
      screenId: 'home',
      component: 'book-follow-up',
    })
  })

  it('reads a component named by the path down to it', () => {
    expect(
      parseHash('#/p/patient-booking/home/no-slots?component=follow-up-card%2FCardContent%2FButton')?.component
    ).toBe('follow-up-card/CardContent/Button')
  })

  it('reads a screen with no component on it', () => {
    expect(parseHash('#/p/patient-booking/home?component=')).toEqual({
      slug: 'patient-booking',
      screenId: 'home',
    })
  })

  it('returns nothing for a URL it does not own', () => {
    expect(parseHash('#/something-else')).toEqual({})
    expect(parseHash('')).toEqual({})
  })
})

describe('formatHash', () => {
  it('writes the component so the link carries the pick', () => {
    expect(
      formatHash({ slug: 'patient-booking', screenId: 'home', variant: 'default', component: 'book-follow-up' })
    ).toBe('#/p/patient-booking/home?component=book-follow-up')
  })

  it('escapes the separators in a component named by the path down to it', () => {
    expect(formatHash({ slug: 'booking', screenId: 'home', variant: 'empty', component: 'Card~1/CardHeader' })).toBe(
      '#/p/booking/home/empty?component=Card~1%2FCardHeader'
    )
  })

  it('reads back everything it writes', () => {
    const route = { slug: 'booking', screenId: 'home', variant: 'empty', component: 'Card~1/CardHeader' }

    expect(parseHash(formatHash(route))).toEqual(route)
  })

  it('leaves the default variant out', () => {
    expect(formatHash({ slug: 'patient-booking', screenId: 'home', variant: 'default' })).toBe(
      '#/p/patient-booking/home'
    )
  })

  it('writes a named variant', () => {
    expect(formatHash({ slug: 'patient-booking', screenId: 'choose-time', variant: 'no-slots' })).toBe(
      '#/p/patient-booking/choose-time/no-slots'
    )
  })

  it('round-trips through parseHash', () => {
    const route = { slug: 'patient-booking', screenId: 'choose-time', variant: 'no-slots' }

    expect(parseHash(formatHash(route))).toEqual(route)
  })
})
