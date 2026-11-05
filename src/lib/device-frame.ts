import type { ScreenViewport } from '../types'
import {
  DEVICE_PRESETS,
  type DevicePreset,
  MAX_FRAME_SIDE,
  MIN_FRAME_SIDE,
  SNAP_DISTANCE,
  SNAP_WIDTHS,
} from './constants'

export interface FrameSize {
  width: number
  height: number
}

/** A size the person chose for the frame: a device from the list, or any width and height. */
export interface DeviceFrame extends FrameSize {
  /** The preset it came from; a frame typed in or dragged to size has none. */
  deviceId?: string
}

/** `fit` shrinks the frame to the stage, never past 100%; a number is a fixed scale. */
export type FrameZoom = 'fit' | number

/** The fixed scales the zoom list offers, after Fit. */
export const ZOOM_LEVELS: readonly number[] = [1, 0.75, 0.5]

/** Which handle of the frame is moving: its right edge, its bottom edge, or the corner. */
export type ResizeAxis = 'x' | 'y' | 'xy'

/** The frame never draws smaller than this, so a huge frame in a small window stays findable. */
const MIN_SCALE = 0.1

/** Keeps one side of the frame within what it can take, in whole pixels. */
export function clampFrameSide(value: number): number {
  return Math.round(Math.min(MAX_FRAME_SIDE, Math.max(MIN_FRAME_SIDE, value)))
}

/** A width close enough to a breakpoint lands on it, so a drag can stop exactly there. */
export function snapWidth(width: number): number {
  return SNAP_WIDTHS.find(candidate => Math.abs(candidate - width) <= SNAP_DISTANCE) ?? width
}

/** The viewport family a width belongs to, for the frame's `data-viewport` and the flow map. */
export function viewportOfWidth(width: number): ScreenViewport {
  if (width < 600) {
    return 'mobile'
  }
  return width < 1100 ? 'tablet' : 'desktop'
}

export interface DragInput {
  /** The size when the drag started. */
  origin: FrameSize
  axis: ResizeAxis
  /** How far the pointer has moved since then, in page pixels. */
  dx: number
  dy: number
  /** The scale the frame is drawn at; a pointer move covers more of a zoomed-out frame. */
  scale: number
  /** A centred frame grows on both sides, so its right edge moves half as far as its width. */
  centered: boolean
}

/** The size a drag of one handle leaves the frame at. */
export function draggedSize({ origin, axis, dx, dy, scale, centered }: DragInput): FrameSize {
  const width =
    axis === 'y' ? origin.width : snapWidth(clampFrameSide(origin.width + (dx * (centered ? 2 : 1)) / scale))
  const height = axis === 'x' ? origin.height : clampFrameSide(origin.height + dy / scale)
  return { width, height }
}

/** Pixels an arrow key moves a focused handle by, and with Shift held. */
const NUDGE = { step: 10, large: 50 }

/**
 * The size an arrow key on a focused handle leaves the frame at, or `undefined` for a key the
 * handle does not take. The right edge takes left and right, the bottom edge up and down, and the
 * corner all four.
 */
export function nudgedSize(size: FrameSize, axis: ResizeAxis, key: string, shift: boolean): FrameSize | undefined {
  const step = shift ? NUDGE.large : NUDGE.step
  const horizontal = { ArrowLeft: -step, ArrowRight: step }[key]
  const vertical = { ArrowUp: -step, ArrowDown: step }[key]
  if (horizontal !== undefined && axis !== 'y') {
    return { width: clampFrameSide(size.width + horizontal), height: size.height }
  }
  if (vertical !== undefined && axis !== 'x') {
    return { width: size.width, height: clampFrameSide(size.height + vertical) }
  }
  return undefined
}

/**
 * The scale that fits the frame in the stage's content box, never above 100%. The caption and the
 * handles sit in the stage's padding. `keyboardInset` is the height an on-screen keyboard covers:
 * counting it back in keeps the screen from shrinking while someone types. The stage's measured
 * size has fractions of a pixel, so both it and the scale are rounded down: a frame drawn exactly
 * as tall as the stage can land a hair past it once scaled, and the stage then shows a scrollbar.
 */
export function fitScale(stage: FrameSize, frame: FrameSize, keyboardInset = 0): number {
  if (stage.width <= 0 || stage.height <= 0) {
    return 1
  }
  const fit = Math.min(Math.floor(stage.width) / frame.width, Math.floor(stage.height + keyboardInset) / frame.height)
  return Math.min(1, Math.floor(fit * 1000) / 1000)
}

/** The scale the frame is drawn at for a zoom choice. */
export function frameScale(zoom: FrameZoom, fit: number): number {
  return Math.max(MIN_SCALE, zoom === 'fit' ? fit : zoom)
}

/** The preset a frame came from, if it still has one. */
export function presetOf(frame: DeviceFrame | undefined): DevicePreset | undefined {
  return frame?.deviceId === undefined ? undefined : DEVICE_PRESETS.find(preset => preset.id === frame.deviceId)
}

/** The frame turned a quarter: width and height swap, and a device stays the same device. */
export function rotatedFrame(frame: DeviceFrame): DeviceFrame {
  return { ...frame, width: frame.height, height: frame.width }
}

/**
 * What the frame is, in words: the device's name, with its orientation when it has been turned from
 * the way the list gives it, or `responsive` for a free size.
 */
export function frameName(frame: DeviceFrame | undefined, defaultName: string): string {
  if (frame === undefined) {
    return defaultName
  }
  const preset = presetOf(frame)
  if (preset === undefined) {
    return 'responsive'
  }
  if (preset.width === frame.width && preset.height === frame.height) {
    return preset.label
  }
  return `${preset.label} ${frame.width > frame.height ? 'landscape' : 'portrait'}`
}

/** The caption above the frame: `820 × 1180 · iPad Air · 73%`. */
export function frameCaption(size: FrameSize, name: string, scale: number): string {
  return [`${size.width} × ${size.height}`, name, `${Math.round(scale * 100)}%`].join(' · ')
}

/** Where the device toolbar keeps its frame and zoom: this browser only, never the prototype. */
export const DEVICE_SETTINGS_KEY = 'vinta-prototype-lab:device'

export interface DeviceSettings {
  /** `undefined` for the viewport's own size. */
  frame?: DeviceFrame | undefined
  zoom: FrameZoom
}

function isSide(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

/** A frame read back from storage, or `undefined` for anything that is not one. */
function parseFrame(value: unknown): DeviceFrame | undefined {
  if (typeof value !== 'object' || value === null) {
    return undefined
  }
  const { width, height, deviceId } = value as Record<string, unknown>
  if (!isSide(width) || !isSide(height)) {
    return undefined
  }
  const frame: DeviceFrame = { width: clampFrameSide(width), height: clampFrameSide(height) }
  return typeof deviceId === 'string' && presetOf({ ...frame, deviceId }) !== undefined ? { ...frame, deviceId } : frame
}

function parseZoom(value: unknown): FrameZoom | undefined {
  if (value === 'fit') {
    return value
  }
  return typeof value === 'number' && ZOOM_LEVELS.includes(value) ? value : undefined
}

const NOTHING_SAVED: DeviceSettings = { zoom: 'fit' }

/**
 * The frame and zoom saved on an earlier visit, checked as they come out of storage: anything
 * unreadable counts as nothing saved, the viewport's own size at Fit.
 */
export function readDeviceSettings(): DeviceSettings {
  try {
    const stored: unknown = JSON.parse(window.localStorage.getItem(DEVICE_SETTINGS_KEY) ?? '{}')
    if (typeof stored !== 'object' || stored === null) {
      return NOTHING_SAVED
    }
    const { frame, zoom } = stored as Record<string, unknown>
    const parsedFrame = parseFrame(frame)
    return { ...(parsedFrame === undefined ? {} : { frame: parsedFrame }), zoom: parseZoom(zoom) ?? 'fit' }
  } catch {
    return NOTHING_SAVED
  }
}

/** Saves the settings for the next visit. */
export function writeDeviceSettings(settings: DeviceSettings): void {
  try {
    window.localStorage.setItem(DEVICE_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // A browser that refuses storage still sizes the frame; it only forgets it on the next visit.
  }
}
