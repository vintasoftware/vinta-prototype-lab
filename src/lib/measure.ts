import type { AnchorRect } from './anchor-rect'

/** One distance drawn between two elements: a line, its length, and where its label goes. */
export interface Measurement {
  side: 'top' | 'right' | 'bottom' | 'left'
  /** Length in the frame's own pixels. */
  value: number
  /** The line, in the frame's coordinates. */
  x1: number
  y1: number
  x2: number
  y2: number
}

const right = (rect: AnchorRect) => rect.left + rect.width
const bottom = (rect: AnchorRect) => rect.top + rect.height
const contains = (outer: AnchorRect, inner: AnchorRect) =>
  inner.left >= outer.left && inner.top >= outer.top && right(inner) <= right(outer) && bottom(inner) <= bottom(outer)

/** Rounds to a tenth of a pixel, which is as fine as a person reads a distance. */
const round = (value: number) => Math.round(value * 10) / 10

/**
 * The distances between the picked element and another, as design tools draw them.
 *
 * When one holds the other, it is the space on each side between the inner one and the outer one.
 * Otherwise it is the gap between them on each axis where there is one, drawn from the middle of
 * where they face each other.
 */
export function measureBetween(picked: AnchorRect, other: AnchorRect): Measurement[] {
  if (contains(picked, other) || contains(other, picked)) {
    const [outer, inner] = contains(picked, other) ? [picked, other] : [other, picked]
    const midX = inner.left + inner.width / 2
    const midY = inner.top + inner.height / 2
    return [
      { side: 'top' as const, value: inner.top - outer.top, x1: midX, y1: outer.top, x2: midX, y2: inner.top },
      {
        side: 'right' as const,
        value: right(outer) - right(inner),
        x1: right(inner),
        y1: midY,
        x2: right(outer),
        y2: midY,
      },
      {
        side: 'bottom' as const,
        value: bottom(outer) - bottom(inner),
        x1: midX,
        y1: bottom(inner),
        x2: midX,
        y2: bottom(outer),
      },
      { side: 'left' as const, value: inner.left - outer.left, x1: outer.left, y1: midY, x2: inner.left, y2: midY },
    ].map(measurement => ({ ...measurement, value: round(measurement.value) }))
  }

  const found: Measurement[] = []
  const overlapTop = Math.max(picked.top, other.top)
  const overlapBottom = Math.min(bottom(picked), bottom(other))
  const middleY = overlapTop < overlapBottom ? (overlapTop + overlapBottom) / 2 : picked.top + picked.height / 2
  const overlapLeft = Math.max(picked.left, other.left)
  const overlapRight = Math.min(right(picked), right(other))
  const middleX = overlapLeft < overlapRight ? (overlapLeft + overlapRight) / 2 : picked.left + picked.width / 2

  if (other.left >= right(picked)) {
    found.push({
      side: 'right',
      value: round(other.left - right(picked)),
      x1: right(picked),
      y1: middleY,
      x2: other.left,
      y2: middleY,
    })
  } else if (right(other) <= picked.left) {
    found.push({
      side: 'left',
      value: round(picked.left - right(other)),
      x1: right(other),
      y1: middleY,
      x2: picked.left,
      y2: middleY,
    })
  }
  if (other.top >= bottom(picked)) {
    found.push({
      side: 'bottom',
      value: round(other.top - bottom(picked)),
      x1: middleX,
      y1: bottom(picked),
      x2: middleX,
      y2: other.top,
    })
  } else if (bottom(other) <= picked.top) {
    found.push({
      side: 'top',
      value: round(picked.top - bottom(other)),
      x1: middleX,
      y1: bottom(other),
      x2: middleX,
      y2: picked.top,
    })
  }
  return found
}

/** Padding and margin of an element, by side, in pixels as the browser computed them. */
export interface BoxModel {
  padding: Record<'top' | 'right' | 'bottom' | 'left', number>
  margin: Record<'top' | 'right' | 'bottom' | 'left', number>
}

export function boxModel(style: Pick<CSSStyleDeclaration, 'getPropertyValue'>): BoxModel {
  const read = (property: string) => Number.parseFloat(style.getPropertyValue(property)) || 0
  const sides = (prefix: string) => ({
    top: read(`${prefix}-top`),
    right: read(`${prefix}-right`),
    bottom: read(`${prefix}-bottom`),
    left: read(`${prefix}-left`),
  })
  return { padding: sides('padding'), margin: sides('margin') }
}
