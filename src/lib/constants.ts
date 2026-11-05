/** Variant a screen file gets when its name carries none. */
export const DEFAULT_VARIANT = 'default'

/** Widths of the device shells the viewer draws around a screen. */
export const VIEWPORT_WIDTH = {
  mobile: 390,
  tablet: 834,
  desktop: 1280,
} as const

/** What the viewer calls each viewport. */
export const VIEWPORT_LABEL = {
  mobile: 'Mobile',
  tablet: 'Tablet',
  desktop: 'Desktop',
} as const

/** Heights of those shells. A phone is taller than it is wide; the other two are landscape. */
export const FRAME_HEIGHT = {
  mobile: 844,
  tablet: 820,
  desktop: 820,
} as const

export interface DevicePreset {
  group: 'Phones' | 'Tablets' | 'Desktops'
  id: string
  label: string
  width: number
  height: number
}

/**
 * Devices the frame can take, as in Chrome's device toolbar. Sizes are CSS pixels, portrait for
 * phones and tablets: the current iPhones and iPads, a small iPhone and a small Android for the
 * narrowest layouts, and the desktop sizes people browse at most. Checked in November 2026.
 */
export const DEVICE_PRESETS: readonly DevicePreset[] = [
  { group: 'Phones', id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667 },
  { group: 'Phones', id: 'iphone-17', label: 'iPhone 17', width: 402, height: 874 },
  { group: 'Phones', id: 'iphone-17-pro-max', label: 'iPhone 17 Pro Max', width: 440, height: 956 },
  { group: 'Phones', id: 'pixel-7', label: 'Pixel 7', width: 412, height: 915 },
  { group: 'Phones', id: 'android-small', label: 'Android small', width: 360, height: 800 },
  { group: 'Tablets', id: 'ipad-mini', label: 'iPad mini', width: 744, height: 1133 },
  { group: 'Tablets', id: 'ipad-air', label: 'iPad Air', width: 820, height: 1180 },
  { group: 'Tablets', id: 'ipad-pro-11', label: 'iPad Pro 11"', width: 834, height: 1210 },
  { group: 'Tablets', id: 'ipad-pro-13', label: 'iPad Pro 13"', width: 1032, height: 1376 },
  { group: 'Desktops', id: 'laptop', label: 'Laptop', width: 1280, height: 800 },
  { group: 'Desktops', id: 'desktop-1440', label: 'Desktop', width: 1440, height: 900 },
  { group: 'Desktops', id: 'laptop-1080p', label: 'Laptop 1080p', width: 1536, height: 864 },
  { group: 'Desktops', id: 'full-hd', label: 'Full HD', width: 1920, height: 1080 },
]

/** Widths a dragged frame snaps to: Tailwind's `sm`, `md`, `lg` and `xl` breakpoints. */
export const SNAP_WIDTHS: readonly number[] = [640, 768, 1024, 1280]

/** How close, in CSS pixels, a dragged width has to come to a snap width to land on it. */
export const SNAP_DISTANCE = 8

/** The smallest and largest side the frame takes, however it is sized. */
export const MIN_FRAME_SIDE = 240
export const MAX_FRAME_SIDE = 2560

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
