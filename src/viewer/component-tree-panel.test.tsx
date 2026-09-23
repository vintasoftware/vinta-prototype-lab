import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { buildComponentTree } from '../lib/component-tree'
import { buildStorybookLinks } from '../lib/storybook-links'
import { ComponentTreePanel } from './component-tree-panel'

function treeOf(html: string) {
  const frame = document.createElement('div')
  frame.innerHTML = html
  return buildComponentTree(frame)
}

const tree = treeOf(
  '<div data-slot="card"><div data-slot="card-content"><button data-slot="button" data-proto-id="book-follow-up"></button></div></div>'
)

const storybookLinks = buildStorybookLinks(
  [
    { id: 'design-system-composites--card-basic', title: 'Design System/Composites', name: 'Card', type: 'story' },
    { id: 'design-system-atoms--buttons', title: 'Design System/Atoms', name: 'Buttons', type: 'story' },
  ],
  'http://localhost:6006'
)

function renderPanel(overrides: Partial<React.ComponentProps<typeof ComponentTreePanel>> = {}) {
  const onSelect = vi.fn()
  const onToggle = vi.fn()
  render(
    <ComponentTreePanel
      tree={tree}
      collapsed={new Set()}
      onSelect={onSelect}
      onHover={vi.fn()}
      onToggle={onToggle}
      storybookLinks={storybookLinks}
      {...overrides}
    />
  )
  return { onSelect, onToggle }
}

describe('ComponentTreePanel', () => {
  it('lists the components of the screen', () => {
    renderPanel()
    const list = screen.getByRole('list', { name: 'Components' })

    expect(within(list).getByRole('button', { name: 'Card' })).toBeInTheDocument()
    expect(within(list).getByRole('button', { name: 'CardContent' })).toBeInTheDocument()
  })

  it('shows the semantic id beside the component that carries it', () => {
    renderPanel()

    expect(screen.getByRole('button', { name: 'Button #book-follow-up' })).toBeInTheDocument()
  })

  it('picks the component whose row was clicked', async () => {
    const { onSelect } = renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'CardContent' }))

    expect(onSelect).toHaveBeenCalledWith('0.0')
  })

  it('clears the pick when the picked row is clicked again', async () => {
    const { onSelect } = renderPanel({ selectedPath: '0.0' })

    await userEvent.click(screen.getByRole('button', { name: 'CardContent' }))

    expect(onSelect).toHaveBeenCalledWith(undefined)
  })

  it('marks the picked row', () => {
    renderPanel({ selectedPath: '0.0' })

    expect(screen.getByRole('button', { name: 'CardContent' })).toHaveAttribute('aria-current', 'true')
  })

  it('hides the rows under a collapsed one', () => {
    renderPanel({ collapsed: new Set(['0']) })

    expect(screen.getByRole('button', { name: 'Card' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'CardContent' })).not.toBeInTheDocument()
  })

  it('collapses and opens a row from its chevron', async () => {
    const { onToggle } = renderPanel()

    await userEvent.click(screen.getByRole('button', { name: 'Collapse Card' }))

    expect(onToggle).toHaveBeenCalledWith('0')
  })

  it('links a component to its Storybook page', () => {
    renderPanel()

    expect(screen.getByRole('link', { name: 'Open Card in Storybook' })).toHaveAttribute(
      'href',
      'http://localhost:6006/?path=/story/design-system-composites--card-basic'
    )
  })

  it('links a part of a component to the page for the component', () => {
    renderPanel()

    expect(screen.getByRole('link', { name: 'Open CardContent in Storybook' })).toHaveAttribute(
      'href',
      'http://localhost:6006/?path=/story/design-system-composites--card-basic'
    )
  })

  it('leaves a plain element unlinked, whatever a story is called', () => {
    render(
      <ComponentTreePanel
        tree={treeOf('<header></header>')}
        collapsed={new Set()}
        onSelect={vi.fn()}
        onHover={vi.fn()}
        onToggle={vi.fn()}
        storybookLinks={buildStorybookLinks(
          [{ id: 'x--header', title: 'Provider Portal/Sidebar Parts', name: 'Header', type: 'story' }],
          'http://localhost:6006'
        )}
      />
    )

    expect(screen.getByRole('button', { name: 'header' })).toBeInTheDocument()
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('leaves a row unlinked when Storybook has no page for it', () => {
    renderPanel({ storybookLinks: new Map() })

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('says so when the screen has nothing to show', () => {
    render(
      <ComponentTreePanel
        tree={treeOf('<div class="plain"></div>')}
        collapsed={new Set()}
        onSelect={vi.fn()}
        onHover={vi.fn()}
        onToggle={vi.fn()}
        storybookLinks={new Map()}
      />
    )

    expect(screen.getByText('Nothing to show for this screen.')).toBeInTheDocument()
  })
})
