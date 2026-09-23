import { readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import type { Connect, Plugin, ViteDevServer } from 'vite'
import { z } from 'zod'
import { type AnnotationEdit, applyAnnotationEdit, serializeAnnotations } from '../lib/annotation-edit'
import { annotationSchema, parseAnnotationsFile } from '../lib/annotations'
import { ANNOTATIONS_ENDPOINT, NAME_ELEMENT_ENDPOINT, parseSourceRef } from '../lib/source-ref'
import type { Annotation } from '../types'
import { addAnchor } from './add-anchor'
import { isScreenFile } from './stamp-jsx-source'

/** A folder name and nothing else, so a slug can never climb out of `prototypes/`. */
const SLUG = /^[a-z0-9][a-z0-9-]*$/

const annotationEditSchema = z.discriminatedUnion('op', [
  z.object({ op: z.literal('save'), note: annotationSchema }),
  z.object({ op: z.literal('delete'), id: z.string().min(1) }),
])

const annotationsRequestSchema = z.object({ slug: z.string().min(1), edit: annotationEditSchema })

export interface AnnotationsRequest {
  slug: string
  edit: AnnotationEdit
}

/** Asks for an element in a screen to be given a semantic id. */
const nameElementRequestSchema = z.object({ source: z.string().min(1), id: z.string().min(1) })

export interface NameElementRequest {
  /** Where the element was written, as the stamp on it says. */
  source: string
  id: string
}

export interface EditResult {
  status: number
  body: { notes: Annotation[] } | { error: string }
}

/** What naming an element answers with: it writes a screen, not the notes file. */
export interface NameResult {
  status: number
  body: { named: string } | { error: string }
}

/** The file a slug names, or undefined when the slug is not a plain folder name. */
export function annotationsPathFor(prototypesDir: string, slug: string): string | undefined {
  if (!SLUG.test(slug)) {
    return undefined
  }
  const file = path.join(prototypesDir, slug, 'annotations.json')
  const inside = path.relative(prototypesDir, file)
  return inside.startsWith('..') || path.isAbsolute(inside) ? undefined : file
}

/** The notes already in the file, or why they could not be read. */
type NotesOnDisk = { notes: Annotation[] } | { error: string }

/**
 * Reads the notes a prototype already has.
 *
 * A file that is not there yet is an empty one — the first comment creates it. A file that is
 * there but cannot be read is not: writing over it would drop every note in it, so the read fails
 * and the caller writes nothing.
 */
async function readNotes(file: string): Promise<NotesOnDisk> {
  const name = path.basename(file)
  let raw: string

  try {
    raw = await readFile(file, 'utf8')
  } catch (thrown) {
    if ((thrown as NodeJS.ErrnoException).code === 'ENOENT') {
      return { notes: [] }
    }
    return { error: `${name} could not be read, so nothing was written.` }
  }

  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { error: `${name} is not valid JSON, so nothing was written.` }
  }

  const { annotations, issues } = parseAnnotationsFile(parsed, name)
  if (issues.length > 0) {
    return { error: `${issues.join(' ')} Fix the file and try again; nothing was written.` }
  }
  return { notes: annotations }
}

/**
 * Applies one edit to a prototype's notes file.
 *
 * The file on disk is read again here rather than taken from the viewer, so a note the viewer never
 * saw — hand-written, or added by someone else since the page loaded — is kept.
 */
export async function editAnnotations(prototypesDir: string, request: AnnotationsRequest): Promise<EditResult> {
  const file = annotationsPathFor(prototypesDir, request.slug)
  if (file === undefined) {
    return { status: 400, body: { error: `"${request.slug}" is not a prototype folder name.` } }
  }

  const onDisk = await readNotes(file)
  if ('error' in onDisk) {
    return { status: 409, body: { error: onDisk.error } }
  }

  const notes = applyAnnotationEdit(onDisk.notes, request.edit)
  await writeFile(file, serializeAnnotations(notes), 'utf8')

  return { status: 200, body: { notes } }
}

/**
 * Drops a written file from the server's cache.
 *
 * The notes files are out of the watcher, so nothing else tells the server they changed. Without
 * this the next full page load — the one a screen edit causes — would be served the notes as they
 * were when the page first opened.
 */
function forget(server: ViteDevServer, file: string): void {
  for (const mod of server.moduleGraph.getModulesByFile(file) ?? []) {
    server.moduleGraph.invalidateModule(mod)
  }
}

/**
 * Whether the request came from the viewer itself.
 *
 * These endpoints write to the repository, and a POST of `text/plain` is dispatched by a browser
 * without asking this server first — so any page open beside the viewer could otherwise reach them.
 * A request must carry JSON, and must come either from one of the addresses this server serves
 * itself on — `--host` included — or from a tool that sends no origin at all.
 */
export function fromTheViewer(
  headers: { 'content-type'?: string | undefined; origin?: string | undefined },
  served: readonly string[]
): boolean {
  if (!(headers['content-type'] ?? '').startsWith('application/json')) {
    return false
  }
  if (headers.origin === undefined) {
    return true
  }
  return served.some(url => new URL(url).origin === headers.origin)
}

/** Every address this dev server serves itself on, `--host` included. */
export function servedBy(server: Pick<ViteDevServer, 'resolvedUrls'>): string[] {
  return [...(server.resolvedUrls?.local ?? []), ...(server.resolvedUrls?.network ?? [])]
}

async function readBody(request: Connect.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(chunk as Buffer)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Lets the viewer write a prototype's comments while `vite dev` is running.
 *
 * Comments stay in `annotations.json`, in the same shape a designer hand-writes, so they are
 * reviewed in the pull request with everything else. A built copy of the viewer has no server
 * behind it and stays read-only.
 */
export function annotationsWriter(options: { prototypesDir: string; root: string }): Plugin {
  return {
    name: 'prototype-lab:annotations-writer',
    apply: 'serve',
    configureServer(server) {
      const serve = <T>(
        endpoint: string,
        schema: z.ZodType<T>,
        run: (payload: T) => Promise<{ status: number; body: unknown }>
      ) => {
        server.middlewares.use(endpoint, (request, response, next) => {
          if (request.method !== 'POST') {
            next()
            return
          }

          void (async () => {
            const send = (status: number, body: unknown) => {
              response.statusCode = status
              response.setHeader('Content-Type', 'application/json')
              response.end(JSON.stringify(body))
            }

            if (!fromTheViewer(request.headers, servedBy(server))) {
              send(403, { error: 'Only the viewer this dev server is serving may write.' })
              return
            }

            try {
              const payload = schema.safeParse(await readBody(request))
              if (!payload.success) {
                send(400, { error: 'That request is not one this endpoint takes.' })
                return
              }
              const { status, body } = await run(payload.data)
              send(status, body)
            } catch (thrown) {
              // The detail can name a path on this machine, so it stays in the server's own log.
              const detail = thrown instanceof Error ? thrown.stack : String(thrown)
              server.config.logger.error(`${endpoint}: ${detail}`)
              send(400, { error: 'That request could not be carried out. The dev server log says why.' })
            }
          })()
        })
      }

      serve(ANNOTATIONS_ENDPOINT, annotationsRequestSchema, async payload => {
        const result = await editAnnotations(options.prototypesDir, payload)
        const file = annotationsPathFor(options.prototypesDir, payload.slug)
        if (result.status === 200 && file !== undefined) {
          forget(server, file)
        }
        return result
      })
      serve(NAME_ELEMENT_ENDPOINT, nameElementRequestSchema, payload => nameElement(options.root, payload))
    },
  }
}

/**
 * Writes a semantic id onto an element of a screen.
 *
 * Only a file under a prototype's `screens/` is ever opened, and the position comes from the stamp
 * the dev server itself put on the element, so the edit lands where the element was written.
 */
export async function nameElement(root: string, request: NameElementRequest): Promise<NameResult> {
  const ref = parseSourceRef(request.source)
  if (ref === undefined) {
    return { status: 400, body: { error: 'That element carries no source to write to.' } }
  }

  const file = path.resolve(root, ref.file)
  if (!isScreenFile(file) || path.relative(root, file).startsWith('..')) {
    return { status: 400, body: { error: 'Only a screen of a prototype can be edited.' } }
  }

  const before = await readFile(file, 'utf8')
  const { source, skipped } = addAnchor(before, ref.line, ref.column, request.id, ref.tag)

  if (skipped !== undefined) {
    return { status: 409, body: { error: skipped } }
  }

  await writeFile(file, source, 'utf8')
  return { status: 200, body: { named: request.id } }
}
