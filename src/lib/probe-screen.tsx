import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { PrototypeRuntime, type ScreenNavigation } from '../components/prototype-runtime'
import type { Prototype, PrototypeScreen } from '../types'
import { FRAME_HEIGHT, VIEWPORT_WIDTH } from './constants'
import { type FlowControl, type FlowLink, type FlowNodeKey, flowNodeKey, type ScreenLinks } from './flow-graph'

/**
 * What the probe clicks: the elements a person can click too. A `div` with an `onClick` is left
 * out on purpose — it is not reachable from the keyboard either, and the map showing no arrow is
 * how a designer finds out.
 */
export const INTERACTIVE_SELECTOR = [
  'button',
  'a[href]',
  '[role="button"]',
  '[role="link"]',
  '[role="menuitem"]',
  '[role="tab"]',
  '[role="option"]',
  'summary',
  'input[type="submit"]',
  'input[type="button"]',
].join(', ')

const LABEL_LENGTH = 40

function indexAmongSiblings(element: Element): number {
  let index = 0
  for (let sibling = element.previousElementSibling; sibling !== null; sibling = sibling.previousElementSibling) {
    index += 1
  }
  return index
}

function childAt(parent: Element, index: number): Element | undefined {
  let child = parent.firstElementChild
  for (let step = 0; step < index && child !== null; step += 1) {
    child = child.nextElementSibling
  }
  return child ?? undefined
}

/** Child indexes from `root` down to `element`; `undefined` when `element` is not under `root`. */
export function elementPath(root: Element, element: Element): number[] | undefined {
  const path: number[] = []
  let current: Element = element
  while (current !== root) {
    const parent = current.parentElement
    if (parent === null) {
      return undefined
    }
    path.unshift(indexAmongSiblings(current))
    current = parent
  }
  return path
}

/** The element `path` points at under `root`, or `undefined` when the tree is shaped differently. */
export function elementAtPath(root: Element, path: readonly number[]): Element | undefined {
  let current: Element | undefined = root
  for (const index of path) {
    current = current === undefined ? undefined : childAt(current, index)
  }
  return current
}

/** The name a person would use for the control: its accessible name first, then what it shows. */
export function controlLabel(element: Element): string {
  const named = element.getAttribute('aria-label') ?? element.getAttribute('title')
  const text = (named ?? element.textContent ?? '').replace(/\s+/g, ' ').trim()
  if (text === '') {
    return element.getAttribute('data-slot') ?? element.tagName.toLowerCase()
  }
  return text.length > LABEL_LENGTH ? `${text.slice(0, LABEL_LENGTH - 1)}…` : text
}

function isEnabled(element: Element): boolean {
  return !element.matches(':disabled, [aria-disabled="true"]')
}

function describe(thrown: unknown): string {
  return thrown instanceof Error ? thrown.message : String(thrown)
}

/**
 * Finds out where every control on a screen leads, by rendering the screen out of sight and
 * clicking each one.
 *
 * The screen renders inside a runtime whose `goToScreen` and `back` record instead of navigating,
 * so the links are read from what the screen does — a `Button` with its own `onClick`, a
 * `ScreenLink`, a `Hotspot` — rather than from any declaration. Clicks are stopped from doing
 * anything to the page the viewer runs in, and the render is torn down before the browser paints.
 *
 * A control that navigates later, from a timer or after an await, is not seen: only what happens
 * during the click counts.
 */
export function probeScreen(screen: PrototypeScreen, doc: Document = document): ScreenLinks {
  const host = doc.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  host.style.cssText = [
    'position:fixed',
    'top:0',
    'left:-100000px',
    `width:${VIEWPORT_WIDTH[screen.viewport]}px`,
    `height:${FRAME_HEIGHT[screen.viewport]}px`,
    'overflow:hidden',
    'visibility:hidden',
    'pointer-events:none',
  ].join(';')
  const mount = doc.createElement('div')
  host.appendChild(mount)
  doc.body.appendChild(host)

  // A link would leave the page, and a form would reload it. The click on a submit button is left
  // alone so the form's own `onSubmit` still runs; only the submission itself is stopped.
  const stopLinks = (event: Event) => {
    if (event.target instanceof Element && event.target.closest('a[href]') !== null) {
      event.preventDefault()
    }
  }
  const stopSubmits = (event: Event) => event.preventDefault()
  host.addEventListener('click', stopLinks, true)
  host.addEventListener('submit', stopSubmits, true)

  const links: FlowLink[] = []
  let clicking: FlowControl | undefined
  let error: string | undefined

  const navigation: ScreenNavigation = {
    screenId: screen.id,
    variant: screen.variant,
    goToScreen: (screenId, options) => {
      if (clicking !== undefined) {
        links.push({
          kind: 'screen',
          control: clicking,
          screenId,
          ...(options?.variant === undefined ? {} : { variant: options.variant }),
        })
      }
    },
    back: () => {
      if (clicking !== undefined) {
        links.push({ kind: 'back', control: clicking })
      }
    },
    canGoBack: true,
    showHotspots: false,
  }

  const root = createRoot(mount, {
    onUncaughtError: thrown => {
      error = describe(thrown)
    },
  })

  try {
    flushSync(() => {
      root.render(
        <PrototypeRuntime value={navigation}>
          <screen.Component />
        </PrototypeRuntime>
      )
    })

    // Every control is located before the first click, so a click that changes the screen does
    // not move the paths of the controls after it.
    const controls = [...mount.querySelectorAll(INTERACTIVE_SELECTOR)].filter(isEnabled).flatMap(element => {
      const path = elementPath(mount, element)
      return path === undefined ? [] : [{ element, control: { path, label: controlLabel(element) } }]
    })

    for (const { element, control } of controls) {
      clicking = control
      try {
        element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      } catch (thrown) {
        error ??= describe(thrown)
      }
      clicking = undefined
    }
  } catch (thrown) {
    error ??= describe(thrown)
  } finally {
    root.unmount()
    host.remove()
  }

  return { links, ...(error === undefined ? {} : { error }) }
}

/** Reads the links of every screen state in the prototype. */
export function probePrototype(prototype: Prototype, doc: Document = document): Map<FlowNodeKey, ScreenLinks> {
  const result = new Map<FlowNodeKey, ScreenLinks>()
  for (const screen of prototype.screens) {
    result.set(flowNodeKey(screen.id, screen.variant), probeScreen(screen, doc))
  }
  return result
}
