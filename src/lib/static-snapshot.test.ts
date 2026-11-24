import { describe, expect, it } from 'vitest'
import { SOURCE_ATTRIBUTE } from './source-ref'
import { cloneForShare, PREVIEW_SIZE, previewPlacement, SHARE_OMIT_ATTRIBUTE } from './static-snapshot'

function element(html: string): HTMLElement {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.append(host)
  return host
}

describe('cloneForShare', () => {
  it('drops the viewer’s chrome, scripts, handlers and source stamps', () => {
    const host = element(`
      <div ${SOURCE_ATTRIBUTE}="prototypes/a/screens/1.tsx:3:4:div" onclick="steal()">
        <span ${SHARE_OMIT_ATTRIBUTE}>hover outline</span>
        <script>steal()</script>
        <a href="javascript:steal()">link</a>
        <p>kept</p>
      </div>`)
    const clone = cloneForShare(host)
    expect(clone.textContent).toContain('kept')
    expect(clone.textContent).not.toContain('hover outline')
    expect(clone.querySelector('script')).toBeNull()
    expect(clone.querySelector(`[${SOURCE_ATTRIBUTE}]`)).toBeNull()
    expect(clone.querySelector('[onclick]')).toBeNull()
    expect(clone.querySelector('a')?.hasAttribute('href')).toBe(false)
  })

  it('keeps what was typed and ticked, but never a password', () => {
    const host = element(`
      <input id="name" />
      <input id="secret" type="password" />
      <input id="agree" type="checkbox" />
      <textarea id="note"></textarea>
      <select id="size"><option>S</option><option>M</option></select>`)
    ;(host.querySelector('#name') as HTMLInputElement).value = 'Dana'
    ;(host.querySelector('#secret') as HTMLInputElement).value = 'hunter2'
    ;(host.querySelector('#agree') as HTMLInputElement).checked = true
    ;(host.querySelector('#note') as HTMLTextAreaElement).value = 'Hi'
    ;(host.querySelector('#size') as HTMLSelectElement).selectedIndex = 1

    const html = cloneForShare(host).outerHTML
    expect(html).toContain('value="Dana"')
    expect(html).not.toContain('hunter2')
    expect(html).toMatch(/id="agree"[^>]*checked/)
    expect(html).toContain('>Hi</textarea>')
    expect(html).toMatch(/<option selected="">M<\/option>/)
  })

  it('takes the camera’s transform off the root', () => {
    const host = element('<p>canvas</p>')
    host.style.transform = 'translate(10px, 20px) scale(0.5)'
    host.style.width = '4000px'
    const clone = cloneForShare(host)
    expect(clone.style.transform).toBe('')
    expect(clone.style.width).toBe('4000px')
  })
})

describe('previewPlacement', () => {
  it('fits a wide screen to the card', () => {
    const placement = previewPlacement(1440, 900)
    expect(placement.scale).toBeCloseTo((PREVIEW_SIZE.width - 64) / 1440)
    expect(placement.x).toBe(32)
  })

  it('shows the top of a tall phone screen rather than shrinking it to nothing', () => {
    const placement = previewPlacement(390, 844)
    expect(placement.scale).toBeGreaterThan(1)
    expect(placement.y).toBe(32)
    expect(Math.round(390 * placement.scale) + 2 * placement.x).toBe(PREVIEW_SIZE.width)
  })
})
