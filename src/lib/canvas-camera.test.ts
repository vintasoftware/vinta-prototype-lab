// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  boundsOf,
  clampZoom,
  fitRect,
  nearestInDirection,
  panBy,
  readingOrder,
  toCanvas,
  zoomAt,
} from './canvas-camera'

describe('clampZoom', () => {
  it('keeps the zoom between 5% and 200%', () => {
    expect(clampZoom(0.01)).toBe(0.05)
    expect(clampZoom(3)).toBe(2)
    expect(clampZoom(0.5)).toBe(0.5)
  })
})

describe('zoomAt', () => {
  it('keeps the canvas point under the anchor where it is', () => {
    const camera = { x: 100, y: 50, zoom: 1 }
    const anchor = { x: 300, y: 250 }
    const before = toCanvas(camera, anchor)

    const zoomed = zoomAt(camera, 2, anchor)

    expect(zoomed.zoom).toBe(2)
    expect(toCanvas(zoomed, anchor)).toEqual(before)
  })

  it('stops at the end of the range', () => {
    expect(zoomAt({ x: 0, y: 0, zoom: 1.8 }, 5, { x: 0, y: 0 }).zoom).toBe(2)
  })
})

describe('panBy', () => {
  it('moves the camera by screen pixels', () => {
    expect(panBy({ x: 10, y: 20, zoom: 0.5 }, -30, 5)).toEqual({ x: -20, y: 25, zoom: 0.5 })
  })
})

describe('fitRect', () => {
  it('shows the box whole and centred', () => {
    const camera = fitRect({ x: 0, y: 0, width: 2000, height: 1000 }, { width: 1096, height: 1096 })

    expect(camera.zoom).toBe(0.5)
    expect(camera.x).toBe(48)
    expect(camera.y).toBe((1096 - 500) / 2)
  })

  it('never zooms past the maximum it is given', () => {
    expect(fitRect({ x: 0, y: 0, width: 100, height: 100 }, { width: 1000, height: 1000 }).zoom).toBe(1)
  })

  it('stays put for an empty box or an unmeasured viewport', () => {
    expect(fitRect({ x: 0, y: 0, width: 0, height: 0 }, { width: 800, height: 600 })).toEqual({ x: 0, y: 0, zoom: 1 })
    expect(fitRect({ x: 0, y: 0, width: 10, height: 10 }, { width: 0, height: 0 })).toEqual({ x: 0, y: 0, zoom: 1 })
  })
})

describe('boundsOf', () => {
  it('holds every box', () => {
    expect(
      boundsOf([
        { x: 10, y: 20, width: 100, height: 50 },
        { x: -40, y: 100, width: 20, height: 20 },
      ])
    ).toEqual({ x: -40, y: 20, width: 150, height: 100 })
  })
})

describe('nearestInDirection', () => {
  const frames = [
    { key: 'right', rect: { x: 300, y: 0, width: 100, height: 100 } },
    { key: 'far-right-below', rect: { x: 250, y: 600, width: 100, height: 100 } },
    { key: 'below', rect: { x: 0, y: 300, width: 100, height: 100 } },
  ]
  const from = { x: 0, y: 0, width: 100, height: 100 }

  it('moves to the frame that way, preferring one in line', () => {
    expect(nearestInDirection(from, frames, 'right')).toBe('right')
    expect(nearestInDirection(from, frames, 'down')).toBe('below')
  })

  it('finds nothing when no frame lies that way', () => {
    expect(nearestInDirection(from, frames, 'left')).toBeUndefined()
    expect(nearestInDirection(from, frames, 'up')).toBeUndefined()
  })
})

describe('readingOrder', () => {
  it('reads rows top to bottom and left to right, with a little slack for the row', () => {
    expect(
      readingOrder([
        { key: 'c', rect: { x: 0, y: 500, width: 10, height: 10 } },
        { key: 'b', rect: { x: 400, y: 10, width: 10, height: 10 } },
        { key: 'a', rect: { x: 0, y: 30, width: 10, height: 10 } },
      ])
    ).toEqual(['a', 'b', 'c'])
  })
})
