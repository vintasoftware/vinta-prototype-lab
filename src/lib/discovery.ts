import type { Prototype, PrototypeDoc, PrototypeScreen, ScreenModule } from '../types'
import { parseAnnotationsFile } from './annotations'
import { DEFAULT_VARIANT } from './constants'
import { parseFrontmatter } from './frontmatter'
import { buildScreenMeta, titleize } from './screen-id'
import type { ScreenAddress } from './session'

/** The three file kinds a prototype folder holds, keyed by path. */
export interface PrototypeSources {
  docs: Record<string, string>
  annotations: Record<string, unknown>
  screens: Record<string, ScreenModule>
}

/** Where a path enters the prototypes folder. */
const PROTOTYPES_ROOT = /(?:^|\/)prototypes\//

/** What sits directly in a prototype folder: its doc, its notes, or a screen under `screens/`. */
const PROTOTYPE_FILE = /^(.+?)\/(?:prototype\.md|annotations\.json|screens\/[^/]+)$/

/**
 * The folder a file belongs to, as a path under `prototypes/` such as `billing/refunds`. That path
 * is the prototype's slug; the folders above the last one are its groups.
 */
function slugOf(path: string): string | undefined {
  const match = PROTOTYPES_ROOT.exec(path)
  if (match === null) {
    return undefined
  }
  const folder = PROTOTYPE_FILE.exec(path.slice(match.index + match[0].length))?.[1]
  // A screen's own `screens/` folder never names a prototype, however deep a glob reached into it.
  return folder === undefined || folder.split('/').includes('screens') ? undefined : folder
}

function fileNameOf(path: string): string {
  return path.slice(path.lastIndexOf('/') + 1)
}

function buildDoc(slug: string, raw: string | undefined): PrototypeDoc {
  const fallbackTitle = titleize(fileNameOf(slug))
  if (raw === undefined) {
    return { title: fallbackTitle, body: '' }
  }

  const { data, body } = parseFrontmatter(raw)

  return {
    title: data.title ?? fallbackTitle,
    summary: data.summary,
    entry: data.entry,
    status: data.status,
    owner: data.owner,
    updated: data.updated,
    body,
  }
}

function buildScreens(slug: string, sources: PrototypeSources, issues: string[]): PrototypeScreen[] {
  const screens: PrototypeScreen[] = []
  const seen = new Map<string, string>()

  for (const [path, module] of Object.entries(sources.screens)) {
    if (slugOf(path) !== slug) {
      continue
    }

    const fileName = fileNameOf(path)
    if (typeof module.default !== 'function') {
      issues.push(
        `${fileName}: no default export, so there is nothing to render. Export the screen component as default.`
      )
      continue
    }

    const meta = buildScreenMeta(fileName, module.screen)
    const key = `${meta.id}:${meta.variant}`
    const previous = seen.get(key)
    if (previous !== undefined) {
      issues.push(`${fileName}: screen "${meta.id}" variant "${meta.variant}" is already defined by ${previous}.`)
      continue
    }
    seen.set(key, fileName)

    screens.push({ ...meta, Component: module.default, source: path })
  }

  return screens.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id) || a.variant.localeCompare(b.variant))
}

/**
 * Turns the raw file maps into the prototypes the viewer renders.
 *
 * A prototype is any folder under `prototypes/` holding `prototype.md`, `annotations.json` or
 * `screens/`. A folder holding none of them is a group, so `prototypes/billing/refunds/` is the
 * prototype `billing/refunds` in the group `billing`.
 *
 * Every problem lands in `issues` rather than throwing: a designer with a half-written prototype
 * still gets a running viewer, with the list of what is wrong next to it.
 */
export function buildPrototypes(sources: PrototypeSources): Prototype[] {
  const slugs = new Set<string>()
  for (const path of [
    ...Object.keys(sources.docs),
    ...Object.keys(sources.screens),
    ...Object.keys(sources.annotations),
  ]) {
    const slug = slugOf(path)
    if (slug !== undefined) {
      slugs.add(slug)
    }
  }

  const prototypes: Prototype[] = []

  for (const slug of [...slugs].sort()) {
    const issues: string[] = []

    // The two never share files, so both still run; the folders just no longer say which is a group.
    const outer = [...slugs].find(other => slug.startsWith(`${other}/`))
    if (outer !== undefined) {
      issues.push(
        `this folder sits inside the prototype "${outer}". Move it out, or put both in a group folder that holds no prototype.md, annotations.json or screens/.`
      )
    }

    const docEntry = Object.entries(sources.docs).find(([path]) => slugOf(path) === slug)
    if (docEntry === undefined) {
      issues.push('prototype.md is missing, so this prototype has no documentation.')
    }
    const doc = buildDoc(slug, docEntry?.[1])

    const screens = buildScreens(slug, sources, issues)
    if (screens.length === 0) {
      issues.push('screens/ holds no screen, so there is nothing to click through.')
    }

    const annotationEntry = Object.entries(sources.annotations).find(([path]) => slugOf(path) === slug)
    const parsed =
      annotationEntry === undefined
        ? { annotations: [], issues: [] }
        : parseAnnotationsFile(annotationEntry[1], fileNameOf(annotationEntry[0]))
    issues.push(...parsed.issues)

    const screenIds = new Set(screens.map(screen => screen.id))
    for (const note of parsed.annotations) {
      if (note.screen !== undefined && !screenIds.has(note.screen)) {
        issues.push(`annotations.json: note "${note.id}" points at screen "${note.screen}", which does not exist.`)
      }
    }

    if (doc.entry !== undefined && !screenIds.has(doc.entry)) {
      issues.push(`prototype.md: entry "${doc.entry}" is not one of the screens.`)
    }

    const group = slug.split('/').slice(0, -1)
    prototypes.push({ slug, group, doc, screens, annotations: parsed.annotations, issues })
  }

  return prototypes
}

/** Screen the prototype opens on: the one the doc names, or the first in the list. */
export function entryScreenId(prototype: Prototype): string | undefined {
  const ids = prototype.screens.map(screen => screen.id)
  if (prototype.doc.entry !== undefined && ids.includes(prototype.doc.entry)) {
    return prototype.doc.entry
  }
  return ids[0]
}

/** Every variant of one screen, in list order. */
export function variantsOf(prototype: Prototype, screenId: string): PrototypeScreen[] {
  return prototype.screens.filter(screen => screen.id === screenId)
}

/** One entry per screen id, keeping the first variant as the representative. */
export function distinctScreens(prototype: Prototype): PrototypeScreen[] {
  const seen = new Set<string>()
  return prototype.screens.filter(screen => {
    if (seen.has(screen.id)) {
      return false
    }
    seen.add(screen.id)
    return true
  })
}

/**
 * The screen to render for an address. A link may name a screen whose only state is a variant, so
 * the default state is a preference rather than a requirement.
 */
export function resolveScreen(prototype: Prototype, address: ScreenAddress): PrototypeScreen | undefined {
  const ofScreen = prototype.screens.filter(screen => screen.id === address.screenId)
  return (
    ofScreen.find(screen => screen.variant === address.variant) ??
    ofScreen.find(screen => screen.variant === DEFAULT_VARIANT) ??
    ofScreen[0]
  )
}
