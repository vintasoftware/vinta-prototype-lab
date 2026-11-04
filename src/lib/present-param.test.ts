import { afterEach, describe, expect, it } from 'vitest'
import { presentingIn, withPresenting, writePresenting } from './present-param'

describe('presentingIn', () => {
  it('finds the parameter bare, with a value, or among others', () => {
    expect(presentingIn('?present')).toBe(true)
    expect(presentingIn('?present=1')).toBe(true)
    expect(presentingIn('?lang=en&present')).toBe(true)
  })

  it('finds nothing in a query without it', () => {
    expect(presentingIn('')).toBe(false)
    expect(presentingIn('?presenter=ana')).toBe(false)
  })
})

describe('withPresenting', () => {
  const route = '#/p/booking/home'

  it('adds the parameter bare, before the route', () => {
    expect(withPresenting(`http://localhost:6007/${route}`, true)).toBe(`http://localhost:6007/?present${route}`)
  })

  it('keeps the other parameters', () => {
    expect(withPresenting(`http://localhost:6007/?lang=en${route}`, true)).toBe(
      `http://localhost:6007/?lang=en&present${route}`
    )
    expect(withPresenting(`http://localhost:6007/?lang=en&present${route}`, false)).toBe(
      `http://localhost:6007/?lang=en${route}`
    )
  })

  it('leaves no stray question mark when it takes the last parameter out', () => {
    expect(withPresenting(`http://localhost:6007/?present=${route}`, false)).toBe(`http://localhost:6007/${route}`)
  })

  it('never adds the parameter twice', () => {
    expect(withPresenting('http://localhost:6007/?present', true)).toBe('http://localhost:6007/?present')
  })
})

describe('writePresenting', () => {
  afterEach(() => window.history.replaceState(null, '', '/'))

  it('rewrites the address in place', () => {
    window.history.replaceState(null, '', '/#/p/booking/home')
    const entries = window.history.length

    writePresenting(true)
    expect(window.location.search).toBe('?present')
    expect(window.location.hash).toBe('#/p/booking/home')

    writePresenting(false)
    expect(window.location.search).toBe('')
    expect(window.history.length).toBe(entries)
  })
})
