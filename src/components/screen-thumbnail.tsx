import type { Ref } from 'react'
import { FRAME_HEIGHT, THUMBNAIL_SCALE, VIEWPORT_WIDTH } from '../lib/constants'
import type { FrameSize } from '../lib/device-frame'
import { thumbnailSize } from '../lib/flow-drawing'
import type { PrototypeScreen, ScreenViewport } from '../types'
import { cn, RenderBoundary } from '../ui'
import { NO_NAVIGATION, PrototypeRuntime, type ScreenNavigation } from './prototype-runtime'

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
  /** The size to render the screen at. Defaults to its viewport's frame. */
  size?: FrameSize
  /** How much to shrink it. Defaults to the flow map's factor for the viewport; the canvas uses 1. */
  scale?: number
  /**
   * Makes the screen clickable, with this navigation, as a live frame on the canvas is. Without it
   * the screen is inert: nothing in it can be clicked, focused or read out.
   */
  navigation?: ScreenNavigation
  className?: string
}

/**
 * A screen drawn small, for the canvas. It is the real screen rendered at its own viewport size
 * and scaled, so it looks the way the stage does. It is inert unless given a navigation: nothing in
 * it can be clicked, focused or read out, so the frame around it is the one control.
 */
export function ScreenThumbnail({
  screen,
  showHotspots,
  viewport,
  mountRef,
  size,
  scale: scaleOverride,
  navigation,
  className,
}: ScreenThumbnailProps) {
  const live = navigation !== undefined
  const frame = viewport ?? screen.viewport
  const scale = scaleOverride ?? THUMBNAIL_SCALE[frame]
  const inner = size ?? { width: VIEWPORT_WIDTH[frame], height: FRAME_HEIGHT[frame] }
  const outer =
    size === undefined && scaleOverride === undefined
      ? thumbnailSize(frame)
      : { width: Math.round(inner.width * scale), height: Math.round(inner.height * scale) }

  return (
    <div
      inert={!live}
      aria-hidden={live ? undefined : 'true'}
      style={{ width: outer.width, height: outer.height }}
      className={cn(
        'overflow-hidden bg-background',
        // An inert screen is a picture: its animations would only keep the browser compositing every
        // frame, which is what makes a canvas of many screens stutter.
        !live && 'pointer-events-none select-none [&_*]:animate-none! [&_*]:transition-none!',
        className
      )}
    >
      <div
        ref={mountRef}
        data-viewport={frame}
        style={{
          width: inner.width,
          height: inner.height,
          // The transform stays on, even at 1, so `position: fixed` inside a screen stays in its frame.
          transform: `scale(${scale})`,
          transformOrigin: '0 0',
        }}
        className='overflow-hidden'
      >
        <RenderBoundary fallback={<ScreenDidNotRender />}>
          <PrototypeRuntime
            value={navigation ?? { ...NO_NAVIGATION, screenId: screen.id, variant: screen.variant, showHotspots }}
          >
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
