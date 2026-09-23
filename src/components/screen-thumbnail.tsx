import type { Ref } from 'react'
import { FRAME_HEIGHT, THUMBNAIL_SCALE, VIEWPORT_WIDTH } from '../lib/constants'
import { thumbnailSize } from '../lib/flow-drawing'
import type { PrototypeScreen, ScreenViewport } from '../types'
import { cn, RenderBoundary } from '../ui'
import { NO_NAVIGATION, PrototypeRuntime } from './prototype-runtime'

export interface ScreenThumbnailProps {
  screen: PrototypeScreen
  /** Whether hotspots show, the same as on stage, so a hotspot's arrow has a visible start. */
  showHotspots: boolean
  /** Frame to draw the screen in. Defaults to the screen's own. */
  viewport?: ScreenViewport
  /**
   * The element the screen renders directly into. Paths the probe recorded are relative to it, so
   * the map can find a control in the thumbnail.
   */
  mountRef?: Ref<HTMLDivElement>
  className?: string
}

/**
 * A screen drawn small, for the flow map. It is the real screen rendered at its own viewport size
 * and scaled down, so it looks the way the stage does. It is inert: nothing in it can be clicked,
 * focused or read out, so the card around it is the one control.
 */
export function ScreenThumbnail({ screen, showHotspots, viewport, mountRef, className }: ScreenThumbnailProps) {
  const frame = viewport ?? screen.viewport
  const scale = THUMBNAIL_SCALE[frame]
  const outer = thumbnailSize(frame)

  return (
    <div
      inert
      aria-hidden='true'
      style={{ width: outer.width, height: outer.height }}
      className={cn('pointer-events-none select-none overflow-hidden bg-background', className)}
    >
      <div
        ref={mountRef}
        style={{
          width: VIEWPORT_WIDTH[frame],
          height: FRAME_HEIGHT[frame],
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
        }}
        className='overflow-hidden'
      >
        <RenderBoundary fallback={<ScreenDidNotRender />}>
          <PrototypeRuntime value={{ ...NO_NAVIGATION, screenId: screen.id, variant: screen.variant, showHotspots }}>
            <screen.Component />
          </PrototypeRuntime>
        </RenderBoundary>
      </div>
    </div>
  )
}

/** Shown in place of a screen that threw, so the rest of the map still draws. */
function ScreenDidNotRender() {
  return (
    <div className='flex h-full items-center justify-center bg-muted p-8 text-center text-3xl text-muted-foreground'>
      This screen did not render
    </div>
  )
}
