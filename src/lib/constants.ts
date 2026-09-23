/** Variant a screen file gets when its name carries none. */
export const DEFAULT_VARIANT = 'default'

/** Widths of the device shells the viewer draws around a screen. */
export const VIEWPORT_WIDTH = {
  mobile: 390,
  tablet: 834,
  desktop: 1280,
} as const

/** Heights of those shells. A phone is taller than it is wide; the other two are landscape. */
export const FRAME_HEIGHT = {
  mobile: 844,
  tablet: 820,
  desktop: 820,
} as const

/**
 * How far the flow map shrinks a screen of each viewport. A phone can stay half size and remain
 * readable; a desktop screen has to shrink further or one card would fill the canvas.
 */
export const THUMBNAIL_SCALE = {
  mobile: 0.5,
  tablet: 0.3,
  desktop: 0.22,
} as const

/**
 * Where Storybook runs unless the config says otherwise. The viewer reads its index from here to
 * link a component in the tree to the page that documents it, and shows no links when nothing
 * answers.
 */
export const STORYBOOK_URL = 'http://localhost:6006'
