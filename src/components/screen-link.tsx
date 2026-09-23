import type { CSSProperties, ReactNode } from 'react'
import { cn } from '../ui'
import { anchor } from './anchor'
import { useScreenNavigation } from './prototype-runtime'

export interface ScreenLinkProps {
  /** Screen to open. Its id is the screen's filename, minus any order prefix and variant. */
  to: string
  /** State of that screen to open. Defaults to the screen's default variant. */
  variant?: string
  children: ReactNode
  className?: string
  /** Semantic id, when a comment should point at the link itself. */
  anchorId?: string
}

/**
 * Makes text or a static row navigate:
 *
 * ```tsx
 * <ScreenLink to='home'>Back to home</ScreenLink>
 * ```
 *
 * It renders a button of its own, so its children have to be non-interactive. Give a `Button`, an
 * input or a link the navigation directly instead: `onClick={() => goToScreen('review')}` from
 * {@link useScreenNavigation}.
 */
export function ScreenLink({ to, variant, children, className, anchorId }: ScreenLinkProps) {
  const { goToScreen } = useScreenNavigation()

  return (
    <button
      type='button'
      onClick={() => goToScreen(to, variant === undefined ? undefined : { variant })}
      className={cn('cursor-pointer text-left', className)}
      {...(anchorId === undefined ? {} : anchor(anchorId))}
    >
      {children}
    </button>
  )
}

export interface HotspotArea {
  top: string
  left: string
  width: string
  height: string
}

export interface HotspotProps {
  to: string
  variant?: string
  /** Shown when the viewer reveals hotspots, and as the button's accessible name. */
  label: string
  /**
   * Part of the parent to cover, as percentages. Use it over something that scales as one piece — a
   * mock image, a screenshot. Omit it to cover the whole parent, which is what keeps a hotspot on
   * its target at every viewport.
   */
  area?: HotspotArea
  anchorId?: string
}

/**
 * A click region laid over a part of the screen that is not itself a control — a chart, a static
 * image, a row of a mock table. It is invisible until the viewer's hotspot toggle reveals it.
 *
 * By default it fills its parent, so wrap the thing being covered in a `relative` element and the
 * hotspot tracks it through every layout the screen has.
 */
export function Hotspot({ to, variant, label, area, anchorId }: HotspotProps) {
  const { goToScreen, showHotspots } = useScreenNavigation()
  const style: CSSProperties | undefined = area

  return (
    <button
      type='button'
      aria-label={label}
      title={label}
      data-visible={showHotspots}
      className={cn('prototype-hotspot', area === undefined && 'inset-0')}
      {...(style === undefined ? {} : { style })}
      onClick={() => goToScreen(to, variant === undefined ? undefined : { variant })}
      {...(anchorId === undefined ? {} : anchor(anchorId))}
    />
  )
}
