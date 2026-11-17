import type { Rect } from './canvas-camera'
import { MISSING_SIZE } from './flow-drawing'
import type { FlowGraph, FlowNode, FlowNodeKey, Point, Size } from './flow-graph'

/** One frame on the canvas: its card (title, screen, rows), in canvas pixels. */
export interface CanvasFrameBox extends Rect {
  key: FlowNodeKey
}

/**
 * The states of one screen, side by side under a label. A link that opens a screen no file defines
 * gets a section of its own too, holding the red card that says so.
 */
export interface CanvasSection extends Rect {
  /** The screen id, or the id a link names for a missing screen. */
  screenId: string
  title: string
  missing: boolean
  frames: CanvasFrameBox[]
}

export interface CanvasLayout {
  sections: CanvasSection[]
  frameByKey: Map<FlowNodeKey, CanvasFrameBox>
  bounds: Rect
}

/** Every distance a section is built from, in canvas pixels. The section component uses the same numbers. */
export const SECTION_SPACING = {
  /**
   * Room across the top of a section, above its frames. With the padding it is the height a frame
   * title takes at its largest (3 x 40), so a title grown to stay readable never leaves its section.
   */
  label: 88,
  /** Inside the section, around its frames. */
  padding: 32,
  /** Between two frames of one section. */
  frameGap: 64,
  /** Between two columns of sections. */
  column: 320,
  /** Between two sections in one column. */
  row: 160,
} as const

interface SectionDraft {
  screenId: string
  title: string
  missing: boolean
  layer: number
  frames: Array<{ key: FlowNodeKey; size: Size }>
}

/** The frames one screen state is drawn in: one, or one per viewport when several are shown. */
export type FramesOf = (node: FlowNode) => Array<{ key: string; size: Size }>

/** Groups the graph's nodes by screen, in the order the sidebar lists them, one section each. */
function draftSections(graph: FlowGraph, framesOf: FramesOf): SectionDraft[] {
  const drafts: SectionDraft[] = []
  const byScreen = new Map<string, SectionDraft>()

  for (const node of graph.nodes) {
    let draft = byScreen.get(node.screen.id)
    if (draft === undefined) {
      draft = { screenId: node.screen.id, title: node.screen.title, missing: false, layer: node.layer, frames: [] }
      byScreen.set(node.screen.id, draft)
      drafts.push(draft)
    }
    draft.layer = Math.min(draft.layer, node.layer)
    draft.frames.push(...framesOf(node))
  }

  for (const missing of graph.missing) {
    drafts.push({
      screenId: missing.screenId,
      title: missing.screenId,
      missing: true,
      layer: missing.layer,
      frames: [{ key: missing.key, size: MISSING_SIZE }],
    })
  }

  return drafts
}

function sectionSize(draft: SectionDraft): Size {
  const framesWidth =
    draft.frames.reduce((total, frame) => total + frame.size.width, 0) +
    Math.max(0, draft.frames.length - 1) * SECTION_SPACING.frameGap
  const framesHeight = Math.max(0, ...draft.frames.map(frame => frame.size.height))
  return {
    width: framesWidth + SECTION_SPACING.padding * 2,
    height: SECTION_SPACING.label + framesHeight + SECTION_SPACING.padding * 2,
  }
}

/** Places a section's frames left to right inside it, tops aligned under the label. */
function placeSection(draft: SectionDraft, at: Point): CanvasSection {
  const size = sectionSize(draft)
  const frames: CanvasFrameBox[] = []
  let x = at.x + SECTION_SPACING.padding
  const y = at.y + SECTION_SPACING.label + SECTION_SPACING.padding
  for (const frame of draft.frames) {
    frames.push({ key: frame.key, x, y, ...frame.size })
    x += frame.size.width + SECTION_SPACING.frameGap
  }
  return {
    screenId: draft.screenId,
    title: draft.title,
    missing: draft.missing,
    x: at.x,
    y: at.y,
    ...size,
    frames,
  }
}

/** The shape the auto layout aims for, width to height: about that of a screen. */
const TARGET_ASPECT = 16 / 10

/** Columns of sections, each wrapped once it grows past `maxHeight`. */
function placeColumns(
  columns: ReadonlyArray<readonly SectionDraft[]>,
  sizes: ReadonlyMap<string, Size>,
  origin: Point,
  maxHeight: number
): { positions: Map<string, Point>; width: number; height: number } {
  const positions = new Map<string, Point>()
  let x = origin.x
  let height = 0
  for (const column of columns) {
    let y = origin.y
    let width = 0
    for (const draft of column) {
      const size = sizes.get(draft.screenId) ?? { width: 0, height: 0 }
      if (y > origin.y && y + size.height > origin.y + maxHeight) {
        x += width + SECTION_SPACING.column
        y = origin.y
        width = 0
      }
      positions.set(draft.screenId, { x, y })
      height = Math.max(height, y + size.height - origin.y)
      y += size.height + SECTION_SPACING.row
      width = Math.max(width, size.width)
    }
    x += width + SECTION_SPACING.column
  }
  return { positions, width: x - SECTION_SPACING.column - origin.x, height }
}

/**
 * Where the flow graph's columns put each section: one column per layer, read left to right.
 *
 * A layer can hold many screens, as when a menu reaches every screen in one click. Stacked in one
 * column they would make a canvas far taller than wide, which no zoom fits; spread in a row, far
 * wider. So each column wraps after the number of sections that brings the whole canvas closest to
 * a screen's shape.
 */
function autoPositions(drafts: readonly SectionDraft[], origin: Point): Map<string, Point> {
  const byLayer = new Map<number, SectionDraft[]>()
  for (const draft of drafts) {
    byLayer.set(draft.layer, [...(byLayer.get(draft.layer) ?? []), draft])
  }
  const columns = [...byLayer.entries()].sort(([a], [b]) => a - b).map(([, column]) => column)
  const sizes = new Map(drafts.map(draft => [draft.screenId, sectionSize(draft)] as const))
  const tallest = Math.max(0, ...[...sizes.values()].map(size => size.height))
  const longest = Math.max(1, ...columns.map(column => column.length))

  let best: { positions: Map<string, Point>; distance: number } | undefined
  for (let perColumn = 1; perColumn <= longest; perColumn += 1) {
    const maxHeight = perColumn * (tallest + SECTION_SPACING.row) - SECTION_SPACING.row
    const placed = placeColumns(columns, sizes, origin, maxHeight)
    const distance = Math.abs(Math.log(placed.width / Math.max(1, placed.height) / TARGET_ASPECT))
    if (best === undefined || distance < best.distance) {
      best = { positions: placed.positions, distance }
    }
  }
  return best?.positions ?? new Map()
}

/**
 * Lays the canvas out: one section per screen, in the flow graph's columns by default.
 *
 * `saved` holds positions a person dragged sections to. Those sections stay where they were put;
 * any other section is laid out by the columns, to the right of everything already placed, so a new
 * screen never lands on top of an arranged one.
 *
 * `framesOf` says which frames each state is drawn in, side by side in its section: one by default,
 * one per viewport when several are shown.
 */
export function layoutCanvas(
  graph: FlowGraph,
  cardSize: (key: FlowNodeKey) => Size,
  saved: ReadonlyMap<string, Point> = new Map(),
  framesOf: FramesOf = node => [{ key: node.key, size: cardSize(node.key) }]
): CanvasLayout {
  const drafts = draftSections(graph, framesOf)
  const placed = drafts.filter(draft => saved.has(draft.screenId))
  const unplaced = drafts.filter(draft => !saved.has(draft.screenId))

  const placedRight = Math.max(
    0,
    ...placed.map(draft => (saved.get(draft.screenId)?.x ?? 0) + sectionSize(draft).width + SECTION_SPACING.column)
  )
  const auto = autoPositions(unplaced, { x: placed.length === 0 ? 0 : placedRight, y: 0 })

  const sections = drafts.map(draft =>
    placeSection(draft, saved.get(draft.screenId) ?? auto.get(draft.screenId) ?? { x: 0, y: 0 })
  )
  const frameByKey = new Map(sections.flatMap(section => section.frames.map(frame => [frame.key, frame] as const)))

  const left = Math.min(0, ...sections.map(section => section.x))
  const top = Math.min(0, ...sections.map(section => section.y))
  const right = Math.max(0, ...sections.map(section => section.x + section.width))
  const bottom = Math.max(0, ...sections.map(section => section.y + section.height))

  return { sections, frameByKey, bounds: { x: left, y: top, width: right - left, height: bottom - top } }
}

/** Which way an arrow runs between two frames, from where they sit rather than from their layers. */
export function arrowDirection(from: Rect, to: Rect): 'forward' | 'backward' | 'sideways' {
  if (to.x >= from.x + from.width) {
    return 'forward'
  }
  if (to.x + to.width <= from.x) {
    return 'backward'
  }
  return 'sideways'
}
