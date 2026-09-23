import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { Anchor, anchor } from './anchor'

describe('anchor', () => {
  it('names an element so a comment can point at it', () => {
    render(
      <button type='button' {...anchor('book-follow-up')}>
        Book a visit
      </button>
    )

    expect(screen.getByRole('button')).toHaveAttribute('data-proto-id', 'book-follow-up')
  })
})

describe('Anchor', () => {
  it('names what it wraps without taking a box of its own', () => {
    render(<Anchor id='task-count'>2 tasks</Anchor>)

    const wrapper = screen.getByText('2 tasks')

    expect(wrapper).toHaveAttribute('data-proto-id', 'task-count')
    expect(wrapper).toHaveClass('contents')
  })
})
