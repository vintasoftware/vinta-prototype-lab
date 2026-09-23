import { STORYBOOK_URL } from './constants'

/** Where to find the project's Storybook, and how to tell it from another project's. */
export interface StorybookOptions {
  /** Where Storybook runs. Defaults to `http://localhost:6006`. */
  url?: string
  /**
   * A root section the project's Storybook always has, such as `Design System`. The index carries no
   * project name, so this is what tells the project's Storybook from another one on the same port.
   * Leave it out to accept whatever Storybook answers.
   */
  marker?: string
}

/** One entry of Storybook's `index.json`. */
export interface StorybookEntry {
  id: string
  title: string
  name: string
  type?: string
}

export interface StorybookLink {
  url: string
  /** Where the link goes, for the row's tooltip: `Design System/Atoms → Buttons`. */
  title: string
  name: string
}

/**
 * Same treatment for a component name and a story name, so the two can be compared: case, spaces,
 * punctuation and a trailing plural all stop mattering. `Buttons` and `Button` both come out
 * `button`, which is what lets a component find the story that shows a row of them.
 */
export function normalizeName(name: string): string {
  const flat = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  return flat.endsWith('s') ? flat.slice(0, -1) : flat
}

/** `CardHeader` -> `['CardHeader', 'Card']`: the component, then the family it belongs to. */
export function nameFamily(componentName: string): string[] {
  const words = componentName.split(/(?=[A-Z])/).filter(word => word !== '')
  const names: string[] = []

  for (let length = words.length; length > 0; length -= 1) {
    names.push(words.slice(0, length).join(''))
  }

  return names.length === 0 ? [componentName] : names
}

function lastTitleSegment(title: string): string {
  const segments = title.split('/')
  return segments[segments.length - 1] ?? title
}

function linkFor(entry: StorybookEntry, baseUrl: string): StorybookLink {
  const kind = entry.type === 'docs' ? 'docs' : 'story'
  return { url: `${baseUrl}/?path=/${kind}/${entry.id}`, title: entry.title, name: entry.name }
}

/**
 * Indexes Storybook's entries by the names a component could be found under.
 *
 * A title that ends in the component's own name is the strongest signal, so those are indexed
 * first and a story name never displaces one. Otherwise the story name is what a grouped file
 * offers: `Design System/Atoms` holds a story called `Buttons`, and that is the page for `Button`.
 */
export function buildStorybookLinks(
  entries: readonly StorybookEntry[],
  baseUrl = STORYBOOK_URL
): Map<string, StorybookLink> {
  const links = new Map<string, StorybookLink>()

  for (const entry of entries) {
    const key = normalizeName(lastTitleSegment(entry.title))
    if (key !== '' && !links.has(key)) {
      links.set(key, linkFor(entry, baseUrl))
    }
  }

  for (const entry of entries) {
    // A docs page is named "Docs" whatever it documents, so it is reachable by its title alone.
    if (entry.type === 'docs') {
      continue
    }
    const key = normalizeName(entry.name)
    if (key !== '' && !links.has(key)) {
      links.set(key, linkFor(entry, baseUrl))
    }
  }

  return links
}

/**
 * The Storybook page for a component, or the page for the family it belongs to. `CardHeader` has no
 * story of its own, and the Card story is the page a person wants when they ask about one.
 */
export function findStorybookLink(
  links: ReadonlyMap<string, StorybookLink>,
  componentName: string
): StorybookLink | undefined {
  for (const candidate of nameFamily(componentName)) {
    const link = links.get(normalizeName(candidate))
    if (link !== undefined) {
      return link
    }
  }

  return undefined
}

/**
 * Whether an index came from the project's Storybook, judged by the marker section it must have.
 *
 * Several projects run a Storybook on the same port, and a stranger's index answers a fetch just as
 * happily as ours. Linking a component to a page in another product's Storybook is worse than
 * showing no link, so a foreign index is reported rather than used. With no marker, any index that
 * has entries is taken.
 */
export function looksLikeOurStorybook(entries: readonly StorybookEntry[], marker?: string): boolean {
  if (marker === undefined || marker === '') {
    return entries.length > 0
  }
  return entries.some(entry => entry.title.startsWith(`${marker}/`))
}

/**
 * Where to look for Storybook: the URL in the viewer's own query string, one saved from an earlier
 * visit, or the configured one. The query string wins, so a person whose 6006 is taken can point the
 * viewer at the right port without editing anything.
 */
export function resolveStorybookUrl(
  search: string,
  stored: string | null | undefined,
  fallback: string = STORYBOOK_URL
): string {
  const asked = new URLSearchParams(search).get('storybook')

  for (const candidate of [asked, stored]) {
    if (candidate !== null && candidate !== undefined && /^https?:\/\//.test(candidate)) {
      return candidate.replace(/\/$/, '')
    }
  }

  return fallback.replace(/\/$/, '')
}
