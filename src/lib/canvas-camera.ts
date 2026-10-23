import type { Point, Size } from './flow-graph'

/** Where the canvas is looked at from: a shift in screen pixels, then a zoom. */
export interface Camera {
  x: number
  y: number
  zoom: number
}

/** A box in canvas pixels, the coordinates frames and sections are laid out in. */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export const MIN_ZOOM = 0.05
export const MAX_ZOOM = 2

/**
 * Below this zoom a frame is a card with its title only. A 1280 px screen is 256 px wide here, too
 * small to read, and drawing dozens of them is what costs a pan its frame rate.
 */
export const CARD_ONLY_ZOOM = 0.2

/** How much one `+` or `-` press, or one toolbar click, zooms. */
export const ZOOM_STEP = 1.25

/** How far one arrow key pans, in screen pixels. */
export const PAN_STEP = 80

/** Room left around what a fit shows, in screen pixels. */
const FIT_PADDING = 48

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

/** The canvas point under a point of the viewport. */
export function toCanvas(camera: Camera, point: Point): Point {
  return { x: (point.x - camera.x) / camera.zoom, y: (point.y - camera.y) / camera.zoom }
}

/**
 * Zooms to `zoom`, keeping the canvas point under `anchor` (a point of the viewport) where it is.
 * Zooming on the pointer is what makes a wheel zoom land on the thing being looked at.
 */
export function zoomAt(camera: Camera, zoom: number, anchor: Point): Camera {
  const next = clampZoom(zoom)
  const ratio = next / camera.zoom
  return { x: anchor.x - (anchor.x - camera.x) * ratio, y: anchor.y - (anchor.y - camera.y) * ratio, zoom: next }
}

export function panBy(camera: Camera, dx: number, dy: number): Camera {
  return { ...camera, x: camera.x + dx, y: camera.y + dy }
}

/**
 * The camera that shows `rect` whole and centred in a viewport of `viewport`. It never zooms past
 * `maxZoom`, so fitting one small frame does not blow it up.
 */
export function fitRect(rect: Rect, viewport: Size, maxZoom = 1): Camera {
  if (rect.width <= 0 || rect.height <= 0 || viewport.width <= 0 || viewport.height <= 0) {
    return { x: 0, y: 0, zoom: 1 }
  }
  const zoom = clampZoom(
    Math.min(
      maxZoom,
      (viewport.width - FIT_PADDING * 2) / rect.width,
      (viewport.height - FIT_PADDING * 2) / rect.height
    )
  )
  return {
    x: (viewport.width - rect.width * zoom) / 2 - rect.x * zoom,
    y: (viewport.height - rect.height * zoom) / 2 - rect.y * zoom,
    zoom,
  }
}

/** The smallest box holding every one of `rects`. */
export function boundsOf(rects: readonly Rect[]): Rect {
  if (rects.length === 0) {
    return { x: 0, y: 0, width: 0, height: 0 }
  }
  const left = Math.min(...rects.map(rect => rect.x))
  const top = Math.min(...rects.map(rect => rect.y))
  const right = Math.max(...rects.map(rect => rect.x + rect.width))
  const bottom = Math.max(...rects.map(rect => rect.y + rect.height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}

export type Direction = 'left' | 'right' | 'up' | 'down'

const center = (rect: Rect): Point => ({ x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 })

/**
 * The frame an arrow key moves to: the nearest one whose centre lies that way. Distance across the
 * direction counts double, so Right picks the frame beside this one over one far below it.
 */
export function nearestInDirection<K>(
  from: Rect,
  candidates: ReadonlyArray<{ key: K; rect: Rect }>,
  direction: Direction
): K | undefined {
  const origin = center(from)
  let best: { key: K; score: number } | undefined

  for (const candidate of candidates) {
    const point = center(candidate.rect)
    const dx = point.x - origin.x
    const dy = point.y - origin.y
    const along = direction === 'left' ? -dx : direction === 'right' ? dx : direction === 'up' ? -dy : dy
    const across = direction === 'left' || direction === 'right' ? Math.abs(dy) : Math.abs(dx)
    if (along <= 0) {
      continue
    }
    const score = along + across * 2
    if (best === undefined || score < best.score) {
      best = { key: candidate.key, score }
    }
  }

  return best?.key
}

/**
 * Frames in reading order: top to bottom by row, left to right within a row. Two frames whose tops
 * are within `rowTolerance` of each other share a row, so a slightly lower neighbour is not skipped.
 */
export function readingOrder<K>(items: ReadonlyArray<{ key: K; rect: Rect }>, rowTolerance = 40): K[] {
  const sorted = [...items].sort((a, b) => a.rect.y - b.rect.y)
  const rows: Array<Array<{ key: K; rect: Rect }>> = []
  for (const item of sorted) {
    const row = rows[rows.length - 1]
    const first = row?.[0]
    if (row !== undefined && first !== undefined && item.rect.y - first.rect.y <= rowTolerance) {
      row.push(item)
    } else {
      rows.push([item])
    }
  }
  return rows.flatMap(row => row.sort((a, b) => a.rect.x - b.rect.x).map(item => item.key))
}
