import type { Annotation } from '../types'

/** What the viewer asks the dev server to do to one note. */
export type AnnotationEdit = { op: 'save'; note: Annotation } | { op: 'delete'; id: string }

/** Order the fields are written in, so a note's lines stay put and diffs read as what changed. */
const FIELD_ORDER = ['id', 'screen', 'target', 'kind', 'title', 'body', 'author', 'status'] as const

/**
 * A note as the file has it: the fields a designer wrote, in their order, and nothing filled in.
 * The file has been checked against the schema before one of these is used.
 */
export type WrittenNote = Readonly<Record<string, unknown>> & { readonly id?: unknown }

/** An edit to a list of notes of either kind: the parsed ones or the ones as written. */
type NoteEdit<Note> = { op: 'save'; note: Note } | { op: 'delete'; id: string }

/**
 * Applies one edit to the notes already in the file.
 *
 * The edit names a single note, and the notes it does not name are returned untouched, so a hand
 * edit or another designer's note survives a save from here.
 */
export function applyAnnotationEdit<Note extends { readonly id?: unknown }>(
  notes: readonly Note[],
  edit: NoteEdit<Note>
): Note[] {
  if (edit.op === 'delete') {
    return notes.filter(note => note.id !== edit.id)
  }

  const known = notes.some(note => note.id === edit.note.id)
  return known ? notes.map(note => (note.id === edit.note.id ? edit.note : note)) : [...notes, edit.note]
}

/**
 * The file after one edit, as it is written back.
 *
 * Only the note the edit names changes. Every other note is written back as the file had it, so
 * one new comment reads in review as one new note rather than a change to every note: a default
 * the schema fills in, such as `status`, is not added to a note that left it out. Anything else in
 * the file beside `notes` is kept too.
 */
export function serializeAnnotationEdit(
  file: Readonly<Record<string, unknown>>,
  written: readonly WrittenNote[],
  edit: AnnotationEdit
): string {
  const notes = applyAnnotationEdit<WrittenNote>(
    written,
    edit.op === 'save' ? { op: 'save', note: orderFields(edit.note) } : edit
  )
  return `${JSON.stringify({ ...file, notes }, null, 2)}\n`
}

/** One note with its fields in a fixed order, and the ones it does not set left out. */
function orderFields(note: Annotation): Record<string, unknown> {
  const ordered: Record<string, unknown> = {}
  for (const field of FIELD_ORDER) {
    const value = note[field]
    if (value !== undefined) {
      ordered[field] = value
    }
  }
  return ordered
}

/**
 * An id for a new note, taken from its title so it stays quotable in review, with a number added
 * when the title is one already used.
 */
export function annotationId(title: string, taken: readonly string[]): string {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .split('-')
    .filter(word => word !== '')

  // Words are taken whole, so an id never ends mid-word.
  let base = ''
  for (const word of words) {
    const next = base === '' ? word : `${base}-${word}`
    if (next.length > 40) {
      break
    }
    base = next
  }
  base = base === '' ? 'note' : base

  if (!taken.includes(base)) {
    return base
  }
  let suffix = 2
  while (taken.includes(`${base}-${suffix}`)) {
    suffix += 1
  }
  return `${base}-${suffix}`
}
