import { ANCHOR_ATTRIBUTE, SELECTOR_SEPARATOR } from './source-ref'

/** Marks a subtree the viewer draws over the screen. The component tree walks past these. */
export const OVERLAY_ATTRIBUTE = 'data-prototype-overlay'

/** What every shadcn/ui component stamps on its root, and where a row gets its name. */
export const SLOT_ATTRIBUTE = 'data-slot'

/**
 * Tags worth a row of their own. A screen built from plain HTML still reads as a tree, and one
 * built from shadcn/ui gets its component names from `data-slot` instead.
 */
const LANDMARK_TAGS = new Set([
  'header',
  'nav',
  'main',
  'footer',
  'section',
  'aside',
  'form',
  'button',
  'a',
  'h1',
  'h2',
  'h3',
  'img',
])

export interface ComponentNode {
  /** Position in the tree, e.g. `0.2.1`. Identifies a row and the element it stands for. */
  path: string
  /** A `data-slot` names a component; anything else is a plain element of the page. */
  kind: 'component' | 'element'
  /** Component name from `data-slot`, or the tag for a landmark. */
  label: string
  /** Semantic id, when the designer named this element for a comment. */
  anchorId?: string
  children: ComponentNode[]
}

export interface ComponentTree {
  roots: ComponentNode[]
  nodeByPath: Map<string, ComponentNode>
  elementByPath: Map<string, Element>
  pathByElement: Map<Element, string>
}

export const EMPTY_COMPONENT_TREE: ComponentTree = {
  roots: [],
  nodeByPath: new Map(),
  elementByPath: new Map(),
  pathByElement: new Map(),
}

/**
 * `card-header` -> `CardHeader`, matching the component the slot came from.
 *
 * A slot holding the path separator would make a name a link could not read back, so it is left
 * out and the element reads as the plain tag it is.
 */
function componentName(slot: string): string {
  return slot
    .split('-')
    .filter(part => part !== '')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

interface Naming {
  kind: 'component' | 'element'
  label: string
}

/** What to call an element, or nothing when it earns no row of its own. */
function labelOf(element: Element): Naming | undefined {
  const slot = element.getAttribute(SLOT_ATTRIBUTE)
  if (slot !== null && slot !== '') {
    return { kind: 'component', label: componentName(slot) }
  }

  const tag = element.tagName.toLowerCase()
  if (element.hasAttribute(ANCHOR_ATTRIBUTE) || LANDMARK_TAGS.has(tag)) {
    return { kind: 'element', label: tag }
  }

  return undefined
}

interface RawNode extends Naming {
  element: Element
  children: RawNode[]
}

/**
 * Collects the elements that earn a row. An element that earns none is walked through rather than
 * around, so its own components move up to the nearest row above them — layout wrappers do not
 * become rows in the tree.
 */
function gather(parent: Element): RawNode[] {
  const nodes: RawNode[] = []

  for (const child of Array.from(parent.children)) {
    if (child.hasAttribute(OVERLAY_ATTRIBUTE)) {
      continue
    }

    const naming = labelOf(child)
    if (naming === undefined) {
      nodes.push(...gather(child))
      continue
    }

    nodes.push({ ...naming, element: child, children: gather(child) })
  }

  return nodes
}

/** Numbers the rows depth-first and records which element each one stands for. */
function assignPaths(raw: RawNode[], parentPath: string, tree: ComponentTree): ComponentNode[] {
  return raw.map((node, index) => {
    const path = parentPath === '' ? String(index) : `${parentPath}.${index}`
    tree.elementByPath.set(path, node.element)
    tree.pathByElement.set(node.element, path)

    // A link names a component by its id or by a path of names, and the two are told apart by
    // the separator — so an id holding one could not be read back, and the tree does not offer it.
    const attribute = node.element.getAttribute(ANCHOR_ATTRIBUTE)
    const anchorId = attribute?.includes(SELECTOR_SEPARATOR) === true ? null : attribute

    const built: ComponentNode = {
      path,
      kind: node.kind,
      label: node.label,
      ...(anchorId === null || anchorId === '' ? {} : { anchorId }),
      children: assignPaths(node.children, path, tree),
    }
    tree.nodeByPath.set(path, built)

    return built
  })
}

/** Reads the screen on stage into the tree the sidebar shows. */
export function buildComponentTree(frame: Element): ComponentTree {
  const tree: ComponentTree = { roots: [], nodeByPath: new Map(), elementByPath: new Map(), pathByElement: new Map() }
  tree.roots = assignPaths(gather(frame), '', tree)
  return tree
}

/**
 * The row that stands for an element, or for the closest thing above it that has one. Clicking the
 * text inside a button selects the button, which is the row a person meant to point at.
 */
export function nearestNodePath(tree: ComponentTree, from: Element): string | undefined {
  let current: Element | null = from

  while (current !== null) {
    const path = tree.pathByElement.get(current)
    if (path !== undefined) {
      return path
    }
    current = current.parentElement
  }

  return undefined
}

/** `0.2.1` -> `['0', '0.2']`, the rows that have to be open for it to be visible. */
export function ancestorPaths(path: string): string[] {
  const parts = path.split('.')
  return parts.slice(0, -1).map((_, index) => parts.slice(0, index + 1).join('.'))
}
