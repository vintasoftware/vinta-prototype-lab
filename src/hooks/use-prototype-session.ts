import { useCallback, useEffect, useMemo, useState } from 'react'
import { DEFAULT_VARIANT } from '../lib/constants'
import { entryScreenId, resolveScreen } from '../lib/discovery'
import { formatHash, type HashRoute, parseHash, type ScreenRoute } from '../lib/hash-route'
import { goBack, navigateTo, type SessionState, selectComponent, showVariant, startSession } from '../lib/session'
import type { Prototype, PrototypeScreen } from '../types'

const EMPTY_STATE: SessionState = { slug: '', current: { screenId: '', variant: DEFAULT_VARIANT }, history: [] }

/** Opening state for a prototype: the entry screen the doc names, in its default variant. */
export function openingState(prototype: Prototype): SessionState {
  return startSession(prototype.slug, { screenId: entryScreenId(prototype) ?? '', variant: DEFAULT_VARIANT })
}

/** Reads a URL into a session, ignoring the parts of it that name nothing. */
export function stateFromRoute(prototypes: readonly Prototype[], route: HashRoute): SessionState {
  const prototype = prototypes.find(candidate => candidate.slug === route.slug) ?? prototypes[0]
  if (prototype === undefined) {
    return EMPTY_STATE
  }

  const opening = openingState(prototype)
  const screenId =
    route.screenId !== undefined && prototype.screens.some(screen => screen.id === route.screenId)
      ? route.screenId
      : opening.current.screenId

  const variant =
    route.variant !== undefined &&
    prototype.screens.some(screen => screen.id === screenId && screen.variant === route.variant)
      ? route.variant
      : DEFAULT_VARIANT

  // A pick belongs to one rendering of one screen, so it is dropped when either fallback fires.
  const honoured = route.screenId === screenId && (route.variant ?? DEFAULT_VARIANT) === variant

  return startSession(prototype.slug, { screenId, variant }, honoured ? route.component : undefined)
}

/** Reads the page's hash into a session. The slugs tell the parser where a grouped slug ends. */
function stateFromHash(prototypes: readonly Prototype[], hash: string): SessionState {
  return stateFromRoute(
    prototypes,
    parseHash(
      hash,
      prototypes.map(prototype => prototype.slug)
    )
  )
}

/** The URL this session stands for. Written by the effect below, and recognised by the one after it. */
function routeFor(state: SessionState): ScreenRoute {
  return {
    slug: state.slug,
    screenId: state.current.screenId,
    variant: state.current.variant,
    ...(state.component === undefined ? {} : { component: state.component }),
  }
}

export interface PrototypeSession {
  prototype: Prototype | undefined
  screen: PrototypeScreen | undefined
  state: SessionState
  openPrototype: (slug: string) => void
  goToScreen: (screenId: string, options?: { variant?: string }) => void
  selectVariant: (variant: string) => void
  /** Picks a component on the screen, putting it in the URL so the view can be linked to. */
  pickComponent: (component: string | undefined) => void
  back: () => void
  canGoBack: boolean
  restart: () => void
}

/**
 * Holds which prototype, screen and variant are on stage, and keeps the URL in step so a designer
 * can paste a link to one screen.
 *
 * The URL is replaced rather than pushed: the prototype has its own Back button, and a second
 * history stack behind it would make the browser's Back mean two different things.
 */
export function usePrototypeSession(prototypes: readonly Prototype[]): PrototypeSession {
  const [state, setState] = useState<SessionState>(() =>
    stateFromHash(prototypes, typeof window === 'undefined' ? '' : window.location.hash)
  )

  const prototype = useMemo(() => prototypes.find(candidate => candidate.slug === state.slug), [prototypes, state.slug])
  const screen = useMemo(
    () => (prototype === undefined ? undefined : resolveScreen(prototype, state.current)),
    [prototype, state.current]
  )

  useEffect(() => {
    if (state.slug === '') {
      return
    }
    const next = formatHash(routeFor(state))
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [state])

  useEffect(() => {
    const onHashChange = () => {
      setState(current => {
        // A URL that already names what is on stage is the one this hook just wrote. Rebuilding the
        // session from it would throw away the history behind the Back button.
        const written = current.slug === '' ? '' : formatHash(routeFor(current))
        if (window.location.hash === written) {
          return current
        }
        return stateFromHash(prototypes, window.location.hash)
      })
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [prototypes])

  const openPrototype = useCallback(
    (slug: string) => {
      const next = prototypes.find(candidate => candidate.slug === slug)
      if (next !== undefined) {
        setState(openingState(next))
      }
    },
    [prototypes]
  )

  const goToScreen = useCallback((screenId: string, options?: { variant?: string }) => {
    setState(current => navigateTo(current, { screenId, variant: options?.variant ?? DEFAULT_VARIANT }))
  }, [])

  const selectVariant = useCallback((variant: string) => {
    setState(current => showVariant(current, variant))
  }, [])

  const pickComponent = useCallback((component: string | undefined) => {
    setState(current => selectComponent(current, component))
  }, [])

  const back = useCallback(() => {
    setState(goBack)
  }, [])

  const restart = useCallback(() => {
    setState(current => {
      const target = prototypes.find(candidate => candidate.slug === current.slug)
      return target === undefined ? current : openingState(target)
    })
  }, [prototypes])

  return {
    prototype,
    screen,
    state,
    openPrototype,
    goToScreen,
    selectVariant,
    pickComponent,
    back,
    canGoBack: state.history.length > 0,
    restart,
  }
}
