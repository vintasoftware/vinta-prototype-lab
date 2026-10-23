import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { anchor } from '../../components/anchor'
import { useScreenNavigation } from '../../components/prototype-runtime'
import { ScreenLink } from '../../components/screen-link'
import type { FlowLinks } from '../../hooks/use-flow-links'
import { buildPrototypes } from '../../lib/discovery'
import { probePrototype } from '../../lib/probe-screen'
import type { CanvasFile } from '../../types'
import { CanvasView, type CanvasViewProps } from './canvas-view'

vi.mock('../../lib/export-png', () => ({
  exportPng: vi.fn(() => Promise.resolve()),
  pngFileName: (slug: string, screenId: string, variant: string) => `${slug}--${screenId}--${variant}.png`,
}))

function HomeScreen() {
  const { goToScreen } = useScreenNavigation()
  return (
    <div>
      <h1>Good morning</h1>
      <button type='button' onClick={() => goToScreen('review')} {...anchor('book')}>
        Book a visit
      </button>
      <button type='button' onClick={() => goToScreen('review')}>
        Reschedule
      </button>
      <ScreenLink to='terms'>Terms</ScreenLink>
    </div>
  )
}

function ReviewScreen() {
  const { goToScreen, back } = useScreenNavigation()
  return (
    <div>
      <h1>Review your visit</h1>
      <button type='button' onClick={back}>
        Back
      </button>
      <button type='button' onClick={() => goToScreen('review', { variant: 'empty' })}>
        Clear
      </button>
    </div>
  )
}

const ReviewEmptyScreen = () => <h1>Nothing to review</h1>
const LostScreen = () => <h1>Nobody links here</h1>

const prototype = buildPrototypes({
  docs: { '../../prototypes/booking/prototype.md': '---\ntitle: Booking\nentry: home\n---\n' },
  annotations: {
    '../../prototypes/booking/annotations.json': {
      notes: [
        { id: 'n1', screen: 'home', target: 'book', title: 'One filled button' },
        { id: 'n2', screen: 'home', target: 'book', title: 'Already settled', status: 'resolved' },
      ],
    },
  },
  screens: {
    '../../prototypes/booking/screens/10-home.tsx': { default: HomeScreen },
    '../../prototypes/booking/screens/20-review.tsx': { default: ReviewScreen },
    '../../prototypes/booking/screens/20-review.empty.tsx': { default: ReviewEmptyScreen },
    '../../prototypes/booking/screens/30-lost.tsx': { default: LostScreen },
  },
})[0]

if (prototype === undefined) {
  throw new Error('the fixture did not build')
}

const ready = (): FlowLinks => {
  const linksByNode = probePrototype(prototype)
  return { status: 'ready', linksByNode, read: linksByNode.size, total: linksByNode.size }
}

function renderCanvas(props: Partial<CanvasViewProps> = {}) {
  const handlers = {
    onSelect: vi.fn(),
    onOpen: vi.fn(),
    onPin: vi.fn(),
    onToggleArrows: vi.fn(),
    onArrange: vi.fn((_canvas: CanvasFile) => Promise.resolve()),
  }
  const view = (extra: Partial<CanvasViewProps>) => (
    <CanvasView
      prototype={prototype as NonNullable<typeof prototype>}
      flow={ready()}
      showHotspots={false}
      showNotes={false}
      arrows
      selectedKey={undefined}
      selectedNoteId={undefined}
      opening='fit'
      canArrange={false}
      {...handlers}
      {...props}
      {...extra}
    />
  )
  const { rerender } = render(view({}))
  return { ...handlers, rerender: (extra: Partial<CanvasViewProps>) => rerender(view(extra)) }
}

const zoomLabel = () => screen.getByText(/^\d+%$/)
const content = () => screen.getByRole('region', { name: 'Canvas' }).querySelector(':scope > div') as HTMLElement

describe('CanvasView', () => {
  beforeEach(() => {
    // happy-dom's IntersectionObserver never reports; without one every frame counts as in view.
    vi.stubGlobal('IntersectionObserver', undefined)
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(2400)
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(2000)
  })

  it('draws one frame per screen state, with the real screen inside, out of reach', () => {
    renderCanvas()

    expect(screen.getAllByRole('article')).toHaveLength(5)
    const home = screen.getByRole('article', { name: 'Home' })
    expect(within(home).getByText('Good morning')).toBeInTheDocument()
    expect(within(home).getByText('Good morning').closest('[inert]')).not.toBeNull()
  })

  it('groups the states of one screen in a labelled section', () => {
    renderCanvas()

    const review = screen.getByRole('region', { name: 'Screen Review' })
    expect(within(review).getByRole('heading', { name: 'Review' })).toBeInTheDocument()
    expect(within(review).getByText('2 states')).toBeInTheDocument()
  })

  it('lists under each frame every control and where it leads, and the controls that go back', () => {
    renderCanvas()

    const homeRows = within(screen.getByRole('article', { name: 'Home' })).getByRole('list')
    expect(within(homeRows).getByText('Book a visit, Reschedule')).toBeInTheDocument()
    expect(within(homeRows).getByText('Review')).toBeInTheDocument()
    const reviewRows = within(screen.getByRole('article', { name: 'Review' })).getByRole('list')
    expect(within(reviewRows).getByText('Previous screen')).toBeInTheDocument()
  })

  it('marks the entry screen, a screen nothing leads to, and a linked screen that does not exist', () => {
    renderCanvas()

    expect(within(screen.getByRole('article', { name: 'Home' })).getByText('Entry')).toBeInTheDocument()
    expect(within(screen.getByRole('article', { name: 'Lost' })).getByText('Unreachable')).toBeInTheDocument()
    expect(screen.getByText('No screen “terms”')).toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'Missing screen terms' })).toBeInTheDocument()
  })

  it('shows the open comment count on a frame title', () => {
    renderCanvas()

    expect(within(screen.getByRole('article', { name: 'Home' })).getByTitle('1 open comment')).toBeInTheDocument()
  })

  it('picks a frame on click, and opens it on the stage on double click or Enter', async () => {
    const { onSelect, onOpen } = renderCanvas()

    await userEvent.click(screen.getByRole('button', { name: 'Review · Empty' }))
    expect(onSelect).toHaveBeenCalledWith('review', 'empty')

    await userEvent.dblClick(screen.getByRole('button', { name: 'Review · Empty' }))
    expect(onOpen).toHaveBeenCalledWith('review', 'empty')

    onOpen.mockClear()
    screen.getByRole('button', { name: 'Home' }).focus()
    await userEvent.keyboard('{Enter}')
    expect(onOpen).toHaveBeenCalledWith('home', 'default')
  })

  it('puts the frames in reading order for Tab, and picks a frame that takes focus', () => {
    const { onSelect } = renderCanvas()
    const frames = [...screen.getByRole('region', { name: 'Canvas' }).querySelectorAll('button[aria-pressed]')]

    // Columns of the flow, read row by row: the entry first, then what it leads to.
    expect(frames.map(frame => frame.getAttribute('aria-label'))).toEqual(['Home', 'Review', 'Review · Empty', 'Lost'])

    fireEvent.focus(screen.getByRole('button', { name: 'Review' }))
    expect(onSelect).toHaveBeenLastCalledWith('review', 'default')
  })

  it('brings a frame picked from outside into view, and leaves one picked on the canvas where it is', () => {
    const { rerender, onSelect } = renderCanvas({ selectedKey: 'home/default' })
    for (let step = 0; step < 4; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    }
    const before = content().style.transform

    // A click, without the focus that comes with it: happy-dom reads every focus as from the keyboard.
    fireEvent.click(screen.getByRole('button', { name: 'Lost' }))
    expect(onSelect).toHaveBeenLastCalledWith('lost', 'default')
    rerender({ selectedKey: 'lost/default' })
    expect(content().style.transform).toBe(before)

    rerender({ selectedKey: 'review/empty' })
    expect(content().style.transform).not.toBe(before)
  })

  it('undoes any scroll of the canvas itself, which moves only by its camera', () => {
    renderCanvas()
    const canvas = screen.getByRole('region', { name: 'Canvas' })

    canvas.scrollLeft = 300
    fireEvent.scroll(canvas)

    expect(canvas.scrollLeft).toBe(0)
  })

  it('brings a frame that takes focus from the keyboard into view, and leaves a clicked one where it is', () => {
    renderCanvas()
    for (let step = 0; step < 4; step += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    }
    const lost = screen.getByRole('button', { name: 'Lost' })
    const before = content().style.transform

    fireEvent.focus(lost)
    expect(content().style.transform).toBe(before)

    vi.spyOn(lost, 'matches').mockImplementation(selector => selector === ':focus-visible')
    fireEvent.focus(lost)
    expect(content().style.transform).not.toBe(before)
  })

  it('moves to the nearest frame with the arrow keys', async () => {
    const { onSelect } = renderCanvas({ selectedKey: 'review/default' })

    screen.getByRole('button', { name: 'Review' }).focus()
    onSelect.mockClear()
    await userEvent.keyboard('{ArrowRight}')

    expect(onSelect).toHaveBeenLastCalledWith('review', 'empty')
    expect(screen.getByRole('button', { name: 'Review · Empty' })).toHaveFocus()
  })

  it('pans with the arrow keys when no frame has focus', async () => {
    renderCanvas()
    const before = content().style.transform

    screen.getByRole('region', { name: 'Canvas' }).focus()
    await userEvent.keyboard('{ArrowLeft}')

    expect(content().style.transform).not.toBe(before)
  })

  it('takes focus when it opens, so its keys work at once', () => {
    renderCanvas()

    expect(screen.getByRole('region', { name: 'Canvas' })).toHaveFocus()
  })

  it('keeps its keys after a toolbar button is clicked', async () => {
    renderCanvas()

    await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    const zoom = zoomLabel().textContent
    await userEvent.keyboard('+')

    expect(zoomLabel().textContent).not.toBe(zoom)
  })

  it('zooms with the toolbar and with + and -, between 5% and 200%', async () => {
    renderCanvas()
    const start = zoomLabel().textContent

    await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(zoomLabel().textContent).not.toBe(start)

    for (let step = 0; step < 30; step += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    }
    expect(zoomLabel()).toHaveTextContent('200%')

    screen.getByRole('region', { name: 'Canvas' }).focus()
    for (let step = 0; step < 40; step += 1) {
      await userEvent.keyboard('-')
    }
    expect(zoomLabel()).toHaveTextContent('5%')
  })

  it('draws frames as titled cards when zoomed too far out to read them', async () => {
    renderCanvas()
    expect(screen.getByText('Good morning')).toBeInTheDocument()

    for (let step = 0; step < 20; step += 1) {
      await userEvent.click(screen.getByRole('button', { name: 'Zoom out' }))
    }

    expect(screen.queryByText('Good morning')).not.toBeInTheDocument()
    expect(screen.getByRole('article', { name: 'Home' })).toBeInTheDocument()
  })

  it('fits everything with Shift+1 and zooms to the picked frame with Shift+2', async () => {
    renderCanvas({ selectedKey: 'home/default' })
    const fitted = zoomLabel().textContent

    screen.getByRole('region', { name: 'Canvas' }).focus()
    await userEvent.keyboard('{Shift>}2{/Shift}')
    const onFrame = zoomLabel().textContent
    expect(onFrame).not.toBe(fitted)

    await userEvent.keyboard('{Shift>}1{/Shift}')
    expect(zoomLabel().textContent).toBe(fitted)
  })

  it('opens centred on the picked frame when asked to', () => {
    renderCanvas({ selectedKey: 'home/default', opening: 'selection' })

    expect(zoomLabel()).toHaveTextContent('100%')
  })

  it('pans with the wheel and zooms with Ctrl and the wheel', () => {
    renderCanvas()
    const canvas = screen.getByRole('region', { name: 'Canvas' })
    const before = content().style.transform
    const zoom = zoomLabel().textContent

    fireEvent.wheel(canvas, { deltaX: 0, deltaY: 120 })
    expect(content().style.transform).not.toBe(before)
    expect(zoomLabel().textContent).toBe(zoom)

    // happy-dom's WheelEvent leaves `ctrlKey` out, so the test sets it.
    const pinch = new WheelEvent('wheel', { deltaY: -100, bubbles: true, cancelable: true })
    Object.defineProperty(pinch, 'ctrlKey', { value: true })
    fireEvent(canvas, pinch)
    expect(zoomLabel().textContent).not.toBe(zoom)
  })

  it('pans when dragged on empty canvas', () => {
    renderCanvas()
    const canvas = screen.getByRole('region', { name: 'Canvas' })
    const before = content().style.transform

    fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 160, clientY: 130 })
    fireEvent.pointerUp(canvas, { pointerId: 1 })

    expect(content().style.transform).not.toBe(before)
  })

  it('does not pan when a drag starts on a frame', () => {
    renderCanvas()
    const before = content().style.transform

    const frame = screen.getByRole('button', { name: 'Home' })
    fireEvent.pointerDown(frame, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
    fireEvent.pointerMove(frame, { pointerId: 1, clientX: 160, clientY: 130 })

    expect(content().style.transform).toBe(before)
  })

  it('turns the arrow layer off from its button', async () => {
    const { onToggleArrows } = renderCanvas({ arrows: false })

    expect(screen.getByRole('button', { name: 'Arrows' })).toHaveAttribute('aria-pressed', 'false')
    await userEvent.click(screen.getByRole('button', { name: 'Arrows' }))

    expect(onToggleArrows).toHaveBeenCalled()
  })

  it('fades the frames an arrow does not join to the one under the pointer', async () => {
    renderCanvas()

    await userEvent.hover(screen.getByRole('article', { name: 'Home' }))

    expect(screen.getByRole('article', { name: 'Lost' })).toHaveClass('opacity-40')
    expect(screen.getByRole('article', { name: 'Review' })).not.toHaveClass('opacity-40')
  })

  it('draws a frame as tall as its whole page, and a live one at its device height again', async () => {
    const flow = ready()
    const home = flow.linksByNode.get('home/default')
    const links = new Map(flow.linksByNode)
    links.set('home/default', { ...(home ?? { links: [] }), pageHeight: 1500 })
    renderCanvas({ flow: { ...flow, linksByNode: links } })
    const mount = () =>
      within(screen.getByRole('article', { name: 'Home' }))
        .getByText('Good morning')
        .closest('[data-viewport]')

    expect(mount()).toHaveStyle({ width: '1280px', height: '1500px' })

    screen.getByRole('button', { name: 'Home' }).focus()
    await userEvent.keyboard('l')

    expect(mount()).toHaveStyle({ height: '820px' })
  })

  it('draws every frame at the size the device toolbar sets', async () => {
    renderCanvas({ frameSize: { width: 768, height: 1024 } })

    // A size other than the screen's own is measured first, which takes a task per screen.
    const mount = (await screen.findByText('Good morning')).closest('[data-viewport]')
    expect(mount).toHaveStyle({ width: '768px', height: '1024px' })
  })

  it('pins the comments on a frame and reports the one clicked', async () => {
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue(
      DOMRect.fromRect({ x: 10, y: 10, width: 50, height: 20 })
    )
    const { onPin } = renderCanvas({ showNotes: true })

    await userEvent.click(await screen.findByRole('button', { name: 'Note 1: One filled button' }))

    expect(onPin).toHaveBeenCalledWith('home', 'default', 'n1')
  })

  it('says it is reading, and how far along, while the links are not in yet', () => {
    renderCanvas({ flow: { status: 'reading', linksByNode: new Map(), read: 2, total: 4 } })

    expect(screen.getByText('Reading where every control leads… 2 of 4 screen states')).toBeInTheDocument()
    expect(screen.queryByRole('article')).not.toBeInTheDocument()
  })

  it('says there is nothing to lay out for a prototype with no screens', () => {
    renderCanvas({ prototype: { ...(prototype as NonNullable<typeof prototype>), screens: [] } })

    expect(screen.getByText('This prototype has no screens yet, so there is nothing to lay out.')).toBeInTheDocument()
  })

  it('keeps the zoom when only the frames in view change', () => {
    renderCanvas()
    const zoom = zoomLabel().textContent

    act(() => {
      fireEvent.wheel(screen.getByRole('region', { name: 'Canvas' }), { deltaX: 500, deltaY: 0 })
    })

    expect(zoomLabel().textContent).toBe(zoom)
  })

  describe('arranging', () => {
    const section = (name: string) => screen.getByRole('region', { name: `Screen ${name}` })
    const withCanvas = (canvas: NonNullable<typeof prototype>['canvas']) => ({
      ...(prototype as NonNullable<typeof prototype>),
      canvas,
    })

    it('puts a section where canvas.json saved it', () => {
      renderCanvas({ prototype: withCanvas({ version: 1, sections: [{ screen: 'review', x: -900, y: 1200 }] }) })

      expect(section('Review')).toHaveStyle({ left: '-900px', top: '1200px' })
    })

    it('offers no handles and no reset without the dev server', () => {
      renderCanvas()

      expect(screen.queryByRole('button', { name: 'Move the Review section' })).not.toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Reset layout' })).not.toBeInTheDocument()
    })

    it('moves a section dragged by its name, and saves every section where it is', () => {
      const { onArrange } = renderCanvas({ canArrange: true })
      const handle = screen.getByRole('button', { name: 'Move the Review section' })
      const before = section('Review')
      const left = Number.parseFloat(before.style.left)
      const top = Number.parseFloat(before.style.top)

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 100, clientY: 100 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 150, clientY: 80 })
      fireEvent.pointerUp(window, { pointerId: 1 })

      const zoom = Number.parseInt(zoomLabel().textContent ?? '100', 10) / 100
      expect(onArrange).toHaveBeenCalledTimes(1)
      const saved = onArrange.mock.calls[0]?.[0]
      expect(saved?.sections.map(placed => placed.screen).sort()).toEqual(['home', 'lost', 'review'])
      const review = saved?.sections.find(placed => placed.screen === 'review')
      expect(review?.x).toBeCloseTo(left + 50 / zoom, 0)
      expect(review?.y).toBeCloseTo(top - 20 / zoom, 0)
      expect(Number.parseFloat(section('Review').style.left)).toBeCloseTo(review?.x ?? 0, 0)
    })

    it('moves a focused section with the arrow keys, Shift for a bigger step, and saves after a moment', () => {
      vi.useFakeTimers()
      const { onArrange } = renderCanvas({ canArrange: true })
      const handle = screen.getByRole('button', { name: 'Move the Home section' })
      const left = Number.parseFloat(section('Home').style.left)

      fireEvent.keyDown(handle, { key: 'ArrowRight' })
      fireEvent.keyDown(handle, { key: 'ArrowRight', shiftKey: true })

      expect(section('Home')).toHaveStyle({ left: `${left + 440}px` })
      expect(onArrange).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(700))
      expect(onArrange).toHaveBeenCalledTimes(1)
    })

    it('puts every section back in the columns of the flow on Reset layout', async () => {
      const { onArrange } = renderCanvas({
        canArrange: true,
        prototype: withCanvas({
          version: 1,
          sections: [{ screen: 'review', x: -900, y: 1200 }],
          viewports: ['tablet'],
        }),
      })

      await userEvent.click(screen.getByRole('button', { name: 'Reset layout' }))

      expect(onArrange).toHaveBeenCalledWith({ version: 1, sections: [], viewports: ['tablet'] })
    })

    it('has nothing to reset when nothing was arranged', () => {
      renderCanvas({ canArrange: true })

      expect(screen.getByRole('button', { name: 'Reset layout' })).toBeDisabled()
    })

    it('says why when the arrangement could not be saved', async () => {
      renderCanvas({ canArrange: true, onArrange: vi.fn(() => Promise.reject(new Error('canvas.json is read-only'))) })
      const handle = screen.getByRole('button', { name: 'Move the Home section' })

      fireEvent.pointerDown(handle, { button: 0, pointerId: 1, clientX: 0, clientY: 0 })
      fireEvent.pointerMove(window, { pointerId: 1, clientX: 40, clientY: 0 })
      fireEvent.pointerUp(window, { pointerId: 1 })

      expect(await screen.findByRole('alert')).toHaveTextContent('The layout was not saved: canvas.json is read-only')
    })
  })

  describe('live frames', () => {
    const frame = (name: string) => screen.getByRole('article', { name })

    it('makes the focused frame live with L, so it clicks through inside itself', async () => {
      renderCanvas()
      screen.getByRole('button', { name: 'Home' }).focus()

      await userEvent.keyboard('l')

      const home = frame('Home')
      expect(within(home).getByText('Live')).toBeInTheDocument()
      expect(within(home).getByText('Good morning').closest('[inert]')).toBeNull()

      await userEvent.click(within(home).getByRole('button', { name: 'Book a visit' }))

      expect(within(home).getByRole('heading', { name: 'Review your visit' })).toBeInTheDocument()
      await userEvent.click(within(home).getByRole('button', { name: 'Back to Home' }))
      expect(within(home).getByText('Good morning')).toBeInTheDocument()
    })

    it('stops on Esc, back on its own state and inert again', async () => {
      renderCanvas()
      screen.getByRole('button', { name: 'Home' }).focus()
      await userEvent.keyboard('l')
      await userEvent.click(within(frame('Home')).getByRole('button', { name: 'Book a visit' }))

      await userEvent.keyboard('{Escape}')

      expect(within(frame('Home')).queryByText('Live')).not.toBeInTheDocument()
      expect(within(frame('Home')).getByText('Good morning').closest('[inert]')).not.toBeNull()
    })

    it('stays live on an Esc the screen used itself, to close one of its menus', async () => {
      renderCanvas()
      screen.getByRole('button', { name: 'Home' }).focus()
      await userEvent.keyboard('l')

      const used = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      used.preventDefault()
      act(() => {
        window.dispatchEvent(used)
      })

      expect(within(frame('Home')).getByText('Live')).toBeInTheDocument()
    })

    it('stops from its own button, and on a press anywhere else on the canvas', async () => {
      renderCanvas()
      screen.getByRole('button', { name: 'Home' }).focus()
      await userEvent.keyboard('l')
      await userEvent.click(screen.getByRole('button', { name: 'Stop the live frame' }))
      expect(within(frame('Home')).queryByText('Live')).not.toBeInTheDocument()

      screen.getByRole('button', { name: 'Home' }).focus()
      await userEvent.keyboard('l')
      fireEvent.pointerDown(screen.getByRole('region', { name: 'Canvas' }), { button: 0, pointerId: 1 })
      expect(within(frame('Home')).queryByText('Live')).not.toBeInTheDocument()
    })

    it('keeps one frame live at a time', async () => {
      renderCanvas()
      screen.getByRole('button', { name: 'Home' }).focus()
      await userEvent.keyboard('l')
      screen.getByRole('button', { name: 'Lost' }).focus()
      await userEvent.keyboard('l')

      expect(within(frame('Lost')).getByText('Live')).toBeInTheDocument()
      expect(within(frame('Home')).queryByText('Live')).not.toBeInTheDocument()
    })

    it('makes a frame live on double click with Live on, and opens it on the stage with Live off', async () => {
      const { onOpen } = renderCanvas()

      await userEvent.click(screen.getByRole('button', { name: 'Live' }))
      await userEvent.dblClick(screen.getByRole('button', { name: 'Lost' }))

      expect(within(frame('Lost')).getByText('Live')).toBeInTheDocument()
      expect(onOpen).not.toHaveBeenCalled()
    })
  })

  describe('viewports', () => {
    const frames = () => [...document.querySelectorAll('article[data-canvas-frame]')]

    it('draws each state in two viewports side by side, named on their titles', async () => {
      renderCanvas()

      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Viewports' }), 'Desktop and tablet')

      await waitFor(() => expect(frames()).toHaveLength(8))
      // Frames draw their screens a couple at a time, so the screens are waited for too.
      const desktop = await within(screen.getByRole('article', { name: 'Home (Desktop)' })).findByText('Good morning')
      const tablet = await within(screen.getByRole('article', { name: 'Home (Tablet)' })).findByText('Good morning')
      expect(desktop.closest('[data-viewport]')).toHaveStyle({ width: '1280px' })
      expect(tablet.closest('[data-viewport]')).toHaveStyle({ width: '834px' })
    })

    it('saves the choice to canvas.json with the dev server, and keeps it on the page without', async () => {
      const arranging = renderCanvas({ canArrange: true })
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Viewports' }), 'Tablet and mobile')
      expect(arranging.onArrange).toHaveBeenCalledWith({ version: 1, sections: [], viewports: ['tablet', 'mobile'] })
    })

    it('does not save the choice without the dev server', async () => {
      const { onArrange } = renderCanvas()
      await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Viewports' }), 'Tablet and mobile')

      expect(onArrange).not.toHaveBeenCalled()
      await waitFor(() => expect(frames()).toHaveLength(8))
    })

    it('draws every frame in the one viewport canvas.json names', async () => {
      renderCanvas({
        prototype: {
          ...(prototype as NonNullable<typeof prototype>),
          canvas: { version: 1, sections: [], viewports: ['tablet'] },
        },
      })

      expect((await screen.findByText('Good morning')).closest('[data-viewport]')).toHaveStyle({ width: '834px' })
      expect(frames()).toHaveLength(4)
    })
  })

  describe('ready for dev and PNG', () => {
    const withReady = (ready: string[]) => ({
      ...(prototype as NonNullable<typeof prototype>),
      canvas: { version: 1 as const, sections: [], ready },
    })

    it('marks the states canvas.json says are ready for dev', () => {
      renderCanvas({ prototype: withReady(['review/empty']) })

      expect(
        within(screen.getByRole('article', { name: 'Review · Empty' })).getByText('Ready for dev')
      ).toBeInTheDocument()
      expect(within(screen.getByRole('article', { name: 'Home' })).queryByText('Ready for dev')).not.toBeInTheDocument()
    })

    it('marks the picked state ready with the dev server, and unmarks it', async () => {
      const marking = renderCanvas({ canArrange: true, selectedKey: 'home/default' })
      await userEvent.click(screen.getByRole('button', { name: 'Ready for dev' }))
      expect(marking.onArrange).toHaveBeenLastCalledWith({ version: 1, sections: [], ready: ['home/default'] })
    })

    it('unmarks a state that is ready', async () => {
      const { onArrange } = renderCanvas({
        canArrange: true,
        selectedKey: 'review/empty',
        prototype: withReady(['review/empty']),
      })

      expect(screen.getByRole('button', { name: 'Ready for dev' })).toHaveAttribute('aria-pressed', 'true')
      await userEvent.click(screen.getByRole('button', { name: 'Ready for dev' }))
      expect(onArrange).toHaveBeenLastCalledWith({ version: 1, sections: [], ready: [] })
    })

    it('offers no way to mark a state without the dev server', () => {
      renderCanvas({ selectedKey: 'home/default' })

      expect(screen.queryByRole('button', { name: 'Ready for dev' })).not.toBeInTheDocument()
    })

    it("saves the picked frame's screen as a PNG named after it", async () => {
      const { exportPng } = await import('../../lib/export-png')
      renderCanvas({ selectedKey: 'review/empty' })

      await userEvent.click(screen.getByRole('button', { name: 'PNG' }))

      const [element, name] = vi.mocked(exportPng).mock.calls[0] ?? []
      expect(element).toHaveTextContent('Nothing to review')
      expect(name).toBe('booking--review--empty.png')
    })
  })
})
