import type { Prototype, PrototypeScreen } from '../types'
import { DEFAULT_VARIANT } from './constants'
import { entryScreenId, resolveScreen } from './discovery'

/** One rendered state of a screen: `home/default`, `choose-time/no-slots`. */
export type FlowNodeKey = string

export function flowNodeKey(screenId: string, variant: string): FlowNodeKey {
  return `${screenId}/${variant}`
}

/** Key of the placeholder drawn for a link to a screen that does not exist. */
export function missingNodeKey(screenId: string): FlowNodeKey {
  return `missing:${screenId}`
}

/** A control the probe clicked. The map finds it again in a thumbnail by its path. */
export interface FlowControl {
  /** Child indexes from the screen's mount element down to the control. */
  path: number[]
  /** What the control says: its accessible name, else its text. */
  label: string
}

/** What one click did when the probe clicked a control. */
export type FlowLink =
  | { kind: 'screen'; control: FlowControl; screenId: string; variant?: string }
  | { kind: 'back'; control: FlowControl }

/** Everything the probe learned about one screen state. */
export interface ScreenLinks {
  links: FlowLink[]
  /** Set when the screen could not be rendered, so its links are unknown rather than none. */
  error?: string
}

export interface FlowNode {
  key: FlowNodeKey
  screen: PrototypeScreen
  /** Column in the map: steps from the entry screen along the shortest path. */
  layer: number
  entry: boolean
  /** No link leads here and it is not the entry, so a person clicking through never sees it. */
  unreachable: boolean
  /** Controls on this screen that call `back()`. They lead to wherever the person came from. */
  backControls: FlowControl[]
  error?: string
}

/** Stands in for a screen id that links point at but no file defines. */
export interface MissingNode {
  key: FlowNodeKey
  screenId: string
  layer: number
}

/** Every control on `from` that opens `to`, drawn as one arrow. */
export interface FlowEdge {
  from: FlowNodeKey
  to: FlowNodeKey
  controls: FlowControl[]
}

export interface FlowGraph {
  nodes: FlowNode[]
  missing: MissingNode[]
  edges: FlowEdge[]
}

export type LinksByNode = ReadonlyMap<FlowNodeKey, ScreenLinks>

function samePath(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((index, position) => index === b[position])
}

/** The node a link opens: the variant it names, else the screen's default state. */
function targetKey(prototype: Prototype, screenId: string, variant: string | undefined): FlowNodeKey {
  const screen = resolveScreen(prototype, { screenId, variant: variant ?? DEFAULT_VARIANT })
  return screen === undefined ? missingNodeKey(screenId) : flowNodeKey(screen.id, screen.variant)
}

function isMissing(key: FlowNodeKey): boolean {
  return key.startsWith('missing:')
}

/**
 * Turns what the probe saw on each screen into the graph the map draws.
 *
 * Links from one screen to the same destination become one edge listing every control, so six slot
 * buttons that all open the review screen read as one arrow rather than six. Layers come from a
 * breadth-first walk from the entry screen; whatever the walk never reaches is marked unreachable
 * and placed after everything else.
 */
export function buildFlowGraph(prototype: Prototype, linksByNode: LinksByNode): FlowGraph {
  const entryKey = (() => {
    const entryId = entryScreenId(prototype)
    return entryId === undefined ? undefined : targetKey(prototype, entryId, undefined)
  })()

  const edges: FlowEdge[] = []
  const backByNode = new Map<FlowNodeKey, FlowControl[]>()
  const missingIds = new Map<string, FlowNodeKey[]>()

  for (const screen of prototype.screens) {
    const key = flowNodeKey(screen.id, screen.variant)
    const byTarget = new Map<FlowNodeKey, FlowControl[]>()
    const back: FlowControl[] = []

    for (const link of linksByNode.get(key)?.links ?? []) {
      if (link.kind === 'back') {
        if (!back.some(control => samePath(control.path, link.control.path))) {
          back.push(link.control)
        }
        continue
      }

      const to = targetKey(prototype, link.screenId, link.variant)
      if (isMissing(to)) {
        missingIds.set(link.screenId, [...(missingIds.get(link.screenId) ?? []), key])
      }
      const controls = byTarget.get(to) ?? []
      if (!controls.some(control => samePath(control.path, link.control.path))) {
        controls.push(link.control)
      }
      byTarget.set(to, controls)
    }

    for (const [to, controls] of byTarget) {
      edges.push({ from: key, to, controls })
    }
    backByNode.set(key, back)
  }

  const layers = new Map<FlowNodeKey, number>()
  if (entryKey !== undefined) {
    layers.set(entryKey, 0)
    const queue = [entryKey]
    while (queue.length > 0) {
      const current = queue.shift() as FlowNodeKey
      const depth = layers.get(current) ?? 0
      for (const edge of edges) {
        if (edge.from === current && !layers.has(edge.to) && !isMissing(edge.to)) {
          layers.set(edge.to, depth + 1)
          queue.push(edge.to)
        }
      }
    }
  }
  const deepest = Math.max(-1, ...layers.values())

  const nodes: FlowNode[] = prototype.screens.map(screen => {
    const key = flowNodeKey(screen.id, screen.variant)
    const layer = layers.get(key)
    const read = linksByNode.get(key)
    return {
      key,
      screen,
      layer: layer ?? deepest + 1,
      entry: key === entryKey,
      unreachable: layer === undefined,
      backControls: backByNode.get(key) ?? [],
      ...(read?.error === undefined ? {} : { error: read.error }),
    }
  })

  const layerOf = new Map(nodes.map(node => [node.key, node.layer]))
  const missing: MissingNode[] = [...missingIds].map(([screenId, sources]) => ({
    key: missingNodeKey(screenId),
    screenId,
    layer: Math.min(...sources.map(source => layerOf.get(source) ?? 0)) + 1,
  }))

  return { nodes, missing, edges }
}

export interface Size {
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

export interface FlowLayout {
  /** Top-left corner of every node and placeholder. */
  positions: Map<FlowNodeKey, Point>
  width: number
  height: number
}

export const LAYOUT_SPACING = { column: 140, row: 40, padding: 48 } as const

/**
 * Places nodes in columns by layer, each column centred on the tallest one, so the flow reads left
 * to right and a short column does not hang from the top edge.
 */
export function layoutFlowGraph(graph: FlowGraph, sizeOf: (key: FlowNodeKey) => Size): FlowLayout {
  const columns = new Map<number, FlowNodeKey[]>()
  for (const item of [...graph.nodes, ...graph.missing]) {
    columns.set(item.layer, [...(columns.get(item.layer) ?? []), item.key])
  }
  const ordered = [...columns.entries()].sort(([a], [b]) => a - b)

  const columnHeight = (keys: FlowNodeKey[]) =>
    keys.reduce((total, key) => total + sizeOf(key).height, 0) + Math.max(0, keys.length - 1) * LAYOUT_SPACING.row
  const tallest = Math.max(0, ...ordered.map(([, keys]) => columnHeight(keys)))

  const positions = new Map<FlowNodeKey, Point>()
  let x = LAYOUT_SPACING.padding
  for (const [, keys] of ordered) {
    const width = Math.max(0, ...keys.map(key => sizeOf(key).width))
    let y = LAYOUT_SPACING.padding + (tallest - columnHeight(keys)) / 2
    for (const key of keys) {
      positions.set(key, { x, y })
      y += sizeOf(key).height + LAYOUT_SPACING.row
    }
    x += width + LAYOUT_SPACING.column
  }

  return {
    positions,
    width: x - LAYOUT_SPACING.column + LAYOUT_SPACING.padding,
    height: tallest + LAYOUT_SPACING.padding * 2,
  }
}

/**
 * The curve of one arrow. A forward arrow leaves the control to the right and enters the target
 * from the left; an arrow back to an earlier column leaves to the left and enters from the right;
 * an arrow within a column loops out on the right so it does not cross the cards between.
 */
export function arrowPath(from: Point, to: Point, direction: 'forward' | 'backward' | 'sideways'): string {
  const reach = Math.max(56, Math.abs(to.x - from.x) / 2)
  const c1 = direction === 'backward' ? from.x - reach : from.x + reach
  const c2 = direction === 'forward' ? to.x - reach : to.x + reach
  return `M ${from.x} ${from.y} C ${c1} ${from.y}, ${c2} ${to.y}, ${to.x} ${to.y}`
}
