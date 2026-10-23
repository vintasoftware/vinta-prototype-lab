import { afterEach, describe, expect, it } from 'vitest'
import { readPresenting, writePresenting } from './present-param'

describe('present param', () => {
  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('reads presenting from the page address', () => {
    window.history.replaceState(null, '', '/?present#/booking/home')
    expect(readPresenting()).toBe(true)

    window.history.replaceState(null, '', '/#/booking/home')
    expect(readPresenting()).toBe(false)
  })

  it('adds and drops the bare word, keeping the screen route', () => {
    window.history.replaceState(null, '', '/?lang=en#/booking/home')

    writePresenting(true)
    expect(window.location.search).toBe('?lang=en&present')
    expect(window.location.hash).toBe('#/booking/home')

    writePresenting(false)
    expect(window.location.search).toBe('?lang=en')
    expect(window.location.hash).toBe('#/booking/home')
  })
})
