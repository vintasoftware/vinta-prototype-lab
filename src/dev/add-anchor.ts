import { ANCHOR_ID } from '../lib/source-ref'
import { findOpeningElements } from './stamp-jsx-source'

/** Where `anchor` is imported from in a screen file. */
const PACKAGE = 'vinta-prototype-lab'

export interface AddAnchorResult {
  source: string
  /** Set when the file was left alone, saying why. */
  skipped?: string
}

/**
 * Adds `anchor` to the screen's import of the package, or writes a fresh import above the first one.
 *
 * A type-only import cannot carry a value, so a screen that has one gets a second import beside it.
 */
function withAnchorImported(source: string): string {
  const existing = new RegExp(`import\\s*\\{([^}]*)\\}\\s*from\\s*'${PACKAGE}'`).exec(source)

  if (existing === null) {
    const firstImport = source.indexOf('import ')
    const at = firstImport === -1 ? 0 : firstImport
    return `${source.slice(0, at)}import { anchor } from '${PACKAGE}'\n${source.slice(at)}`
  }

  const [statement, names = ''] = existing
  if (/\banchor\b/.test(names)) {
    return source
  }
  // `anchor` sorts ahead of the component names beside it, which is where Biome puts it.
  return source.replace(statement, statement.replace('{', '{ anchor,'))
}

/**
 * Names an element in a screen file: writes `{...anchor('<id>')}` onto the element that starts at
 * the given position, and imports `anchor` if the file does not already.
 *
 * The element is found by parsing the screen and matching the position exactly against the elements
 * the parser reports — the same reading that stamped the position onto the element in the first
 * place. The tag is matched too, so a position that has drifted onto a different element is caught
 * rather than written to. Nothing matching means the screen has changed since it was drawn, and
 * nothing is written: the alternative is naming whatever now sits there.
 */
export function addAnchor(source: string, line: number, column: number, id: string, tag?: string): AddAnchorResult {
  if (!ANCHOR_ID.test(id)) {
    return { source, skipped: `"${id}" is not a name: use lower-case letters, digits and dashes.` }
  }

  let elements: ReturnType<typeof findOpeningElements>
  try {
    elements = findOpeningElements(source)
  } catch {
    return { source, skipped: 'That screen could not be read, so nothing was written.' }
  }

  const element = elements.find(
    candidate => candidate.line === line && candidate.column === column && (tag === undefined || candidate.tag === tag)
  )
  if (element === undefined) {
    return { source, skipped: 'The element has moved since the screen was drawn. Reload and try again.' }
  }
  if (element.named) {
    return { source, skipped: 'That element already carries a name.' }
  }

  const named = `${source.slice(0, element.insertAt)} {...anchor('${id}')}${source.slice(element.insertAt)}`
  return { source: withAnchorImported(named) }
}
