// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PrototypeVersion } from '../types'
import {
  ALL_VERSION_VIEW,
  atLeast,
  atMost,
  chipFor,
  firstVersionOf,
  includes,
  readVersions,
  resolveVersion,
  statesForVersion,
  versionView,
} from './version'

const VERSIONS: PrototypeVersion[] = [
  { id: 'v1', label: 'V1: Send claims', short: 'V1' },
  { id: 'v2', label: 'V2: Resolve denials', short: 'V2' },
  { id: 'v3', label: 'V3: Prevent errors', short: 'V3' },
  { id: 'later', label: 'Later: Money in', short: 'Later' },
]

describe('readVersions', () => {
  it('reads the version keys in the order they were written', () => {
    expect(
      readVersions({
        title: 'Billing: Claims',
        'version-v1': 'V1: Send claims',
        'version-v2': 'V2: Resolve denials',
        'version-v3': 'V3: Prevent errors',
        'version-later': 'Later: Money in',
      })
    ).toEqual(VERSIONS)
  })

  it('uses the whole label as the short name when it has no colon', () => {
    expect(readVersions({ 'version-beta': 'Beta' })).toEqual([{ id: 'beta', label: 'Beta', short: 'Beta' }])
  })

  it('uses the id as the label when the value is empty', () => {
    expect(readVersions({ 'version-v1': '' })).toEqual([{ id: 'v1', label: 'v1', short: 'v1' }])
  })

  it('reads nothing from front matter without version keys', () => {
    expect(readVersions({ title: 'Booking', 'version-': 'No id' })).toEqual([])
  })
})

describe('atLeast and atMost', () => {
  it('compares the picked version with the order of the list', () => {
    expect(atLeast(VERSIONS, 'v2', 'v1')).toBe(true)
    expect(atLeast(VERSIONS, 'v2', 'v2')).toBe(true)
    expect(atLeast(VERSIONS, 'v2', 'v3')).toBe(false)
    expect(atMost(VERSIONS, 'v2', 'v1')).toBe(false)
    expect(atMost(VERSIONS, 'v2', 'v2')).toBe(true)
    expect(atMost(VERSIONS, 'v2', 'later')).toBe(true)
  })

  it('treats All as the last version', () => {
    expect(atLeast(VERSIONS, undefined, 'later')).toBe(true)
    expect(atMost(VERSIONS, undefined, 'v3')).toBe(false)
    expect(atMost(VERSIONS, undefined, 'later')).toBe(true)
  })

  it('lets an id the prototype does not declare pass', () => {
    expect(atLeast(VERSIONS, 'v1', 'v9')).toBe(true)
    expect(atMost(VERSIONS, 'later', 'v9')).toBe(true)
  })
})

describe('includes', () => {
  it('keeps an item from its since on', () => {
    expect(includes(VERSIONS, 'v1', 'v2')).toBe(false)
    expect(includes(VERSIONS, 'v2', 'v2')).toBe(true)
    expect(includes(VERSIONS, 'later', 'v2')).toBe(true)
  })

  it('keeps an item up to its until', () => {
    expect(includes(VERSIONS, 'v1', undefined, 'v1')).toBe(true)
    expect(includes(VERSIONS, 'v2', undefined, 'v1')).toBe(false)
  })

  it('keeps an item between its since and until', () => {
    expect(includes(VERSIONS, 'v1', 'v2', 'v3')).toBe(false)
    expect(includes(VERSIONS, 'v3', 'v2', 'v3')).toBe(true)
    expect(includes(VERSIONS, 'later', 'v2', 'v3')).toBe(false)
  })

  it('keeps an untagged item in every version', () => {
    expect(includes(VERSIONS, 'v1')).toBe(true)
    expect(includes(VERSIONS, undefined)).toBe(true)
  })

  it('renders All like the last version', () => {
    expect(includes(VERSIONS, undefined, 'later')).toBe(true)
    expect(includes(VERSIONS, undefined, undefined, 'v1')).toBe(false)
  })
})

describe('statesForVersion', () => {
  const states = [
    { id: 'queue' },
    { id: 'denied', since: 'v2' },
    { id: 'letter', until: 'v1' },
    { id: 'payments', since: 'later' },
  ]

  it('lists only the states of the picked version', () => {
    expect(statesForVersion(states, VERSIONS, 'v1').map(state => state.id)).toEqual(['queue', 'letter'])
    expect(statesForVersion(states, VERSIONS, 'v2').map(state => state.id)).toEqual(['queue', 'denied'])
    expect(statesForVersion(states, VERSIONS, 'later').map(state => state.id)).toEqual(['queue', 'denied', 'payments'])
  })

  it('lists every state in All, the ones with until included', () => {
    expect(statesForVersion(states, VERSIONS, undefined)).toEqual(states)
  })
})

describe('chipFor', () => {
  it('names the first version of a later state', () => {
    expect(chipFor(VERSIONS, { since: 'v2' })).toBe('V2')
    expect(chipFor(VERSIONS, { since: 'later' })).toBe('Later')
  })

  it('names the last version of a state that is replaced', () => {
    expect(chipFor(VERSIONS, { until: 'v1' })).toBe('Until V1')
  })

  it('names both ends of a state that comes and goes', () => {
    expect(chipFor(VERSIONS, { since: 'v2', until: 'v3' })).toBe('V2 to V3')
  })

  it('gives no chip to a state in every version', () => {
    expect(chipFor(VERSIONS, {})).toBeUndefined()
    expect(chipFor(VERSIONS, { since: 'v1' })).toBeUndefined()
    expect(chipFor(VERSIONS, { until: 'later' })).toBeUndefined()
  })
})

describe('resolveVersion', () => {
  it('keeps a declared id and reads anything else as All', () => {
    expect(resolveVersion(VERSIONS, 'v2')).toBe('v2')
    expect(resolveVersion(VERSIONS, 'all')).toBeUndefined()
    expect(resolveVersion(VERSIONS, 'v9')).toBeUndefined()
    expect(resolveVersion([], 'v1')).toBeUndefined()
  })
})

describe('firstVersionOf', () => {
  it('returns the version a state arrives in', () => {
    expect(firstVersionOf(VERSIONS, { since: 'v2' })?.short).toBe('V2')
    expect(firstVersionOf(VERSIONS, {})).toBeUndefined()
  })
})

describe('versionView', () => {
  it('describes the picked version', () => {
    const view = versionView(VERSIONS, 'v2')

    expect(view).toMatchObject({ id: 'v2', label: 'V2: Resolve denials', isAll: false })
    expect(view.atLeast('v2')).toBe(true)
    expect(view.atMost('v1')).toBe(false)
    expect(view.includes('v3')).toBe(false)
  })

  it('describes All', () => {
    const view = versionView(VERSIONS, undefined)

    expect(view).toMatchObject({ id: 'all', label: 'All', isAll: true })
    expect(view.includes('later')).toBe(true)
    expect(view.includes(undefined, 'v1')).toBe(false)
  })

  it('reads an id the prototype does not declare as All', () => {
    expect(versionView(VERSIONS, 'v9').isAll).toBe(true)
  })

  it('acts as All with no version list', () => {
    expect(versionView([], 'v1')).toBe(ALL_VERSION_VIEW)
    expect(ALL_VERSION_VIEW.includes('v2')).toBe(true)
    expect(ALL_VERSION_VIEW.includes(undefined, 'v1')).toBe(false)
    expect(ALL_VERSION_VIEW.atLeast('v3')).toBe(true)
  })
})
