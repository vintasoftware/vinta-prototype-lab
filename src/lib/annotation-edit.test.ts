// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { Annotation } from '../types'
import { annotationId, applyAnnotationEdit, serializeAnnotations } from './annotation-edit'

function note(id: string, title = id): Annotation {
  return { id, target: 'book-follow-up', kind: 'spec', title, status: 'open' }
}

const NOTES = [note('one'), note('two')]

describe('applyAnnotationEdit', () => {
  it('adds a note the file does not have yet', () => {
    const after = applyAnnotationEdit(NOTES, { op: 'save', note: note('three') })

    expect(after.map(item => item.id)).toEqual(['one', 'two', 'three'])
  })

  it('replaces a note in place, so its position in the file does not move', () => {
    const after = applyAnnotationEdit(NOTES, { op: 'save', note: note('one', 'A better title') })

    expect(after.map(item => item.id)).toEqual(['one', 'two'])
    expect(after[0]?.title).toBe('A better title')
  })

  it('removes the note it names', () => {
    expect(applyAnnotationEdit(NOTES, { op: 'delete', id: 'one' }).map(item => item.id)).toEqual(['two'])
  })

  it('leaves the notes it does not name alone, so a hand edit beside it survives', () => {
    const after = applyAnnotationEdit(NOTES, { op: 'save', note: note('one', 'Changed') })

    expect(after[1]).toBe(NOTES[1])
  })

  it('reads a delete of a note that is already gone as nothing to do', () => {
    expect(applyAnnotationEdit(NOTES, { op: 'delete', id: 'missing' })).toEqual(NOTES)
  })
})

describe('serializeAnnotations', () => {
  it('writes the fields in one order and leaves out the ones a note does not set', () => {
    const written = serializeAnnotations([
      { id: 'n1', target: 'book', kind: 'flow', title: 'Why', screen: 'home', status: 'open' },
    ])

    expect(written).toBe(`{
  "notes": [
    {
      "id": "n1",
      "screen": "home",
      "target": "book",
      "kind": "flow",
      "title": "Why",
      "status": "open"
    }
  ]
}
`)
  })

  it('ends on a newline, the way a hand-written file does', () => {
    expect(serializeAnnotations([]).endsWith('}\n')).toBe(true)
  })
})

describe('annotationId', () => {
  it('takes the id from the title, so it stays quotable in review', () => {
    expect(annotationId('One filled button per screen', [])).toBe('one-filled-button-per-screen')
  })

  it('numbers an id a note already holds', () => {
    expect(annotationId('Same title', ['same-title'])).toBe('same-title-2')
    expect(annotationId('Same title', ['same-title', 'same-title-2'])).toBe('same-title-3')
  })

  it('takes whole words, so a long title never ends an id mid-word', () => {
    const id = annotationId('Refills need a pharmacy on file before this button opens anything', [])

    expect(id).toBe('refills-need-a-pharmacy-on-file-before')
    expect(id.length).toBeLessThanOrEqual(40)
  })

  it('falls back to a name for a title that is all punctuation', () => {
    expect(annotationId('!!!', [])).toBe('note')
  })
})
