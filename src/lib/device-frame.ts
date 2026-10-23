import type { ScreenViewport } from '../types'
import { DEVICE_PRESETS, MAX_FRAME_SIDE, MIN_FRAME_SIDE, SNAP_DISTANCE, SNAP_WIDTHS } from './constants'

export interface FrameSize {
  width: number
  height: number
}

/**
 * A size the person gave the frame in the device toolbar, by picking a device or by typing or
 * dragging. `deviceId` stays only while the size is still the device's own.
 */
export interface DeviceFrame extends FrameSize {
  deviceId?: string
}

/** How big the frame is drawn: fit to the stage, or a set scale. */
export type FrameZoom = 'fit' | number

/** Which sides a drag on the frame's edge changes: the width, the height, or both. */
export type ResizeAxis = 'x' | 'y' | 'xy'

/** Keeps a side of the frame within the sizes the toolbar allows, in whole pixels. */
export function clampFrameSide(value: number): number {
  return Math.round(Math.min(MAX_FRAME_SIDE, Math.max(MIN_FRAME_SIDE, value)))
}

/** The breakpoint a width is close enough to, or the width itself. */
export function snapWidth(width: number): number {
  return SNAP_WIDTHS.find(candidate => Math.abs(candidate - width) <= SNAP_DISTANCE) ?? width
}

/** The viewport family a frame width belongs to, for the screen's `data-viewport` and the flow map. */
export function viewportOfWidth(width: number): ScreenViewport {
  if (width < 600) {
    return 'mobile'
  }
  return width < 1100 ? 'tablet' : 'desktop'
}

export function devicePreset(id: string | undefined) {
  return id === undefined ? undefined : DEVICE_PRESETS.find(preset => preset.id === id)
}

export interface DragInput {
  axis: ResizeAxis
  /** The frame's size when the drag started. */
  start: FrameSize
  /** How far the pointer moved since then, in page pixels. */
  dx: number
  dy: number
  /** How big the frame is drawn, so a move on the page is turned into frame pixels. */
  scale: number
  /** A centered frame grows on both sides, so its right edge moves half as far as the width grows. */
  centered: boolean
}

/** The frame's size while one of its edges is dragged. Widths snap to the breakpoints. */
export function draggedSize({ axis, start, dx, dy, scale, centered }: DragInput): FrameSize {
  const width = axis === 'y' ? start.width : snapWidth(clampFrameSide(start.width + (dx * (centered ? 2 : 1)) / scale))
  const height = axis === 'x' ? start.height : clampFrameSide(start.height + dy / scale)
  return { width, height }
}

/** How far an arrow key moves a focused handle, and how far with Shift held. */
const NUDGE = { small: 10, large: 50 }

/**
 * The frame's size after an arrow key on a focused handle, or `undefined` for a key the handle does
 * not use. The side handle takes left and right, the bottom handle up and down, the corner all four.
 */
export function nudgedSize(size: FrameSize, axis: ResizeAxis, key: string, large: boolean): FrameSize | undefined {
  const step = large ? NUDGE.large : NUDGE.small
  if (axis !== 'y' && (key === 'ArrowLeft' || key === 'ArrowRight')) {
    return { ...size, width: clampFrameSide(size.width + (key === 'ArrowRight' ? step : -step)) }
  }
  if (axis !== 'x' && (key === 'ArrowUp' || key === 'ArrowDown')) {
    return { ...size, height: clampFrameSide(size.height + (key === 'ArrowDown' ? step : -step)) }
  }
  return undefined
}

/** Room the stage keeps around the frame: its padding, and the line of text above the frame. */
const STAGE_GUTTER = { x: 80, y: 88 }

/**
 * The scale that fits the frame in the stage, never above 1. A stage not measured yet fits at 1.
 * `keyboardInset` is the height an on-screen keyboard covers: the fit ignores it, so typing in a
 * screen never shrinks the screen.
 */
export function fitScale(frame: FrameSize, stage: FrameSize, keyboardInset = 0): number {
  if (stage.width <= 0) {
    return 1
  }
  return Math.min(
    1,
    (stage.width - STAGE_GUTTER.x) / frame.width,
    (stage.height + keyboardInset - STAGE_GUTTER.y) / frame.height
  )
}

/** The scale the frame is drawn at for a zoom choice, never below a tenth. */
export function frameScale(zoom: FrameZoom, fit: number): number {
  return Math.max(0.1, zoom === 'fit' ? fit : zoom)
}

/** The line above the frame: its size, what that size is, and how big it is drawn. */
export function frameCaption(size: FrameSize, frame: DeviceFrame | undefined, scale: number): string {
  const what = devicePreset(frame?.deviceId)?.label ?? (frame === undefined ? 'screen default' : 'responsive')
  return [`${size.width} × ${size.height}`, what, `${Math.round(scale * 100)}%`].join(' · ')
}

/** Where the device toolbar keeps its frame and zoom: this browser only, never the prototype. */
export const DEVICE_SETTINGS_KEY = 'vinta-prototype-lab:device'

export interface DeviceSettings {
  frame?: DeviceFrame
  zoom?: FrameZoom
}

function isFrame(value: unknown): value is DeviceFrame {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const { width, height, deviceId } = value as Record<string, unknown>
  return (
    typeof width === 'number' && typeof height === 'number' && (deviceId === undefined || typeof deviceId === 'string')
  )
}

function isZoom(value: unknown): value is FrameZoom {
  return value === 'fit' || (typeof value === 'number' && value > 0)
}

/** The remembered settings. Anything unreadable or malformed is left out. */
export function readDeviceSettings(): DeviceSettings {
  try {
    const value: unknown = JSON.parse(window.localStorage.getItem(DEVICE_SETTINGS_KEY) ?? '{}')
    if (typeof value !== 'object' || value === null) {
      return {}
    }
    const { frame, zoom } = value as Record<string, unknown>
    return { ...(isFrame(frame) ? { frame } : {}), ...(isZoom(zoom) ? { zoom } : {}) }
  } catch {
    return {}
  }
}

/** Changes some of the remembered settings. A browser that refuses storage simply forgets them. */
export function writeDeviceSettings(change: DeviceSettings): void {
  try {
    const next = { ...readDeviceSettings(), ...change }
    window.localStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(next))
  } catch {
    // Nothing to do: the settings last until the page closes.
  }
}
