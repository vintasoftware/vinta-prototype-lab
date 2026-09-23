import type { ComponentType } from 'react'

/** Frame a screen is drawn in. Sets the width of the device shell around it. */
export type ScreenViewport = 'mobile' | 'tablet' | 'desktop'

/**
 * What the viewer needs to know about one screen. A screen file may export a partial `screen`
 * object to override any of it; everything left out is read from the filename.
 */
export interface ScreenMeta {
  /** Stable id used by links and by annotation targets. Defaults to the filename. */
  id: string
  /** Name shown in the screen list. */
  title: string
  /** Which state of the screen this is. `default` when the filename carries no variant. */
  variant: string
  /** Name shown in the variant switcher. */
  variantLabel: string
  /** Device shell the screen renders in. */
  viewport: ScreenViewport
  /** Position in the screen list. Screens with the same order sort by filename. */
  order: number
}

/** Shape of a `screens/*.tsx` module. */
export interface ScreenModule {
  default: ComponentType
  screen?: Partial<ScreenMeta>
}

export interface PrototypeScreen extends ScreenMeta {
  Component: ComponentType
  /** Path of the file the screen came from. Shown when the viewer reports a problem. */
  source: string
}

/** What a designer's comment is about. Drives the pin colour and the filter in the notes panel. */
export type AnnotationKind = 'spec' | 'flow' | 'question' | 'todo'

/** One comment, anchored to an element by its semantic id. */
export interface Annotation {
  id: string
  /** Element the note points at: the `data-proto-id` value set by `anchor()`. */
  target: string
  /** Screen the note belongs to. When absent the note applies on every screen with that target. */
  screen?: string
  kind: AnnotationKind
  title: string
  /** Markdown. Long-form detail behind the title. */
  body?: string
  author?: string
  status?: 'open' | 'resolved'
}

/** `prototype.md`: the front matter fields plus the markdown that follows them. */
export interface PrototypeDoc {
  title: string
  summary?: string
  /** Screen the prototype opens on. Defaults to the first screen in the list. */
  entry?: string
  status?: string
  owner?: string
  /** Free text; the date the designer last touched the prototype. */
  updated?: string
  /** Markdown body, front matter removed. */
  body: string
}

export interface Prototype {
  /** Folder path under `prototypes/`, e.g. `billing/refunds`. Identifies the prototype in the URL. */
  slug: string
  /** Group folders the prototype sits in, outermost first. Empty for one directly under `prototypes/`. */
  group: string[]
  doc: PrototypeDoc
  screens: PrototypeScreen[]
  annotations: Annotation[]
  /** Problems found while loading. The viewer shows these instead of failing to start. */
  issues: string[]
}
