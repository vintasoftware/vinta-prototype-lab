import { RotateCw } from 'lucide-react'
import { useEffect, useState } from 'react'
import { DEVICE_PRESETS, type DevicePreset } from '../lib/constants'
import { clampFrameSide, type DeviceFrame, type FrameSize, type FrameZoom } from '../lib/device-frame'
import { Button, cn, NativeSelect, NativeSelectOptGroup, NativeSelectOption } from '../ui'

const DEVICE_GROUPS: readonly DevicePreset['group'][] = ['Phones', 'Tablets', 'Desktops']

const ZOOM_OPTIONS: readonly { value: string; label: string }[] = [
  { value: 'fit', label: 'Fit' },
  { value: '1', label: '100%' },
  { value: '0.75', label: '75%' },
  { value: '0.5', label: '50%' },
]

/** The device list's two entries that are not devices. */
const SCREEN_DEFAULT = 'default'
const RESPONSIVE = 'responsive'

export interface DeviceToolbarProps {
  /** The size the person set, or `undefined` for the screen's own size. */
  frame: DeviceFrame | undefined
  onFrame: (frame: DeviceFrame | undefined) => void
  /** The screen's own size, shown while no size is set. */
  defaultSize: FrameSize
  /** Names the screen's own size in the device list's tooltip, e.g. `Mobile 390 × 844`. */
  defaultLabel: string
  zoom: FrameZoom
  onZoom: (zoom: FrameZoom) => void
}

/**
 * The device toolbar, as in Chrome's DevTools: a device list (or the screen's own size, or a free
 * size), the width and height, a rotate button, and the zoom. The size fields and rotate go away on
 * a narrow window; the device list and zoom stay.
 */
export function DeviceToolbar({ frame, onFrame, defaultSize, defaultLabel, zoom, onZoom }: DeviceToolbarProps) {
  const size = frame ?? defaultSize
  const selected = frame === undefined ? SCREEN_DEFAULT : (frame.deviceId ?? RESPONSIVE)

  const chooseDevice = (value: string) => {
    if (value === SCREEN_DEFAULT) {
      onFrame(undefined)
      return
    }
    if (value === RESPONSIVE) {
      onFrame({ width: size.width, height: size.height })
      return
    }
    const device = DEVICE_PRESETS.find(preset => preset.id === value)
    if (device !== undefined) {
      onFrame({ deviceId: device.id, width: device.width, height: device.height })
    }
  }

  return (
    // The selects and fields are `h-8`, the height of the header's buttons; NativeSelect's own small
    // size is `h-7`.
    <div className='flex items-center gap-1'>
      <NativeSelect
        size='sm'
        aria-label='Device'
        title={frame === undefined ? `Screen default: ${defaultLabel}` : undefined}
        className='w-36 [&_select]:h-8!'
        value={selected}
        onChange={event => chooseDevice(event.target.value)}
      >
        <NativeSelectOption value={SCREEN_DEFAULT}>Screen default</NativeSelectOption>
        <NativeSelectOption value={RESPONSIVE}>Responsive</NativeSelectOption>
        {DEVICE_GROUPS.map(group => (
          <NativeSelectOptGroup key={group} label={group}>
            {DEVICE_PRESETS.filter(preset => preset.group === group).map(preset => (
              <NativeSelectOption key={preset.id} value={preset.id}>
                {preset.label}
              </NativeSelectOption>
            ))}
          </NativeSelectOptGroup>
        ))}
      </NativeSelect>

      <div className='max-[1100px]:hidden! flex items-center gap-1'>
        {/* A typed size is no longer the device's own, so it drops the device. */}
        <SizeField label='Width' value={size.width} onCommit={width => onFrame({ width, height: size.height })} />
        <span className='text-muted-foreground text-xs'>×</span>
        <SizeField label='Height' value={size.height} onCommit={height => onFrame({ width: size.width, height })} />
        <Button
          variant='ghost'
          size='icon-sm'
          aria-label='Rotate'
          title='Rotate'
          onClick={() =>
            onFrame({
              ...(frame?.deviceId === undefined ? {} : { deviceId: frame.deviceId }),
              width: size.height,
              height: size.width,
            })
          }
        >
          <RotateCw />
        </Button>
      </div>

      <NativeSelect
        size='sm'
        aria-label='Zoom'
        className='w-20 [&_select]:h-8!'
        value={String(zoom)}
        onChange={event => onZoom(event.target.value === 'fit' ? 'fit' : Number(event.target.value))}
      >
        {ZOOM_OPTIONS.map(option => (
          <NativeSelectOption key={option.value} value={option.value}>
            {option.label}
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

/** One side of the frame, typed in. It applies on Enter or when the field loses focus; Esc undoes it. */
function SizeField({ label, value, onCommit }: SizeFieldProps) {
  const [draft, setDraft] = useState(String(value))

  useEffect(() => setDraft(String(value)), [value])

  const commit = () => {
    const number = Number.parseInt(draft, 10)
    if (Number.isFinite(number)) {
      onCommit(clampFrameSide(number))
    } else {
      setDraft(String(value))
    }
  }

  return (
    <input
      aria-label={label}
      inputMode='numeric'
      className={cn(
        'h-8 w-14 rounded-md border border-input bg-card px-2 text-center text-sm tabular-nums outline-none',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50'
      )}
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
