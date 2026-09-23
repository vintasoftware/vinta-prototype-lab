import { type RefObject, useCallback, useEffect, useState } from 'react'
import { buildComponentTree, type ComponentTree, EMPTY_COMPONENT_TREE, SLOT_ATTRIBUTE } from '../lib/component-tree'
import { ANCHOR_ATTRIBUTE } from '../lib/source-ref'

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

    // One read per frame at most: a screen that renders a list mutates the DOM once per item.
    let pending = 0
    const observer = new MutationObserver(() => {
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
