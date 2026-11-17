import { useCallback, useState } from 'react'

/** Everything about the viewer that is simply on or off. */
export type ViewToggle = 'notes' | 'hotspots' | 'inspect' | 'canvas' | 'arrows' | 'screens' | 'doc'

export type ViewToggles = Record<ViewToggle, boolean>

/**
 * How the viewer opens: the screens panel out, and the screen otherwise left alone, with the doc
 * panel shut and comments hidden. `c` and `]` bring them back.
 */
const OPENING_TOGGLES: ViewToggles = {
  notes: false,
  hotspots: false,
  inspect: false,
  canvas: false,
  // The canvas's arrow layer: where each control leads. On, so the canvas opens as the flow map did.
  arrows: true,
  screens: true,
  doc: false,
}

/**
 * The key that flips each one. `a` (arrows) works only on the canvas and `f` opens the canvas with
 * its arrows on, so the viewer handles both itself.
 */
export const TOGGLE_KEYS: Readonly<Record<string, ViewToggle>> = {
  c: 'notes',
  h: 'hotspots',
  i: 'inspect',
  v: 'canvas',
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
