import { createContext, type ReactNode, useContext, useMemo } from 'react'
import { DEFAULT_VARIANT } from '../lib/constants'
import { ALL_VERSION_VIEW, type VersionView, versionView } from '../lib/version'
import type { PrototypeVersion } from '../types'

/** The version picked in the viewer header, and the versions the prototype declares. */
export interface RuntimeVersion {
  versions: PrototypeVersion[]
  /** The picked version's id. Left out for All. */
  selected?: string
}

export interface ScreenNavigation {
  /** Screen currently on stage. */
  screenId: string
  /** Variant of that screen currently on stage. */
  variant: string
  /** Opens another screen. Omitting the variant opens the screen's default state. */
  goToScreen: (screenId: string, options?: { variant?: string }) => void
  /** Returns to the screen clicked from. */
  back: () => void
  canGoBack: boolean
  /** Whether the viewer's hotspot toggle is on. `<Hotspot>` reads it to draw itself. */
  showHotspots: boolean
  /** The version picked in the header. Left out when the prototype declares none, which reads as All. */
  version?: RuntimeVersion
}

const ScreenNavigationContext = createContext<ScreenNavigation | undefined>(undefined)

export interface PrototypeRuntimeProps {
  value: ScreenNavigation
  children: ReactNode
}

/**
 * Supplies the navigation a prototype screen calls into. The viewer renders it around the screen;
 * a test that exercises one screen on its own renders it too.
 */
export function PrototypeRuntime({ value, children }: PrototypeRuntimeProps) {
  return <ScreenNavigationContext.Provider value={value}>{children}</ScreenNavigationContext.Provider>
}

/**
 * Navigation for the screen being rendered. Use it to wire an existing component's own handler:
 *
 * ```tsx
 * const { goToScreen } = useScreenNavigation()
 * <Button onClick={() => goToScreen('confirmation')}>Confirm</Button>
 * ```
 */
export function useScreenNavigation(): ScreenNavigation {
  const value = useContext(ScreenNavigationContext)
  if (value === undefined) {
    throw new Error('useScreenNavigation must be called inside <PrototypeRuntime>. The viewer renders one per screen.')
  }
  return value
}

/** Navigation for components that render outside a prototype, such as the viewer's own chrome. */
export function useOptionalScreenNavigation(): ScreenNavigation | undefined {
  return useContext(ScreenNavigationContext)
}

export const NO_NAVIGATION: ScreenNavigation = {
  screenId: '',
  variant: DEFAULT_VARIANT,
  goToScreen: () => {},
  back: () => {},
  canGoBack: false,
  showHotspots: false,
}

/**
 * The version picked in the viewer header, so a screen can show or hide its parts by version:
 *
 * ```tsx
 * const version = useVersion()
 * const rows = allRows.filter(row => version.includes(row.since, row.until))
 * ```
 *
 * Outside a runtime (Storybook, tests), and for a prototype with no versions, it behaves as All.
 */
export function useVersion(): VersionView {
  const version = useContext(ScreenNavigationContext)?.version
  return useMemo(
    () => (version === undefined ? ALL_VERSION_VIEW : versionView(version.versions, version.selected)),
    [version]
  )
}

export interface SinceProps {
  /** First version the children show in. Left out, they show from the first version. */
  version?: string
  /** Last version the children show in. Left out, they show in every later version. */
  until?: string
  children: ReactNode
}

/**
 * Shows its children only in the versions it names: `<Since version="v2">` from V2 on,
 * `<Since until="v1">` up to V1. All renders like the last version.
 */
export function Since({ version, until, children }: SinceProps) {
  return useVersion().includes(version, until) ? children : null
}
