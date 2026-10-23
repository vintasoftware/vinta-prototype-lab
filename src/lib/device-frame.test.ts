import { describe, expect, it } from 'vitest'
import {
  clampFrameSide,
  DEVICE_SETTINGS_KEY,
  draggedSize,
  fitScale,
  frameCaption,
  frameScale,
  readDeviceSettings,
  snapWidth,
  viewportOfWidth,
  writeDeviceSettings,
} from './device-frame'

describe('clampFrameSide', () => {
  it('keeps a side between the smallest and largest the toolbar allows', () => {
    expect(clampFrameSide(10)).toBe(240)
    expect(clampFrameSide(9000)).toBe(2560)
    expect(clampFrameSide(500.6)).toBe(501)
  })
})

describe('snapWidth', () => {
  it('snaps a width close to a breakpoint onto it', () => {
    expect(snapWidth(774)).toBe(768)
    expect(snapWidth(1018)).toBe(1024)
  })

  it('leaves a width away from every breakpoint as it is', () => {
    expect(snapWidth(700)).toBe(700)
  })
})

describe('viewportOfWidth', () => {
  it('names the viewport family of a width', () => {
    expect(viewportOfWidth(390)).toBe('mobile')
    expect(viewportOfWidth(834)).toBe('tablet')
    expect(viewportOfWidth(1280)).toBe('desktop')
  })
})

describe('draggedSize', () => {
  const start = { width: 400, height: 800 }

  it('changes only the width on the side handle', () => {
    expect(draggedSize({ axis: 'x', start, dx: 50, dy: 90, scale: 1, centered: false })).toEqual({
      width: 450,
      height: 800,
    })
  })

  it('changes only the height on the bottom handle', () => {
    expect(draggedSize({ axis: 'y', start, dx: 50, dy: 90, scale: 1, centered: false })).toEqual({
      width: 400,
      height: 890,
    })
  })

  it('grows a centered frame twice the move, since it grows on both sides', () => {
    expect(draggedSize({ axis: 'xy', start, dx: 50, dy: 10, scale: 1, centered: true })).toEqual({
      width: 500,
      height: 810,
    })
  })

  it('turns a move on the page into frame pixels on a zoomed out frame', () => {
    expect(draggedSize({ axis: 'xy', start, dx: 25, dy: 25, scale: 0.5, centered: false })).toEqual({
      width: 450,
      height: 850,
    })
  })

  it('snaps the width to a breakpoint it passes close to', () => {
    expect(draggedSize({ axis: 'x', start, dx: 245, dy: 0, scale: 1, centered: false }).width).toBe(640)
  })
})

describe('fitScale', () => {
  it('fits a frame larger than the stage', () => {
    expect(fitScale({ width: 1840, height: 900 }, { width: 1000, height: 2000 })).toBe(0.5)
  })

  it('never draws a frame larger than its own size', () => {
    expect(fitScale({ width: 390, height: 844 }, { width: 2000, height: 2000 })).toBe(1)
  })

  it('ignores the height an on-screen keyboard covers', () => {
    const frame = { width: 390, height: 912 }
    expect(fitScale(frame, { width: 2000, height: 544 }, 456)).toBe(1)
  })

  it('draws at full size before the stage is measured', () => {
    expect(fitScale({ width: 1280, height: 820 }, { width: 0, height: 0 })).toBe(1)
  })
})

describe('frameScale', () => {
  it('uses the fit for "fit" and the set scale otherwise, never below a tenth', () => {
    expect(frameScale('fit', 0.42)).toBe(0.42)
    expect(frameScale(0.75, 0.42)).toBe(0.75)
    expect(frameScale('fit', 0.01)).toBe(0.1)
  })
})

describe('frameCaption', () => {
  it('names a device frame', () => {
    expect(frameCaption({ width: 393, height: 852 }, { deviceId: 'iphone-15', width: 393, height: 852 }, 1)).toBe(
      '393 × 852 · iPhone 15 · 100%'
    )
  })

  it('names the screen default and a free size', () => {
    expect(frameCaption({ width: 1280, height: 820 }, undefined, 0.5)).toBe('1280 × 820 · screen default · 50%')
    expect(frameCaption({ width: 700, height: 600 }, { width: 700, height: 600 }, 0.754)).toBe(
      '700 × 600 · responsive · 75%'
    )
  })
})

describe('device settings', () => {
  it('remembers the frame and zoom, each written on its own', () => {
    writeDeviceSettings({ frame: { deviceId: 'pixel-7', width: 412, height: 915 } })
    writeDeviceSettings({ zoom: 0.5 })

    expect(readDeviceSettings()).toEqual({ frame: { deviceId: 'pixel-7', width: 412, height: 915 }, zoom: 0.5 })
  })

  it('forgets the frame when it goes back to the screen default', () => {
    writeDeviceSettings({ frame: { width: 700, height: 600 }, zoom: 'fit' })
    writeDeviceSettings({ frame: undefined })

    expect(readDeviceSettings()).toEqual({ zoom: 'fit' })
  })

  it('reads nothing from a value it cannot use', () => {
    localStorage.setItem(DEVICE_SETTINGS_KEY, '{"frame":{"width":"wide"},"zoom":-1}')
    expect(readDeviceSettings()).toEqual({})

    localStorage.setItem(DEVICE_SETTINGS_KEY, 'not json')
    expect(readDeviceSettings()).toEqual({})
  })
})
