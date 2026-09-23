import { DEFAULT_VARIANT } from './constants'

/** The part of the viewer's state that lives in the URL, so a link opens on the right screen. */
export interface HashRoute {
  slug?: string
  screenId?: string
  variant?: string
  /** The component the link points at, named the way a component link names one. */
  component?: string
}

/** A URL the viewer can write: the screen it is on, and the component picked on it. */
export interface ScreenRoute {
  slug: string
  screenId: string
  variant: string
  component?: string
}

/** Reads `#/p/[slug]/[screen]/[variant]?component=[id]`. Anything else reads as an empty route. */
export function parseHash(hash: string): HashRoute {
  const [pathPart = '', queryPart = ''] = hash.replace(/^#/, '').replace(/^\//, '').split('?')
  const [prefix, slug, screenId, variant] = pathPart.split('/')

  if (prefix !== 'p' || slug === undefined || slug === '') {
    return {}
  }

  const component = new URLSearchParams(queryPart).get('component')

  return {
    slug,
    ...(screenId !== undefined && screenId !== '' ? { screenId } : {}),
    ...(variant !== undefined && variant !== '' ? { variant } : {}),
    ...(component === null || component === '' ? {} : { component }),
  }
}

export function formatHash(route: ScreenRoute): string {
  const variant = route.variant === DEFAULT_VARIANT ? '' : `/${route.variant}`
  const component = route.component === undefined ? '' : `?component=${encodeURIComponent(route.component)}`
  return `#/p/${route.slug}/${route.screenId}${variant}${component}`
}
