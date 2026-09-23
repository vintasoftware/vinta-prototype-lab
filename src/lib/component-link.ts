import type { ComponentNode, ComponentTree } from './component-tree'
import { SELECTOR_SEPARATOR } from './source-ref'

/** Separates the steps of a path down the tree, and marks a path that starts at the screen. */
const STEP = SELECTOR_SEPARATOR

/** Marks which of several same-named siblings a step means. Both characters are URL-safe as they are. */
const INDEX = '~'

function parentPathOf(path: string): string | undefined {
  const cut = path.lastIndexOf('.')
  return cut === -1 ? undefined : path.slice(0, cut)
}

function parentOf(tree: ComponentTree, node: ComponentNode): ComponentNode | undefined {
  const parent = parentPathOf(node.path)
  return parent === undefined ? undefined : tree.nodeByPath.get(parent)
}

function siblingsOf(tree: ComponentTree, node: ComponentNode): readonly ComponentNode[] {
  return parentOf(tree, node)?.children ?? tree.roots
}

/** `Button`, or `Button~1` for the second Button among its siblings. */
function stepFor(tree: ComponentTree, node: ComponentNode): string {
  const sameName = siblingsOf(tree, node).filter(sibling => sibling.label === node.label)
  const index = sameName.findIndex(sibling => sibling.path === node.path)
  return index <= 0 ? node.label : `${node.label}${INDEX}${index}`
}

function nodeWithAnchor(tree: ComponentTree, anchorId: string): ComponentNode | undefined {
  for (const node of tree.nodeByPath.values()) {
    if (node.anchorId === anchorId) {
      return node
    }
  }
  return undefined
}

/** The step's component among `among`: by name, and by which same-named sibling it is. */
function nodeForStep(among: readonly ComponentNode[], step: string): ComponentNode | undefined {
  const cut = step.lastIndexOf(INDEX)
  const label = cut === -1 ? step : step.slice(0, cut)
  const position = cut === -1 ? '0' : step.slice(cut + 1)

  if (!/^\d+$/.test(position)) {
    return undefined
  }
  return among.filter(node => node.label === label)[Number(position)]
}

/**
 * How a link names a component.
 *
 * Every component can be named, whether or not the designer gave it a semantic id, and the name is
 * built to outlive edits to the screen around it:
 *
 * - A component with an id is named by it alone — `book-follow-up`. Nothing else on the screen can
 *   move it, which is what makes it the name to prefer.
 * - Any other component is named by the path of component names down to it, starting at the nearest
 *   ancestor that does have an id — `follow-up-card/CardContent/Button`. Everything outside that
 *   ancestor is then free to change.
 * - With no id anywhere above it, the path starts at the screen, and a leading `/` says so —
 *   `/Card~1/CardHeader/CardTitle`. That mark is what keeps the two apart: a screen may hold both a
 *   `<header>` element and a different element the designer named `header`.
 *
 * A step carries a number only when it has same-named siblings, so inserting a paragraph, a badge or
 * a wrapper changes nothing; only adding a same-named sibling ahead of a step moves it.
 */
export function componentSelector(tree: ComponentTree, node: ComponentNode): string {
  const steps: string[] = []
  let current: ComponentNode | undefined = node

  while (current !== undefined) {
    if (current.anchorId !== undefined) {
      steps.unshift(current.anchorId)
      return steps.join(STEP)
    }
    steps.unshift(stepFor(tree, current))
    current = parentOf(tree, current)
  }

  return `${STEP}${steps.join(STEP)}`
}

/** The component a link names, as a path into the tree. Undefined when the screen has no such component. */
export function resolveComponentSelector(tree: ComponentTree, selector: string): string | undefined {
  const fromScreen = selector.startsWith(STEP)
  const [first, ...rest] = (fromScreen ? selector.slice(STEP.length) : selector).split(STEP)

  if (first === undefined || first === '') {
    return undefined
  }

  let node = fromScreen ? nodeForStep(tree.roots, first) : nodeWithAnchor(tree, first)

  for (const step of rest) {
    if (node === undefined) {
      return undefined
    }
    node = nodeForStep(node.children, step)
  }

  return node?.path
}
