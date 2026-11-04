import { describe, expect, it, vi } from 'vitest'
import {
  clampFrameSide,
  DEVICE_SETTINGS_KEY,
  draggedSize,
  fitScale,
  frameCaption,
  frameName,
  frameScale,
  nudgedSize,
  presetOf,
  readDeviceSettings,
  rotatedFrame,
  snapWidth,
  viewportOfWidth,
  writeDeviceSettings,
} from './device-frame'

describe('clampFrameSide', () => {
  it('keeps a side between 240 and 2560 pixels, in whole pixels', () => {
    expect(clampFrameSide(100)).toBe(240)
    expect(clampFrameSide(9000)).toBe(2560)
    expect(clampFrameSide(800.6)).toBe(801)
  })
})

describe('snapWidth', () => {
  it('lands on a breakpoint within 8 pixels of it', () => {
    expect(snapWidth(762)).toBe(768)
    expect(snapWidth(776)).toBe(768)
  })

  it('leaves a width further from every breakpoint alone', () => {
    expect(snapWidth(750)).toBe(750)
  })
})

describe('viewportOfWidth', () => {
  it('names the viewport family a width belongs to', () => {
    expect(viewportOfWidth(390)).toBe('mobile')
    expect(viewportOfWidth(820)).toBe('tablet')
    expect(viewportOfWidth(1280)).toBe('desktop')
  })
})

describe('draggedSize', () => {
  const origin = { width: 800, height: 600 }

  it('moves only the width for the right edge', () => {
    expect(draggedSize({ origin, axis: 'x', dx: 50, dy: 90, scale: 1, centered: false })).toEqual({
      width: 850,
      height: 600,
    })
  })

  it('moves only the height for the bottom edge', () => {
    expect(draggedSize({ origin, axis: 'y', dx: 50, dy: 90, scale: 1, centered: false })).toEqual({
      width: 800,
      height: 690,
    })
  })

  it('doubles the move of a centred frame, so its edge follows the pointer', () => {
    expect(draggedSize({ origin, axis: 'xy', dx: 50, dy: 10, scale: 1, centered: true })).toEqual({
      width: 900,
      height: 610,
    })
  })

  it('counts the move in frame pixels when the frame is zoomed out', () => {
    expect(draggedSize({ origin, axis: 'xy', dx: 50, dy: 50, scale: 0.5, centered: false })).toEqual({
      width: 900,
      height: 700,
    })
  })

  it('snaps the width to a breakpoint and keeps both sides in range', () => {
    expect(draggedSize({ origin, axis: 'xy', dx: -36, dy: -2000, scale: 1, centered: false })).toEqual({
      width: 768,
      height: 240,
    })
  })
})

describe('nudgedSize', () => {
  const size = { width: 800, height: 600 }

  it('moves the right edge with the left and right arrows, more with Shift', () => {
    expect(nudgedSize(size, 'x', 'ArrowRight', false)).toEqual({ width: 810, height: 600 })
    expect(nudgedSize(size, 'x', 'ArrowLeft', true)).toEqual({ width: 750, height: 600 })
  })

  it('moves the bottom edge with the up and down arrows', () => {
    expect(nudgedSize(size, 'y', 'ArrowDown', false)).toEqual({ width: 800, height: 610 })
  })

  it('lets the corner take all four arrows', () => {
    expect(nudgedSize(size, 'xy', 'ArrowUp', false)).toEqual({ width: 800, height: 590 })
    expect(nudgedSize(size, 'xy', 'ArrowRight', false)).toEqual({ width: 810, height: 600 })
  })

  it('ignores a key the handle does not take', () => {
    expect(nudgedSize(size, 'x', 'ArrowUp', false)).toBeUndefined()
    expect(nudgedSize(size, 'xy', 'Enter', false)).toBeUndefined()
  })
})

describe('fitScale', () => {
  it('shrinks a frame to the room the stage leaves for it', () => {
    // 880 - 80 of gutter leaves 800 for a 1600 frame.
    expect(fitScale({ width: 880, height: 2000 }, { width: 1600, height: 800 })).toBe(0.5)
  })

  it('never draws a frame larger than its own size', () => {
    expect(fitScale({ width: 4000, height: 4000 }, { width: 390, height: 844 })).toBe(1)
  })

  it('keeps the scale while a keyboard covers part of the stage', () => {
    const open = fitScale({ width: 2000, height: 488 }, { width: 800, height: 800 }, 400)
    expect(open).toBe(fitScale({ width: 2000, height: 888 }, { width: 800, height: 800 }))
  })

  it('draws at full size before the stage has been measured', () => {
    expect(fitScale({ width: 0, height: 0 }, { width: 1600, height: 800 })).toBe(1)
  })
})

describe('frameScale', () => {
  it('uses the fit scale for Fit and the chosen scale otherwise', () => {
    expect(frameScale('fit', 0.42)).toBe(0.42)
    expect(frameScale(0.75, 0.42)).toBe(0.75)
  })

  it('never draws the frame smaller than a tenth', () => {
    expect(frameScale('fit', 0.01)).toBe(0.1)
  })
})

describe('presetOf', () => {
  it('finds the device a frame came from', () => {
    expect(presetOf({ deviceId: 'ipad-air', width: 820, height: 1180 })?.label).toBe('iPad Air')
  })

  it('finds none for a free size or an unknown id', () => {
    expect(presetOf({ width: 820, height: 1180 })).toBeUndefined()
    expect(presetOf({ deviceId: 'nokia-3310', width: 820, height: 1180 })).toBeUndefined()
  })
})

describe('rotatedFrame', () => {
  it('swaps the sides and keeps the device', () => {
    expect(rotatedFrame({ deviceId: 'ipad-air', width: 820, height: 1180 })).toEqual({
      deviceId: 'ipad-air',
      width: 1180,
      height: 820,
    })
  })
})

describe('frameName', () => {
  it('names the default size, a device, and a free size', () => {
    expect(frameName(undefined, 'Tablet default')).toBe('Tablet default')
    expect(frameName({ deviceId: 'ipad-air', width: 820, height: 1180 }, 'Tablet default')).toBe('iPad Air')
    expect(frameName({ width: 900, height: 700 }, 'Tablet default')).toBe('responsive')
  })

  it("says a turned device's orientation, so the name matches the size beside it", () => {
    expect(frameName({ deviceId: 'ipad-air', width: 1180, height: 820 }, '')).toBe('iPad Air landscape')
    expect(frameName({ deviceId: 'laptop', width: 800, height: 1280 }, '')).toBe('Laptop portrait')
  })
})

describe('frameCaption', () => {
  it('reads size, name and zoom', () => {
    expect(frameCaption({ width: 820, height: 1180 }, 'iPad Air', 0.734)).toBe('820 × 1180 · iPad Air · 73%')
  })
})

describe('device settings', () => {
  it('reads back what was written', () => {
    writeDeviceSettings({ frame: { deviceId: 'ipad-air', width: 820, height: 1180 } })
    writeDeviceSettings({ zoom: 0.5 })

    expect(readDeviceSettings()).toEqual({ frame: { deviceId: 'ipad-air', width: 820, height: 1180 }, zoom: 0.5 })
  })

  it('forgets a key written as undefined', () => {
    writeDeviceSettings({ frame: { width: 900, height: 700 }, zoom: 'fit' })
    writeDeviceSettings({ frame: undefined })

    expect(readDeviceSettings()).toEqual({ zoom: 'fit' })
  })

  it('reads nothing from storage that is not JSON', () => {
    localStorage.setItem(DEVICE_SETTINGS_KEY, '{not json')

    expect(readDeviceSettings()).toEqual({})
  })

  it('drops what is not a frame or a zoom, and keeps sides in range', () => {
    localStorage.setItem(
      DEVICE_SETTINGS_KEY,
      JSON.stringify({ frame: { width: 99999, height: 50, deviceId: 'unknown' }, zoom: 3 })
    )

    expect(readDeviceSettings()).toEqual({ frame: { width: 2560, height: 240 } })
  })

  it('reads nothing when storage is refused, and writing does not throw', () => {
    const refuse = () => {
      throw new Error('storage disabled')
    }
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(refuse)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(refuse)

    expect(readDeviceSettings()).toEqual({})
    expect(() => writeDeviceSettings({ zoom: 0.5 })).not.toThrow()
  })
})
