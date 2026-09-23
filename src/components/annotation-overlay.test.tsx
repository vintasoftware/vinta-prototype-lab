import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { AnchorRect } from '../lib/anchor-rect'
import { AnnotationOverlay, type NumberedAnnotation } from './annotation-overlay'

const rect: AnchorRect = { top: 40, left: 20, width: 200, height: 44 }

const notes: NumberedAnnotation[] = [
  {
    id: 'n1',
    target: 'book-follow-up',
    kind: 'spec',
    title: 'One filled button per screen',
    body: 'Every other card action is ghost.',
    author: 'Ana',
    number: 1,
  },
  { id: 'n2', target: 'task-count', kind: 'question', title: 'Show the count at zero?', number: 2 },
]

describe('AnnotationOverlay', () => {
  it('pins a note to the element it points at', () => {
    render(<AnnotationOverlay notes={notes} rects={new Map([['book-follow-up', rect]])} onSelect={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Note 1: One filled button per screen' })).toBeInTheDocument()
  })

  it('draws nothing for a note whose target is not on the screen', () => {
    render(<AnnotationOverlay notes={notes} rects={new Map([['book-follow-up', rect]])} onSelect={vi.fn()} />)

    expect(screen.queryByRole('button', { name: /Note 2/ })).not.toBeInTheDocument()
  })

  it('selects a note when its pin is clicked', async () => {
    const onSelect = vi.fn()
    render(<AnnotationOverlay notes={notes} rects={new Map([['book-follow-up', rect]])} onSelect={onSelect} />)

    await userEvent.click(screen.getByRole('button', { name: /Note 1/ }))

    expect(onSelect).toHaveBeenCalledWith('n1')
  })

  it('clears the selection when the open note is clicked again', async () => {
    const onSelect = vi.fn()
    render(
      <AnnotationOverlay
        notes={notes}
        rects={new Map([['book-follow-up', rect]])}
        selectedId='n1'
        onSelect={onSelect}
      />
    )

    await userEvent.click(screen.getByRole('button', { name: /Note 1/ }))

    expect(onSelect).toHaveBeenCalledWith(undefined)
  })

  it('shows the note body while it is selected', () => {
    render(
      <AnnotationOverlay notes={notes} rects={new Map([['book-follow-up', rect]])} selectedId='n1' onSelect={vi.fn()} />
    )

    expect(screen.getByText('Every other card action is ghost.')).toBeInTheDocument()
    expect(screen.getByText('— Ana')).toBeInTheDocument()
  })
})
