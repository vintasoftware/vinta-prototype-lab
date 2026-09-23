import type { ScreenViewport } from '../types'
import { FRAME_HEIGHT, THUMBNAIL_SCALE, VIEWPORT_WIDTH } from './constants'
import {
  arrowPath,
  type FlowControl,
  type FlowEdge,
  type FlowGraph,
  type FlowLayout,
  type FlowNode,
  type FlowNodeKey,
  type Point,
  type Size,
} from './flow-graph'
import { elementAtPath } from './probe-screen'

/** Space a thumbnail of a screen with this viewport takes, after scaling. */
export function thumbnailSize(viewport: ScreenViewport): Size {
  const scale = THUMBNAIL_SCALE[viewport]
  return { width: Math.round(VIEWPORT_WIDTH[viewport] * scale), height: Math.round(FRAME_HEIGHT[viewport] * scale) }
}

/*
 * A card is sized in code rather than measured, so the layout and the drawing agree before the
 * first paint. Every number here matches a class on the card the map renders.
 */
const CARD_BORDER = 1
export const HEADER_HEIGHT = 40
const THUMBNAIL_INSET = 8
const THUMBNAIL_BORDER = 1
const ROW_HEIGHT = 24
const FOOTER_PADDING = 8
export const MISSING_SIZE: Size = { width: 240, height: 76 }
/** Vertical distance between two arrows entering the same card. */
export const ARROW_SPREAD = 16

/** Rows under a card's thumbnail: one per destination, one for the controls that go back, one for an error. */
export function rowCount(node: FlowNode, edges: readonly FlowEdge[]): number {
  const outgoing = edges.filter(edge => edge.from === node.key).length
  return outgoing + (node.backControls.length > 0 ? 1 : 0) + (node.error === undefined ? 0 : 1)
}

export function cardSize(node: FlowNode, edges: readonly FlowEdge[], viewport: ScreenViewport | undefined): Size {
  const thumbnail = thumbnailSize(viewport ?? node.screen.viewport)
  const rows = rowCount(node, edges)
  return {
    width: thumbnail.width + 2 * (CARD_BORDER + THUMBNAIL_INSET + THUMBNAIL_BORDER),
    height:
      2 * CARD_BORDER +
      HEADER_HEIGHT +
      thumbnail.height +
      2 * THUMBNAIL_BORDER +
      (rows === 0 ? THUMBNAIL_INSET : rows * ROW_HEIGHT + 2 * FOOTER_PADDING),
  }
}

export interface Box {
  x: number
  y: number
  width: number
  height: number
}

export interface Arrow {
  edge: FlowEdge
  d: string
  backward: boolean
}

export interface Ring {
  key: string
  node: FlowNodeKey
  rect: Box
  kind: 'screen' | 'back'
}

export interface Drawing {
  arrows: Arrow[]
  rings: Ring[]
}

export const NOTHING_DRAWN: Drawing = { arrows: [], rings: [] }

/** Where an element is on screen. Injected so the geometry can be tested without a layout engine. */
export type Measure = (element: Element) => DOMRect

/** A box measured on screen, put back into the canvas's own (unscaled) coordinates. */
function toCanvas(rect: DOMRect, origin: DOMRect, scale: number): Box {
  return {
    x: (rect.left - origin.left) / scale,
    y: (rect.top - origin.top) / scale,
    width: rect.width / scale,
    height: rect.height / scale,
  }
}

function intersects(box: Box, within: Box): boolean {
  return (
    box.width > 0 &&
    box.height > 0 &&
    box.x < within.x + within.width &&
    box.x + box.width > within.x &&
    box.y < within.y + within.height &&
    box.y + box.height > within.y
  )
}

export function edgeKey(edge: FlowEdge): string {
  return `${edge.from}->${edge.to}`
}

export interface DrawFlowOptions {
  graph: FlowGraph
  layout: FlowLayout
  /** Zoom the canvas is drawn at. Measurements come back in screen pixels and are divided by it. */
  scale: number
  sizeOf: (key: FlowNodeKey) => Size
  /** The canvas element every position is relative to. */
  content: Element
  /** The element each screen renders into, by node. Control paths are relative to it. */
  mounts: ReadonlyMap<FlowNodeKey, Element>
  /** The row on a card for each edge, by {@link edgeKey}. Where an arrow starts when its control is not found. */
  rows: ReadonlyMap<string, Element>
  measure?: Measure
}

/**
 * Where every arrow starts and ends, measured from the live thumbnails.
 *
 * An arrow starts at a control that opens its destination, found in the thumbnail by the path the
 * probe recorded. When none of them is there — the thumbnail rendered differently, or the controls
 * sit below the fold — the arrow starts at the card's row for that destination instead, so every
 * edge is drawn. Every control found is also returned as a ring, so the map can outline it.
 */
export function drawFlow({
  graph,
  layout,
  scale,
  sizeOf,
  content,
  mounts,
  rows,
  measure = element => element.getBoundingClientRect(),
}: DrawFlowOptions): Drawing {
  const origin = measure(content)
  if (origin.width === 0 && origin.height === 0) {
    return NOTHING_DRAWN
  }
  const layerOf = new Map<FlowNodeKey, number>([
    ...graph.nodes.map(node => [node.key, node.layer] as const),
    ...graph.missing.map(missing => [missing.key, missing.layer] as const),
  ])

  const thumbnailBox = (key: FlowNodeKey): Box | undefined => {
    const outer = mounts.get(key)?.parentElement
    return outer === undefined || outer === null ? undefined : toCanvas(measure(outer), origin, scale)
  }

  const controlBox = (key: FlowNodeKey, control: FlowControl): Box | undefined => {
    const mount = mounts.get(key)
    const within = thumbnailBox(key)
    if (mount === undefined || within === undefined) {
      return undefined
    }
    const element = elementAtPath(mount, control.path)
    if (element === undefined) {
      return undefined
    }
    const box = toCanvas(measure(element), origin, scale)
    return intersects(box, within) ? box : undefined
  }

  const rings: Ring[] = []
  for (const edge of graph.edges) {
    edge.controls.forEach((control, index) => {
      const box = controlBox(edge.from, control)
      if (box !== undefined) {
        rings.push({ key: `${edgeKey(edge)}#${index}`, node: edge.from, rect: box, kind: 'screen' })
      }
    })
  }
  for (const node of graph.nodes) {
    node.backControls.forEach((control, index) => {
      const box = controlBox(node.key, control)
      if (box !== undefined) {
        rings.push({ key: `${node.key}<-#${index}`, node: node.key, rect: box, kind: 'back' })
      }
    })
  }

  // Arrows into one card fan out down its header rather than all landing on one point.
  const incomingSlot = new Map<string, number>()
  const incomingCount = new Map<FlowNodeKey, number>()
  for (const edge of graph.edges) {
    incomingSlot.set(edgeKey(edge), incomingCount.get(edge.to) ?? 0)
    incomingCount.set(edge.to, (incomingCount.get(edge.to) ?? 0) + 1)
  }

  const arrows: Arrow[] = []
  for (const edge of graph.edges) {
    if (edge.from === edge.to) {
      continue
    }
    const toPosition = layout.positions.get(edge.to)
    if (toPosition === undefined || !layout.positions.has(edge.from)) {
      continue
    }
    const fromLayer = layerOf.get(edge.from) ?? 0
    const toLayer = layerOf.get(edge.to) ?? 0
    const direction = toLayer > fromLayer ? 'forward' : toLayer < fromLayer ? 'backward' : 'sideways'

    // Leave from the control nearest the side the arrow exits, so it crosses none of its siblings.
    const boxes = edge.controls.flatMap(control => controlBox(edge.from, control) ?? [])
    const nearestExit = boxes.reduce<Box | undefined>((best, box) => {
      if (best === undefined) {
        return box
      }
      if (direction === 'backward') {
        return box.x < best.x ? box : best
      }
      return box.x + box.width > best.x + best.width ? box : best
    }, undefined)
    const row = rows.get(edgeKey(edge))
    const start = nearestExit ?? (row === undefined ? undefined : toCanvas(measure(row), origin, scale))
    if (start === undefined) {
      continue
    }

    const from: Point = {
      x: direction === 'backward' ? start.x : start.x + start.width,
      y: start.y + start.height / 2,
    }
    const targetSize = sizeOf(edge.to)
    const slot = incomingSlot.get(edgeKey(edge)) ?? 0
    const to: Point = {
      x: direction === 'forward' ? toPosition.x : toPosition.x + targetSize.width,
      y: Math.min(
        toPosition.y + HEADER_HEIGHT / 2 + slot * ARROW_SPREAD,
        toPosition.y + targetSize.height - ARROW_SPREAD
      ),
    }

    arrows.push({ edge, d: arrowPath(from, to, direction), backward: direction === 'backward' })
  }

  return { arrows, rings }
}
