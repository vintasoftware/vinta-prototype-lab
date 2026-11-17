// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { aaMinimum, composite, contrastRatio, isLargeText, parseColor } from './contrast'

describe('parseColor', () => {
  it('reads the forms a browser reports a computed colour in', () => {
    expect(parseColor('rgb(255, 0, 0)')).toEqual({ r: 1, g: 0, b: 0, a: 1 })
    expect(parseColor('rgba(0, 0, 0, 0.5)')).toEqual({ r: 0, g: 0, b: 0, a: 0.5 })
    expect(parseColor('rgb(0 0 255 / 25%)')).toEqual({ r: 0, g: 0, b: 1, a: 0.25 })
    expect(parseColor('color(srgb 0.5 0.5 0.5)')).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 })
    expect(parseColor('transparent')?.a).toBe(0)
  })

  it('converts oklch and oklab to sRGB', () => {
    const white = parseColor('oklch(1 0 0)')
    const black = parseColor('oklab(0 0 0)')

    expect(white?.r).toBeCloseTo(1, 3)
    expect(white?.g).toBeCloseTo(1, 3)
    expect(black?.r).toBeCloseTo(0, 3)
    // Tailwind's blue-500, oklch(0.623 0.214 259.815), is close to rgb(43, 127, 255).
    const blue = parseColor('oklch(0.623 0.214 259.815)')
    expect((blue?.r ?? 0) * 255).toBeCloseTo(43, -1)
    expect((blue?.b ?? 0) * 255).toBeCloseTo(255, -1)
  })

  it('reads a form it does not know as unknown, rather than guessing', () => {
    expect(parseColor('lab(50% 20 30)')).toBeUndefined()
  })
})

describe('contrast', () => {
  const white = { r: 1, g: 1, b: 1, a: 1 }
  const black = { r: 0, g: 0, b: 0, a: 1 }

  it('measures black on white at 21 and a colour on itself at 1', () => {
    expect(contrastRatio(black, white)).toBeCloseTo(21, 5)
    expect(contrastRatio(white, white)).toBe(1)
  })

  it('composites a translucent background over the one under it', () => {
    expect(composite({ r: 0, g: 0, b: 0, a: 0.5 }, white)).toEqual({ r: 0.5, g: 0.5, b: 0.5, a: 1 })
  })

  it('asks 4.5 of body text and 3 of large text', () => {
    expect(isLargeText(24, 400)).toBe(true)
    expect(isLargeText(19, 700)).toBe(true)
    expect(isLargeText(19, 400)).toBe(false)
    expect(aaMinimum(14, 400)).toBe(4.5)
    expect(aaMinimum(24, 400)).toBe(3)
  })
})
