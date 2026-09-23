import { z } from 'zod'
import type { Annotation } from '../types'

/**
 * Schema for `annotations.json`. Designers hand-write the file, so a mistake in it has to read as a
 * message in the viewer's problem list rather than a blank screen — {@link parseAnnotationsFile}
 * returns the errors instead of throwing.
 */
/** One note, as it is written in the file and as the viewer sends it. */
export const annotationSchema = z.object({
  id: z.string().min(1),
  target: z.string().min(1),
  screen: z.string().min(1).optional(),
  kind: z.enum(['spec', 'flow', 'question', 'todo']).default('spec'),
  title: z.string().min(1),
  body: z.string().optional(),
  author: z.string().optional(),
  status: z.enum(['open', 'resolved']).default('open'),
})

const annotationsFileSchema = z.object({
  notes: z.array(annotationSchema).default([]),
})

export interface ParsedAnnotations {
  annotations: Annotation[]
  issues: string[]
}

export function parseAnnotationsFile(raw: unknown, source: string): ParsedAnnotations {
  const result = annotationsFileSchema.safeParse(raw)

  if (!result.success) {
    return {
      annotations: [],
      issues: result.error.issues.map(issue => `${source}: ${issue.path.join('.') || 'file'} — ${issue.message}`),
    }
  }

  const seen = new Set<string>()
  const issues: string[] = []
  const annotations: Annotation[] = []

  for (const note of result.data.notes) {
    if (seen.has(note.id)) {
      issues.push(`${source}: two notes share the id "${note.id}"; the second one is ignored`)
      continue
    }
    seen.add(note.id)
    annotations.push(note)
  }

  return { annotations, issues }
}

/**
 * Notes shown on one screen: the ones pinned to it, plus the ones that named no screen and so
 * apply wherever their target is rendered.
 */
export function annotationsForScreen(annotations: readonly Annotation[], screenId: string): Annotation[] {
  return annotations.filter(note => note.screen === undefined || note.screen === screenId)
}
