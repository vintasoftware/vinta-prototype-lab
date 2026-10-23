import { act, fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { anchor } from '../../components/anchor'
import { useScreenNavigation } from '../../components/prototype-runtime'
import { ScreenLink } from '../../components/screen-link'
import type { FlowLinks } from '../../hooks/use-flow-links'
import { buildPrototypes } from '../../lib/discovery'
import { probePrototype } from '../../lib/probe-screen'
import { CanvasView, type CanvasViewProps } from './canvas-view'

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
  }
  render(
    <CanvasView
      prototype={prototype as NonNullable<typeof prototype>}
      flow={ready()}
      showHotspots={false}
      showNotes={false}
      arrows
      selectedKey={undefined}
      selectedNoteId={undefined}
      opening='fit'
      {...handlers}
      {...props}
    />
  )
  return handlers
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

  it('draws every frame at the size the device toolbar sets', () => {
    renderCanvas({ frameSize: { width: 768, height: 1024 } })

    const mount = screen.getByText('Good morning').closest('[data-viewport]')
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
})
