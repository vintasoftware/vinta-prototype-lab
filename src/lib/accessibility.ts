import { computeAccessibleName, getRole } from 'dom-accessibility-api'
import { aaMinimum, composite, contrastRatio, parseColor, type Rgba } from './contrast'

/** How the keyboard reaches an element. */
export type KeyboardReach =
  /** In the Tab order. */
  | 'tab'
  /** Focusable from script, but `tabindex="-1"` keeps it out of the Tab order. */
  | 'script-only'
  /** Not focusable at all. */
  | 'none'
  /** Inside an `inert` region of the screen, where nothing can take focus. */
  | 'inert'
  /** Not drawn: `display: none` or `visibility: hidden` above it. */
  | 'hidden'

export interface ContrastReading {
  ratio: number
  /** The AA minimum for this text's size and weight: 4.5, or 3 for large text. */
  minimum: number
  passes: boolean
}

export interface AccessibilityReading {
  /** The role assistive technology reads, explicit or implied by the element. */
  role: string | undefined
  /** The accessible name, computed the way assistive technology computes it. */
  name: string
  /** Undefined when a colour is in a form the viewer cannot read, so it is not guessed. */
  contrast: ContrastReading | undefined
  keyboard: KeyboardReach
}

/** What a person can focus with the keyboard, before `tabindex` and `disabled` are weighed. */
const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button',
  'input:not([type="hidden"])',
  'select',
  'textarea',
  'summary',
  'iframe',
  'audio[controls]',
  'video[controls]',
  '[contenteditable]:not([contenteditable="false"])',
  '[tabindex]',
].join(', ')

/**
 * The background the text sits on: every background colour from the element up, composited until
 * one is opaque, over white when none is. Background images and gradients are not read.
 */
export function effectiveBackground(element: Element): Rgba | undefined {
  const layers: Rgba[] = []
  for (let current: Element | null = element; current !== null; current = current.parentElement) {
    // An element with no background reports it as transparent; an empty value means the same.
    const color = parseColor(getComputedStyle(current).backgroundColor || 'transparent')
    if (color === undefined) {
      return undefined
    }
    if (color.a > 0) {
      layers.push(color)
    }
    if (color.a >= 1) {
      break
    }
  }
  return layers.reduceRight<Rgba>((under, layer) => composite(layer, under), { r: 1, g: 1, b: 1, a: 1 })
}

/** The text's contrast against its background, and the AA minimum for its size. */
export function readContrast(element: Element): ContrastReading | undefined {
  const style = getComputedStyle(element)
  const text = parseColor(style.color)
  const background = effectiveBackground(element)
  if (text === undefined || background === undefined) {
    return undefined
  }
  const ratio = contrastRatio(composite(text, background), background)
  const minimum = aaMinimum(Number.parseFloat(style.fontSize), Number.parseFloat(style.fontWeight))
  return { ratio: Math.round(ratio * 100) / 100, minimum, passes: ratio >= minimum }
}

/**
 * Whether the keyboard reaches the element, looking only within `root`: the viewer keeps a frame on
 * the canvas inert while it is a picture, and that is not the screen's doing.
 */
export function keyboardReach(element: Element, root: Element): KeyboardReach {
  for (let current: Element | null = element; current !== null && current !== root; current = current.parentElement) {
    if (current.hasAttribute('inert')) {
      return 'inert'
    }
    const style = getComputedStyle(current)
    if (style.display === 'none' || style.visibility === 'hidden') {
      return 'hidden'
    }
  }
  if (!element.matches(FOCUSABLE) || element.matches(':disabled')) {
    return 'none'
  }
  const tabIndex = element.getAttribute('tabindex')
  return tabIndex !== null && Number.parseInt(tabIndex, 10) < 0 ? 'script-only' : 'tab'
}

/** Everything the Dev tab says about the element's accessibility. */
export function readAccessibility(element: Element, root: Element): AccessibilityReading {
  return {
    role: getRole(element) ?? undefined,
    name: computeAccessibleName(element),
    contrast: readContrast(element),
    keyboard: keyboardReach(element, root),
  }
}
