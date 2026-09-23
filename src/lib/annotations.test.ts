// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { annotationsForScreen, parseAnnotationsFile } from './annotations'

describe('parseAnnotationsFile', () => {
  it('reads notes and fills the defaults a designer left out', () => {
    const { annotations, issues } = parseAnnotationsFile(
      { notes: [{ id: 'n1', target: 'book-follow-up', title: 'One filled button per screen' }] },
      'annotations.json'
    )

    expect(issues).toEqual([])
    expect(annotations).toEqual([
      { id: 'n1', target: 'book-follow-up', title: 'One filled button per screen', kind: 'spec', status: 'open' },
    ])
  })

  it('reports the field that is wrong instead of throwing', () => {
    const { annotations, issues } = parseAnnotationsFile(
      { notes: [{ id: 'n1', target: 'x', title: 'A note', kind: 'idea' }] },
      'annotations.json'
    )

    expect(annotations).toEqual([])
    expect(issues).toHaveLength(1)
    expect(issues[0]).toContain('notes.0.kind')
  })

  it('keeps the first of two notes that share an id and says so', () => {
    const { annotations, issues } = parseAnnotationsFile(
      {
        notes: [
          { id: 'n1', target: 'a', title: 'First' },
          { id: 'n1', target: 'b', title: 'Second' },
        ],
      },
      'annotations.json'
    )

    expect(annotations.map(note => note.title)).toEqual(['First'])
    expect(issues).toEqual(['annotations.json: two notes share the id "n1"; the second one is ignored'])
  })

  it('reads a file with no notes at all', () => {
    expect(parseAnnotationsFile({}, 'annotations.json')).toEqual({ annotations: [], issues: [] })
  })
})

describe('annotationsForScreen', () => {
  const notes = [
    { id: 'a', target: 't', title: 'On home', kind: 'spec' as const, screen: 'home' },
    { id: 'b', target: 't', title: 'On review', kind: 'spec' as const, screen: 'review' },
    { id: 'c', target: 'nav', title: 'Anywhere', kind: 'spec' as const },
  ]

  it('takes the notes pinned to the screen plus the ones pinned to none', () => {
    expect(annotationsForScreen(notes, 'home').map(note => note.id)).toEqual(['a', 'c'])
  })
})
