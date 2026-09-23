import { useCallback, useState } from 'react'

/** Everything about the viewer that is simply on or off. */
export type ViewToggle = 'notes' | 'hotspots' | 'inspect' | 'flow' | 'screens' | 'doc'

export type ViewToggles = Record<ViewToggle, boolean>

/** How the viewer opens: both panels out, comments drawn, nothing else on. */
const OPENING_TOGGLES: ViewToggles = {
  notes: true,
  hotspots: false,
  inspect: false,
  flow: false,
  screens: true,
  doc: true,
}

/** The key that flips each one. */
export const TOGGLE_KEYS: Readonly<Record<string, ViewToggle>> = {
  c: 'notes',
  h: 'hotspots',
  i: 'inspect',
  f: 'flow',
  '[': 'screens',
  ']': 'doc',
}

export interface ViewToggleState {
  toggles: ViewToggles
  /** Flips one. */
  toggle: (name: ViewToggle) => void
  /** Puts one in a known state, for the cases that are not a flip — a link leaving the flow map. */
  setToggle: (name: ViewToggle, on: boolean) => void
}

/**
 * The viewer's on/off state, in one place.
 *
 * Holding them together is what keeps a new toggle from being four separate additions — a piece of
 * state, a key, a pair of props, and a button.
 */
export function useViewToggles(): ViewToggleState {
  const [toggles, setToggles] = useState<ViewToggles>(OPENING_TOGGLES)

  const toggle = useCallback((name: ViewToggle) => {
    setToggles(current => ({ ...current, [name]: !current[name] }))
  }, [])

  const setToggle = useCallback((name: ViewToggle, on: boolean) => {
    setToggles(current => (current[name] === on ? current : { ...current, [name]: on }))
  }, [])

  return { toggles, toggle, setToggle }
}
