import { Minimize } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useState } from 'react'
import type { VisibleBox } from '../hooks/use-visible-box'
import type { ScreenViewport } from '../types'
import { Button, cn } from '../ui'

export interface PresentingStageProps {
  /** The window's own viewport: presenting draws at the window's size, with no frame or zoom. */
  viewport: ScreenViewport
  frameRef: RefObject<HTMLDivElement | null>
  /** The part of the page the person can see, which the stage fills. */
  box: VisibleBox
  onExit: () => void
  children: ReactNode
}

/** How long the way out stays on screen after the last touch or pointer move. */
export const EXIT_BUTTON_DELAY_MS = 2500

/**
 * Presenting: only the screen, filling the window, with none of the viewer around it. The way out
 * is a small button in the corner that hides after a moment and comes back on any touch or pointer
 * move, or Esc.
 */
export function PresentingStage({ viewport, frameRef, box, onExit, children }: PresentingStageProps) {
  const [exitShown, setExitShown] = useState(true)

  useEffect(() => {
    let timer = window.setTimeout(() => setExitShown(false), EXIT_BUTTON_DELAY_MS)
    const show = () => {
      setExitShown(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setExitShown(false), EXIT_BUTTON_DELAY_MS)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExit()
      }
    }
    window.addEventListener('pointerdown', show, true)
    window.addEventListener('pointermove', show, true)
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', show, true)
      window.removeEventListener('pointermove', show, true)
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [onExit])

  return (
    <div className='fixed inset-x-0 bg-background' style={{ top: box.top, height: box.height }}>
      <div
        ref={frameRef}
        data-viewport={viewport}
        className='relative size-full overflow-auto overscroll-contain bg-background'
      >
        {children}
      </div>
      <Button
        variant='outline'
        size='icon-sm'
        aria-label='Stop presenting'
        title='Stop presenting (Esc)'
        className={cn(
          'absolute top-3 right-3 z-[2147483647] rounded-full shadow-md transition-opacity',
          exitShown ? 'opacity-90' : 'pointer-events-none opacity-0'
        )}
        onClick={onExit}
      >
        <Minimize />
      </Button>
    </div>
  )
}
