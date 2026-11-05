import { RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DEVICE_PRESETS, type DevicePreset } from '../lib/constants'
import {
  clampFrameSide,
  type DeviceFrame,
  type FrameSize,
  type FrameZoom,
  rotatedFrame,
  ZOOM_LEVELS,
} from '../lib/device-frame'
import { Button, NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '../ui'

export interface DeviceToolbarProps {
  /** The size chosen here, or `undefined` for the viewport's own size. */
  frame: DeviceFrame | undefined
  onFrame: (frame: DeviceFrame | undefined) => void
  /** The viewport's own size, which the frame takes with nothing chosen. */
  defaultSize: FrameSize
  /** What the list calls that size, e.g. `Tablet default`. */
  defaultName: string
  zoom: FrameZoom
  onZoom: (zoom: FrameZoom) => void
}

const GROUPS: readonly DevicePreset['group'][] = ['Phones', 'Tablets', 'Desktops']

const DEFAULT_OPTION = 'default'
const RESPONSIVE_OPTION = 'responsive'

/** The selects sit at the height of the header's small buttons. */
const SELECT_CLASS = '[&_select]:h-8'

/**
 * The device toolbar, as in Chrome's DevTools: a device list (or the viewport's own size, or a free
 * size), the width and height, a rotate button, and the zoom.
 */
export function DeviceToolbar({ frame, onFrame, defaultSize, defaultName, zoom, onZoom }: DeviceToolbarProps) {
  const size = frame ?? defaultSize
  const selected = frame === undefined ? DEFAULT_OPTION : (frame.deviceId ?? RESPONSIVE_OPTION)

  const chooseDevice = (value: string) => {
    if (value === DEFAULT_OPTION) {
      onFrame(undefined)
      return
    }
    if (value === RESPONSIVE_OPTION) {
      onFrame({ width: size.width, height: size.height })
      return
    }
    const device = DEVICE_PRESETS.find(preset => preset.id === value)
    if (device !== undefined) {
      onFrame({ deviceId: device.id, width: device.width, height: device.height })
    }
  }

  return (
    <div className='flex items-center gap-1'>
      <NativeSelect
        aria-label='Device'
        title={`${defaultName}: ${defaultSize.width} × ${defaultSize.height}`}
        className={`w-40 ${SELECT_CLASS}`}
        value={selected}
        onChange={event => chooseDevice(event.target.value)}
      >
        <NativeSelectOption value={DEFAULT_OPTION}>{defaultName}</NativeSelectOption>
        <NativeSelectOption value={RESPONSIVE_OPTION}>Responsive</NativeSelectOption>
        {GROUPS.map(group => (
          <NativeSelectOptGroup key={group} label={group}>
            {DEVICE_PRESETS.filter(preset => preset.group === group).map(preset => (
              <NativeSelectOption key={preset.id} value={preset.id}>
                {preset.label}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>

      <SizeField label='Width' value={size.width} onCommit={width => onFrame({ width, height: size.height })} />
      <span aria-hidden='true' className='text-muted-foreground text-xs'>
        ×
      </span>
      <SizeField label='Height' value={size.height} onCommit={height => onFrame({ width: size.width, height })} />
      <Button
        variant='ghost'
        size='icon-sm'
        aria-label='Rotate'
        title='Rotate'
        onClick={() => onFrame(rotatedFrame(frame ?? size))}
      >
        <RotateCw />
      </Button>

      <NativeSelect
        aria-label='Zoom'
        className={`w-24 ${SELECT_CLASS}`}
        value={String(zoom)}
        onChange={event => onZoom(event.target.value === 'fit' ? 'fit' : Number(event.target.value))}
      >
        <NativeSelectOption value='fit'>Fit</NativeSelectOption>
        {ZOOM_LEVELS.map(level => (
          <NativeSelectOption key={level} value={String(level)}>
            {Math.round(level * 100)}%
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  )
}

interface SizeFieldProps {
  label: string
  value: number
  onCommit: (value: number) => void
}

/** One side of the frame, typed in. Enter or leaving the field applies it; Esc puts it back. */
function SizeField({ label, value, onCommit }: SizeFieldProps) {
  const [draft, setDraft] = useState(String(value))
  useEffect(() => setDraft(String(value)), [value])

  const commit = () => {
    const number = Number.parseInt(draft, 10)
    if (Number.isFinite(number)) {
      const side = clampFrameSide(number)
      setDraft(String(side))
      if (side !== value) {
        onCommit(side)
      }
    } else {
      setDraft(String(value))
    }
  }

  return (
    <input
      aria-label={label}
      inputMode='numeric'
      className='h-8 w-16 rounded-md border border-input bg-card px-2 text-center text-sm tabular-nums outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
      value={draft}
      onChange={event => setDraft(event.target.value.replace(/[^0-9]/g, ''))}
      onBlur={commit}
      onKeyDown={event => {
        if (event.key === 'Enter') {
          commit()
        }
        if (event.key === 'Escape') {
          setDraft(String(value))
        }
      }}
    />
  )
}
