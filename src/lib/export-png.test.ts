import { afterEach, describe, expect, it, vi } from 'vitest'
import { exportPng, pngFileName } from './export-png'

vi.mock('html-to-image', () => ({ toPng: vi.fn(() => Promise.resolve('data:image/png;base64,AAAA')) }))

afterEach(() => vi.clearAllMocks())

describe('pngFileName', () => {
  it('flattens the prototype, screen and state into one file name', () => {
    expect(pngFileName('billing/refunds', 'choose-lines', 'default')).toBe('billing-refunds--choose-lines--default.png')
  })
})

describe('exportPng', () => {
  it('draws the element at twice its size and downloads it under the name given', async () => {
    const { toPng } = await import('html-to-image')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const element = document.createElement('div')

    await exportPng(element, 'booking--home--default.png')

    expect(toPng).toHaveBeenCalledWith(element, expect.objectContaining({ pixelRatio: 2, cacheBust: true }))
    const link = click.mock.contexts[0] as HTMLAnchorElement
    expect(link.download).toBe('booking--home--default.png')
    expect(link.href).toBe('data:image/png;base64,AAAA')
  })

  it("leaves out the viewer's layers drawn over the screen", async () => {
    const { toPng } = await import('html-to-image')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const overlay = document.createElement('div')
    overlay.setAttribute('data-prototype-overlay', '')

    await exportPng(document.createElement('div'), 'a.png')

    const filter = vi.mocked(toPng).mock.calls[0]?.[1]?.filter
    expect(filter?.(overlay)).toBe(false)
    expect(filter?.(document.createElement('button'))).toBe(true)
  })
})
