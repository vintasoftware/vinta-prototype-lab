import { z } from 'zod'
import { DEFAULT_VARIANT } from '../lib/constants'
import { resolveScreen } from '../lib/discovery'
import type { Prototype, PrototypeScreen } from '../types'

const ID = /^[a-z0-9-]+$/
const SLUG = /^[a-z0-9-]+(?:\/[a-z0-9-]+)*$/

const stepSchema = z
  .object({
    // A prototype's slug: its folder path under `prototypes/`, so `billing/refunds` inside a group.
    prototype: z.string().regex(SLUG).optional(),
    screen: z.string().regex(ID),
    variant: z.string().regex(ID).optional(),
    anchor: z.string().min(1).optional(),
    title: z.string().min(1),
    caption: z.string().min(1),
    fixes: z.string().min(1).optional(),
    click: z.string().min(1).optional(),
  })
  .strict()

const tourSchema = z
  .object({
    id: z.string().regex(ID),
    title: z.string().min(1),
    summary: z.string().min(1),
    order: z.number().optional(),
    steps: z.array(stepSchema).min(1),
  })
  .strict()

/** One step as written in a tour file. */
export type TourStepFile = z.infer<typeof stepSchema>

/** A step with its defaults filled in: the prototype and the variant are always named. */
export interface TourStep extends Omit<TourStepFile, 'prototype' | 'variant'> {
  prototype: string
  variant: string
}

export interface Tour {
  id: string
  title: string
  summary: string
  order?: number
  /**
   * Slug of the prototype whose `tours/` folder holds the file. Steps that name no prototype stay in
   * it. Empty for a tour in `prototypes/tours/`, whose steps must each name their prototype.
   */
  home: string
  steps: TourStep[]
}

/** `prototypes/<slug>/tours/<id>.json`, or `prototypes/tours/<id>.json` for a tour across prototypes. */
const FOLDER = /(?:^|\/)prototypes\/(?:(.+)\/)?tours\/([^/]+)\.json$/

/**
 * Reads the tour files into tours. A file that does not parse is reported, never thrown, so one
 * half-written tour does not take the others down with it.
 */
export function buildTours(files: Record<string, unknown>): { tours: Tour[]; issues: string[] } {
  const tours: Tour[] = []
  const issues: string[] = []

  for (const [path, raw] of Object.entries(files)) {
    const match = FOLDER.exec(path)
    if (match === null) {
      continue
    }
    const [, home = '', fileId = ''] = match
    const where = `${home === '' ? '' : `${home}/`}tours/${fileId}.json`
    const parsed = tourSchema.safeParse(raw)
    if (!parsed.success) {
      issues.push(
        `${where}: ${parsed.error.issues.map(issue => `${issue.path.join('.')} ${issue.message}`).join('; ')}`
      )
      continue
    }
    if (parsed.data.id !== fileId) {
      issues.push(`${where}: id "${parsed.data.id}" does not match the file name.`)
    }
    const orphan = parsed.data.steps.findIndex(step => step.prototype === undefined)
    if (home === '' && orphan !== -1) {
      issues.push(
        `${where}: step ${orphan + 1} names no prototype. A tour outside a prototype folder names one on every step.`
      )
      continue
    }
    tours.push({
      ...parsed.data,
      home,
      steps: parsed.data.steps.map(step => ({
        ...step,
        prototype: step.prototype ?? home,
        variant: step.variant ?? DEFAULT_VARIANT,
      })),
    })
  }

  tours.sort((a, b) => (a.order ?? Number.POSITIVE_INFINITY) - (b.order ?? Number.POSITIVE_INFINITY))
  return { tours, issues }
}

/**
 * The screen a step opens, exactly as named. A step whose screen or state is missing resolves to
 * nothing, so the player can say so instead of showing a different state.
 */
export function screenForStep(prototypes: readonly Prototype[], step: TourStep): PrototypeScreen | undefined {
  const prototype = prototypes.find(candidate => candidate.slug === step.prototype)
  if (prototype === undefined) {
    return undefined
  }
  const screen = resolveScreen(prototype, { screenId: step.screen, variant: step.variant })
  return screen !== undefined && screen.id === step.screen && screen.variant === step.variant ? screen : undefined
}

/** How long a step stays up at 1x: about 2.5 s plus a quarter second per word, never under 4 s. */
export function readingTimeMs(step: Pick<TourStep, 'title' | 'caption' | 'fixes'>): number {
  const text = [step.title, step.caption, step.fixes ?? ''].join(' ')
  const words = text.split(/\s+/).filter(word => word !== '').length
  return Math.max(4000, 2500 + 250 * words)
}

/** Total length of a tour at 1x, for the picker. */
export function tourLengthMs(tour: Tour): number {
  return tour.steps.reduce((total, step) => total + readingTimeMs(step), 0)
}

/** `#/tour/<id>/<step>`, step counted from 1. Anything else reads as the picker. */
export function parseTourHash(hash: string): { tourId: string; step: number } | undefined {
  const match = /^#?\/?tour\/([a-z0-9-]+)(?:\/(\d+))?\/?$/.exec(hash)
  if (match === null) {
    return undefined
  }
  const step = match[2] === undefined ? 1 : Number(match[2])
  return { tourId: match[1] ?? '', step: Math.max(1, step) }
}

export function formatTourHash(tourId: string, stepIndex: number): string {
  return `#/tour/${tourId}/${stepIndex + 1}`
}
