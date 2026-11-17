import { type RefObject, useCallback, useEffect, useState } from 'react'
import {
  buildComponentTree,
  type ComponentTree,
  EMPTY_COMPONENT_TREE,
  OVERLAY_ATTRIBUTE,
  SLOT_ATTRIBUTE,
} from '../lib/component-tree'
import { ANCHOR_ATTRIBUTE } from '../lib/source-ref'

/** Whether a node is, or sits inside, one of the viewer's overlays. */
function isOverlay(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement
  return element?.closest(`[${OVERLAY_ATTRIBUTE}]`) != null
}

/** Whether a change touched only the viewer's overlays: inside one, or adding or removing one. */
function onlyOverlay(record: MutationRecord): boolean {
  if (isOverlay(record.target)) {
    return true
  }
  const nodes = [...Array.from(record.addedNodes), ...Array.from(record.removedNodes)]
  return record.type === 'childList' && nodes.length > 0 && nodes.every(isOverlay)
}

/**
 * The component tree of the screen on stage.
 *
 * It is read from the live DOM, so a screen gets a tree without declaring one: every
 * shadcn/ui component stamps a `data-slot`, and that is the component's name. Reading again on
 * every mutation keeps the tree true for a screen that changes what it renders.
 */
export function useComponentTree(frameRef: RefObject<HTMLElement | null>, revision: string): ComponentTree {
  const [tree, setTree] = useState<ComponentTree>(EMPTY_COMPONENT_TREE)

  const read = useCallback(() => {
    const frame = frameRef.current
    setTree(frame === null ? EMPTY_COMPONENT_TREE : buildComponentTree(frame))
  }, [frameRef])

  // biome-ignore lint/correctness/useExhaustiveDependencies: `revision` changes when the screen on stage does, and the effect has to measure again then.
  useEffect(() => {
    const frame = frameRef.current
    if (frame === null) {
      // No stage right now — the map is open — so nothing from the last screen may linger.
      read()
      return
    }

    read()

    // One read per frame at most: a screen that renders a list mutates the DOM once per item. The
    // viewer's own overlays live inside the frame too; drawing an outline is not a change to the
    // screen, and reading the tree again for one would clear the hover that drew it.
    let pending = 0
    const observer = new MutationObserver(records => {
      if (records.every(onlyOverlay)) {
        return
      }
      cancelAnimationFrame(pending)
      pending = requestAnimationFrame(read)
    })
    observer.observe(frame, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [SLOT_ATTRIBUTE, ANCHOR_ATTRIBUTE],
    })

    return () => {
      cancelAnimationFrame(pending)
      observer.disconnect()
    }
    // `revision` re-reads when the screen on stage changes.
  }, [frameRef, read, revision])

  return tree
}
