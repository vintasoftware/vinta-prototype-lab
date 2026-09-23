import { describe, expect, it } from 'vitest'
import { ancestorPaths, buildComponentTree, nearestNodePath, OVERLAY_ATTRIBUTE } from './component-tree'

function frameFrom(html: string): HTMLElement {
  const frame = document.createElement('div')
  frame.innerHTML = html
  return frame
}

describe('buildComponentTree', () => {
  it('names a row after the component its data-slot came from', () => {
    const tree = buildComponentTree(frameFrom('<div data-slot="card-header"></div>'))

    expect(tree.roots).toEqual([{ path: '0', kind: 'component', label: 'CardHeader', children: [] }])
  })

  it('nests rows the way the DOM nests', () => {
    const tree = buildComponentTree(
      frameFrom('<div data-slot="card"><div data-slot="card-header"><h2 data-slot="card-title"></h2></div></div>')
    )

    expect(tree.roots[0]?.label).toBe('Card')
    expect(tree.roots[0]?.children[0]?.label).toBe('CardHeader')
    expect(tree.roots[0]?.children[0]?.children[0]).toEqual({
      path: '0.0.0',
      kind: 'component',
      label: 'CardTitle',
      children: [],
    })
  })

  it('walks through a layout wrapper, so its components move up to the row above', () => {
    const tree = buildComponentTree(
      frameFrom('<div class="flex gap-4"><div data-slot="badge"></div><div data-slot="button"></div></div>')
    )

    expect(tree.roots.map(node => [node.path, node.label])).toEqual([
      ['0', 'Badge'],
      ['1', 'Button'],
    ])
  })

  it('numbers lifted rows alongside their new siblings', () => {
    const tree = buildComponentTree(
      frameFrom('<div data-slot="badge"></div><div><div data-slot="button"></div></div><div data-slot="input"></div>')
    )

    expect(tree.roots.map(node => node.path)).toEqual(['0', '1', '2'])
    expect(tree.roots.map(node => node.label)).toEqual(['Badge', 'Button', 'Input'])
  })

  it('keeps a landmark tag, so a screen of plain HTML still has a tree', () => {
    const tree = buildComponentTree(frameFrom('<header><h1></h1></header>'))

    expect(tree.roots[0]?.label).toBe('header')
    expect(tree.roots[0]?.children[0]?.label).toBe('h1')
  })

  it('tells a component apart from a plain element of the page', () => {
    const tree = buildComponentTree(frameFrom('<header><div data-slot="badge"></div></header>'))

    expect(tree.roots[0]?.kind).toBe('element')
    expect(tree.roots[0]?.children[0]?.kind).toBe('component')
  })

  it('keeps an element the designer named, whatever it is', () => {
    const tree = buildComponentTree(frameFrom('<span data-proto-id="task-count"></span>'))

    expect(tree.roots[0]).toEqual({
      path: '0',
      kind: 'element',
      label: 'span',
      anchorId: 'task-count',
      children: [],
    })
  })

  it('leaves the viewer own overlays out of the screen tree', () => {
    const tree = buildComponentTree(
      frameFrom(`<div data-slot="card"></div><div ${OVERLAY_ATTRIBUTE}><div data-slot="badge"></div></div>`)
    )

    expect(tree.roots.map(node => node.label)).toEqual(['Card'])
  })

  it('maps every row to its element both ways', () => {
    const frame = frameFrom('<div data-slot="card"><div data-slot="button"></div></div>')
    const tree = buildComponentTree(frame)
    const button = frame.querySelector('[data-slot="button"]')

    expect(tree.elementByPath.get('0.0')).toBe(button)
    expect(button && tree.pathByElement.get(button)).toBe('0.0')
    expect(tree.nodeByPath.get('0.0')?.label).toBe('Button')
  })
})

describe('nearestNodePath', () => {
  it('takes the row of the element itself', () => {
    const frame = frameFrom('<div data-slot="button"></div>')
    const tree = buildComponentTree(frame)
    const button = frame.querySelector('[data-slot="button"]')

    expect(button && nearestNodePath(tree, button)).toBe('0')
  })

  it('climbs to the nearest row, so clicking the text inside a button picks the button', () => {
    const frame = frameFrom('<div data-slot="button"><span class="label">Book</span></div>')
    const tree = buildComponentTree(frame)
    const label = frame.querySelector('.label')

    expect(label && nearestNodePath(tree, label)).toBe('0')
  })

  it('finds nothing above an element with no row anywhere over it', () => {
    const frame = frameFrom('<div class="plain"><span class="inner"></span></div>')
    const tree = buildComponentTree(frame)
    const inner = frame.querySelector('.inner')

    expect(inner && nearestNodePath(tree, inner)).toBeUndefined()
  })
})

describe('ancestorPaths', () => {
  it('lists the rows that have to be open for a row to be visible', () => {
    expect(ancestorPaths('0.2.1')).toEqual(['0', '0.2'])
  })

  it('has none for a root', () => {
    expect(ancestorPaths('3')).toEqual([])
  })
})
