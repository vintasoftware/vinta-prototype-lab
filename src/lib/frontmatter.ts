/**
 * Front matter reader for `prototype.md`.
 *
 * Handles the shape designers write by hand: a `---` fenced block of `key: value` lines at the top
 * of the file, values optionally quoted. Nested structures are not read — a prototype's front
 * matter is a handful of flat fields, and anything longer belongs in the markdown body.
 */
export interface ParsedFrontmatter {
  data: Record<string, string>
  body: string
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/

function unquote(value: string): string {
  const trimmed = value.trim()
  const first = trimmed[0]
  const last = trimmed[trimmed.length - 1]
  if (trimmed.length >= 2 && (first === '"' || first === "'") && last === first) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

export function parseFrontmatter(source: string): ParsedFrontmatter {
  const match = FENCE.exec(source)
  if (!match) {
    return { data: {}, body: source.trim() }
  }

  const data: Record<string, string> = {}
  const block = match[1] ?? ''

  for (const line of block.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue
    }
    const separator = trimmed.indexOf(':')
    if (separator === -1) {
      continue
    }
    const key = trimmed.slice(0, separator).trim()
    if (key === '') {
      continue
    }
    data[key] = unquote(trimmed.slice(separator + 1))
  }

  return { data, body: source.slice(match[0].length).trim() }
}
