import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { ANCHOR_ATTRIBUTE } from '../components/anchor'
import { NO_NAVIGATION, PrototypeRuntime, type ScreenNavigation } from '../components/prototype-runtime'
import { DEFAULT_VARIANT, FRAME_HEIGHT, VIEWPORT_WIDTH } from '../lib/constants'
import { parseHash } from '../lib/hash-route'
import type { Prototype } from '../types'
import { screenForStep, type Tour, type TourStep } from './tours'

/** What a person can click: the controls a `click` anchor may name, or hold. */
export const CLICKABLE =
  'button, a[href], [role="button"], [role="link"], [role="tab"], [role="menuitem"], summary, input'

/** How long a check waits for a screen to draw the step's elements before it calls them missing. */
const WAIT_MS = 1500

export interface StepCheck {
  tourId: string
  /** Counted from 1, as the player shows it. */
  step: number
  title: string
  /** Empty when the step plays as written. */
  problems: string[]
}

interface Destination {
  prototype: string
  screen: string
  variant: string
}

function describe(destination: Destination): string {
  return `${destination.prototype}/${destination.screen}/${destination.variant}`
}

function nextFrame(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(() => resolve())
    } else {
      setTimeout(resolve, 16)
    }
  })
}

async function waitFor<T>(find: () => T | null | undefined): Promise<T | undefined> {
  const until = Date.now() + WAIT_MS
  for (;;) {
    const found = find()
    if (found !== null && found !== undefined) {
      return found
    }
    if (Date.now() > until) {
      return undefined
    }
    await nextFrame()
  }
}

/**
 * Renders one step's screen, as the player does, and checks it: the screen and state exist, the
 * anchor is drawn, and the `click` control leads to the next step's screen. The click is real, with
 * the navigation captured, so a click that only changes the screen's own state is caught.
 */
export async function checkStep(
  prototypes: readonly Prototype[],
  step: TourStep,
  next: TourStep | undefined,
  host: HTMLElement
): Promise<string[]> {
  const screen = screenForStep(prototypes, step)
  if (screen === undefined) {
    return [`${step.prototype}/${step.screen}/${step.variant} is not a screen and state of the prototype.`]
  }

  const problems: string[] = []
  const slugs = prototypes.map(prototype => prototype.slug)
  let destination: Destination | undefined
  const navigation: ScreenNavigation = {
    ...NO_NAVIGATION,
    screenId: screen.id,
    variant: screen.variant,
    goToScreen: (screenId, options) => {
      destination ??= { prototype: step.prototype, screen: screenId, variant: options?.variant ?? DEFAULT_VARIANT }
    },
  }

  const frame = document.createElement('div')
  frame.style.cssText = `position:relative;overflow:auto;width:${VIEWPORT_WIDTH[screen.viewport]}px;height:${FRAME_HEIGHT[screen.viewport]}px`
  host.replaceChildren(frame)
  // A link such as `<a href='#/p/…'>` would move the page; read where it goes and stay.
  const onClick = (event: MouseEvent) => {
    const link = (event.target as Element | null)?.closest('a[href]')
    const href = link?.getAttribute('href') ?? ''
    if (href.startsWith('#/p/')) {
      event.preventDefault()
      const route = parseHash(href, slugs)
      if (route.slug !== undefined && route.screenId !== undefined) {
        destination ??= { prototype: route.slug, screen: route.screenId, variant: route.variant ?? DEFAULT_VARIANT }
      }
    }
  }
  frame.addEventListener('click', onClick, true)

  const root = createRoot(frame)
  try {
    flushSync(() => {
      root.render(
        <PrototypeRuntime value={navigation}>
          <screen.Component />
        </PrototypeRuntime>
      )
    })

    if (step.anchor !== undefined) {
      const anchor = await waitFor(() => frame.querySelector(`[${ANCHOR_ATTRIBUTE}="${step.anchor}"]`))
      if (anchor === undefined) {
        problems.push(`anchor "${step.anchor}" is not on the screen.`)
      }
    }

    if (step.click !== undefined) {
      const element = await waitFor(() => frame.querySelector(`[${ANCHOR_ATTRIBUTE}="${step.click}"]`))
      const control =
        element === undefined ? null : element.matches(CLICKABLE) ? element : element.querySelector(CLICKABLE)
      if (element === undefined) {
        problems.push(`click "${step.click}" is not on the screen.`)
      } else if (control === null) {
        problems.push(`click "${step.click}" holds nothing a person can click.`)
      } else if (next === undefined) {
        problems.push('the last step has a click, but there is no step to go to. Leave the click out.')
      } else {
        flushSync(() => (control as HTMLElement).click())
        await nextFrame()
        const expected: Destination = { prototype: next.prototype, screen: next.screen, variant: next.variant }
        if (destination === undefined) {
          problems.push(
            `clicking "${step.click}" opens no screen; it only changes this one. Leave the click out of this step.`
          )
        } else if (describe(destination) !== describe(expected)) {
          problems.push(
            `clicking "${step.click}" opens ${describe(destination)}, but the next step is ${describe(expected)}.`
          )
        }
      }
    }
  } catch (error) {
    problems.push(`the screen failed to render: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    root.unmount()
    frame.removeEventListener('click', onClick, true)
    host.replaceChildren()
  }
  return problems
}

/** Checks every step of every tour, one at a time, and reports each step's problems. */
export async function checkTours(
  tours: readonly Tour[],
  prototypes: readonly Prototype[],
  host: HTMLElement,
  onStep?: (result: StepCheck) => void
): Promise<StepCheck[]> {
  const results: StepCheck[] = []
  for (const tour of tours) {
    for (const [index, step] of tour.steps.entries()) {
      const problems = await checkStep(prototypes, step, tour.steps[index + 1], host)
      const result = { tourId: tour.id, step: index + 1, title: step.title, problems }
      results.push(result)
      onStep?.(result)
    }
  }
  return results
}
