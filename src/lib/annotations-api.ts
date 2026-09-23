import type { Annotation } from '../types'
import type { AnnotationEdit } from './annotation-edit'
import { ANNOTATIONS_ENDPOINT, NAME_ELEMENT_ENDPOINT } from './source-ref'

/**
 * Whether comments can be written from here.
 *
 * Writing needs the dev server behind the viewer. A built copy handed to someone — the `dist` from
 * `build:viewer` — has no server, so it reads comments and does not offer to change them.
 */
export function canEditAnnotations(): boolean {
  return import.meta.env.DEV
}

/**
 * Sends one edit and answers with the file as it now stands.
 *
 * The server owns the file and returns every note in it, so the viewer shows what was actually
 * written rather than what it hoped to write.
 */
export async function saveAnnotationEdit(slug: string, edit: AnnotationEdit): Promise<Annotation[]> {
  const response = await fetch(ANNOTATIONS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, edit }),
  })

  const payload = (await response.json()) as { notes?: Annotation[]; error?: string }

  if (!response.ok || payload.notes === undefined) {
    throw new Error(payload.error ?? `The dev server answered ${response.status}.`)
  }
  return payload.notes
}

/**
 * Writes a semantic id onto an element in its screen file, so a comment can point at a name the
 * screen keeps rather than at where the element happens to sit.
 */
export async function nameElement(source: string, id: string): Promise<void> {
  const response = await fetch(NAME_ELEMENT_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source, id }),
  })

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string }
    throw new Error(payload.error ?? `The dev server answered ${response.status}.`)
  }
}
