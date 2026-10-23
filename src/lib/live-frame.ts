import type { Prototype, PrototypeScreen } from '../types'
import { resolveScreen } from './discovery'
import { goBack, navigateTo, type ScreenAddress, type SessionState, startSession } from './session'

/**
 * A frame on the canvas made live: it clicks through inside itself, with a history of its own,
 * apart from the screen the viewer has open. It always knows the state it came from, to go back to.
 */
export interface LiveFrame {
  /** The canvas frame that is live. */
  frameKey: string
  /** The state the frame draws when it is not live. */
  origin: ScreenAddress
  /** Where its click-through is, the same way the viewer's own session keeps it. */
  session: SessionState
}

export function startLiveFrame(frameKey: string, origin: ScreenAddress): LiveFrame {
  return { frameKey, origin, session: startSession('', origin) }
}

/** Follows a link inside the live frame. A link to a screen that does not exist goes nowhere. */
export function liveGoTo(
  live: LiveFrame,
  prototype: Prototype,
  screenId: string,
  variant: string | undefined
): LiveFrame {
  const screen = resolveScreen(prototype, { screenId, variant: variant ?? 'default' })
  if (screen === undefined) {
    return live
  }
  return { ...live, session: navigateTo(live.session, { screenId: screen.id, variant: screen.variant }) }
}

export function liveBack(live: LiveFrame): LiveFrame {
  return { ...live, session: goBack(live.session) }
}

/** Back where it started, with its history cleared, as the "Back to" chip on its title does. */
export function liveReturn(live: LiveFrame): LiveFrame {
  return { ...live, session: startSession('', live.origin) }
}

/** Whether the frame has clicked away from the state it draws when not live. */
export function liveAway(live: LiveFrame): boolean {
  const { current } = live.session
  return current.screenId !== live.origin.screenId || current.variant !== live.origin.variant
}

/** The screen the live frame draws now. */
export function liveScreen(live: LiveFrame, prototype: Prototype): PrototypeScreen | undefined {
  return resolveScreen(prototype, live.session.current)
}
