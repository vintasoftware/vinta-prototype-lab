import { z } from 'zod'
import type { CanvasFile, ScreenViewport } from '../types'
import type { Point } from './flow-graph'

/** The version of `canvas.json` this viewer writes and reads. */
export const CANVAS_FILE_VERSION = 1

const viewportSchema = z.enum(['mobile', 'tablet', 'desktop'])

/** Schema for `canvas.json`, as the viewer writes it and a person may edit it. */
export const canvasFileSchema = z.object({
  version: z.literal(CANVAS_FILE_VERSION),
  sections: z
    .array(z.object({ screen: z.string().min(1), x: z.number().finite(), y: z.number().finite() }))
    .default([]),
  viewports: z.array(viewportSchema).max(2).optional(),
})

export interface ParsedCanvasFile {
  canvas?: CanvasFile
  issues: string[]
}

/**
 * Reads a prototype's `canvas.json`. Like the notes file, a mistake in it reads as a line in the
 * problem list rather than a broken viewer, and the canvas falls back to its own layout.
 *
 * A section for a screen that no longer exists is dropped with a line saying so: the screen was
 * renamed or removed, and the next arrangement saved writes the file without it.
 */
export function parseCanvasFile(raw: unknown, source: string, screenIds: ReadonlySet<string>): ParsedCanvasFile {
  const result = canvasFileSchema.safeParse(raw)
  if (!result.success) {
    return {
      issues: result.error.issues.map(
        issue => `${source}: ${issue.path.join('.') || 'file'} ${issue.message}; the canvas uses its own layout.`
      ),
    }
  }

  const issues: string[] = []
  const seen = new Set<string>()
  const sections: CanvasFile['sections'] = []
  for (const section of result.data.sections) {
    if (!screenIds.has(section.screen)) {
      issues.push(`${source}: section "${section.screen}" is for a screen that does not exist, so it was dropped.`)
      continue
    }
    if (seen.has(section.screen)) {
      issues.push(`${source}: screen "${section.screen}" is placed twice; the second place is ignored.`)
      continue
    }
    seen.add(section.screen)
    sections.push(section)
  }

  return {
    canvas: {
      version: CANVAS_FILE_VERSION,
      sections,
      ...(result.data.viewports === undefined ? {} : { viewports: result.data.viewports }),
    },
    issues,
  }
}

/** Where the file puts each section, by screen id. */
export function savedPositions(canvas: CanvasFile | undefined): Map<string, Point> {
  return new Map((canvas?.sections ?? []).map(section => [section.screen, { x: section.x, y: section.y }]))
}

/**
 * The file after sections were moved: every section in `positions`, in whole pixels, in the order
 * given, and the viewports kept as they were.
 */
export function arrangedCanvas(
  canvas: CanvasFile | undefined,
  positions: ReadonlyArray<{ screen: string } & Point>
): CanvasFile {
  return {
    version: CANVAS_FILE_VERSION,
    sections: positions.map(({ screen, x, y }) => ({ screen, x: Math.round(x), y: Math.round(y) })),
    ...(canvas?.viewports === undefined ? {} : { viewports: canvas.viewports }),
  }
}

/** The file with the layout reset: no section placed, the viewports kept. */
export function resetCanvas(canvas: CanvasFile | undefined): CanvasFile {
  return arrangedCanvas(canvas, [])
}

/** The file with other viewports, the sections kept. */
export function withViewports(canvas: CanvasFile | undefined, viewports: readonly ScreenViewport[]): CanvasFile {
  return { version: CANVAS_FILE_VERSION, sections: canvas?.sections ?? [], viewports: [...viewports] }
}

/** How the file is written: two-space JSON and a final newline, so a hand edit and a save diff cleanly. */
export function serializeCanvasFile(canvas: CanvasFile): string {
  return `${JSON.stringify(canvas, null, 2)}\n`
}
