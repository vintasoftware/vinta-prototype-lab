// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { PrototypeScreen } from '../types'
import { arrowDirection, layoutCanvas, SECTION_SPACING } from './canvas-layout'
import { MISSING_SIZE } from './flow-drawing'
import type { FlowGraph, FlowNode } from './flow-graph'

const Blank = () => null

function node(id: string, variant: string, layer: number): FlowNode {
  const screen: PrototypeScreen = {
    id,
    title: id.toUpperCase(),
    variant,
    variantLabel: variant,
    viewport: 'mobile',
    order: 10,
    Component: Blank,
    source: '',
  }
  return { key: `${id}/${variant}`, screen, layer, entry: layer === 0, unreachable: false, backControls: [] }
}

const graph: FlowGraph = {
  nodes: [
    node('home', 'default', 0),
    node('review', 'default', 1),
    node('review', 'empty', 1),
    node('help', 'default', 1),
  ],
  missing: [{ key: 'missing:typo', screenId: 'typo', layer: 2 }],
  edges: [],
}
const card = { width: 400, height: 900 }
const cardSize = () => card
const { padding, label, frameGap, column, row } = SECTION_SPACING

describe('layoutCanvas', () => {
  it('puts the states of one screen side by side in one section, in list order', () => {
    const layout = layoutCanvas(graph, cardSize)
    const review = layout.sections.find(section => section.screenId === 'review')

    expect(review?.title).toBe('REVIEW')
    expect(review?.frames.map(frame => frame.key)).toEqual(['review/default', 'review/empty'])
    expect(review?.width).toBe(padding * 2 + card.width * 2 + frameGap)
    expect(review?.height).toBe(label + padding * 2 + card.height)
    const [first, second] = review?.frames ?? []
    expect(second?.x).toBe((first?.x ?? 0) + card.width + frameGap)
    expect(second?.y).toBe(first?.y)
  })

  it("lays sections out in the flow graph's columns, read left to right", () => {
    const layout = layoutCanvas(graph, cardSize)
    const at = (id: string) => layout.sections.find(section => section.screenId === id)

    expect(at('home')).toMatchObject({ x: 0, y: 0 })
    expect(at('review')?.x).toBe(padding * 2 + card.width + column)
    expect(at('help')?.x).toBeGreaterThanOrEqual(at('review')?.x ?? 0)
    expect(at('typo')?.x).toBeGreaterThan(at('help')?.x ?? 0)
  })

  it('stacks the sections of one column when that keeps the canvas closest to a screen shape', () => {
    const tall: FlowGraph = {
      nodes: [node('a', 'default', 0), node('b', 'default', 0), node('c', 'default', 1), node('d', 'default', 1)],
      missing: [],
      edges: [],
    }
    const layout = layoutCanvas(tall, () => ({ width: 1600, height: 300 }))
    const at = (id: string) => layout.sections.find(section => section.screenId === id)

    expect(at('b')).toMatchObject({ x: 0, y: (at('a')?.height ?? 0) + row })
    expect(at('d')?.x).toBe(at('c')?.x)
  })

  it('wraps a layer holding many screens into more columns, so the canvas keeps a screen-like shape', () => {
    const wide: FlowGraph = {
      nodes: [
        node('menu', 'default', 0),
        ...Array.from({ length: 12 }, (_, index) => node(`page-${index}`, 'default', 1)),
      ],
      missing: [],
      edges: [],
    }
    const layout = layoutCanvas(wide, cardSize)
    const columns = new Set(layout.sections.map(section => section.x))

    expect(columns.size).toBeGreaterThan(2)
    expect(layout.bounds.width / layout.bounds.height).toBeGreaterThan(1)
    expect(layout.bounds.width / layout.bounds.height).toBeLessThan(3)
  })

  it('gives a missing screen a section of its own with the red card', () => {
    const missing = layoutCanvas(graph, cardSize).sections.find(section => section.missing)

    expect(missing?.screenId).toBe('typo')
    expect(missing?.frames[0]).toMatchObject({ key: 'missing:typo', ...MISSING_SIZE })
  })

  it('indexes every frame and measures the whole canvas', () => {
    const layout = layoutCanvas(graph, cardSize)

    expect(layout.frameByKey.get('review/empty')?.width).toBe(400)
    const right = Math.max(...layout.sections.map(section => section.x + section.width))
    expect(layout.bounds).toMatchObject({ x: 0, y: 0, width: right })
  })

  it('keeps saved sections where they were put and places the rest to their right', () => {
    const saved = new Map([['review', { x: -500, y: 2000 }]])
    const layout = layoutCanvas(graph, cardSize, saved)
    const at = (id: string) => layout.sections.find(section => section.screenId === id)

    expect(at('review')).toMatchObject({ x: -500, y: 2000 })
    const reviewRight = -500 + (at('review')?.width ?? 0)
    expect(at('home')?.x).toBe(reviewRight + column)
    expect(layout.bounds.x).toBe(-500)
  })
})

describe('arrowDirection', () => {
  const box = (x: number) => ({ x, y: 0, width: 100, height: 100 })

  it('reads the direction from where the frames sit', () => {
    expect(arrowDirection(box(0), box(200))).toBe('forward')
    expect(arrowDirection(box(200), box(0))).toBe('backward')
    expect(arrowDirection(box(0), box(50))).toBe('sideways')
  })
})
