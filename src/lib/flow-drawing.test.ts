import { describe, expect, it } from 'vitest'
import type { PrototypeScreen } from '../types'
import { type Box, cardSize, drawFlow, edgeKey, type Measure, rowCount, thumbnailSize } from './flow-drawing'
import type { FlowEdge, FlowGraph, FlowLayout, FlowNode } from './flow-graph'

const Blank = () => null

function screen(id: string, viewport: PrototypeScreen['viewport'] = 'mobile'): PrototypeScreen {
  return {
    id,
    title: id,
    variant: 'default',
    variantLabel: 'Default',
    viewport,
    order: 10,
    Component: Blank,
    source: '',
  }
}

function node(id: string, layer: number, extra: Partial<FlowNode> = {}): FlowNode {
  return {
    key: `${id}/default`,
    screen: screen(id),
    layer,
    entry: layer === 0,
    unreachable: false,
    backControls: [],
    ...extra,
  }
}

/** A canvas with three cards: home (col 0) with two controls, review and settings (col 1). */
function canvas() {
  const content = document.createElement('div')
  const boxes = new Map<Element, Box>()
  boxes.set(content, { x: 100, y: 100, width: 2000, height: 1000 })

  const mounts = new Map<string, Element>()
  const mountFor = (key: string, thumbnail: Box, controls: Box[]) => {
    const outer = document.createElement('div')
    const mount = document.createElement('div')
    outer.appendChild(mount)
    content.appendChild(outer)
    boxes.set(outer, thumbnail)
    for (const box of controls) {
      const button = document.createElement('button')
      mount.appendChild(button)
      boxes.set(button, box)
    }
    mounts.set(key, mount)
  }
  mountFor('home/default', { x: 100, y: 100, width: 200, height: 400 }, [
    { x: 120, y: 150, width: 60, height: 20 },
    { x: 200, y: 300, width: 80, height: 20 },
    // Below the fold of the thumbnail, so not drawable.
    { x: 120, y: 900, width: 60, height: 20 },
  ])
  mountFor('review/default', { x: 500, y: 100, width: 200, height: 400 }, [{ x: 520, y: 150, width: 60, height: 20 }])
  mountFor('settings/default', { x: 500, y: 700, width: 200, height: 400 }, [])

  const rows = new Map<string, Element>()
  const rowFor = (key: string, box: Box) => {
    const row = document.createElement('li')
    content.appendChild(row)
    boxes.set(row, box)
    rows.set(key, row)
  }

  // Everything measured is offset by the canvas origin, the way the browser reports it.
  const measure: Measure = element => {
    const box = boxes.get(element) ?? { x: 0, y: 0, width: 0, height: 0 }
    const origin = element === content ? { x: 0, y: 0 } : { x: 100, y: 100 }
    return DOMRect.fromRect({ x: box.x + origin.x, y: box.y + origin.y, width: box.width, height: box.height })
  }

  return { content, mounts, rows, rowFor, measure }
}

const layout: FlowLayout = {
  positions: new Map([
    ['home/default', { x: 100, y: 100 }],
    ['review/default', { x: 500, y: 100 }],
    ['settings/default', { x: 500, y: 700 }],
    ['missing:typo', { x: 900, y: 100 }],
  ]),
  width: 1200,
  height: 1200,
}

const sizeOf = () => ({ width: 200, height: 500 })

describe('drawFlow', () => {
  const homeToReview: FlowEdge = {
    from: 'home/default',
    to: 'review/default',
    controls: [
      { path: [0], label: 'Book' },
      { path: [1], label: 'Reschedule' },
      { path: [2], label: 'Hidden' },
    ],
  }
  const reviewToHome: FlowEdge = {
    from: 'review/default',
    to: 'home/default',
    controls: [{ path: [0], label: 'Back home' }],
  }
  const graph: FlowGraph = {
    nodes: [node('home', 0), node('review', 1, { backControls: [{ path: [0], label: 'Back' }] }), node('settings', 1)],
    missing: [],
    edges: [homeToReview, reviewToHome],
  }

  it('starts a forward arrow at the right edge of the control nearest that side', () => {
    const { content, mounts, rows, measure } = canvas()

    const { arrows } = drawFlow({ graph, layout, scale: 1, sizeOf, content, mounts, rows, measure })
    const forward = arrows.find(arrow => arrow.edge === homeToReview)

    // The second control reaches further right (200 + 80) than the first (120 + 60).
    expect(forward?.d.startsWith('M 280 310 ')).toBe(true)
    expect(forward?.backward).toBe(false)
  })

  it('ends a forward arrow on the left edge of the target, at its header', () => {
    const { content, mounts, rows, measure } = canvas()

    const { arrows } = drawFlow({ graph, layout, scale: 1, sizeOf, content, mounts, rows, measure })
    const forward = arrows.find(arrow => arrow.edge === homeToReview)

    expect(forward?.d.endsWith(' 500 120')).toBe(true)
  })

  it('draws an arrow back to an earlier column from the left edge of its control to the right edge of the target', () => {
    const { content, mounts, rows, measure } = canvas()

    const { arrows } = drawFlow({ graph, layout, scale: 1, sizeOf, content, mounts, rows, measure })
    const backward = arrows.find(arrow => arrow.edge === reviewToHome)

    expect(backward?.backward).toBe(true)
    expect(backward?.d.startsWith('M 520 160 ')).toBe(true)
    expect(backward?.d.endsWith(' 300 120')).toBe(true)
  })

  it('outlines every control it found, and none it could not', () => {
    const { content, mounts, rows, measure } = canvas()

    const { rings } = drawFlow({ graph, layout, scale: 1, sizeOf, content, mounts, rows, measure })

    expect(rings.map(ring => [ring.node, ring.kind, ring.rect.x])).toEqual([
      ['home/default', 'screen', 120],
      ['home/default', 'screen', 200],
      ['review/default', 'screen', 520],
      ['review/default', 'back', 520],
    ])
  })

  it('puts measurements back into canvas coordinates when the canvas is zoomed', () => {
    const { content, mounts, rows, measure } = canvas()
    // The browser reports everything at half size when the canvas is drawn at 50%.
    const zoomed: Measure = element => {
      const rect = measure(element)
      return DOMRect.fromRect({ x: rect.x / 2, y: rect.y / 2, width: rect.width / 2, height: rect.height / 2 })
    }

    const { rings } = drawFlow({ graph, layout, scale: 0.5, sizeOf, content, mounts, rows, measure: zoomed })

    expect(rings[0]?.rect).toEqual({ x: 120, y: 150, width: 60, height: 20 })
  })

  it('fans arrows into the same card out down its header', () => {
    const { content, mounts, rows, measure } = canvas()
    const settingsToReview: FlowEdge = { from: 'settings/default', to: 'review/default', controls: [] }
    rows.set(
      edgeKey(settingsToReview),
      (() => {
        const row = document.createElement('li')
        content.appendChild(row)
        return row
      })()
    )
    const withTwoIn: FlowGraph = { ...graph, edges: [homeToReview, settingsToReview] }
    const measureRows: Measure = element =>
      element.tagName === 'LI' ? DOMRect.fromRect({ x: 600, y: 1100, width: 150, height: 24 }) : measure(element)

    const { arrows } = drawFlow({
      graph: withTwoIn,
      layout,
      scale: 1,
      sizeOf,
      content,
      mounts,
      rows,
      measure: measureRows,
    })

    expect(arrows[0]?.d.endsWith(' 500 120')).toBe(true)
    expect(arrows[1]?.d.endsWith(' 700 136')).toBe(true)
  })

  it('starts from the card row when no control for the edge can be found', () => {
    const { content, mounts, rows, rowFor, measure } = canvas()
    const fromRow: FlowEdge = { from: 'home/default', to: 'settings/default', controls: [{ path: [7], label: 'Gone' }] }
    rowFor(edgeKey(fromRow), { x: 110, y: 520, width: 180, height: 24 })
    const withRow: FlowGraph = { ...graph, edges: [fromRow] }

    const { arrows } = drawFlow({ graph: withRow, layout, scale: 1, sizeOf, content, mounts, rows, measure })

    expect(arrows[0]?.d.startsWith('M 290 532 ')).toBe(true)
  })

  it('skips an edge with neither a control nor a row to start from', () => {
    const { content, mounts, rows, measure } = canvas()
    const nowhere: FlowEdge = { from: 'home/default', to: 'settings/default', controls: [{ path: [7], label: 'Gone' }] }

    const { arrows } = drawFlow({
      graph: { ...graph, edges: [nowhere] },
      layout,
      scale: 1,
      sizeOf,
      content,
      mounts,
      rows,
      measure,
    })

    expect(arrows).toEqual([])
  })

  it('draws no arrow from a screen to itself', () => {
    const { content, mounts, rows, measure } = canvas()
    const self: FlowEdge = { from: 'home/default', to: 'home/default', controls: [{ path: [0], label: 'Refresh' }] }

    const { arrows, rings } = drawFlow({
      graph: { ...graph, edges: [self] },
      layout,
      scale: 1,
      sizeOf,
      content,
      mounts,
      rows,
      measure,
    })

    expect(arrows).toEqual([])
    expect(rings).toHaveLength(2)
  })

  it('loops out on the right between two cards in the same column', () => {
    const { content, mounts, rows, measure } = canvas()
    const sideways: FlowEdge = {
      from: 'review/default',
      to: 'settings/default',
      controls: [{ path: [0], label: 'Settings' }],
    }

    const { arrows } = drawFlow({
      graph: { ...graph, edges: [sideways] },
      layout,
      scale: 1,
      sizeOf,
      content,
      mounts,
      rows,
      measure,
    })

    expect(arrows[0]?.d).toBe('M 580 160 C 640 160, 760 720, 700 720')
  })

  it('draws nothing before the canvas has a size', () => {
    const { content, mounts, rows } = canvas()

    expect(drawFlow({ graph, layout, scale: 1, sizeOf, content, mounts, rows, measure: () => new DOMRect() })).toEqual({
      arrows: [],
      rings: [],
    })
  })

  it('skips an edge whose end has no place on the canvas', () => {
    const { content, mounts, rows, measure } = canvas()
    const toNowhere: FlowEdge = { from: 'home/default', to: 'ghost/default', controls: [{ path: [0], label: 'Ghost' }] }

    const { arrows } = drawFlow({
      graph: { ...graph, edges: [toNowhere] },
      layout,
      scale: 1,
      sizeOf,
      content,
      mounts,
      rows,
      measure,
    })

    expect(arrows).toEqual([])
  })
})

describe('cardSize and rowCount', () => {
  const edges: FlowEdge[] = [
    { from: 'home/default', to: 'review/default', controls: [] },
    { from: 'home/default', to: 'settings/default', controls: [] },
  ]

  it('counts one row per destination, one for going back, one for an error', () => {
    expect(rowCount(node('home', 0), edges)).toBe(2)
    expect(rowCount(node('home', 0, { backControls: [{ path: [0], label: 'Back' }], error: 'boom' }), edges)).toBe(4)
    expect(rowCount(node('review', 1), edges)).toBe(0)
  })

  it('grows the card by one row per line under the thumbnail', () => {
    const quiet = cardSize(node('review', 1), edges, undefined)
    const busy = cardSize(node('home', 0), edges, undefined)

    expect(busy.width).toBe(quiet.width)
    expect(busy.height - quiet.height).toBe(2 * 24 + 2 * 8 - 8)
  })

  it("sizes the card for the viewport asked for over the screen's own", () => {
    const asDesktop = cardSize(node('home', 0), [], 'desktop')

    expect(asDesktop.width).toBe(thumbnailSize('desktop').width + 20)
    expect(asDesktop.width).toBeGreaterThan(cardSize(node('home', 0), [], undefined).width)
  })
})

describe('thumbnailSize', () => {
  it('shrinks each viewport by its own factor', () => {
    expect(thumbnailSize('mobile')).toEqual({ width: 195, height: 422 })
    expect(thumbnailSize('desktop')).toEqual({ width: 282, height: 180 })
  })
})
