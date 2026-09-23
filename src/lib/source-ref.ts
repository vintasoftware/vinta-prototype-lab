/** Where the dev server takes a comment edit, and where it names an element. */
export const ANNOTATIONS_ENDPOINT = '/__annotations'
export const NAME_ELEMENT_ENDPOINT = '/__name-element'

/** DOM attribute carrying where in a screen file the element was written. */
export const SOURCE_ATTRIBUTE = 'data-proto-src'

/**
 * DOM attribute that carries a semantic id. Annotations find their element by this value.
 *
 * It lives here rather than beside `anchor()` so the dev-server plugins can read it: they run in
 * Node, and the components module reaches React.
 */
export const ANCHOR_ATTRIBUTE = 'data-proto-id'

/** A semantic id a designer can type: kebab-case, so it reads as a name in a URL and a diff. */
export const ANCHOR_ID = /^[a-z0-9][a-z0-9-]*$/

/** Separates the steps of a component path, and marks one that starts at the screen. */
export const SELECTOR_SEPARATOR = '/'

export interface SourceRef {
  file: string
  line: number
  column: number
  /** The element's tag, so a position that has drifted onto another element is recognised. */
  tag: string
}

/** Reads `prototypes/booking/screens/10-home.tsx:34:8:Button` back into its parts. */
export function parseSourceRef(ref: string): SourceRef | undefined {
  const match = /^(.+):(\d+):(\d+):([\w$.]+)$/.exec(ref)
  const [, file, line, column, tag] = match ?? []

  if (file === undefined || line === undefined || column === undefined || tag === undefined) {
    return undefined
  }
  return { file, line: Number(line), column: Number(column), tag }
}

/** A name suggested for an element, from what it is and what it says. */
export function suggestAnchorId(label: string, text: string): string {
  const slug = (value: string) =>
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')

  const fromText = slug(text).split('-').slice(0, 4).join('-')
  const fromLabel = slug(label.replace(/([a-z0-9])([A-Z])/g, '$1-$2'))

  return (fromText === '' ? fromLabel : fromText).slice(0, 40) || 'element'
}
