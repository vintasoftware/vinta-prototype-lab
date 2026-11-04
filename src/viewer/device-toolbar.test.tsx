import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { DeviceFrame, FrameZoom } from '../lib/device-frame'
import { DeviceToolbar } from './device-toolbar'

function renderToolbar(frame?: DeviceFrame, zoom: FrameZoom = 'fit') {
  const onFrame = vi.fn()
  const onZoom = vi.fn()
  render(
    <DeviceToolbar
      frame={frame}
      onFrame={onFrame}
      defaultSize={{ width: 834, height: 820 }}
      defaultName='Tablet default'
      zoom={zoom}
      onZoom={onZoom}
    />
  )
  return { onFrame, onZoom }
}

describe('DeviceToolbar', () => {
  it("shows the viewport's own size with nothing chosen", () => {
    renderToolbar()

    expect(screen.getByRole('combobox', { name: 'Device' })).toHaveValue('default')
    expect(screen.getByRole('option', { name: 'Tablet default' })).toBeInTheDocument()
    expect(screen.getByRole('textbox', { name: 'Width' })).toHaveValue('834')
    expect(screen.getByRole('textbox', { name: 'Height' })).toHaveValue('820')
  })

  it('lists the devices under Phones, Tablets and Desktops', () => {
    renderToolbar()

    expect(screen.getAllByRole('group').map(group => group.getAttribute('label'))).toEqual([
      'Phones',
      'Tablets',
      'Desktops',
    ])
    expect(screen.getByRole('option', { name: 'iPad Air' })).toBeInTheDocument()
  })

  it('takes a device at its own size', async () => {
    const { onFrame } = renderToolbar()

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Device' }), 'iPad Air')

    expect(onFrame).toHaveBeenCalledWith({ deviceId: 'ipad-air', width: 820, height: 1180 })
  })

  it('goes back to the default size, and frees the current size for Responsive', async () => {
    const { onFrame } = renderToolbar({ deviceId: 'ipad-air', width: 820, height: 1180 })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Device' }), 'Responsive')
    expect(onFrame).toHaveBeenLastCalledWith({ width: 820, height: 1180 })

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Device' }), 'Tablet default')
    expect(onFrame).toHaveBeenLastCalledWith(undefined)
  })

  it('applies a typed width on Enter, kept in range, as a free size', async () => {
    const { onFrame } = renderToolbar({ deviceId: 'ipad-air', width: 820, height: 1180 })
    const width = screen.getByRole('textbox', { name: 'Width' })

    await userEvent.clear(width)
    await userEvent.type(width, '9000{Enter}')

    expect(onFrame).toHaveBeenCalledWith({ width: 2560, height: 1180 })
    expect(width).toHaveValue('2560')
  })

  it('applies a typed height when the field loses focus, and ignores anything but digits', async () => {
    const { onFrame } = renderToolbar()
    const height = screen.getByRole('textbox', { name: 'Height' })

    await userEvent.clear(height)
    await userEvent.type(height, '7a00')
    await userEvent.tab()

    expect(onFrame).toHaveBeenCalledWith({ width: 834, height: 700 })
  })

  it('puts the field back on Esc, and leaves the frame alone for an unchanged or empty one', async () => {
    const { onFrame } = renderToolbar()
    const width = screen.getByRole('textbox', { name: 'Width' })

    await userEvent.clear(width)
    await userEvent.type(width, '500{Escape}')
    expect(width).toHaveValue('834')

    await userEvent.clear(width)
    await userEvent.tab()
    expect(width).toHaveValue('834')

    await userEvent.click(width)
    await userEvent.tab()
    expect(onFrame).not.toHaveBeenCalled()
  })

  it('rotates the frame, keeping the device', async () => {
    const { onFrame } = renderToolbar({ deviceId: 'ipad-air', width: 820, height: 1180 })

    await userEvent.click(screen.getByRole('button', { name: 'Rotate' }))

    expect(onFrame).toHaveBeenCalledWith({ deviceId: 'ipad-air', width: 1180, height: 820 })
  })

  it('rotates the default size into a free size', async () => {
    const { onFrame } = renderToolbar()

    await userEvent.click(screen.getByRole('button', { name: 'Rotate' }))

    expect(onFrame).toHaveBeenCalledWith({ width: 820, height: 834 })
  })

  it('changes the zoom to Fit or a fixed scale', async () => {
    const { onZoom } = renderToolbar(undefined, 1)
    const zoom = screen.getByRole('combobox', { name: 'Zoom' })
    expect(zoom).toHaveValue('1')

    await userEvent.selectOptions(zoom, '50%')
    expect(onZoom).toHaveBeenLastCalledWith(0.5)

    await userEvent.selectOptions(zoom, 'Fit')
    expect(onZoom).toHaveBeenLastCalledWith('fit')
  })
})
