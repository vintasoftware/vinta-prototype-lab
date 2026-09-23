import { createContext, type ReactNode, useContext } from 'react'
import { DEFAULT_VARIANT } from '../lib/constants'

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
