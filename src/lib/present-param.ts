/** `?present` in the page address opens the viewer straight into presenting, e.g. on a tablet. */
export const PRESENT_PARAM = 'present'

/** Whether a page's query string asks for presenting. */
export function presentingIn(search: string): boolean {
  return new URLSearchParams(search).has(PRESENT_PARAM)
}

/**
 * The address with `?present` added or taken out, and everything else kept: the other query
 * parameters and the `#/p/…` route. It is written bare, `?present`, rather than `?present=`.
 */
export function withPresenting(href: string, on: boolean): string {
  const url = new URL(href)
  const params = new URLSearchParams(url.search)
  params.delete(PRESENT_PARAM)
  const rest = params.toString()
  const search = on ? [rest, PRESENT_PARAM].filter(part => part !== '').join('&') : rest
  url.search = search === '' ? '' : `?${search}`
  return url.href
}

/** Puts presenting in the address bar without a new history entry, so Back leaves the viewer as before. */
export function writePresenting(on: boolean): void {
  try {
    window.history.replaceState(window.history.state, '', withPresenting(window.location.href, on))
  } catch {
    // An address the browser will not rewrite still presents; only the link is not updated.
  }
}
