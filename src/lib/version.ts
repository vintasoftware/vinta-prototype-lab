import type { PrototypeVersion } from '../types'

/** The id the viewer uses for "every version". A prototype cannot declare a version with it. */
export const ALL_VERSIONS = 'all'

/** The front matter key prefix that declares a version: `version-v1: 'V1: Send claims'`. */
const VERSION_KEY = /^version-(.+)$/

/** What a screen sees of the version picked in the viewer. Read it with `useVersion()`. */
export interface VersionView {
  /** The picked version's id, or `all`. */
  id: string
  /** The picked version's label, or `All`. */
  label: string
  isAll: boolean
  /** Whether the picked version is `id` or a later one. All counts as the last version. */
  atLeast: (id: string) => boolean
  /** Whether the picked version is `id` or an earlier one. All counts as the last version. */
  atMost: (id: string) => boolean
  /** Whether something tagged with this `since` and `until` exists in the picked version. */
  includes: (since?: string, until?: string) => boolean
}

/**
 * Reads the `version-<id>` keys of a front matter block, in the order they were written. The label
 * up to its first colon is the short name: `V1: Send claims` gives `V1`.
 */
export function readVersions(data: Record<string, string>): PrototypeVersion[] {
  const versions: PrototypeVersion[] = []
  for (const [key, value] of Object.entries(data)) {
    const id = VERSION_KEY.exec(key)?.[1]?.trim()
    if (id === undefined || id === '') {
      continue
    }
    const label = value.trim() === '' ? id : value.trim()
    const colon = label.indexOf(':')
    const short = colon > 0 ? label.slice(0, colon).trim() : label
    versions.push({ id, label, short })
  }
  return versions
}

/** Position of a version in the list, or undefined for an id the prototype does not declare. */
function rankOf(versions: readonly PrototypeVersion[], id: string | undefined): number | undefined {
  if (id === undefined) {
    return undefined
  }
  const index = versions.findIndex(version => version.id === id)
  return index === -1 ? undefined : index
}

/** The picked version's position. All, or an id not in the list, counts as the last version. */
function selectedRank(versions: readonly PrototypeVersion[], selected: string | undefined): number {
  return rankOf(versions, selected) ?? Number.POSITIVE_INFINITY
}

/** Whether `selected` (undefined for All) is the version `id` or a later one. An unknown `id` passes. */
export function atLeast(versions: readonly PrototypeVersion[], selected: string | undefined, id: string): boolean {
  const rank = rankOf(versions, id)
  return rank === undefined || selectedRank(versions, selected) >= rank
}

/**
 * Whether `selected` (undefined for All) is the version `id` or an earlier one. All counts as the
 * last version, so only the last version's id passes there. An unknown `id` passes.
 */
export function atMost(versions: readonly PrototypeVersion[], selected: string | undefined, id: string): boolean {
  const rank = rankOf(versions, id)
  if (rank === undefined) {
    return true
  }
  const picked = selectedRank(versions, selected)
  return picked === Number.POSITIVE_INFINITY ? rank === versions.length - 1 : picked <= rank
}

/**
 * Whether something tagged with `since` and `until` exists in `selected` (undefined for All, which
 * renders like the last version). An id the prototype does not declare is ignored, so the tag
 * reads as "every version" on that side.
 */
export function includes(
  versions: readonly PrototypeVersion[],
  selected: string | undefined,
  since?: string,
  until?: string
): boolean {
  return (
    (since === undefined || atLeast(versions, selected, since)) &&
    (until === undefined || atMost(versions, selected, until))
  )
}

/** Whether a tagged item is listed for `selected`. All lists every item, `until` included. */
export function listedIn(
  versions: readonly PrototypeVersion[],
  selected: string | undefined,
  item: { since?: string; until?: string }
): boolean {
  return selected === undefined || includes(versions, selected, item.since, item.until)
}

/** The screen states listed for `selected`, in their order. All lists every state. */
export function statesForVersion<T extends { since?: string; until?: string }>(
  states: readonly T[],
  versions: readonly PrototypeVersion[],
  selected: string | undefined
): T[] {
  return states.filter(state => listedIn(versions, selected, state))
}

/**
 * The chip shown after a state or note in All, or undefined when it exists in every version:
 * `V2` (from V2 on), `Until V1`, or `V2 to V3`.
 */
export function chipFor(
  versions: readonly PrototypeVersion[],
  item: { since?: string; until?: string }
): string | undefined {
  const sinceRank = rankOf(versions, item.since)
  const untilRank = rankOf(versions, item.until)
  const from = sinceRank !== undefined && sinceRank > 0 ? versions[sinceRank] : undefined
  const to = untilRank !== undefined && untilRank < versions.length - 1 ? versions[untilRank] : undefined
  if (from !== undefined && to !== undefined) {
    return `${from.short} to ${to.short}`
  }
  if (from !== undefined) {
    return from.short
  }
  if (to !== undefined) {
    return `Until ${to.short}`
  }
  return undefined
}

/**
 * The version to use for a `?v=` value: a declared id, or undefined (All) for anything else,
 * `all` and an id the prototype does not declare included.
 */
export function resolveVersion(
  versions: readonly PrototypeVersion[],
  requested: string | undefined
): string | undefined {
  return versions.some(version => version.id === requested) ? requested : undefined
}

/** The first version an item exists in, for "arrives in V2" messages. Undefined when it is in every version. */
export function firstVersionOf(
  versions: readonly PrototypeVersion[],
  item: { since?: string }
): PrototypeVersion | undefined {
  const rank = rankOf(versions, item.since)
  return rank === undefined ? undefined : versions[rank]
}

/**
 * The view used outside a prototype runtime (Storybook, a test rendering one component) and for a
 * prototype that declares no versions. It acts as All with no version list: anything tagged `since`
 * shows, and anything tagged `until` is hidden, since All renders like the last version.
 */
export const ALL_VERSION_VIEW: VersionView = {
  id: ALL_VERSIONS,
  label: 'All',
  isAll: true,
  atLeast: () => true,
  atMost: () => false,
  includes: (_since, until) => until === undefined,
}

/** What `useVersion()` returns for a picked version (undefined for All). */
export function versionView(versions: readonly PrototypeVersion[], selected: string | undefined): VersionView {
  if (versions.length === 0) {
    return ALL_VERSION_VIEW
  }
  const picked = versions.find(version => version.id === selected)
  return {
    id: picked?.id ?? ALL_VERSIONS,
    label: picked?.label ?? 'All',
    isAll: picked === undefined,
    atLeast: id => atLeast(versions, picked?.id, id),
    atMost: id => atMost(versions, picked?.id, id),
    includes: (since, until) => includes(versions, picked?.id, since, until),
  }
}

/** Why an item is not in the picked version, and the version that has it. */
export interface OutOfVersion {
  /** `arrives`: it starts in a later version. `replaced`: it ended in an earlier one. */
  reason: 'arrives' | 'replaced'
  /** The version to switch to so it shows: its `since`, or its `until`. */
  version: PrototypeVersion
}

/**
 * Why `item` is not listed in `selected`, or undefined when it is (All lists everything). Used for
 * the toast on a link and the placeholder on a deep link.
 */
export function outOfVersion(
  versions: readonly PrototypeVersion[],
  selected: string | undefined,
  item: { since?: string; until?: string }
): OutOfVersion | undefined {
  if (listedIn(versions, selected, item)) {
    return undefined
  }
  const since = versions.find(version => version.id === item.since)
  if (since !== undefined && !atLeast(versions, selected, since.id)) {
    return { reason: 'arrives', version: since }
  }
  const until = versions.find(version => version.id === item.until)
  return until === undefined ? undefined : { reason: 'replaced', version: until }
}

/** The toast a link to a state outside the picked version shows. */
export function linkToastText(missing: OutOfVersion): string {
  const { short } = missing.version
  return missing.reason === 'arrives'
    ? `This screen arrives in ${short}. Switch to ${short} or All to open it.`
    : `This screen is replaced after ${short}. Switch to ${short} or All to open it.`
}
