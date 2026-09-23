import { resolveComponentSelector } from './component-link'
import type { ComponentTree } from './component-tree'
import { ANCHOR_ATTRIBUTE } from './source-ref'

/**
 * The element a comment points at.
 *
 * A target is either a semantic id, which the designer put on the element with `anchor()`, or the
 * name of a component in the tree — the same name a link to that component uses. Ids are tried
 * first: an id is a promise the screen keeps, and a name describes where the component sits today.
 *
 * The anchored elements are read and compared rather than searched for, so a target written by hand
 * finds nothing instead of forming a search the browser rejects.
 */
export function resolveAnnotationTarget(frame: Element, tree: ComponentTree, target: string): Element | undefined {
  for (const element of Array.from(frame.querySelectorAll(`[${ANCHOR_ATTRIBUTE}]`))) {
    if (element.getAttribute(ANCHOR_ATTRIBUTE) === target) {
      return element
    }
  }

  const path = resolveComponentSelector(tree, target)
  return path === undefined ? undefined : tree.elementByPath.get(path)
}
