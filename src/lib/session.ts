/** Where the click-through currently is. */
export interface ScreenAddress {
  screenId: string
  variant: string
}

export interface SessionState {
  slug: string
  current: ScreenAddress
  /** Addresses visited before the current one, oldest first. Drives the viewer's Back button. */
  history: ScreenAddress[]
  /**
   * The component picked on the screen, named the way a link names one. It travels in the URL, so
   * a link pasted in a ticket opens the screen with the component already picked.
   */
  component?: string
}

function sameAddress(a: ScreenAddress, b: ScreenAddress): boolean {
  return a.screenId === b.screenId && a.variant === b.variant
}

/** Any move to another address drops the pick: it belonged to the screen it was made on. */
function moveTo(state: SessionState, current: ScreenAddress, history: ScreenAddress[]): SessionState {
  const { component: _picked, ...rest } = state
  return { ...rest, current, history }
}

export function startSession(slug: string, current: ScreenAddress, component?: string): SessionState {
  return { slug, current, history: [], ...(component === undefined ? {} : { component }) }
}

/**
 * Moves to another screen. Staying on the same address changes nothing, so a link back to the
 * current screen does not pile up history entries.
 */
export function navigateTo(state: SessionState, next: ScreenAddress): SessionState {
  if (sameAddress(state.current, next)) {
    return state
  }
  return moveTo(state, next, [...state.history, state.current])
}

export function goBack(state: SessionState): SessionState {
  const previous = state.history[state.history.length - 1]
  if (previous === undefined) {
    return state
  }
  return moveTo(state, previous, state.history.slice(0, -1))
}

/**
 * Shows a different state of the screen already open. This is the designer flipping between "empty"
 * and "filled", not a step in the flow, so it leaves history alone.
 */
export function showVariant(state: SessionState, variant: string): SessionState {
  if (state.current.variant === variant) {
    return state
  }
  return moveTo(state, { ...state.current, variant }, state.history)
}

/** Picks a component on the screen, or clears the pick. */
export function selectComponent(state: SessionState, component: string | undefined): SessionState {
  if (state.component === component) {
    return state
  }
  const { component: _replaced, ...rest } = state
  return { ...rest, ...(component === undefined ? {} : { component }) }
}
