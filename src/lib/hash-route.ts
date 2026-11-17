import { DEFAULT_VARIANT } from './constants'

/** The part of the viewer's state that lives in the URL, so a link opens on the right screen. */
export interface HashRoute {
  slug?: string
  screenId?: string
  variant?: string
  /** The component the link points at, named the way a component link names one. */
  component?: string
  /** The version picked in the header, by id. Left out for All. */
  version?: string
}

/** A URL the viewer can write: the screen it is on, and the component picked on it. */
export interface ScreenRoute {
  slug: string
  screenId: string
  variant: string
  component?: string
  /** The version picked in the header. Left out for All, so links shared without one open as before. */
  version?: string
}

/** How many leading segments of the path make up the slug: the longest known slug they spell. */
function slugLength(segments: readonly string[], slugs: readonly string[]): number {
  let longest = 1
  for (const slug of slugs) {
    const parts = slug.split('/')
    if (parts.length > longest && parts.every((part, index) => segments[index] === part)) {
      longest = parts.length
    }
  }
  return longest
}

/**
 * Reads `#/p/[slug]/[screen]/[variant]?v=[version]&component=[id]`. Anything else reads as an empty route.
 *
 * A prototype inside a group folder has `/` in its slug (`billing/refunds`), so the path alone
 * cannot say where the slug ends. `slugs` are the prototypes that exist; the longest one the path
 * starts with is taken, and without a match the slug is the first segment.
 */
export function parseHash(hash: string, slugs: readonly string[] = []): HashRoute {
  const [pathPart = '', queryPart = ''] = hash.replace(/^#/, '').replace(/^\//, '').split('?')
  const [prefix, ...segments] = pathPart.split('/')

  if (prefix !== 'p' || segments[0] === undefined || segments[0] === '') {
    return {}
  }

  const length = slugLength(segments, slugs)
  const slug = segments.slice(0, length).join('/')
  const [screenId, variant] = segments.slice(length)

  const query = new URLSearchParams(queryPart)
  const component = query.get('component')
  const version = query.get('v')

  return {
    slug,
    ...(screenId !== undefined && screenId !== '' ? { screenId } : {}),
    ...(variant !== undefined && variant !== '' ? { variant } : {}),
    ...(component === null || component === '' ? {} : { component }),
    ...(version === null || version === '' ? {} : { version }),
  }
}

export function formatHash(route: ScreenRoute): string {
  const variant = route.variant === DEFAULT_VARIANT ? '' : `/${route.variant}`
  const query = [
    route.version === undefined ? undefined : `v=${encodeURIComponent(route.version)}`,
    route.component === undefined ? undefined : `component=${encodeURIComponent(route.component)}`,
  ].filter(part => part !== undefined)
  return `#/p/${route.slug}/${route.screenId}${variant}${query.length === 0 ? '' : `?${query.join('&')}`}`
}
