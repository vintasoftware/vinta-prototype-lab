import type { ComponentType } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useScreenNavigation } from '../components/prototype-runtime'
import { Hotspot, ScreenLink } from '../components/screen-link'
import type { PrototypeScreen } from '../types'
import { controlLabel, elementAtPath, elementPath, probeScreen } from './probe-screen'

function screenOf(Component: ComponentType, id = 'home'): PrototypeScreen {
  return {
    id,
    title: id,
    variant: 'default',
    variantLabel: 'Default',
    viewport: 'mobile',
    order: 10,
    Component,
    source: `${id}.tsx`,
  }
}

function HomeScreen() {
  const { goToScreen, back } = useScreenNavigation()
  return (
    <div>
      <header>
        <button type='button' aria-label='Back' onClick={back}>
          ‹
        </button>
        <h1>Home</h1>
      </header>
      <button type='button' onClick={() => goToScreen('choose-time')}>
        Book a visit
      </button>
      <button type='button' disabled onClick={() => goToScreen('never')}>
        Disabled
      </button>
      <button type='button'>Does nothing</button>
      <ScreenLink to='review' variant='empty'>
        Review
      </ScreenLink>
      <div className='relative'>
        <Hotspot to='choose-time' variant='no-slots' label='Next week' />
      </div>
      <form onSubmit={() => goToScreen('submitted')}>
        <button type='submit'>Send</button>
      </form>
      <a href='https://example.com' onClick={() => goToScreen('external')}>
        Terms
      </a>
    </div>
  )
}

describe('probeScreen', () => {
  // The probe renders on its own, outside the test renderer, so React must not expect `act()`.
  beforeEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = false
  })
  afterEach(() => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
  })

  it('reads where each control leads, however the screen wires it', () => {
    const { links, error } = probeScreen(screenOf(HomeScreen))

    expect(error).toBeUndefined()
    expect(links).toEqual([
      { kind: 'back', control: { path: [0, 0, 0], label: 'Back' } },
      { kind: 'screen', control: { path: [0, 1], label: 'Book a visit' }, screenId: 'choose-time' },
      { kind: 'screen', control: { path: [0, 4], label: 'Review' }, screenId: 'review', variant: 'empty' },
      {
        kind: 'screen',
        control: { path: [0, 5, 0], label: 'Next week' },
        screenId: 'choose-time',
        variant: 'no-slots',
      },
      { kind: 'screen', control: { path: [0, 6, 0], label: 'Send' }, screenId: 'submitted' },
      { kind: 'screen', control: { path: [0, 7], label: 'Terms' }, screenId: 'external' },
    ])
  })

  it('leaves nothing behind in the document', () => {
    const before = document.body.children.length

    probeScreen(screenOf(HomeScreen))

    expect(document.body.children.length).toBe(before)
    expect(document.querySelector('h1')).toBeNull()
  })

  it('does not let a link take the page anywhere', () => {
    const href = window.location.href

    probeScreen(screenOf(HomeScreen))

    expect(window.location.href).toBe(href)
  })

  it('reports a screen that cannot render instead of throwing', () => {
    const Broken = () => {
      throw new Error('boom')
    }

    const { links, error } = probeScreen(screenOf(Broken))

    expect(links).toEqual([])
    expect(error).toBe('boom')
  })

  it('reads a screen with no controls as having no links', () => {
    expect(probeScreen(screenOf(() => <p>Nothing here</p>))).toEqual({ links: [] })
  })
})

describe('elementPath and elementAtPath', () => {
  it('round-trips through the same tree', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div><span></span><button></button></div><p></p>'
    const button = root.querySelector('button') as Element

    const path = elementPath(root, button)

    expect(path).toEqual([0, 1])
    expect(elementAtPath(root, path ?? [])).toBe(button)
  })

  it('finds nothing for a path the tree does not have', () => {
    const root = document.createElement('div')
    root.innerHTML = '<div></div>'

    expect(elementAtPath(root, [0, 3])).toBeUndefined()
    expect(elementPath(root, document.createElement('span'))).toBeUndefined()
  })
})

describe('controlLabel', () => {
  const element = (html: string) => {
    const holder = document.createElement('div')
    holder.innerHTML = html
    return holder.firstElementChild as Element
  }

  it('prefers the accessible name, then the title, then the text', () => {
    expect(controlLabel(element('<button aria-label="Close">×</button>'))).toBe('Close')
    expect(controlLabel(element('<button title="Next week"></button>'))).toBe('Next week')
    expect(controlLabel(element('<button>  Book\n   a visit </button>'))).toBe('Book a visit')
  })

  it('falls back to the component name for a control that shows only an icon', () => {
    expect(controlLabel(element('<button data-slot="button"><svg></svg></button>'))).toBe('button')
    expect(controlLabel(element('<a href="#"></a>'))).toBe('a')
  })

  it('shortens a long label', () => {
    const label = controlLabel(element(`<button>${'x'.repeat(60)}</button>`))

    expect(label).toHaveLength(40)
    expect(label.endsWith('…')).toBe(true)
  })
})
