import { describe, expect, it } from 'vitest'
import { collectTokenNames, readStyle, resolveTokens, spacingPrefixes, tokenNameFor, utilityFor } from './style-tokens'

describe('utilityFor', () => {
  it('finds the utility that sets each kind of style', () => {
    const classes = [
      'flex',
      'gap-3',
      'bg-muted',
      'text-sm',
      'text-muted-foreground',
      'font-semibold',
      'rounded-lg',
      'border',
      'border-border',
    ]

    expect(utilityFor(classes, 'background')?.utility).toBe('bg-muted')
    expect(utilityFor(classes, 'color')?.utility).toBe('text-muted-foreground')
    expect(utilityFor(classes, 'font-size')?.utility).toBe('text-sm')
    expect(utilityFor(classes, 'font-weight')?.utility).toBe('font-semibold')
    expect(utilityFor(classes, 'radius')?.utility).toBe('rounded-lg')
    expect(utilityFor(classes, 'border-color')?.utility).toBe('border-border')
    expect(utilityFor(classes, 'spacing', 'gx')?.utility).toBe('gap-3')
  })

  it('reads only the classes that apply at rest, not under a variant', () => {
    expect(utilityFor(['hover:bg-accent', 'bg-card'], 'background')?.utility).toBe('bg-card')
    expect(utilityFor(['md:p-6'], 'spacing', 'pt')).toBeUndefined()
  })

  it('takes the most specific spacing utility for a side', () => {
    expect(spacingPrefixes('pt')).toEqual(['pt', 'py', 'p'])
    expect(spacingPrefixes('ml')).toEqual(['ml', 'mx', 'm'])
    expect(utilityFor(['p-6', 'py-4', 'pt-2'], 'spacing', 'pt')?.utility).toBe('pt-2')
    expect(utilityFor(['p-6', 'py-4'], 'spacing', 'pb')?.utility).toBe('py-4')
    expect(utilityFor(['p-6', 'py-4'], 'spacing', 'pl')?.utility).toBe('p-6')
  })

  it('reads an arbitrary text value as a size when it is a length, and as a colour otherwise', () => {
    expect(utilityFor(['text-[0.8rem]', 'text-foreground'], 'color')?.utility).toBe('text-foreground')
    expect(utilityFor(['text-[0.8rem]'], 'font-size')?.utility).toBe('text-[0.8rem]')
    expect(utilityFor(['text-[#1a1a1a]'], 'color')?.utility).toBe('text-[#1a1a1a]')
    expect(utilityFor(['text-[#1a1a1a]'], 'font-size')).toBeUndefined()
  })

  it('does not read a text size or alignment as a colour, or a border width as a border colour', () => {
    expect(utilityFor(['text-center', 'text-lg'], 'color')).toBeUndefined()
    expect(utilityFor(['border-2', 'border-t', 'border-dashed'], 'border-color')).toBeUndefined()
  })
})

describe('tokenNameFor', () => {
  it("names the token behind a utility the way Tailwind's theme does", () => {
    expect(tokenNameFor('background', 'muted')).toBe('--color-muted')
    expect(tokenNameFor('color', 'primary/50')).toBe('--color-primary')
    expect(tokenNameFor('font-size', 'sm')).toBe('--text-sm')
    expect(tokenNameFor('radius', 'DEFAULT')).toBe('--radius')
    expect(tokenNameFor('spacing', '3')).toBe('--spacing')
  })

  it('names no token for an arbitrary value', () => {
    expect(tokenNameFor('background', '[#ff0000]')).toBeUndefined()
    expect(tokenNameFor('spacing', '[13px]')).toBeUndefined()
  })
})

describe('readStyle', () => {
  const tokens = new Map([
    ['--color-muted', 'rgb(245, 245, 245)'],
    ['--color-secondary', 'rgb(245, 245, 245)'],
    ['--spacing', '4px'],
  ])

  it('names the utility and its token, then the value', () => {
    expect(readStyle('Background', 'rgb(245, 245, 245)', 'background', ['bg-muted'], tokens)).toEqual({
      label: 'Background',
      value: 'rgb(245, 245, 245)',
      utility: 'bg-muted',
      tokens: ['--color-muted'],
      notToken: false,
    })
  })

  it('reads a spacing step as the spacing token times the step', () => {
    expect(readStyle('Gap', '12px', 'spacing', ['gap-3'], tokens, 'g').tokens).toEqual(['--spacing × 3'])
  })

  it('names every token a value equals when no utility set it, never just one of them', () => {
    expect(readStyle('Background', 'rgb(245, 245, 245)', 'background', [], tokens).tokens).toEqual([
      '--color-muted',
      '--color-secondary',
    ])
  })

  it('finds the token of a theme declared inline, which names it without the colour prefix', () => {
    const inline = new Map([['--primary-foreground', 'rgb(255, 255, 255)']])

    expect(readStyle('Text', 'rgb(255, 255, 255)', 'color', ['text-primary-foreground'], inline).tokens).toEqual([
      '--primary-foreground',
    ])
  })

  it('reads the line height a text size utility sets from its own token', () => {
    const lineHeights = new Map([['--text-sm--line-height', '20px']])

    expect(readStyle('Line height', '20px', 'line-height', ['text-sm'], lineHeights)).toMatchObject({
      utility: 'text-sm',
      tokens: ['--text-sm--line-height'],
      notToken: false,
    })
  })

  it('reads a colour keyword as no token, and nothing wrong', () => {
    const reading = readStyle('Border', 'rgba(0, 0, 0, 0)', 'border-color', ['border-transparent'], tokens)

    expect(reading).toMatchObject({ utility: 'border-transparent', tokens: [], notToken: false })
  })

  it('flags a value no token produces', () => {
    const reading = readStyle('Background', 'rgb(255, 0, 0)', 'background', ['bg-[#ff0000]'], tokens)

    expect(reading.utility).toBe('bg-[#ff0000]')
    expect(reading.notToken).toBe(true)
  })
})

describe('reading the page', () => {
  it('collects the custom properties set on :root, inside layers too, and resolves them on a probe', () => {
    const style = document.createElement('style')
    style.textContent =
      ':root { --color-muted: rgb(1, 2, 3); color: red; } .card { --not-a-token: 1px; } :root { --spacing: 4px; }'
    document.head.append(style)
    const within = document.createElement('div')
    document.body.append(within)

    try {
      const [first, , third] = Array.from(style.sheet?.cssRules ?? [])
      // happy-dom drops @layer blocks, which browsers keep; a layer is a rule holding rules.
      const layered = { styleSheets: [{ cssRules: [first, { cssRules: [third] }] }] } as unknown as Document

      expect(collectTokenNames()).toEqual(['--color-muted', '--spacing'])
      expect(collectTokenNames(layered)).toEqual(['--color-muted', '--spacing'])
      expect(resolveTokens(['--color-muted'], 'background', within).get('--color-muted')).toBe('rgb(1, 2, 3)')
    } finally {
      style.remove()
      within.remove()
    }
  })
})
