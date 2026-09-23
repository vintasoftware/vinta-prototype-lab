/** Box of an anchored element, in coordinates relative to the frame the screen renders in. */
export interface AnchorRect {
  top: number
  left: number
  width: number
  height: number
}

interface Box {
  top: number
  left: number
  right: number
  bottom: number
}

function toBox(rect: DOMRect): Box {
  return { top: rect.top, left: rect.left, right: rect.right, bottom: rect.bottom }
}

function merge(a: Box, b: Box): Box {
  return {
    top: Math.min(a.top, b.top),
    left: Math.min(a.left, b.left),
    right: Math.max(a.right, b.right),
    bottom: Math.max(a.bottom, b.bottom),
  }
}

/**
 * Viewport box of an element. `<Anchor>` renders with `display: contents` so it does not disturb
 * layout, and such an element reports an empty rect — in that case the box is the union of what it
 * contains.
 */
function viewportBox(element: Element, depth = 0): Box | undefined {
  const rect = element.getBoundingClientRect()
  if (rect.width > 0 || rect.height > 0) {
    return toBox(rect)
  }

  if (depth > 3) {
    return undefined
  }

  let box: Box | undefined
  for (const child of Array.from(element.children)) {
    const childBox = viewportBox(child, depth + 1)
    if (childBox !== undefined) {
      box = box === undefined ? childBox : merge(box, childBox)
    }
  }
  return box
}

/** Measures one anchored element against the frame's own box. */
export function measureAnchor(element: Element, frame: Element): AnchorRect | undefined {
  const box = viewportBox(element)
  if (box === undefined) {
    return undefined
  }

  const origin = frame.getBoundingClientRect()

  return {
    top: box.top - origin.top,
    left: box.left - origin.left,
    width: box.right - box.left,
    height: box.bottom - box.top,
  }
}

/**
 * Where the overlay puts a box of its own — a pin, a note card.
 *
 * The overlay fills the frame, so `100%` is the frame's width. Anything drawn past it scrolls the
 * screen sideways, which is the one thing the overlay must not do to the design under it. A box
 * wider than the frame sits flush left and shrinks to fit: `clamp` returns its minimum when the
 * maximum falls below it.
 */
export function overlayBox(left: number, width: number): { left: string; width: string } {
  return {
    left: `clamp(0px, ${left}px, calc(100% - ${width}px))`,
    width: `min(${width}px, 100%)`,
  }
}

/** Where the overlay puts the ring tracing an element, trimmed at the frame's edges. */
export function overlayRing(rect: AnchorRect): { left: number; width: string } {
  const left = Math.max(rect.left, 0)
  return { left, width: `min(${rect.width}px, calc(100% - ${left}px))` }
}
