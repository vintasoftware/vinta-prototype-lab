import { describe, expect, it } from 'vitest'
import { componentSelector, resolveComponentSelector } from './component-link'
import { buildComponentTree, type ComponentNode, type ComponentTree } from './component-tree'

/**
 * A screen shaped like the ones designers build: two cards, one of them named, each holding a
 * couple of buttons. Built through the real reader so the tree matches what the viewer sees.
 */
function screenTree(markup: string): ComponentTree {
  const frame = document.createElement('div')
  frame.innerHTML = markup
  return buildComponentTree(frame)
}

const HOME = screenTree(`
  <header><h1>Good morning</h1></header>
  <div data-slot="card" data-proto-id="follow-up-card">
    <div data-slot="card-header"><div data-slot="card-title">Follow-up visit</div></div>
    <div data-slot="card-content">
      <p>Dr. Okafor asked to see you.</p>
      <button data-slot="button">Book a visit</button>
    </div>
  </div>
  <div data-slot="card">
    <div data-slot="card-header"><div data-slot="card-title">Refill</div></div>
    <div data-slot="card-content">
      <button data-slot="button">View medication</button>
      <button data-slot="button" data-proto-id="reorder">Reorder</button>
    </div>
  </div>
`)

function nodeAt(tree: ComponentTree, path: string): ComponentNode {
  const node = tree.nodeByPath.get(path)
  if (node === undefined) {
    throw new Error(`the fixture has no node at ${path}`)
  }
  return node
}

function selectorFor(tree: ComponentTree, path: string): string {
  return componentSelector(tree, nodeAt(tree, path))
}

/** The node a selector lands on, named the way the tree shows it. */
function landsOn(tree: ComponentTree, selector: string): string | undefined {
  const path = resolveComponentSelector(tree, selector)
  return path === undefined ? undefined : `${nodeAt(tree, path).label}@${path}`
}

describe('componentSelector', () => {
  it('names a component that has a semantic id by it alone', () => {
    const card = HOME.nodeByPath.get('1')

    expect(card?.anchorId).toBe('follow-up-card')
    expect(selectorFor(HOME, '1')).toBe('follow-up-card')
  })

  it('names a component without an id by the path from the nearest id above it', () => {
    expect(selectorFor(HOME, '1.1.0')).toBe('follow-up-card/CardContent/Button')
  })

  it('starts the path at the screen when nothing above the component has an id', () => {
    expect(selectorFor(HOME, '2.0.0')).toBe('/Card~1/CardHeader/CardTitle')
  })

  it('numbers a step only when its siblings share its name', () => {
    // Two buttons under the same content: the first is bare, the second carries its place.
    const twoButtons = screenTree(
      '<div data-slot="card-content"><button data-slot="button">A</button><button data-slot="button">B</button></div>'
    )

    expect(selectorFor(twoButtons, '0.0')).toBe('/CardContent/Button')
    expect(selectorFor(twoButtons, '0.1')).toBe('/CardContent/Button~1')
  })

  it('names a plain element of the page the same way', () => {
    expect(selectorFor(HOME, '0.0')).toBe('/header/h1')
  })
})

describe('resolveComponentSelector', () => {
  it('reads back every name it writes', () => {
    for (const [path, node] of HOME.nodeByPath) {
      expect(landsOn(HOME, componentSelector(HOME, node))).toBe(`${node.label}@${path}`)
    }
  })

  it('finds a component under an id, and one under the screen', () => {
    expect(landsOn(HOME, 'follow-up-card/CardContent/Button')).toBe('Button@1.1.0')
    expect(landsOn(HOME, '/Card~1/CardHeader/CardTitle')).toBe('CardTitle@2.0.0')
  })

  it('finds nothing when the screen has no such component', () => {
    expect(resolveComponentSelector(HOME, 'confirm-booking')).toBeUndefined()
    expect(resolveComponentSelector(HOME, 'follow-up-card/CardContent/Input')).toBeUndefined()
    expect(resolveComponentSelector(HOME, '/Card~9/CardHeader')).toBeUndefined()
    expect(resolveComponentSelector(HOME, '')).toBeUndefined()
  })

  it('ignores a step whose number is not one', () => {
    expect(resolveComponentSelector(HOME, '/Card~x')).toBeUndefined()
    expect(resolveComponentSelector(HOME, '/Card~-1')).toBeUndefined()
    expect(resolveComponentSelector(HOME, '/Card~1e1')).toBeUndefined()
    expect(resolveComponentSelector(HOME, '/Card~')).toBeUndefined()
  })

  it('finds nothing in a screen whose tree has not been read yet', () => {
    const empty: ComponentTree = {
      roots: [],
      nodeByPath: new Map(),
      elementByPath: new Map(),
      pathByElement: new Map(),
    }

    expect(resolveComponentSelector(empty, 'book-follow-up')).toBeUndefined()
  })
})

describe('a link surviving an edit to the screen', () => {
  const EDITED = screenTree(`
    <header><h1>Good morning</h1></header>
    <div data-slot="badge">2 tasks</div>
    <div data-slot="card" data-proto-id="follow-up-card">
      <div data-slot="card-header"><div data-slot="card-title">Follow-up visit</div></div>
      <div data-slot="card-content">
        <p>Dr. Okafor asked to see you.</p>
        <div data-slot="separator"></div>
        <button data-slot="button">Book a visit</button>
      </div>
    </div>
  `)

  it('still finds the component after a badge is added above it and a separator beside it', () => {
    // The button sat at 1.1.0 and now sits at 2.1.1: both a card above it and a sibling beside it
    // moved, which is exactly what a path of child indexes cannot survive.
    expect(resolveComponentSelector(HOME, 'follow-up-card/CardContent/Button')).toBe('1.1.0')
    expect(landsOn(EDITED, 'follow-up-card/CardContent/Button')).toBe('Button@2.1.1')
  })

  it('still finds a component named from the screen when a component of another name is inserted', () => {
    expect(landsOn(EDITED, '/header/h1')).toBe('h1@0.0')
  })
})

describe('an id that shares a name with a component on the screen', () => {
  // A designer may well name something `header`, and the screen may well have a `<header>` too.
  const COLLIDING = screenTree(`
    <header><h1>Good morning</h1></header>
    <div data-slot="card" data-proto-id="header">Named header</div>
  `)

  it('keeps the two apart, each landing on its own element', () => {
    const rootHeader = nodeAt(COLLIDING, '0')
    const namedCard = nodeAt(COLLIDING, '1')

    expect(componentSelector(COLLIDING, rootHeader)).toBe('/header')
    expect(componentSelector(COLLIDING, namedCard)).toBe('header')

    expect(landsOn(COLLIDING, '/header')).toBe('header@0')
    expect(landsOn(COLLIDING, 'header')).toBe('Card@1')
  })

  it('reads back every name it writes, even with the collision present', () => {
    for (const [path, node] of COLLIDING.nodeByPath) {
      expect(landsOn(COLLIDING, componentSelector(COLLIDING, node))).toBe(`${node.label}@${path}`)
    }
  })
})

describe('an id a link could not spell', () => {
  it('is not offered as an id, so the component is named by its place instead', () => {
    const odd = screenTree('<div data-slot="card" data-proto-id="cards/first">One</div>')
    const card = nodeAt(odd, '0')

    expect(card.anchorId).toBeUndefined()
    expect(componentSelector(odd, card)).toBe('/Card')
    expect(landsOn(odd, '/Card')).toBe('Card@0')
  })
})
