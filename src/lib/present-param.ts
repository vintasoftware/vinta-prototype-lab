/** `?present` in the page address opens the viewer straight into presenting. */
export const PRESENT_PARAM = 'present'

/**
 * How the screen is presented: `frame` keeps the size chosen in the viewer, scaled down to fit the
 * window, so a desktop can show a phone or a tablet; `fill` gives the screen the whole window, for
 * a phone or a tablet that is itself the device.
 */
export type PresentMode = 'frame' | 'fill'

const FILL_VALUE = 'fill'

/** How a page's query string asks for presenting: `?present`, `?present=fill`, or not at all. */
export function presentModeIn(search: string): PresentMode | undefined {
  const params = new URLSearchParams(search)
  if (!params.has(PRESENT_PARAM)) {
    return undefined
  }
  return params.get(PRESENT_PARAM) === FILL_VALUE ? 'fill' : 'frame'
}

/**
 * The address with presenting added or taken out, and everything else kept: the other query
 * parameters and the `#/p/…` route. The frame is written bare, `?present`, rather than `?present=`.
 */
export function withPresenting(href: string, mode: PresentMode | undefined): string {
  const url = new URL(href)
  const params = new URLSearchParams(url.search)
  params.delete(PRESENT_PARAM)
  const rest = params.toString()
  const own = mode === undefined ? '' : mode === 'fill' ? `${PRESENT_PARAM}=${FILL_VALUE}` : PRESENT_PARAM
  const search = [rest, own].filter(part => part !== '').join('&')
  url.search = search === '' ? '' : `?${search}`
  return url.href
}

/** Puts presenting in the address bar without a new history entry, so Back leaves the viewer as before. */
export function writePresenting(mode: PresentMode | undefined): void {
  try {
    window.history.replaceState(window.history.state, '', withPresenting(window.location.href, mode))
  } catch {
    // An address the browser will not rewrite still presents; only the link is not updated.
  }
}
