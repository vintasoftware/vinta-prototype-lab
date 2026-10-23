/** A colour in sRGB, channels from 0 to 1, with its opacity. */
export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

const clamp = (value: number) => Math.min(1, Math.max(0, value))

/** `0.5`, `50%`, `none` → a number; a percentage reads as a fraction of `scale`. */
function component(token: string | undefined, scale = 1): number {
  if (token === undefined || token === 'none') {
    return 0
  }
  return token.endsWith('%') ? (Number.parseFloat(token) / 100) * scale : Number.parseFloat(token)
}

/** The numbers inside `name(...)`, split on spaces, commas and the slash before the opacity. */
function args(text: string): { channels: string[]; alpha: string | undefined } {
  const inner = text.slice(text.indexOf('(') + 1, text.lastIndexOf(')'))
  const [main = '', alpha] = inner.split('/')
  const channels = main.trim().split(/[\s,]+/)
  // `rgba(1, 2, 3, 0.5)` carries the opacity as a fourth channel.
  if (alpha === undefined && channels.length === 4 && text.startsWith('rgb')) {
    return { channels: channels.slice(0, 3), alpha: channels[3] }
  }
  return { channels, alpha: alpha?.trim() }
}

const fromLinear = (value: number) => (value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055)

/** OKLab to sRGB, by the conversion its author published. */
function oklabToRgb(l: number, a: number, b: number): [number, number, number] {
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3
  const r = 4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_
  const g = -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_
  const bl = -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_
  return [clamp(fromLinear(r)), clamp(fromLinear(g)), clamp(fromLinear(bl))]
}

/**
 * Reads a colour as the browser reports a computed one: `rgb()`, `rgba()`, `color(srgb ...)`,
 * `oklch()` or `oklab()`, or `transparent`. Any other form reads as `undefined`, so a contrast is
 * reported as unknown rather than guessed.
 */
export function parseColor(text: string): Rgba | undefined {
  const value = text.trim().toLowerCase()
  if (value === 'transparent') {
    return { r: 0, g: 0, b: 0, a: 0 }
  }
  const { channels, alpha } = args(value)
  const a = alpha === undefined ? 1 : clamp(component(alpha))
  const [first, second, third] = channels

  if (value.startsWith('rgb')) {
    return { r: component(first, 255) / 255, g: component(second, 255) / 255, b: component(third, 255) / 255, a }
  }
  if (value.startsWith('color(srgb ')) {
    const [, red, green, blue] = channels
    return { r: component(red), g: component(green), b: component(blue), a }
  }
  if (value.startsWith('oklch(')) {
    const l = component(first)
    const c = component(second, 0.4)
    const h = (component(third) * Math.PI) / 180
    const [r, g, b] = oklabToRgb(l, c * Math.cos(h), c * Math.sin(h))
    return { r, g, b, a }
  }
  if (value.startsWith('oklab(')) {
    const [r, g, b] = oklabToRgb(component(first), component(second, 0.4), component(third, 0.4))
    return { r, g, b, a }
  }
  return undefined
}

/** `top` drawn over `bottom`, as the browser composites one translucent background over another. */
export function composite(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a + bottom.a * (1 - top.a)
  if (a === 0) {
    return { r: 0, g: 0, b: 0, a: 0 }
  }
  const mix = (front: number, back: number) => (front * top.a + back * bottom.a * (1 - top.a)) / a
  return { r: mix(top.r, bottom.r), g: mix(top.g, bottom.g), b: mix(top.b, bottom.b), a }
}

/** Relative luminance, as WCAG defines it. */
export function luminance({ r, g, b }: Rgba): number {
  const linear = (channel: number) => (channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4)
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

/** The WCAG contrast ratio of two opaque colours, from 1 to 21. */
export function contrastRatio(a: Rgba, b: Rgba): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number]
  return (light + 0.05) / (dark + 0.05)
}

/** Large text, for WCAG: 24px and up, or 18.66px (14pt) and up when bold. */
export function isLargeText(fontSizePx: number, fontWeight: number): boolean {
  return fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700)
}

/** The AA minimum for text of this size: 3 for large text, 4.5 for the rest. */
export function aaMinimum(fontSizePx: number, fontWeight: number): number {
  return isLargeText(fontSizePx, fontWeight) ? 3 : 4.5
}
