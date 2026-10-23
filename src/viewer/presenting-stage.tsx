import { Minimize } from 'lucide-react'
import { type ReactNode, type RefObject, useEffect, useState } from 'react'
import type { VisibleBox } from '../hooks/use-visible-box'
import type { ScreenViewport } from '../types'
import { Button, cn } from '../ui'

/** How long the way out stays on screen after the last touch or pointer move. */
const CONTROLS_SHOWN_MS = 2500

export interface PresentingStageProps {
  viewport: ScreenViewport
  /** The screen's scroller, so links and the runtime measure against it as they do in the frame. */
  frameRef: RefObject<HTMLDivElement | null>
  onExit: () => void
  box: VisibleBox
  children: ReactNode
}

/**
 * Presenting: only the screen, filling the window, with none of the viewer around it. The way out is
 * a small button in the corner that hides after a moment and comes back on any touch, or Esc.
 */
export function PresentingStage({ viewport, frameRef, onExit, box, children }: PresentingStageProps) {
  const [controlsShown, setControlsShown] = useState(true)

  useEffect(() => {
    let timer = window.setTimeout(() => setControlsShown(false), CONTROLS_SHOWN_MS)
    const show = () => {
      setControlsShown(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setControlsShown(false), CONTROLS_SHOWN_MS)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onExit()
      }
    }
    // Capture, so a screen that stops the event still brings the button back.
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
          controlsShown ? 'opacity-90' : 'pointer-events-none opacity-0'
        )}
        onClick={onExit}
      >
        <Minimize />
      </Button>
    </div>
  )
}
