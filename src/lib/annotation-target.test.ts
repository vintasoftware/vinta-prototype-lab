import { describe, expect, it } from 'vitest'
import { resolveAnnotationTarget } from './annotation-target'
import { buildComponentTree } from './component-tree'

function screen(markup: string) {
  const frame = document.createElement('div')
  frame.innerHTML = markup
  return { frame, tree: buildComponentTree(frame) }
}

const { frame, tree } = screen(`
  <div data-slot="card" data-proto-id="follow-up-card">
    <div data-slot="card-content">
      <button data-slot="button" data-proto-id="book-follow-up">Book a visit</button>
    </div>
  </div>
  <div data-slot="card">
    <div data-slot="card-content"><button data-slot="button">View medication</button></div>
  </div>
`)

describe('resolveAnnotationTarget', () => {
  it('finds the element a semantic id names', () => {
    expect(resolveAnnotationTarget(frame, tree, 'book-follow-up')?.textContent).toBe('Book a visit')
  })

  it('finds an element that carries no id, by the name of its place in the tree', () => {
    expect(resolveAnnotationTarget(frame, tree, '/Card~1/CardContent/Button')?.textContent).toBe('View medication')
  })

  it('prefers the id, which is the promise the screen keeps', () => {
    const named = resolveAnnotationTarget(frame, tree, 'follow-up-card')

    expect(named?.getAttribute('data-proto-id')).toBe('follow-up-card')
  })

  it('finds nothing for a target the screen does not have', () => {
    expect(resolveAnnotationTarget(frame, tree, 'confirm-booking')).toBeUndefined()
    expect(resolveAnnotationTarget(frame, tree, '/Card~9/CardContent')).toBeUndefined()
  })

  it('takes a target that would otherwise break the search it is put into', () => {
    expect(resolveAnnotationTarget(frame, tree, 'a"]')).toBeUndefined()
  })
})
