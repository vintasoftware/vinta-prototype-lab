import path from 'node:path'
import { parse } from '@babel/parser'
import type { Plugin } from 'vite'
import { ANCHOR_ATTRIBUTE, SOURCE_ATTRIBUTE } from '../lib/source-ref'

/** Only a screen of a prototype is ever stamped, and only a screen is ever rewritten. */
export function isScreenFile(file: string): boolean {
  const parts = file.split(path.sep).join('/')
  return /\/prototypes\/[^/]+\/screens\/[^/]+\.tsx$/.test(parts)
}

/** `prototypes/patient-booking/screens/10-home.tsx:34:8:Button` — where it sits, and what it is. */
export function formatSourceRef(file: string, root: string, line: number, column: number, tag: string): string {
  return `${path.relative(root, file).split(path.sep).join('/')}:${line}:${column}:${tag}`
}

export interface OpeningElement {
  /** Offset just past the tag name, where an attribute can be inserted. */
  insertAt: number
  line: number
  column: number
  /** Whether it already carries the source stamp. */
  stamped: boolean
  /** Whether it already carries a semantic id, by `anchor()` or by the attribute itself. */
  named: boolean
  /** The element's tag, e.g. `Button` or `div`. */
  tag: string
}

interface Attribute {
  type?: unknown
  start?: number | null
  end?: number | null
  name?: { name?: string }
}

interface Node {
  type?: unknown
  start?: number | null
  end?: number | null
  loc?: { start: { line: number; column: number } } | null
  name?: unknown
  typeArguments?: { end?: number | null }
  typeParameters?: { end?: number | null }
  attributes?: Attribute[]
  [key: string]: unknown
}

/** Whether the element already says which semantic id it carries. */
function carriesAnchor(source: string, attributes: readonly Attribute[]): boolean {
  return attributes.some(attribute => {
    if (attribute.name?.name === ANCHOR_ATTRIBUTE) {
      return true
    }
    const { start, end } = attribute
    return typeof start === 'number' && typeof end === 'number' && source.slice(start, end).includes('anchor(')
  })
}

/** Every JSX element in the file, with the offset where its attributes begin. */
export function findOpeningElements(source: string): OpeningElement[] {
  const ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
  const found: OpeningElement[] = []

  const walk = (node: unknown) => {
    if (node === null || typeof node !== 'object') {
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item)
      }
      return
    }

    const candidate = node as Node
    if (typeof candidate.type !== 'string') {
      return
    }

    if (candidate.type === 'JSXOpeningElement') {
      // A generic component writes its type arguments after the name, so the attributes start past them.
      const insertAt =
        candidate.typeArguments?.end ?? candidate.typeParameters?.end ?? (candidate.name as Node | undefined)?.end
      const at = candidate.loc?.start
      const attributes = candidate.attributes ?? []

      const name = candidate.name as Node | undefined
      const tag =
        typeof name?.start === 'number' && typeof name?.end === 'number'
          ? source.slice(name.start, name.end)
          : undefined

      if (typeof insertAt === 'number' && at !== undefined && tag !== undefined) {
        found.push({
          insertAt,
          line: at.line,
          column: at.column,
          tag,
          stamped: attributes.some(attribute => attribute.name?.name === SOURCE_ATTRIBUTE),
          named: carriesAnchor(source, attributes),
        })
      }
    }

    for (const value of Object.values(candidate)) {
      walk(value)
    }
  }

  walk(ast.program)
  return found
}

/** Writes the stamp onto every element, working backwards so the offsets stay true. */
export function stampSource(source: string, file: string, root: string): string {
  const elements = findOpeningElements(source)
    .filter(element => !element.stamped)
    .sort((a, b) => b.insertAt - a.insertAt)

  let stamped = source
  for (const element of elements) {
    const ref = formatSourceRef(file, root, element.line, element.column, element.tag)
    stamped = `${stamped.slice(0, element.insertAt)} ${SOURCE_ATTRIBUTE}="${ref}"${stamped.slice(element.insertAt)}`
  }
  return stamped
}

/**
 * Records where each element of a screen was written, as an attribute on the element.
 *
 * The viewer reads it to name an element for the designer: a comment placed on something unnamed
 * gets a real `anchor()` id written into the screen file, and that needs the line the element is
 * on. React keeps no source on its fibers, so the source has to travel on the element itself.
 *
 * It runs on the prototypes' screens only, and only while the dev server is up — a built copy of
 * the viewer carries none of these. Running before the React plugin leaves it plain TSX to read.
 */
export function stampJsxSource({ root }: { root: string }): Plugin {
  return {
    name: 'prototype-lab:stamp-jsx-source',
    apply: 'serve',
    enforce: 'pre',
    transform(code, id) {
      const file = id.split('?')[0] ?? id
      return isScreenFile(file) ? { code: stampSource(code, file, root), map: null } : null
    },
  }
}
