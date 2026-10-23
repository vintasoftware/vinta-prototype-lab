import { parse } from '@babel/parser'

interface Node {
  type?: unknown
  start?: number | null
  end?: number | null
  loc?: { start: { line: number; column: number } } | null
  [key: string]: unknown
}

/** The leading spaces of the line `offset` sits on, which the snippet removes from every line. */
function indentAt(source: string, offset: number): string {
  const lineStart = source.lastIndexOf('\n', offset - 1) + 1
  return /^[ \t]*/.exec(source.slice(lineStart))?.[0] ?? ''
}

function dedent(text: string, indent: string): string {
  return text
    .split('\n')
    .map(line => (line.startsWith(indent) ? line.slice(indent.length) : line))
    .join('\n')
}

/**
 * The JSX element written at a position of a screen file, as an engineer would copy it: the tag and
 * its props as written, with its children collapsed to `…`. The position is the one the dev server
 * stamped on the element, and the tag must match, so a file that changed since is caught rather
 * than answered with whatever now sits there.
 */
export function jsxSnippet(source: string, line: number, column: number, tag: string): string | undefined {
  let ast: unknown
  try {
    ast = parse(source, { sourceType: 'module', plugins: ['jsx', 'typescript'] })
  } catch {
    return undefined
  }

  let found: string | undefined
  const walk = (node: unknown) => {
    if (found !== undefined || node === null || typeof node !== 'object') {
      return
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        walk(item)
      }
      return
    }
    const candidate = node as Node
    if (candidate.type === 'JSXElement') {
      const opening = candidate.openingElement as Node | undefined
      const name = opening?.name as Node | undefined
      const at = opening?.loc?.start
      if (
        opening !== undefined &&
        at?.line === line &&
        at.column === column &&
        typeof opening.start === 'number' &&
        typeof opening.end === 'number' &&
        typeof name?.start === 'number' &&
        typeof name.end === 'number' &&
        source.slice(name.start, name.end) === tag
      ) {
        const written = dedent(source.slice(opening.start, opening.end), indentAt(source, opening.start))
        const children = (candidate.children as Node[] | undefined) ?? []
        const hasChildren = children.some(
          child => child.type !== 'JSXText' || String((child as { value?: unknown }).value ?? '').trim() !== ''
        )
        found =
          opening.selfClosing === true ? written : hasChildren ? `${written}\n  …\n</${tag}>` : `${written}</${tag}>`
        return
      }
    }
    for (const value of Object.values(candidate)) {
      walk(value)
    }
  }
  walk((ast as { program: unknown }).program)
  return found
}
