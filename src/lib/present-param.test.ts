// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { presentModeIn, withPresenting } from './present-param'

describe('presentModeIn', () => {
  it('presents in the frame for the parameter bare, with any other value, or among others', () => {
    expect(presentModeIn('?present')).toBe('frame')
    expect(presentModeIn('?present=1')).toBe('frame')
    expect(presentModeIn('?lang=en&present')).toBe('frame')
  })

  it('fills the window for ?present=fill', () => {
    expect(presentModeIn('?present=fill')).toBe('fill')
    expect(presentModeIn('?lang=en&present=fill')).toBe('fill')
  })

  it('finds nothing in a query without it', () => {
    expect(presentModeIn('')).toBeUndefined()
    expect(presentModeIn('?presenter=ana')).toBeUndefined()
  })
})

describe('withPresenting', () => {
  const route = '#/p/booking/home'

  it('adds the parameter bare, before the route', () => {
    expect(withPresenting(`http://localhost:6007/${route}`, 'frame')).toBe(`http://localhost:6007/?present${route}`)
  })

  it('writes the fill mode as its value', () => {
    expect(withPresenting(`http://localhost:6007/${route}`, 'fill')).toBe(`http://localhost:6007/?present=fill${route}`)
  })

  it('keeps the other parameters', () => {
    expect(withPresenting(`http://localhost:6007/?lang=en${route}`, 'frame')).toBe(
      `http://localhost:6007/?lang=en&present${route}`
    )
    expect(withPresenting(`http://localhost:6007/?lang=en&present${route}`, undefined)).toBe(
      `http://localhost:6007/?lang=en${route}`
    )
  })

  it('leaves no stray question mark when it takes the last parameter out', () => {
    expect(withPresenting(`http://localhost:6007/?present=${route}`, undefined)).toBe(`http://localhost:6007/${route}`)
    expect(withPresenting(`http://localhost:6007/?present=fill${route}`, undefined)).toBe(
      `http://localhost:6007/${route}`
    )
  })

  it('never adds the parameter twice', () => {
    expect(withPresenting('http://localhost:6007/?present', 'frame')).toBe('http://localhost:6007/?present')
    expect(withPresenting('http://localhost:6007/?present', 'fill')).toBe('http://localhost:6007/?present=fill')
  })
})
