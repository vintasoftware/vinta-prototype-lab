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

  describe('canvas.json', () => {
    const Home = () => null

    it('reads the arrangement and reports a section for a screen that is gone', () => {
      const [prototype] = buildPrototypes({
        docs: { '../../prototypes/booking/prototype.md': '---\ntitle: Booking\n---\n' },
        annotations: {},
        screens: { '../../prototypes/booking/screens/10-home.tsx': { default: Home } },
        canvases: {
          '../../prototypes/booking/canvas.json': {
            version: 1,
            sections: [
              { screen: 'home', x: 40, y: 80 },
              { screen: 'checkout', x: 0, y: 0 },
            ],
          },
        },
      })

      expect(prototype?.canvas?.sections).toEqual([{ screen: 'home', x: 40, y: 80 }])
      expect(prototype?.issues).toEqual([
        'canvas.json: section "checkout" is for a screen that does not exist, so it was dropped.',
      ])
    })

    it('has no arrangement for a prototype without the file', () => {
      const [prototype] = buildPrototypes({
        docs: { '../../prototypes/booking/prototype.md': '---\ntitle: Booking\n---\n' },
        annotations: {},
        screens: { '../../prototypes/booking/screens/10-home.tsx': { default: Home } },
      })

      expect(prototype?.canvas).toBeUndefined()
    })
  })
})

describe('versions', () => {
  const versioned: PrototypeSources = {
    docs: {
      '../../prototypes/billing/prototype.md':
        "---\ntitle: Billing\nversion-v1: 'V1: Send claims'\nversion-v2: 'V2: Resolve denials'\n---\n",
    },
    annotations: {
      '../../prototypes/billing/annotations.json': {
        notes: [
          { id: 'n1', target: 'appeal', title: 'Appeal', since: 'v2' },
          { id: 'n2', target: 'appeal', title: 'Typo', since: 'v4' },
        ],
      },
    },
    screens: {
      '../../prototypes/billing/screens/10-queue.tsx': { default: Screen },
      '../../prototypes/billing/screens/10-queue.denied.tsx': { default: Screen, screen: { since: 'v2' } },
      '../../prototypes/billing/screens/10-queue.letter.tsx': { default: Screen, screen: { until: 'v1' } },
      '../../prototypes/billing/screens/20-claim.tsx': { default: Screen, screen: { since: 'v4' } },
    },
  }

  it('reads the versions the doc declares, in order', () => {
    const [prototype] = buildPrototypes(versioned)

    expect(prototype?.doc.versions).toEqual([
      { id: 'v1', label: 'V1: Send claims', short: 'V1' },
      { id: 'v2', label: 'V2: Resolve denials', short: 'V2' },
    ])
  })

  it('keeps the since and until a screen declares', () => {
    const [prototype] = buildPrototypes(versioned)

    expect(prototype?.screens.map(screen => [screen.variant, screen.since, screen.until])).toEqual([
      ['default', undefined, undefined],
      ['denied', 'v2', undefined],
      ['letter', undefined, 'v1'],
      ['default', undefined, undefined],
    ])
    expect(prototype?.annotations[0]?.since).toBe('v2')
  })

  it('reports an unknown version id and treats the item as in every version', () => {
    const [prototype] = buildPrototypes(versioned)

    expect(prototype?.issues).toEqual([
      "Unknown version 'v4' in 20-claim.tsx.",
      'Unknown version \'v4\' in annotations.json note "n2".',
    ])
    expect(prototype?.screens[3]).not.toHaveProperty('since')
    expect(prototype?.annotations[1]).not.toHaveProperty('since')
  })

  it('reports a since in a prototype that declares no versions', () => {
    const [prototype] = buildPrototypes(
      sources({
        screens: {
          '../../prototypes/booking/screens/10-home.tsx': { default: Screen, screen: { since: 'v2' } },
          '../../prototypes/booking/screens/20-review.tsx': { default: Screen },
        },
      })
    )

    expect(prototype?.doc).not.toHaveProperty('versions')
    expect(prototype?.issues).toEqual(["Unknown version 'v2' in 10-home.tsx."])
  })

  it('reports and drops a version named all', () => {
    const [prototype] = buildPrototypes({
      ...versioned,
      docs: { '../../prototypes/billing/prototype.md': "---\nversion-v1: 'V1'\nversion-all: 'Everything'\n---\n" },
      annotations: {},
      screens: { '../../prototypes/billing/screens/10-queue.tsx': { default: Screen } },
    })

    expect(prototype?.doc.versions?.map(version => version.id)).toEqual(['v1'])
    expect(prototype?.issues[0]).toContain('"version-all" is reserved')
  })

  it('leaves a prototype without versions as it was', () => {
    const [prototype] = buildPrototypes(sources())

    expect(prototype?.doc).not.toHaveProperty('versions')
    expect(prototype?.screens.every(screen => !('since' in screen) && !('until' in screen))).toBe(true)
  })
})
