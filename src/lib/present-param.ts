/**
 * `?present` in the page address opens the viewer straight into presenting, e.g. on a tablet handed
 * to someone. It sits in the query, not the hash, so it never mixes with the screen's route.
 */
export const PRESENT_PARAM = 'present'

export function readPresenting(): boolean {
  try {
    return new URLSearchParams(window.location.search).has(PRESENT_PARAM)
  } catch {
    return false
  }
}

/** Adds or drops `?present` without a new history entry, so Back still leaves the viewer. */
export function writePresenting(on: boolean): void {
  try {
    const url = new URL(window.location.href)
    if (on) {
      url.searchParams.set(PRESENT_PARAM, '')
    } else {
      url.searchParams.delete(PRESENT_PARAM)
    }
    // `URLSearchParams` writes an empty value as `present=`; the bare word reads better.
    window.history.replaceState(window.history.state, '', url.href.replace(`${PRESENT_PARAM}=`, PRESENT_PARAM))
  } catch {
    // A page that refuses the change still presents; only a reload forgets it.
  }
}
