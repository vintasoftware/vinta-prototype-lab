import { type RefObject, useCallback, useRef, useState } from 'react'
import { type Camera, clampZoom } from '../lib/canvas-camera'

/** How long after the last pan step the content stops being its own compositor layer. */
const PAN_SETTLE_MS = 200

/** Labels never grow past this many times their size, so a canvas zoomed far out stays legible. */
const MAX_LABEL_SCALE = 6

export interface CanvasCamera {
  /** The camera as it is now. Read it in handlers; it changes without a render. */
  camera: RefObject<Camera>
  /** The zoom, as state: what the toolbar shows and what decides whether frames draw their screens. */
  zoom: number
  /**
   * Whether a pan is under way. It turns on with the first step of a pan and off once it has rested
   * for a moment, so work that would make the pan stutter can wait for it to end.
   */
  moving: boolean
  setCamera: (next: Camera) => void
}

/**
 * Holds where the canvas is looked at from, and writes it straight onto the content's transform.
 *
 * Panning changes only the transform, so dragging the canvas renders nothing and stays at the
 * display's frame rate. A change of zoom is also kept as state, which renders once per change. The
 * content gets two custom properties for its children: `--canvas-zoom`, and `--canvas-label-scale`,
 * the factor that keeps a title or a pin at one size on screen.
 *
 * The content is its own compositor layer (`will-change: transform`), so a pan moves it without
 * painting it again. A layer keeps the resolution it was painted at, and one painted zoomed out
 * would stay blurred once zoomed in, so the hint comes off while the zoom changes and goes back on
 * once it rests.
 */
export function useCanvasCamera(contentRef: RefObject<HTMLElement | null>): CanvasCamera {
  const camera = useRef<Camera>({ x: 0, y: 0, zoom: 1 })
  const [zoom, setZoom] = useState(1)
  const zoomRef = useRef(1)
  const settle = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [moving, setMoving] = useState(false)
  const movingRef = useRef(false)

  const setCamera = useCallback(
    (next: Camera) => {
      const settled = { ...next, zoom: clampZoom(next.zoom) }
      camera.current = settled
      const content = contentRef.current
      if (content !== null) {
        clearTimeout(settle.current)
        if (settled.zoom === zoomRef.current) {
          if (!movingRef.current) {
            movingRef.current = true
            setMoving(true)
          }
          settle.current = setTimeout(() => {
            movingRef.current = false
            setMoving(false)
          }, PAN_SETTLE_MS)
        } else {
          // Painted again at the new zoom, then made a layer again once the zoom rests.
          content.style.willChange = ''
          if (movingRef.current) {
            movingRef.current = false
            setMoving(false)
          }
          settle.current = setTimeout(() => {
            content.style.willChange = 'transform'
          }, PAN_SETTLE_MS)
        }
        content.style.transform = `translate(${settled.x}px, ${settled.y}px) scale(${settled.zoom})`
        // A pan changes only the transform. Setting the zoom's properties again would send the
        // browser through its full compositing update on every step, so they change with the zoom.
        if (settled.zoom !== zoomRef.current || content.style.getPropertyValue('--canvas-zoom') === '') {
          content.style.setProperty('--canvas-zoom', String(settled.zoom))
          content.style.setProperty(
            '--canvas-label-scale',
            String(Math.min(MAX_LABEL_SCALE, Math.max(1, 1 / settled.zoom)))
          )
        }
      }
      // A pan leaves the zoom as it was; setting it anyway would still render the canvas.
      if (settled.zoom !== zoomRef.current) {
        zoomRef.current = settled.zoom
        setZoom(settled.zoom)
      }
    },
    [contentRef]
  )

  return { camera, zoom, moving, setCamera }
}
