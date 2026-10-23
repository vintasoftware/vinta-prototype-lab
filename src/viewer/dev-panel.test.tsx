import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DevPanel, type DevPanelProps } from './dev-panel'

let style: HTMLStyleElement
let frame: HTMLDivElement

beforeEach(() => {
  style = document.createElement('style')
  style.textContent = [
    ':root { --color-muted: rgb(1, 2, 3); --color-card: rgb(1, 2, 3); --text-sm: 14px; --spacing: 4px; }',
    '.bg-muted { background-color: rgb(1, 2, 3); }',
    '.text-sm { font-size: 14px; }',
    '.p-3 { padding: 12px; }',
    '.bg-odd { background-color: rgb(9, 9, 9); }',
  ].join('\n')
  document.head.append(style)
  frame = document.createElement('div')
  document.body.append(frame)
})

afterEach(() => {
  style.remove()
  frame.remove()
})

function renderPanel(props: Partial<DevPanelProps> = {}) {
  const onToggleMeasure = vi.fn()
  render(<DevPanel canOpenSource measuring={false} onToggleMeasure={onToggleMeasure} measurements={[]} {...props} />)
  return { onToggleMeasure }
}

function picked(html: string): Element {
  frame.innerHTML = html
  return frame.firstElementChild as Element
}

describe('DevPanel', () => {
  it('says how to pick an element when none is picked', () => {
    renderPanel()

    expect(screen.getByText(/Turn on Inspect \(I\) and pick an element/)).toBeInTheDocument()
  })

  it('names the component, its path, its id and where it was written', () => {
    const element = picked(
      '<button data-slot="button" data-proto-id="book" data-proto-src="prototypes/booking/screens/10-home.tsx:34:8:Button" class="bg-muted">Book</button>'
    )
    renderPanel({ element, frame, label: 'Button', selector: 'book', anchorId: 'book' })

    expect(screen.getByText('Button')).toBeInTheDocument()
    expect(screen.getByText('#book')).toBeInTheDocument()
    expect(screen.getByText('screens/10-home.tsx:34')).toBeInTheDocument()
  })

  it('opens the source in the editor through the dev server', async () => {
    const fetch = vi.fn(() => Promise.resolve({ ok: true }))
    vi.stubGlobal('fetch', fetch)
    const element = picked('<button data-proto-src="prototypes/booking/screens/10-home.tsx:34:8:Button">Book</button>')
    renderPanel({ element, frame })

    await userEvent.click(screen.getByRole('button', { name: 'Open in editor' }))

    expect(fetch).toHaveBeenCalledWith(
      `/__open-in-editor?file=${encodeURIComponent('prototypes/booking/screens/10-home.tsx:34:8')}`
    )
  })

  it('offers no editor in a built copy', () => {
    const element = picked('<button data-proto-src="prototypes/booking/screens/10-home.tsx:34:8:Button">Book</button>')
    renderPanel({ element, frame, canOpenSource: false })

    expect(screen.queryByRole('button', { name: 'Open in editor' })).not.toBeInTheDocument()
  })

  it('says where the source is known when a built copy has no stamps', () => {
    renderPanel({ element: picked('<p>Hello</p>'), frame, canOpenSource: false })

    expect(screen.getByText('Known under prototype-lab dev.')).toBeInTheDocument()
  })

  it('says when an element was written inside another one', () => {
    frame.innerHTML =
      '<div data-proto-src="prototypes/booking/screens/10-home.tsx:12:6:Card"><span id="inner">Text</span></div>'
    renderPanel({ element: frame.querySelector('#inner') as Element, frame })

    expect(screen.getByText('(inside <Card>)')).toBeInTheDocument()
  })

  it('reads each style back to its utility and token, then the value', () => {
    const element = picked('<p class="bg-muted text-sm p-3">Hello</p>')
    renderPanel({ element, frame })

    const background = screen.getByText('Background').closest('li') as HTMLElement
    expect(within(background).getByText('bg-muted')).toBeInTheDocument()
    expect(within(background).getByText('--color-muted')).toBeInTheDocument()
    expect(within(background).getByText('rgb(1, 2, 3)')).toBeInTheDocument()

    const padding = screen.getByText('Padding top').closest('li') as HTMLElement
    expect(within(padding).getByText('p-3')).toBeInTheDocument()
    expect(within(padding).getByText('--spacing × 3')).toBeInTheDocument()
  })

  it('names every token a value matches when no utility set it, and flags a value no token makes', () => {
    picked('<p class="bg-odd">Odd</p>')
    const odd = frame.firstElementChild as Element
    renderPanel({ element: odd, frame })

    const background = screen.getByText('Background').closest('li') as HTMLElement
    expect(within(background).getByText('not a token')).toBeInTheDocument()
  })

  it('turns measuring on from its button, and lists the distances it measured', async () => {
    const element = picked('<p class="p-3">Hello</p>')
    const { onToggleMeasure } = renderPanel({
      element,
      frame,
      measuring: true,
      measurements: [{ side: 'right', value: 24, x1: 0, y1: 0, x2: 24, y2: 0 }],
    })

    expect(screen.getByRole('button', { name: 'Measure' })).toHaveAttribute('aria-pressed', 'true')
    expect(within(screen.getByRole('list', { name: 'Distances' })).getByText('right: 24')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Measure' }))
    expect(onToggleMeasure).toHaveBeenCalled()
  })

  it('lists padding and margin by side, readable without a pointer', () => {
    const element = picked('<p class="p-3">Hello</p>')
    renderPanel({ element, frame })

    const top = screen.getByRole('rowheader', { name: 'top' }).closest('tr') as HTMLElement
    expect(within(top).getAllByRole('cell')[0]).toHaveTextContent('12')
  })
})
