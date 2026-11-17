import type { Annotation, CanvasFile } from '../types'
import type { AnnotationEdit } from './annotation-edit'
import { isDevServer } from './runtime'
import { ANNOTATIONS_ENDPOINT, CANVAS_ENDPOINT, NAME_ELEMENT_ENDPOINT, SNIPPET_ENDPOINT } from './source-ref'

/**
 * Whether comments can be written from here.
 *
 * Writing needs the dev server behind the viewer. A built copy handed to someone — the output of
 * `prototype-lab build` — has no server, so it reads comments and does not offer to change them.
 */
export function canEditAnnotations(): boolean {
  return isDevServer()
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

/**
 * Writes the canvas arrangement to the prototype's `canvas.json`. Like comments, it needs the dev
 * server: a built copy shows the arrangement it was built with and does not offer to change it.
 */
export async function saveCanvas(slug: string, canvas: CanvasFile): Promise<void> {
  const response = await fetch(CANVAS_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, canvas }),
  })

  if (!response.ok) {
    const payload = (await response.json()) as { error?: string }
    throw new Error(payload.error ?? `The dev server answered ${response.status}.`)
  }
}

/** The JSX an element was written as, read from its screen file by the dev server. */
export async function fetchSnippet(source: string): Promise<string> {
  const response = await fetch(SNIPPET_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ source }),
  })
  const payload = (await response.json()) as { snippet?: string; error?: string }
  if (!response.ok || payload.snippet === undefined) {
    throw new Error(payload.error ?? `The dev server answered ${response.status}.`)
  }
  return payload.snippet
}
