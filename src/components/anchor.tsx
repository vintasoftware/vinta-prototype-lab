import type { ReactNode } from 'react'
import { ANCHOR_ATTRIBUTE } from '../lib/source-ref'
import { cn } from '../ui'

export { ANCHOR_ATTRIBUTE } from '../lib/source-ref'

export interface AnchorProps {
  /** Semantic id. Annotations in `annotations.json` point at this string through their `target`. */
  id: string
  children: ReactNode
  className?: string
}

/**
 * Names an element so a designer's comment can point at it.
 *
 * Spread it on anything that forwards DOM props, which every shadcn/ui component does:
 *
 * ```tsx
 * <Button {...anchor('confirm-booking')}>Confirm</Button>
 * ```
 *
 * The id stays stable while the markup around it changes, which is what keeps a comment attached to
 * the thing it is about.
 */
export function anchor(id: string): Record<typeof ANCHOR_ATTRIBUTE, string> {
  return { [ANCHOR_ATTRIBUTE]: id }
}

/**
 * Wrapper for the case where the target does not forward DOM props — plain text, a fragment, a
 * third-party component. It renders no box of its own, so it changes no layout; the overlay
 * measures the children instead.
 */
export function Anchor({ id, children, className }: AnchorProps) {
  return (
    <span {...anchor(id)} className={cn('contents', className)}>
      {children}
    </span>
  )
}
