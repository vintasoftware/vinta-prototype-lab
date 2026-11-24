import type { ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import type { NumberedAnnotation } from '../components/annotation-overlay'
import { ANNOTATION_KIND } from '../lib/annotation-kind'
import { Markdown } from '../lib/markdown'
import { type ShareKind, type SharePageParts, sharePageHtml } from '../lib/share-page'
import { SHARE_ENDPOINT } from '../lib/source-ref'
import {
  cloneForShare,
  collectCss,
  embeddedFontCss,
  inlineImages,
  type PreviewImage,
  previewPng,
} from '../lib/static-snapshot'
import type { Prototype } from '../types'
import { Badge, cn } from '../ui'
import { PrototypeDocPanel } from './side-panel'

/** What the dev server says about uploading, handed to the viewer by the plugin. */
export interface ShareStatus {
  upload: boolean
  /** The environment variables uploading still needs. */
  missing?: string[]
  /** Why the configuration given cannot be used. */
  problem?: string
}

/** The comments on one screen, numbered as their pins are. */
export interface CommentGroup {
  /** The screen's name; left out when the share shows one screen. */
  title?: string
  notes: readonly NumberedAnnotation[]
}

/** A view the Share button can capture: the stage's screen, or the whole canvas. */
export interface ShareView {
  kind: ShareKind
  /** "Review · Empty", or "Canvas". */
  subject: string
  /** The component picked on it, if one is. */
  component?: string
  comments: readonly CommentGroup[]
  /** The element the link preview is drawn from: the screen, or the part of the canvas in view. */
  previewElement: () => HTMLElement | null
  /** Makes everything the share shows drawn, then hands back the element holding it. */
  capture: () => Promise<{ element: HTMLElement; width: number; height: number; release?: () => void }>
}

/** Renders React to a string of HTML, through a root that never reaches the page. */
export function renderStatic(node: ReactNode): string {
  const host = document.createElement('div')
  const root = createRoot(host)
  flushSync(() => root.render(node))
  const html = host.innerHTML
  root.unmount()
  return html
}

/** The comment list of a share: the cards of the Comments tab, without their buttons. */
export function ShareComments({ groups }: { groups: readonly CommentGroup[] }) {
  const shown = groups.filter(group => group.notes.length > 0)
  if (shown.length === 0) {
    return <p className='text-muted-foreground text-sm'>No comments.</p>
  }
  return (
    <div className='space-y-4'>
      {shown.map(group => (
        <section key={group.title ?? ''} className='space-y-2'>
          {group.title !== undefined && <h3 className='font-semibold text-sm'>{group.title}</h3>}
          {group.notes.map(note => {
            const kind = ANNOTATION_KIND[note.kind]
            return (
              <article key={note.id} className='rounded-md border border-border p-3'>
                <div className='flex items-center gap-2'>
                  <span
                    className={cn(
                      'flex size-5 items-center justify-center rounded-full font-semibold text-xs',
                      kind.pin
                    )}
                  >
                    {note.number}
                  </span>
                  <Badge variant='outline'>{kind.label}</Badge>
                  {note.status === 'resolved' && <Badge variant='success'>Resolved</Badge>}
                </div>
                <p className='mt-2 font-medium text-sm'>{note.title}</p>
                {note.body !== undefined && <Markdown source={note.body} className='text-muted-foreground' />}
                <p className='mt-2 font-mono text-muted-foreground text-xs'>{note.target}</p>
                {note.author !== undefined && <p className='text-muted-foreground text-xs'>— {note.author}</p>}
              </article>
            )
          })}
        </section>
      ))}
    </div>
  )
}

function plural(count: number, word: string): string {
  return `${count} ${word}${count === 1 ? '' : 's'}`
}

/** The card's text: the prototype's summary, then what the share holds. */
export function shareDescription(prototype: Prototype, view: Pick<ShareView, 'kind' | 'component'>, comments: number) {
  const holds = [
    view.kind === 'canvas' ? 'Every screen on the canvas' : 'The screen',
    `the documentation and ${plural(comments, 'comment')}`,
  ].join(', ')
  const picked = view.component === undefined ? '' : ` ${view.component} is picked.`
  return `${prototype.doc.summary === undefined ? '' : `${prototype.doc.summary} `}${holds}.${picked}`
}

export function shareTitle(prototype: Prototype, view: Pick<ShareView, 'subject' | 'component'>): string {
  return [prototype.doc.title, view.subject, view.component].filter(part => part !== undefined).join(' · ')
}

export interface CapturedShare {
  parts: SharePageParts
  image?: PreviewImage
}

/**
 * Captures a view as the parts of a share page. The preview is drawn first, from what is on
 * screen; then everything the share shows is drawn and copied.
 */
export async function captureShare(prototype: Prototype, view: ShareView): Promise<CapturedShare> {
  const previewElement = view.previewElement()
  // The preview is a nicety: a share without one still opens, with a plainer card.
  const image = previewElement === null ? undefined : await previewPng(previewElement).catch(() => undefined)

  const captured = await view.capture()
  let stage: HTMLElement
  let fonts: string
  try {
    stage = cloneForShare(captured.element)
    fonts = await embeddedFontCss(captured.element)
  } finally {
    captured.release?.()
  }
  await inlineImages(stage)

  const commentCount = view.comments.reduce((count, group) => count + group.notes.length, 0)
  const parts: SharePageParts = {
    kind: view.kind,
    title: shareTitle(prototype, view),
    description: shareDescription(prototype, view, commentCount),
    prototypeTitle: prototype.doc.title,
    subject: view.subject,
    ...(view.component === undefined ? {} : { component: view.component }),
    sourceUrl: window.location.href,
    stage: stage.outerHTML,
    stageSize: { width: captured.width, height: captured.height },
    doc: renderStatic(<PrototypeDocPanel prototype={prototype} />),
    comments: renderStatic(<ShareComments groups={view.comments} />),
    commentCount,
    css: `${collectCss()}\n${fonts}`,
    sharedAt: new Date().toISOString(),
  }
  return image === undefined ? { parts } : { parts, image }
}

/** `billing/refunds` and "Review · Empty" → `billing-refunds--review-empty.html`. */
export function shareFileName(slug: string, subject: string): string {
  const name = `${slug.replaceAll('/', '-')}--${subject}`
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+$/g, '')
  return `${name}.html`
}

/** Saves the share as one HTML file, for sending by hand. */
export function downloadShare(slug: string, share: CapturedShare): void {
  const html = sharePageHtml(share.parts)
  const url = URL.createObjectURL(new Blob([html], { type: 'text/html' }))
  const link = document.createElement('a')
  link.download = shareFileName(slug, share.parts.subject)
  link.href = url
  link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Has the dev server upload the share to the team's bucket, and answers with its public link. */
export async function uploadShare(slug: string, share: CapturedShare): Promise<string> {
  const response = await fetch(SHARE_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ slug, page: share.parts, ...(share.image === undefined ? {} : { image: share.image }) }),
  })
  const payload = (await response.json().catch(() => ({}))) as { url?: string; error?: string }
  if (!response.ok || payload.url === undefined) {
    throw new Error(payload.error ?? `The dev server answered ${response.status}.`)
  }
  return payload.url
}
