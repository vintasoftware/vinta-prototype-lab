// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildPrototypes, distinctScreens, entryScreenId, type PrototypeSources, variantsOf } from './discovery'

const Screen = () => null

function sources(overrides: Partial<PrototypeSources> = {}): PrototypeSources {
  return {
    docs: {
      '../../prototypes/booking/prototype.md': '---\ntitle: Booking\nentry: review\n---\n\nThe flow.',
    },
    annotations: {
      '../../prototypes/booking/annotations.json': {
        notes: [{ id: 'n1', target: 'confirm', title: 'Read-only', screen: 'review' }],
      },
    },
    screens: {
      '../../prototypes/booking/screens/20-review.tsx': { default: Screen },
      '../../prototypes/booking/screens/10-home.tsx': { default: Screen, screen: { viewport: 'mobile' } },
      '../../prototypes/booking/screens/10-home.empty.tsx': { default: Screen },
    },
    ...overrides,
  }
}

describe('buildPrototypes', () => {
  it('reads one folder into a prototype', () => {
    const [prototype] = buildPrototypes(sources())

    expect(prototype?.slug).toBe('booking')
    expect(prototype?.doc.title).toBe('Booking')
    expect(prototype?.doc.body).toBe('The flow.')
    expect(prototype?.annotations).toHaveLength(1)
    expect(prototype?.issues).toEqual([])
  })

  it('orders screens by their numeric prefix', () => {
    const [prototype] = buildPrototypes(sources())

    expect(prototype?.screens.map(screen => `${screen.id}:${screen.variant}`)).toEqual([
      'home:default',
      'home:empty',
      'review:default',
    ])
  })

  it('takes the viewport a screen file declares', () => {
    const [prototype] = buildPrototypes(sources())

    expect(prototype?.screens[0]?.viewport).toBe('mobile')
    expect(prototype?.screens[2]?.viewport).toBe('desktop')
  })

  it('reports a screen file with no default export and keeps the rest', () => {
    const [prototype] = buildPrototypes(
      sources({
        screens: {
          '../../prototypes/booking/screens/10-home.tsx': { default: Screen },
          '../../prototypes/booking/screens/20-review.tsx': {} as never,
        },
      })
    )

    expect(prototype?.screens.map(screen => screen.id)).toEqual(['home'])
    expect(prototype?.issues[0]).toContain('20-review.tsx: no default export')
  })

  it('reports a note that points at a screen which does not exist', () => {
    const [prototype] = buildPrototypes(
      sources({
        annotations: {
          '../../prototypes/booking/annotations.json': {
            notes: [{ id: 'n1', target: 'confirm', title: 'Read-only', screen: 'checkout' }],
          },
        },
      })
    )

    expect(prototype?.issues).toEqual([
      'annotations.json: note "n1" points at screen "checkout", which does not exist.',
    ])
  })

  it('reports an entry screen the doc names but the folder does not have', () => {
    const [prototype] = buildPrototypes(
      sources({ docs: { '../../prototypes/booking/prototype.md': '---\nentry: checkout\n---\n' } })
    )

    expect(prototype?.issues).toEqual(['prototype.md: entry "checkout" is not one of the screens.'])
  })

  it('reads a prototype inside group folders, with the path as its slug', () => {
    const prototypes = buildPrototypes({
      docs: {
        '../../prototypes/booking/prototype.md': '---\ntitle: Booking\n---\n',
        '../../prototypes/billing/refunds/partial-refund/prototype.md': '---\ntitle: Partial refund\n---\n',
      },
      annotations: {
        '../../prototypes/billing/refunds/partial-refund/annotations.json': {
          notes: [{ id: 'n1', target: 'amount', title: 'Two decimals', screen: 'review' }],
        },
      },
      screens: {
        '../../prototypes/booking/screens/10-home.tsx': { default: Screen },
        '../../prototypes/billing/refunds/partial-refund/screens/10-review.tsx': { default: Screen },
        '../../prototypes/billing/invoice-list/screens/10-list.tsx': { default: Screen },
      },
    })

    expect(prototypes.map(prototype => [prototype.slug, prototype.group, prototype.doc.title])).toEqual([
      ['billing/invoice-list', ['billing'], 'Invoice List'],
      ['billing/refunds/partial-refund', ['billing', 'refunds'], 'Partial refund'],
      ['booking', [], 'Booking'],
    ])
    expect(prototypes[1]?.screens.map(screen => screen.id)).toEqual(['review'])
    expect(prototypes[1]?.annotations).toHaveLength(1)
    expect(prototypes[1]?.issues).toEqual([])
  })

  it('reports a prototype inside another prototype and keeps both', () => {
    const prototypes = buildPrototypes({
      docs: {
        '../../prototypes/booking/prototype.md': '---\ntitle: Booking\n---\n',
        '../../prototypes/booking/reschedule/prototype.md': '---\ntitle: Reschedule\n---\n',
      },
      annotations: {},
      screens: {
        '../../prototypes/booking/screens/10-home.tsx': { default: Screen },
        '../../prototypes/booking/reschedule/screens/10-pick.tsx': { default: Screen },
      },
    })

    expect(prototypes.map(prototype => prototype.slug)).toEqual(['booking', 'booking/reschedule'])
    expect(prototypes[0]?.screens.map(screen => screen.id)).toEqual(['home'])
    expect(prototypes[0]?.issues).toEqual([])
    expect(prototypes[1]?.issues[0]).toContain('sits inside the prototype "booking"')
  })

  it('does not read a folder inside screens/ as a prototype', () => {
    const prototypes = buildPrototypes({
      docs: {},
      annotations: {},
      screens: {
        '../../prototypes/booking/screens/10-home.tsx': { default: Screen },
        '../../prototypes/booking/screens/parts/screens/card.tsx': { default: Screen },
      },
    })

    expect(prototypes.map(prototype => prototype.slug)).toEqual(['booking'])
  })

  it('reports a folder with no doc and no screens instead of dropping it', () => {
    const [prototype] = buildPrototypes({
      docs: {},
      annotations: { '../../prototypes/empty/annotations.json': { notes: [] } },
      screens: {},
    })

    expect(prototype?.slug).toBe('empty')
    expect(prototype?.doc.title).toBe('Empty')
    expect(prototype?.issues).toEqual([
      'prototype.md is missing, so this prototype has no documentation.',
      'screens/ holds no screen, so there is nothing to click through.',
    ])
  })
})

describe('entryScreenId', () => {
  it('takes the screen the doc names', () => {
    const [prototype] = buildPrototypes(sources())

    expect(prototype && entryScreenId(prototype)).toBe('review')
  })

  it('falls back to the first screen when the doc names none', () => {
    const [prototype] = buildPrototypes(sources({ docs: {} }))

    expect(prototype && entryScreenId(prototype)).toBe('home')
  })
})

describe('variantsOf and distinctScreens', () => {
  it('groups the states of one screen', () => {
    const [prototype] = buildPrototypes(sources())

    expect(prototype && variantsOf(prototype, 'home').map(screen => screen.variant)).toEqual(['default', 'empty'])
    expect(prototype && distinctScreens(prototype).map(screen => screen.id)).toEqual(['home', 'review'])
  })
})
