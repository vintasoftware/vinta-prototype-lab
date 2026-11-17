import { useEffect } from 'react'
import { OVERLAY_ATTRIBUTE } from '../lib/component-tree'
import type { OutOfVersion } from '../lib/version'
import { Button } from '../ui'

const TOAST_MS = 5000

export interface ViewerToastProps {
  message: string | undefined
  onDismiss: () => void
}

/**
 * A short message at the foot of the viewer, gone after a few seconds. The live region stays in the
 * page, so a screen reader announces each message as it appears.
 */
export function ViewerToast({ message, onDismiss }: ViewerToastProps) {
  useEffect(() => {
    if (message === undefined) {
      return
    }
    const timer = setTimeout(onDismiss, TOAST_MS)
    return () => clearTimeout(timer)
  }, [message, onDismiss])

  return (
    <div
      role='status'
      aria-live='polite'
      className='pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4'
    >
      {message !== undefined && (
        <p className='pointer-events-auto rounded-md border border-border bg-foreground px-4 py-2 text-background text-sm shadow-lg'>
          {message}
        </p>
      )}
    </div>
  )
}

export interface VersionPlaceholderProps {
  /** The screen's title and the state's label: `Claim detail · Denied`. */
  name: string
  missing: OutOfVersion
  onSwitch: (version: string | undefined) => void
}

/**
 * Shown in the frame, in place of a screen state the picked version does not have. It is viewer
 * chrome, so the component tree walks past it.
 */
export function VersionPlaceholder({ name, missing, onSwitch }: VersionPlaceholderProps) {
  const { short, id } = missing.version
  return (
    <div
      {...{ [OVERLAY_ATTRIBUTE]: '' }}
      className='flex h-full flex-col items-center justify-center gap-4 bg-card p-8 text-center'
    >
      <p className='font-medium text-sm'>
        {name} {missing.reason === 'arrives' ? `arrives in ${short}` : `is replaced after ${short}`}
      </p>
      <div className='flex gap-2'>
        <Button size='sm' onClick={() => onSwitch(id)}>
          Switch to {short}
        </Button>
        <Button size='sm' variant='outline' onClick={() => onSwitch(undefined)}>
          Switch to All
        </Button>
      </div>
    </div>
  )
}
