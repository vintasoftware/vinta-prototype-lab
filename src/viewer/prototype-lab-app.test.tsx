import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { anchor } from '../components/anchor'
import { ScreenLink } from '../components/screen-link'
import { type AnnotationEdit, applyAnnotationEdit } from '../lib/annotation-edit'
import { buildPrototypes } from '../lib/discovery'
import { PrototypeLabApp } from './prototype-lab-app'

function HomeScreen() {
  return (
    <div>
      <h1>Good morning</h1>
      <span data-slot='badge' {...anchor('task-count')}>
        2 tasks
      </span>
      <span data-slot='card-title' data-proto-src='prototypes/booking/screens/10-home.tsx:4:6'>
        Unnamed
      </span>
      <span data-slot='separator' data-proto-src='prototypes/booking/screens/10-home.tsx:9:6'>
        Second thing
      </span>
      <span data-slot='separator' data-proto-src='prototypes/booking/screens/10-home.tsx:12:6'>
        Second thing
      </span>
      <ScreenLink to='review' anchorId='book-follow-up'>
        Book a visit
      </ScreenLink>
    </div>
  )
}

const ReviewScreen = () => <h1>Review your visit</h1>
const ReviewEmptyScreen = () => <h1>Nothing to review</h1>

const prototypes = buildPrototypes({
  docs: {
    '../../prototypes/booking/prototype.md':
      '---\ntitle: Booking\nsummary: How a patient books a visit.\nentry: home\n---\n\n## The flow\n\nStart on home.',
  },
  annotations: {
    '../../prototypes/booking/annotations.json': {
      notes: [
        { id: 'n1', screen: 'home', target: 'book-follow-up', title: 'One filled button per screen' },
        { id: 'n2', screen: 'review', target: 'summary', kind: 'flow', title: 'Repeats the review line for line' },
      ],
    },
  },
  screens: {
    '../../prototypes/booking/screens/10-home.tsx': { default: HomeScreen },
    '../../prototypes/booking/screens/20-review.tsx': { default: ReviewScreen },
    '../../prototypes/booking/screens/20-review.empty.tsx': { default: ReviewEmptyScreen },
  },
})

describe('PrototypeLabApp', () => {
  beforeEach(() => {
    window.location.hash = ''
    // The viewer reads Storybook's index to link components to their pages. Storybook is not
    // running here, which is also the common case for a person opening the viewer on its own.
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Storybook is not running')))
    )
  })

  it('opens on the entry screen the doc names', () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    expect(screen.getByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
  })

  it('follows a link in the prototype and comes back', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('button', { name: 'Book a visit' }))
    expect(screen.getByRole('heading', { name: 'Review your visit' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Back' }))
    expect(screen.getByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
  })

  it('lists the states of the open screen and shows the one picked', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)
    const screens = screen.getByRole('navigation', { name: 'Screens' })

    await userEvent.click(within(screens).getByRole('button', { name: /Review/ }))
    await userEvent.click(within(screens).getByRole('button', { name: 'Empty' }))

    expect(screen.getByRole('heading', { name: 'Nothing to review' })).toBeInTheDocument()
  })

  it('shows the prototype document beside the screen', () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    expect(screen.getByRole('heading', { name: 'Booking' })).toBeInTheDocument()
    expect(screen.getByText('How a patient books a visit.')).toBeInTheDocument()
    expect(screen.getByText('Start on home.')).toBeInTheDocument()
  })

  it('shows the comments written for the open screen', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('tab', { name: /Comments/ }))

    expect(screen.getByText('One filled button per screen')).toBeInTheDocument()
    expect(screen.queryByText('Repeats the review line for line')).not.toBeInTheDocument()
  })

  it('says the prototype loaded cleanly when it has no problems', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('tab', { name: /Problems/ }))

    expect(screen.getByText('Nothing to fix — the prototype loaded cleanly.')).toBeInTheDocument()
  })

  it('writes the open screen into the URL so it can be linked to', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('button', { name: 'Book a visit' }))

    expect(window.location.hash).toBe('#/p/booking/review')
  })

  it('lists the components of the screen on stage', () => {
    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })

    expect(within(tree).getByRole('button', { name: 'h1' })).toBeInTheDocument()
    expect(within(tree).getByRole('button', { name: 'Badge #task-count' })).toBeInTheDocument()
  })

  it('picks the clicked component in the tree while inspecting, and does not navigate', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('button', { name: 'Inspect' }))
    await userEvent.click(screen.getByRole('button', { name: 'Book a visit' }))

    const tree = screen.getByRole('list', { name: 'Components' })

    expect(within(tree).getByRole('button', { name: 'button #book-follow-up' })).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
  })

  it('picks the nearest component when the click lands on something inside it', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('button', { name: 'Inspect' }))
    await userEvent.click(screen.getByText('2 tasks'))

    const tree = screen.getByRole('list', { name: 'Components' })

    expect(within(tree).getByRole('button', { name: 'Badge #task-count' })).toHaveAttribute('aria-current', 'true')
  })

  it('follows the link again once inspecting is off', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('button', { name: 'Inspect' }))
    await userEvent.click(screen.getByRole('button', { name: 'Inspect' }))
    await userEvent.click(screen.getByRole('button', { name: 'Book a visit' }))

    expect(screen.getByRole('heading', { name: 'Review your visit' })).toBeInTheDocument()
  })

  it('drops the picked component when the screen changes', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = () => screen.getByRole('list', { name: 'Components' })

    await userEvent.click(within(tree()).getByRole('button', { name: 'h1' }))
    expect(within(tree()).getByRole('button', { name: 'h1' })).toHaveAttribute('aria-current', 'true')

    await userEvent.click(screen.getByRole('button', { name: 'Book a visit' }))

    expect(within(tree()).getByRole('button', { name: 'h1' })).not.toHaveAttribute('aria-current')
  })

  it('links a component in the tree to its Storybook page', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              entries: {
                'design-system-atoms--badges': {
                  id: 'design-system-atoms--badges',
                  title: 'Design System/Atoms',
                  name: 'Badges',
                  type: 'story',
                },
              },
            }),
        })
      )
    )

    render(<PrototypeLabApp prototypes={prototypes} />)

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Open Badge in Storybook' })).toHaveAttribute(
        'href',
        'http://localhost:6006/?path=/story/design-system-atoms--badges'
      )
    })
  })

  it('says how to start Storybook when its pages cannot be reached', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await waitFor(() => {
      expect(screen.getByText(/Nothing is serving Storybook at/)).toBeInTheDocument()
    })
  })

  it('says the port is serving another project rather than showing nothing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve({
              entries: {
                'billing-invoices--paid': {
                  id: 'billing-invoices--paid',
                  title: 'Billing/Invoices',
                  name: 'Paid',
                  type: 'story',
                },
              },
            }),
        })
      )
    )

    render(<PrototypeLabApp prototypes={prototypes} storybook={{ marker: 'Design System' }} />)

    await waitFor(() => {
      expect(screen.getByText(/serving another project's Storybook/)).toBeInTheDocument()
    })
    expect(screen.queryByRole('link', { name: /in Storybook/ })).not.toBeInTheDocument()
  })

  it('reads no Storybook and says nothing about it when Storybook is turned off', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('Storybook is not running')))
    vi.stubGlobal('fetch', fetch)

    render(<PrototypeLabApp prototypes={prototypes} storybook={false} />)

    await screen.findByRole('button', { name: 'Flow' })
    expect(fetch).not.toHaveBeenCalled()
    expect(screen.queryByText(/Nothing is serving Storybook at/)).not.toBeInTheDocument()
  })

  it('looks for Storybook at the configured URL', async () => {
    const fetch = vi.fn(() => Promise.reject(new Error('Storybook is not running')))
    vi.stubGlobal('fetch', fetch)

    render(<PrototypeLabApp prototypes={prototypes} storybook={{ url: 'http://localhost:6100' }} />)

    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith('http://localhost:6100/index.json', expect.anything())
    })
  })

  it('shows the flow map and opens a screen from one of its cards', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('button', { name: 'Flow' }))

    const home = await screen.findByRole('article', { name: 'Home' })
    const rows = within(home).getByRole('list')
    expect(within(rows).getByText('Book a visit')).toBeInTheDocument()
    expect(within(rows).getByText('Review')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Open Review · Empty' }))

    expect(screen.getByRole('heading', { name: 'Nothing to review' })).toBeInTheDocument()
    expect(screen.queryByRole('article', { name: 'Home' })).not.toBeInTheDocument()
  })

  it('toggles the flow map with the f key and empties the component tree while it is open', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.keyboard('f')

    await screen.findByRole('article', { name: 'Home' })
    expect(screen.getByText('Nothing to show for this screen.')).toBeInTheDocument()

    await userEvent.keyboard('f')

    expect(screen.getByRole('heading', { name: 'Good morning' })).toBeInTheDocument()
    expect(screen.getByRole('list', { name: 'Components' })).toBeInTheDocument()
  })

  it('closes and reopens the screens panel from the header', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('button', { name: 'Hide the screens panel' }))

    expect(screen.queryByRole('navigation', { name: 'Screens' })).not.toBeInTheDocument()
    expect(screen.queryByRole('list', { name: 'Components' })).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Good morning' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show the screens panel' }))

    expect(screen.getByRole('navigation', { name: 'Screens' })).toBeInTheDocument()
  })

  it('closes and reopens the doc panel from the header', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('button', { name: 'Hide the doc panel' }))

    expect(screen.queryByRole('tab', { name: 'Doc' })).not.toBeInTheDocument()
    expect(screen.queryByText('How a patient books a visit.')).not.toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Good morning' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Show the doc panel' }))

    expect(screen.getByRole('tab', { name: 'Doc' })).toBeInTheDocument()
  })

  it('closes each panel with its own bracket key, leaving the other one open', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    // `[[` types one `[`: user-event reads a lone bracket as the start of a key descriptor.
    await userEvent.keyboard('[[')

    expect(screen.queryByRole('navigation', { name: 'Screens' })).not.toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Doc' })).toBeInTheDocument()

    await userEvent.keyboard(']')

    expect(screen.queryByRole('tab', { name: 'Doc' })).not.toBeInTheDocument()

    await userEvent.keyboard('[[')
    await userEvent.keyboard(']')

    expect(screen.getByRole('navigation', { name: 'Screens' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Doc' })).toBeInTheDocument()
  })

  it('opens with the component a link names already picked', async () => {
    window.location.hash = '#/p/booking/home?component=task-count'

    render(<PrototypeLabApp prototypes={prototypes} />)

    const tree = await screen.findByRole('list', { name: 'Components' })

    expect(within(tree).getByRole('button', { name: 'Badge #task-count' })).toHaveAttribute('aria-current', 'true')
  })

  it('opens on a component named by where it sits, for one that carries no semantic id', async () => {
    window.location.hash = '#/p/booking/home?component=%2Fh1'

    render(<PrototypeLabApp prototypes={prototypes} />)

    const tree = await screen.findByRole('list', { name: 'Components' })

    expect(within(tree).getByRole('button', { name: 'h1' })).toHaveAttribute('aria-current', 'true')
  })

  it('puts the picked component in the URL, so the view can be pasted into a ticket', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })

    await userEvent.click(within(tree).getByRole('button', { name: 'Badge #task-count' }))

    expect(window.location.hash).toBe('#/p/booking/home?component=task-count')

    await userEvent.click(within(tree).getByRole('button', { name: 'Badge #task-count' }))

    expect(window.location.hash).toBe('#/p/booking/home')
  })

  it('drops the component from the URL when the flow moves to another screen', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })

    await userEvent.click(within(tree).getByRole('button', { name: 'Badge #task-count' }))
    await userEvent.click(screen.getByRole('button', { name: 'Book a visit' }))

    expect(window.location.hash).toBe('#/p/booking/review')
  })

  it('says so when a link names a component this screen does not have', async () => {
    window.location.hash = '#/p/booking/home?component=confirm-booking'

    render(<PrototypeLabApp prototypes={prototypes} />)

    expect(await screen.findByText(/which this screen does not have/)).toBeInTheDocument()
    expect(screen.getByText('confirm-booking')).toBeInTheDocument()
  })

  it('copies a link to the picked component', async () => {
    const writeText = vi.fn(() => Promise.resolve())
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } })

    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })

    await userEvent.click(within(tree).getByRole('button', { name: 'Badge #task-count' }))
    await userEvent.click(within(tree).getByRole('button', { name: 'Copy a link to Badge' }))

    expect(writeText).toHaveBeenCalledWith(window.location.href)
    expect(window.location.href).toContain('?component=task-count')
  })

  it('writes a comment on the picked component through the dev server', async () => {
    const saved: unknown[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: { body: string }) => {
        if (!url.includes('__annotations')) {
          return Promise.reject(new Error('Storybook is not running'))
        }
        const payload = JSON.parse(init.body) as { edit: { note: unknown } }
        saved.push(payload.edit.note)
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ notes: [payload.edit.note] }) })
      })
    )

    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })

    await userEvent.click(within(tree).getByRole('button', { name: 'Badge #task-count' }))
    await userEvent.click(screen.getByRole('tab', { name: /Comments/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Comment on task-count' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Hide the badge at zero')
    await userEvent.type(screen.getByLabelText('Author'), 'Ana')
    await userEvent.click(screen.getByRole('button', { name: 'Save comment' }))

    await waitFor(() => expect(saved).toHaveLength(1))
    expect(saved[0]).toEqual({
      id: 'hide-the-badge-at-zero',
      target: 'task-count',
      screen: 'home',
      kind: 'spec',
      title: 'Hide the badge at zero',
      author: 'Ana',
      status: 'open',
    })
  })

  describe('a comment on a component with no name of its own', () => {
    /** Every request the viewer makes of the dev server, in order. */
    let sent: { endpoint: string; body: { source?: string; id?: string; edit?: { note: { target: string } } } }[]

    beforeEach(() => {
      sent = []
      vi.stubGlobal(
        'fetch',
        vi.fn((url: string, init: { body: string }) => {
          const endpoint = ['__annotations', '__name-element'].find(name => url.includes(name))
          if (endpoint === undefined) {
            return Promise.reject(new Error('Storybook is not running'))
          }
          const body = JSON.parse(init.body) as (typeof sent)[number]['body']
          sent.push({ endpoint, body })
          const notes = body.edit === undefined ? [] : [body.edit.note]
          return Promise.resolve({ ok: true, json: () => Promise.resolve({ notes }) })
        })
      )
    })

    const openComposer = async () => {
      render(<PrototypeLabApp prototypes={prototypes} />)
      const tree = screen.getByRole('list', { name: 'Components' })
      await userEvent.click(within(tree).getByRole('button', { name: 'CardTitle' }))
      await userEvent.click(screen.getByRole('tab', { name: /Comments/ }))
      await userEvent.click(screen.getByRole('button', { name: 'Comment on /CardTitle' }))
    }

    it('names the component first, then points the comment at the name', async () => {
      await openComposer()
      expect(screen.getByLabelText('Name this element')).toHaveValue('unnamed')

      await userEvent.type(screen.getByLabelText('Title'), 'Say what the total counts')
      await userEvent.click(screen.getByRole('button', { name: 'Save comment' }))

      await waitFor(() => expect(sent).toHaveLength(2))
      expect(sent[0]).toEqual({
        endpoint: '__name-element',
        body: { source: 'prototypes/booking/screens/10-home.tsx:4:6', id: 'unnamed' },
      })
      expect(sent[1]?.endpoint).toBe('__annotations')
      expect(sent[1]?.body.edit?.note.target).toBe('unnamed')
    })

    it.each([
      ['cleared', ''],
      ['left blank', '   '],
    ])('pins the comment by position when the name is %s, leaving the screen alone', async (_, name) => {
      await openComposer()

      await userEvent.clear(screen.getByLabelText('Name this element'))
      if (name !== '') {
        await userEvent.type(screen.getByLabelText('Name this element'), name)
      }
      // The heading says what the comment will point at, which is now the component's place.
      expect(screen.getByText('New comment on', { exact: false })).toHaveTextContent('New comment on /CardTitle')

      await userEvent.type(screen.getByLabelText('Title'), 'Say what the total counts')
      await userEvent.click(screen.getByRole('button', { name: 'Save comment' }))

      await waitFor(() => expect(sent).toHaveLength(1))
      expect(sent[0]?.endpoint).toBe('__annotations')
      expect(sent[0]?.body.edit?.note.target).toBe('/CardTitle')
      expect(await screen.findByText('Say what the total counts')).toBeInTheDocument()
      expect(screen.queryByText('That request is not one this endpoint takes.')).not.toBeInTheDocument()
    })
  })

  it('edits, resolves and deletes a comment through the dev server', async () => {
    const sent: { op: string; note?: { title?: string; status?: string }; id?: string }[] = []
    let notes = prototypes[0]?.annotations ?? []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: { body: string }) => {
        if (!url.includes('__annotations')) {
          return Promise.reject(new Error('Storybook is not running'))
        }
        const edit = (JSON.parse(init.body) as { edit: AnnotationEdit }).edit
        sent.push(edit as (typeof sent)[number])
        // The real server answers with the file as it now stands, and the panel renders that.
        notes = applyAnnotationEdit(notes, edit)
        return Promise.resolve({ ok: true, json: () => Promise.resolve({ notes }) })
      })
    )

    render(<PrototypeLabApp prototypes={prototypes} />)
    await userEvent.click(screen.getByRole('tab', { name: /Comments/ }))

    await userEvent.click(screen.getByRole('button', { name: 'Edit' }))
    await userEvent.clear(screen.getByLabelText('Title'))
    await userEvent.type(screen.getByLabelText('Title'), 'Only one filled button')
    await userEvent.click(screen.getByRole('button', { name: 'Save comment' }))

    await waitFor(() => expect(sent).toHaveLength(1))
    expect(sent[0]?.op).toBe('save')
    expect(sent[0]?.note?.title).toBe('Only one filled button')

    await userEvent.click(screen.getByRole('button', { name: 'Resolve' }))
    await waitFor(() => expect(sent).toHaveLength(2))
    expect(sent[1]?.note?.status).toBe('resolved')

    await userEvent.click(screen.getByRole('button', { name: /^Delete the comment/ }))
    await waitFor(() => expect(sent).toHaveLength(3))
    expect(sent[2]).toEqual({ op: 'delete', id: 'n1' })
  })

  it('offers no way to write a comment with no component picked', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('tab', { name: /Comments/ }))

    expect(screen.getByRole('button', { name: 'Pick a component to comment on' })).toBeDisabled()
  })

  it('keeps what was typed and says why when the dev server refuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('__annotations')
          ? Promise.resolve({
              ok: false,
              status: 400,
              json: () => Promise.resolve({ error: 'annotations.json is read-only' }),
            })
          : Promise.reject(new Error('Storybook is not running'))
      )
    )

    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })

    await userEvent.click(within(tree).getByRole('button', { name: 'Badge #task-count' }))
    await userEvent.click(screen.getByRole('tab', { name: /Comments/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Comment on task-count' }))
    await userEvent.type(screen.getByLabelText('Title'), 'Hide the badge at zero')
    await userEvent.click(screen.getByRole('button', { name: 'Save comment' }))

    expect(await screen.findByText('annotations.json is read-only')).toBeInTheDocument()
    expect(screen.getByLabelText('Title')).toHaveValue('Hide the badge at zero')
  })

  it('names the picked element, writing the id into its screen', async () => {
    const named: { source?: string; id?: string }[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string, init: { body: string }) => {
        if (!url.includes('__name-element')) {
          return Promise.reject(new Error('Storybook is not running'))
        }
        named.push(JSON.parse(init.body) as (typeof named)[number])
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      })
    )

    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })

    await userEvent.click(within(tree).getByRole('button', { name: 'CardTitle' }))
    await userEvent.click(screen.getByRole('button', { name: 'Name this element' }))

    // The name is offered from what the element says, and can be changed before it is written.
    expect(screen.getByLabelText('Element name')).toHaveValue('unnamed')
    await userEvent.clear(screen.getByLabelText('Element name'))
    await userEvent.type(screen.getByLabelText('Element name'), 'task-total')
    await userEvent.click(screen.getByRole('button', { name: 'Name it' }))

    await waitFor(() => expect(named).toHaveLength(1))
    expect(named[0]).toEqual({ source: 'prototypes/booking/screens/10-home.tsx:4:6', id: 'task-total' })
    // The pick moves to the new id, so a link copied now is the durable one.
    await waitFor(() => expect(window.location.hash).toBe('#/p/booking/home?component=task-total'))
  })

  it('offers no name for an element the screen already names', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })

    await userEvent.click(within(tree).getByRole('button', { name: 'Badge #task-count' }))

    expect(screen.queryByRole('button', { name: 'Name this element' })).not.toBeInTheDocument()
  })

  it('says why the name was refused, keeping the form open to fix it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((url: string) =>
        url.includes('__name-element')
          ? Promise.resolve({
              ok: false,
              status: 409,
              json: () => Promise.resolve({ error: 'That element already carries a name.' }),
            })
          : Promise.reject(new Error('Storybook is not running'))
      )
    )

    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })

    await userEvent.click(within(tree).getByRole('button', { name: 'CardTitle' }))
    await userEvent.click(screen.getByRole('button', { name: 'Name this element' }))
    await userEvent.click(screen.getByRole('button', { name: 'Name it' }))

    expect(await screen.findByText('That element already carries a name.')).toBeInTheDocument()
    expect(screen.getByLabelText('Element name')).toBeInTheDocument()
  })

  it('offers the name of the element picked now, not the one picked when the form opened', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })

    await userEvent.click(within(tree).getByRole('button', { name: 'CardTitle' }))
    await userEvent.click(screen.getByRole('tab', { name: /Comments/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Comment on /CardTitle' }))

    expect(screen.getByLabelText('Name this element')).toHaveValue('unnamed')

    // The composer stays open while the pick moves, so it has to follow the pick.
    await userEvent.click(within(tree).getAllByRole('button', { name: 'Separator' })[0] as HTMLElement)

    expect(screen.getByLabelText('Name this element')).toHaveValue('second-thing')
  })

  it('starts the name form again on an element that would be called the same thing', async () => {
    render(<PrototypeLabApp prototypes={prototypes} />)
    const tree = screen.getByRole('list', { name: 'Components' })
    // Two separators reading the same words: the suggestion cannot tell them apart, only the pick can.
    const separators = within(tree).getAllByRole('button', { name: 'Separator' })

    await userEvent.click(separators[0] as HTMLElement)
    await userEvent.click(screen.getByRole('button', { name: 'Name this element' }))
    await userEvent.clear(screen.getByLabelText('Element name'))
    await userEvent.type(screen.getByLabelText('Element name'), 'the-first-one')

    await userEvent.click(separators[1] as HTMLElement)

    // The form belongs to the element it was opened on, so the next one starts again.
    expect(screen.queryByLabelText('Element name')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Name this element' })).toBeInTheDocument()
  })

  it('explains how to start when there are no prototypes', () => {
    render(<PrototypeLabApp prototypes={[]} />)

    expect(screen.getByRole('heading', { name: 'No prototypes yet' })).toBeInTheDocument()
  })
})
