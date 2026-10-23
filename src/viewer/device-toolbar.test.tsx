import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DeviceFrame } from '../lib/device-frame'
import { DeviceToolbar } from './device-toolbar'

function renderToolbar(frame: DeviceFrame | undefined = undefined) {
  const onFrame = vi.fn()
  const onZoom = vi.fn()
  render(
    <DeviceToolbar
      frame={frame}
      onFrame={onFrame}
      defaultSize={{ width: 390, height: 844 }}
      defaultLabel='Mobile 390 × 844'
      zoom='fit'
      onZoom={onZoom}
    />
  )
  return { onFrame, onZoom }
}

describe('DeviceToolbar', () => {
  it('shows the screen default size while no size is set', () => {
    renderToolbar()

    expect(screen.getByRole('combobox', { name: 'Device' })).toHaveValue('default')
    expect(screen.getByRole('textbox', { name: 'Width' })).toHaveValue('390')
    expect(screen.getByRole('textbox', { name: 'Height' })).toHaveValue('844')
  })

  it('sets the frame to a device picked from the list', async () => {
    const { onFrame } = renderToolbar()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Device' }), 'iPad Mini')

    expect(onFrame).toHaveBeenCalledWith({ deviceId: 'ipad-mini', width: 768, height: 1024 })
  })

  it('keeps the current size when switching to responsive, and clears it for the screen default', async () => {
    const { onFrame } = renderToolbar({ deviceId: 'pixel-7', width: 412, height: 915 })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Device' }), 'Responsive')
    expect(onFrame).toHaveBeenLastCalledWith({ width: 412, height: 915 })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Device' }), 'Screen default')
    expect(onFrame).toHaveBeenLastCalledWith(undefined)
  })

  it('applies a typed width on Enter, kept within the allowed sizes, and drops the device', async () => {
    const { onFrame } = renderToolbar({ deviceId: 'pixel-7', width: 412, height: 915 })
    const width = screen.getByRole('textbox', { name: 'Width' })

    await userEvent.clear(width)
    await userEvent.type(width, '9999{Enter}')

    expect(onFrame).toHaveBeenLastCalledWith({ width: 2560, height: 915 })
  })

  it('puts back the size on Esc without applying it', async () => {
    const { onFrame } = renderToolbar()
    const height = screen.getByRole('textbox', { name: 'Height' })

    await userEvent.clear(height)
    await userEvent.type(height, '500{Escape}')

    expect(height).toHaveValue('844')
    expect(onFrame).not.toHaveBeenCalled()
  })

  it('swaps width and height on rotate, keeping the device', async () => {
    const { onFrame } = renderToolbar({ deviceId: 'iphone-15', width: 393, height: 852 })

    await userEvent.click(screen.getByRole('button', { name: 'Rotate' }))

    expect(onFrame).toHaveBeenCalledWith({ deviceId: 'iphone-15', width: 852, height: 393 })
  })

  it('changes the zoom', async () => {
    const { onZoom } = renderToolbar()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Zoom' }), '50%')
    expect(onZoom).toHaveBeenLastCalledWith(0.5)

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Zoom' }), 'Fit')
    expect(onZoom).toHaveBeenLastCalledWith('fit')
  })
})
