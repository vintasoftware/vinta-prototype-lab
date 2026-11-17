import { afterEach, describe, expect, it } from 'vitest'
import { effectiveBackground, keyboardReach, readAccessibility, readContrast } from './accessibility'

let root: HTMLElement

function screenWith(html: string): HTMLElement {
  root = document.createElement('div')
  root.innerHTML = html
  document.body.append(root)
  return root
}

afterEach(() => root?.remove())

describe('readAccessibility', () => {
  it('reads the role and the accessible name the way assistive technology does', () => {
    screenWith('<button aria-label="Book a visit"><svg></svg></button><a href="#">Help</a>')

    expect(readAccessibility(root.querySelector('button') as Element, root)).toMatchObject({
      role: 'button',
      name: 'Book a visit',
    })
    expect(readAccessibility(root.querySelector('a') as Element, root)).toMatchObject({ role: 'link', name: 'Help' })
  })
})

describe('contrast', () => {
  it('measures the text against the backgrounds under it, composited', () => {
    screenWith(
      '<div style="background-color: rgb(0, 0, 0)"><p style="background-color: rgba(255, 255, 255, 0.5); color: rgb(255, 255, 255)">Hi</p></div>'
    )
    const text = root.querySelector('p') as Element

    const background = effectiveBackground(text)
    expect(background?.r).toBeCloseTo(0.5, 2)
    const contrast = readContrast(text)
    // White on the grey that half-white over black makes: 3.95, under the 4.5 body text needs.
    expect(contrast?.ratio).toBeCloseTo(3.95, 1)
    expect(contrast?.passes).toBe(false)
  })

  it('passes AA at 4.5 for body text and 3 for large text', () => {
    screenWith(
      '<p id="small" style="color: rgb(118, 118, 118); font-size: 14px">Small</p><p id="large" style="color: rgb(150, 150, 150); font-size: 24px">Large</p>'
    )

    expect(readContrast(root.querySelector('#small') as Element)).toMatchObject({ minimum: 4.5, passes: true })
    expect(readContrast(root.querySelector('#large') as Element)).toMatchObject({ minimum: 3, passes: false })
  })
})

describe('keyboardReach', () => {
  it('tells the Tab order from script-only focus and from nothing at all', () => {
    screenWith(
      '<button id="a">A</button><div id="b" tabindex="-1">B</div><div id="c">C</div><button id="d" disabled>D</button>'
    )

    expect(keyboardReach(root.querySelector('#a') as Element, root)).toBe('tab')
    expect(keyboardReach(root.querySelector('#b') as Element, root)).toBe('script-only')
    expect(keyboardReach(root.querySelector('#c') as Element, root)).toBe('none')
    expect(keyboardReach(root.querySelector('#d') as Element, root)).toBe('none')
  })

  it("reads an inert region of the screen as unreachable, and ignores the viewer's own inert frame above it", () => {
    const frame = document.createElement('div')
    frame.setAttribute('inert', '')
    document.body.append(frame)
    root = document.createElement('div')
    frame.append(root)
    root.innerHTML = '<button id="ok">OK</button><div inert><button id="no">No</button></div>'

    expect(keyboardReach(root.querySelector('#ok') as Element, root)).toBe('tab')
    expect(keyboardReach(root.querySelector('#no') as Element, root)).toBe('inert')
    frame.remove()
  })
})
