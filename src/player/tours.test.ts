import { describe, expect, it } from 'vitest'
import { buildTours, formatTourHash, parseTourHash, readingTimeMs } from './tours'

const step = { screen: 'home', title: 'T', caption: 'C' }

describe('buildTours', () => {
  it('fills in the prototype and the variant from the folder the file sits in', () => {
    const { tours, issues } = buildTours({
      '/prototypes/billing/refunds/partial-refund/tours/refund.json': {
        id: 'refund',
        title: 'Refund',
        summary: 'S',
        steps: [step, { ...step, prototype: 'billing/invoice-list', variant: 'empty' }],
      },
    })

    expect(issues).toEqual([])
    expect(tours).toEqual([
      {
        id: 'refund',
        title: 'Refund',
        summary: 'S',
        home: 'billing/refunds/partial-refund',
        steps: [
          { ...step, prototype: 'billing/refunds/partial-refund', variant: 'default' },
          { ...step, prototype: 'billing/invoice-list', variant: 'empty' },
        ],
      },
    ])
  })

  it('reads a tour across prototypes from prototypes/tours, when every step names its prototype', () => {
    const { tours, issues } = buildTours({
      '/prototypes/tours/everything.json': {
        id: 'everything',
        title: 'Everything',
        summary: 'S',
        steps: [{ ...step, prototype: 'patient-booking' }],
      },
      '/prototypes/tours/half.json': { id: 'half', title: 'Half', summary: 'S', steps: [step] },
    })

    expect(tours.map(tour => [tour.id, tour.home])).toEqual([['everything', '']])
    expect(issues).toEqual([
      'tours/half.json: step 1 names no prototype. A tour outside a prototype folder names one on every step.',
    ])
  })

  it('reports a file that does not parse, or whose id is not its name, without throwing', () => {
    const { tours, issues } = buildTours({
      '/prototypes/booking/tours/good.json': { id: 'renamed', title: 'Good', summary: 'S', steps: [step] },
      '/prototypes/booking/tours/bad.json': { id: 'bad', steps: [] },
    })

    expect(tours.map(tour => tour.id)).toEqual(['renamed'])
    expect(issues).toHaveLength(2)
    expect(issues[0]).toBe('booking/tours/good.json: id "renamed" does not match the file name.')
    expect(issues[1]).toMatch(/^booking\/tours\/bad\.json: /)
  })

  it('sorts by order, with the tours that have none last', () => {
    const tour = (id: string, order?: number) => ({
      id,
      title: id,
      summary: 'S',
      steps: [step],
      ...(order === undefined ? {} : { order }),
    })
    const { tours } = buildTours({
      '/prototypes/a/tours/c.json': tour('c'),
      '/prototypes/a/tours/b.json': tour('b', 2),
      '/prototypes/a/tours/a.json': tour('a', 1),
    })

    expect(tours.map(item => item.id)).toEqual(['a', 'b', 'c'])
  })
})

describe('reading time', () => {
  it('is 2.5 s plus a quarter second per word', () => {
    const words = Array.from({ length: 20 }, () => 'word').join(' ')
    expect(readingTimeMs({ title: 'One two', caption: words })).toBe(2500 + 22 * 250)
  })

  it('is never under 4 s', () => {
    expect(readingTimeMs({ title: 'Hi', caption: 'There' })).toBe(4000)
  })
})

describe('tour links', () => {
  it('round-trips a step', () => {
    expect(parseTourHash(formatTourHash('front-desk-day', 3))).toEqual({ tourId: 'front-desk-day', step: 4 })
  })

  it('opens step 1 when no step is named', () => {
    expect(parseTourHash('#/tour/setup')).toEqual({ tourId: 'setup', step: 1 })
  })

  it('reads anything else as the picker', () => {
    expect(parseTourHash('#/p/patient-booking/home')).toBeUndefined()
    expect(parseTourHash('#/check')).toBeUndefined()
    expect(parseTourHash('')).toBeUndefined()
  })
})
