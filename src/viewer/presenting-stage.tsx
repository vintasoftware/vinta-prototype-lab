import { Minimize } from 'lucide-react'
import { type ReactNode, useEffect, useState } from 'react'
import { useElementSize } from '../hooks/use-element-size'
import type { VisibleBox } from '../hooks/use-visible-box'
import { type FrameSize, fitScale, frameScale } from '../lib/device-frame'
import { Button, cn } from '../ui'

export interface PresentingStageProps {
  /** The part of the page the person can see, which the stage fills. */
  box: VisibleBox
  /**
   * The size the screen is drawn at, the one chosen in the viewer, scaled down when the window is
   * smaller. Without one the screen fills the window.
   */
  size?: FrameSize | undefined
  onExit: () => void
  children: ReactNode
}

/** How long the way out stays on screen after the last touch or pointer move. */
export const EXIT_BUTTON_DELAY_MS = 2500

/**
 * Presenting: only the screen, with none of the viewer around it. With a size, the screen keeps it
 * and sits in the middle of the window, scaled down to fit when it is larger, so a desktop can show
 * a phone or a tablet in a call. Without one it fills the window, for the device in the person's
 * hand. The way out is a small button in the corner that hides after a moment and comes back on any
 * touch or pointer move. The viewer's own key handler takes Esc.
 */
export function PresentingStage({ box, size, onExit, children }: PresentingStageProps) {
  const [exitShown, setExitShown] = useState(true)
  const [stageRef, stageSize] = useElementSize<HTMLDivElement>()

  useEffect(() => {
    let timer = window.setTimeout(() => setExitShown(false), EXIT_BUTTON_DELAY_MS)
    const show = () => {
      setExitShown(true)
      window.clearTimeout(timer)
      timer = window.setTimeout(() => setExitShown(false), EXIT_BUTTON_DELAY_MS)
    }
    window.addEventListener('pointerdown', show, true)
    window.addEventListener('pointermove', show, true)
    return () => {
      window.clearTimeout(timer)
      window.removeEventListener('pointerdown', show, true)
      window.removeEventListener('pointermove', show, true)
    }
  }, [])

  // An on-screen keyboard covers the stage without changing the zoom, so typing never shrinks the screen.
  const keyboardInset = Math.max(0, window.innerHeight - box.height)
  const scale = size === undefined ? 1 : frameScale('fit', fitScale(stageSize, size, keyboardInset))

  return (
    <div className='fixed inset-x-0 bg-background' style={{ top: box.top, height: box.height }}>
      {size === undefined ? (
        <div className='relative size-full overflow-auto overscroll-contain bg-background'>{children}</div>
      ) : (
        // The frame centres itself with auto margins, which, unlike `justify-center`, leave a frame
        // larger than the stage scrollable from its top left corner.
        <div ref={stageRef} className='flex size-full overflow-auto overscroll-contain bg-muted p-6'>
          <div
            data-testid='presenting-frame'
            className='m-auto shrink-0'
            style={{ width: size.width * scale, height: size.height * scale }}
          >
            <div
              className='relative origin-top-left overflow-auto overscroll-contain rounded-lg border border-border bg-background shadow-sm'
              style={{
                width: size.width,
                height: size.height,
                ...(scale === 1 ? {} : { transform: `scale(${scale})` }),
              }}
            >
              {children}
            </div>
          </div>
        </div>
      )}
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
