// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Prototype, PrototypeScreen } from '../types'
import { liveAway, liveBack, liveGoTo, liveReturn, liveScreen, startLiveFrame } from './live-frame'

const Blank = () => null
const screen = (id: string, variant = 'default'): PrototypeScreen => ({
  id,
  title: id,
  variant,
  variantLabel: variant,
  viewport: 'mobile',
  order: 10,
  Component: Blank,
  source: '',
})
const prototype: Prototype = {
  slug: 'booking',
  group: [],
  doc: { title: 'Booking', body: '' },
  screens: [screen('home'), screen('review'), screen('review', 'empty')],
  annotations: [],
  issues: [],
}

describe('live frame', () => {
  const start = startLiveFrame('home/default', { screenId: 'home', variant: 'default' })

  it('starts on its own state, not away', () => {
    expect(liveScreen(start, prototype)?.id).toBe('home')
    expect(liveAway(start)).toBe(false)
  })

  it('clicks through inside itself, with a history of its own', () => {
    const moved = liveGoTo(liveGoTo(start, prototype, 'review', undefined), prototype, 'review', 'empty')

    expect(liveScreen(moved, prototype)).toMatchObject({ id: 'review', variant: 'empty' })
    expect(liveAway(moved)).toBe(true)
    expect(liveScreen(liveBack(moved), prototype)).toMatchObject({ id: 'review', variant: 'default' })
  })

  it('goes nowhere for a link to a screen that does not exist', () => {
    expect(liveGoTo(start, prototype, 'typo', undefined)).toBe(start)
  })

  it('returns to the state it came from, with its history cleared', () => {
    const back = liveReturn(liveGoTo(start, prototype, 'review', undefined))

    expect(liveScreen(back, prototype)?.id).toBe('home')
    expect(back.session.history).toEqual([])
  })
})
