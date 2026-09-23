import { Check, Link2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '../ui'

export interface CopyLinkButtonProps {
  /** What the picked component is called, for the button's own name. */
  picked: string
  className?: string
}

/**
 * Copies the viewer's own URL, which names the picked component.
 *
 * Pasted into a ticket, the link reopens this screen with the same component picked. It shows only
 * beside the picked component, which is the one the URL is about.
 */
export function CopyLinkButton({ picked, className }: CopyLinkButtonProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }
    const clear = setTimeout(() => setCopied(false), 1500)
    return () => clearTimeout(clear)
  }, [copied])

  return (
    <button
      type='button'
      aria-label={`Copy a link to ${picked}`}
      title={copied ? 'Link copied' : `Copy a link to ${picked}`}
      onClick={() => {
        void navigator.clipboard?.writeText(window.location.href).then(() => setCopied(true))
      }}
      className={cn('flex size-5 shrink-0 items-center justify-center rounded', className)}
    >
      {copied ? <Check className='size-3' /> : <Link2 className='size-3' />}
    </button>
  )
}
