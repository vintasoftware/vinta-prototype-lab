import { describe, expect, it } from 'vitest'
import { measureAnchor, overlayBox, overlayRing } from './anchor-rect'

/** happy-dom reports every box as zero, so tests state the geometry they are about. */
function withRect<T extends HTMLElement>(
  element: T,
  rect: { top: number; left: number; width: number; height: number }
): T {
  element.getBoundingClientRect = () =>
    ({
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect
  return element
}

function frameWith(children: HTMLElement[]): HTMLElement {
  const frame = withRect(document.createElement('div'), { top: 100, left: 50, width: 400, height: 800 })
  for (const child of children) {
    frame.append(child)
  }
  return frame
}

describe('measureAnchor', () => {
  it('reports the box relative to the frame', () => {
    const element = withRect(document.createElement('button'), { top: 160, left: 70, width: 200, height: 40 })

    expect(measureAnchor(element, frameWith([element]))).toEqual({ top: 60, left: 20, width: 200, height: 40 })
  })

  it('measures the children of a wrapper that renders no box of its own', () => {
    const wrapper = withRect(document.createElement('span'), { top: 0, left: 0, width: 0, height: 0 })
    wrapper.append(withRect(document.createElement('span'), { top: 200, left: 100, width: 50, height: 20 }))
    wrapper.append(withRect(document.createElement('span'), { top: 200, left: 160, width: 40, height: 30 }))

    expect(measureAnchor(wrapper, frameWith([wrapper]))).toEqual({ top: 100, left: 50, width: 100, height: 30 })
  })

  it('reports nothing for an element with no box anywhere inside it', () => {
    const empty = withRect(document.createElement('span'), { top: 0, left: 0, width: 0, height: 0 })

    expect(measureAnchor(empty, frameWith([empty]))).toBeUndefined()
  })
})

describe('overlayBox', () => {
  it('places a box where it was asked for when the frame has room', () => {
    expect(overlayBox(20, 288)).toEqual({
      left: 'clamp(0px, 20px, calc(100% - 288px))',
      width: 'min(288px, 100%)',
    })
  })

  it('stops the box at the frame edge, so a note beside a right-hand element scrolls nothing', () => {
    // 320 + 288 runs past a 390pt frame; the max term pulls it back to the frame's own width.
    expect(overlayBox(320, 288).left).toBe('clamp(0px, 320px, calc(100% - 288px))')
  })

  it('lets a box narrower than it asked for fit a frame narrower than the box', () => {
    expect(overlayBox(0, 288).width).toBe('min(288px, 100%)')
  })
})

describe('overlayRing', () => {
  it('traces the element it is drawn around', () => {
    expect(overlayRing({ top: 40, left: 20, width: 200, height: 44 })).toEqual({
      left: 20,
      width: 'min(200px, calc(100% - 20px))',
    })
  })

  it('trims an element that runs past the right edge', () => {
    expect(overlayRing({ top: 40, left: 20, width: 600, height: 44 }).width).toBe('min(600px, calc(100% - 20px))')
  })

  it('starts at the frame edge for an element that begins outside it', () => {
    expect(overlayRing({ top: 40, left: -30, width: 200, height: 44 })).toEqual({
      left: 0,
      width: 'min(200px, calc(100% - 0px))',
    })
  })
})
