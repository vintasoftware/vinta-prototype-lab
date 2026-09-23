// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Prototype, PrototypeScreen } from '../types'
import {
  arrowPath,
  buildFlowGraph,
  type FlowControl,
  flowNodeKey,
  type LinksByNode,
  layoutFlowGraph,
  missingNodeKey,
  type ScreenLinks,
} from './flow-graph'

const Blank = () => null

function screen(id: string, variant = 'default', order = 10): PrototypeScreen {
  return {
    id,
    title: id,
    variant,
    variantLabel: variant,
    viewport: 'mobile',
    order,
    Component: Blank,
    source: `${id}.tsx`,
  }
}

function control(label: string, ...path: number[]): FlowControl {
  return { path, label }
}

const prototype: Prototype = {
  slug: 'booking',
  group: [],
  doc: { title: 'Booking', entry: 'home', body: '' },
  screens: [
    screen('home', 'default', 10),
    screen('choose-time', 'default', 20),
    screen('choose-time', 'no-slots', 20),
    screen('review', 'default', 30),
    screen('help', 'default', 40),
  ],
  annotations: [],
  issues: [],
}

const links: LinksByNode = new Map<string, ScreenLinks>([
  [
    'home/default',
    {
      links: [
        { kind: 'screen', control: control('Book a visit', 1), screenId: 'choose-time' },
        { kind: 'screen', control: control('Reschedule', 2), screenId: 'choose-time' },
        { kind: 'screen', control: control('Terms', 3), screenId: 'terms' },
      ],
    },
  ],
  [
    'choose-time/default',
    {
      links: [
        { kind: 'back', control: control('Back', 0, 0) },
        { kind: 'back', control: control('Back', 0, 0) },
        { kind: 'screen', control: control('Next week', 1, 5), screenId: 'choose-time', variant: 'no-slots' },
        { kind: 'screen', control: control('9:00 AM', 2, 0), screenId: 'review' },
        { kind: 'screen', control: control('9:30 AM', 2, 1), screenId: 'review' },
      ],
    },
  ],
  ['choose-time/no-slots', { links: [{ kind: 'back', control: control('Back', 0, 0) }] }],
  ['review/default', { links: [], error: 'boom' }],
])

const graph = buildFlowGraph(prototype, links)

describe('buildFlowGraph', () => {
  it('makes one node per screen state', () => {
    expect(graph.nodes.map(node => node.key)).toEqual([
      'home/default',
      'choose-time/default',
      'choose-time/no-slots',
      'review/default',
      'help/default',
    ])
  })

  it('draws one arrow per destination, listing every control that leads there', () => {
    const fromHome = graph.edges.find(edge => edge.from === 'home/default' && edge.to === 'choose-time/default')

    expect(fromHome?.controls.map(item => item.label)).toEqual(['Book a visit', 'Reschedule'])

    const toReview = graph.edges.find(edge => edge.to === 'review/default')
    expect(toReview?.controls.map(item => item.label)).toEqual(['9:00 AM', '9:30 AM'])
  })

  it('sends a link with no variant to the default state, and one with a variant to that state', () => {
    expect(graph.edges.some(edge => edge.from === 'home/default' && edge.to === 'choose-time/default')).toBe(true)
    expect(graph.edges.some(edge => edge.from === 'choose-time/default' && edge.to === 'choose-time/no-slots')).toBe(
      true
    )
  })

  it('keeps the controls that go back on the node, once each', () => {
    const chooseTime = graph.nodes.find(node => node.key === 'choose-time/default')

    expect(chooseTime?.backControls).toEqual([control('Back', 0, 0)])
  })

  it('places a screen by its distance from the entry', () => {
    const layerOf = new Map(graph.nodes.map(node => [node.key, node.layer]))

    expect(layerOf.get('home/default')).toBe(0)
    expect(layerOf.get('choose-time/default')).toBe(1)
    expect(layerOf.get('choose-time/no-slots')).toBe(2)
    expect(layerOf.get('review/default')).toBe(2)
  })

  it('marks the entry, and marks a screen nothing links to as unreachable after everything else', () => {
    const home = graph.nodes.find(node => node.key === 'home/default')
    const help = graph.nodes.find(node => node.key === 'help/default')

    expect(home?.entry).toBe(true)
    expect(home?.unreachable).toBe(false)
    expect(help?.unreachable).toBe(true)
    expect(help?.layer).toBe(3)
  })

  it('stands in a placeholder for a link to a screen that does not exist', () => {
    expect(graph.missing).toEqual([{ key: missingNodeKey('terms'), screenId: 'terms', layer: 1 }])
    expect(graph.edges.some(edge => edge.from === 'home/default' && edge.to === 'missing:terms')).toBe(true)
  })

  it('carries a screen that could not be read', () => {
    expect(graph.nodes.find(node => node.key === 'review/default')?.error).toBe('boom')
  })

  it('reads a prototype with no links as one column of unreachable screens after the entry', () => {
    const quiet = buildFlowGraph(prototype, new Map())

    expect(quiet.edges).toEqual([])
    expect(quiet.nodes.map(node => node.layer)).toEqual([0, 1, 1, 1, 1])
  })

  it('reads a prototype with no screens as an empty graph', () => {
    expect(buildFlowGraph({ ...prototype, screens: [] }, new Map())).toEqual({ nodes: [], missing: [], edges: [] })
  })
})

describe('layoutFlowGraph', () => {
  const layout = layoutFlowGraph(graph, () => ({ width: 200, height: 100 }))

  it('puts each layer in its own column, left to right', () => {
    const x = (key: string) => layout.positions.get(key)?.x

    expect(x('home/default')).toBeLessThan(x('choose-time/default') ?? 0)
    expect(x('choose-time/default')).toBe(x('missing:terms'))
    expect(x('choose-time/default')).toBeLessThan(x('review/default') ?? 0)
    expect(x('review/default')).toBeLessThan(x('help/default') ?? 0)
  })

  it('stacks the nodes of a column without overlap', () => {
    const chooseTime = layout.positions.get('choose-time/default')
    const terms = layout.positions.get('missing:terms')

    expect((terms?.y ?? 0) - (chooseTime?.y ?? 0)).toBeGreaterThanOrEqual(100)
  })

  it('centres a short column on the tallest one', () => {
    const home = layout.positions.get('home/default')
    const chooseTime = layout.positions.get('choose-time/default')
    const terms = layout.positions.get('missing:terms')

    expect(home?.y).toBe(((chooseTime?.y ?? 0) + (terms?.y ?? 0)) / 2)
  })

  it('sizes the canvas to hold every node with padding around', () => {
    for (const [key, point] of layout.positions) {
      expect(point.x + 200).toBeLessThanOrEqual(layout.width)
      expect(point.y + 100).toBeLessThanOrEqual(layout.height)
      expect(key).toBeTruthy()
    }
  })

  it('lays out an empty graph as an empty canvas', () => {
    const empty = layoutFlowGraph({ nodes: [], missing: [], edges: [] }, () => ({ width: 200, height: 100 }))

    expect(empty.positions.size).toBe(0)
  })
})

describe('arrowPath', () => {
  it('leaves to the right and arrives from the left when going forward', () => {
    expect(arrowPath({ x: 0, y: 0 }, { x: 200, y: 50 }, 'forward')).toBe('M 0 0 C 100 0, 100 50, 200 50')
  })

  it('leaves to the left and arrives from the right when going back', () => {
    expect(arrowPath({ x: 200, y: 0 }, { x: 0, y: 50 }, 'backward')).toBe('M 200 0 C 100 0, 100 50, 0 50')
  })

  it('loops out on the right when both ends share a column', () => {
    expect(arrowPath({ x: 100, y: 0 }, { x: 100, y: 200 }, 'sideways')).toBe('M 100 0 C 156 0, 156 200, 100 200')
  })
})

describe('flowNodeKey', () => {
  it('names a screen state', () => {
    expect(flowNodeKey('choose-time', 'no-slots')).toBe('choose-time/no-slots')
  })
})
