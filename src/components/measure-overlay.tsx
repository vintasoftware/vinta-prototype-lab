import type { AnchorRect } from '../lib/anchor-rect'
import { OVERLAY_ATTRIBUTE } from '../lib/component-tree'
import type { BoxModel, Measurement } from '../lib/measure'

export interface MeasureOverlayProps {
  /** Distances from the picked element to the one under the pointer. */
  measurements: readonly Measurement[]
  /** An element's own spacing, drawn when nothing is picked to measure from. */
  spacing?: { rect: AnchorRect; model: BoxModel }
}

/** Keeps a label one size on screen however far the canvas is zoomed out. */
const STEADY = { scale: 'var(--canvas-label-scale, 1)' } as const

/**
 * Draws measurements over the screen, in the frame's own pixels, as design tools do: a line and a
 * number for each distance, or the padding and margin of one element as tinted bands.
 */
export function MeasureOverlay({ measurements, spacing }: MeasureOverlayProps) {
  return (
    <div {...{ [OVERLAY_ATTRIBUTE]: '' }} className='pointer-events-none absolute inset-0 z-30'>
      {spacing !== undefined && <SpacingBands {...spacing} />}
      <svg aria-hidden='true' className='absolute inset-0 size-full overflow-visible'>
        {measurements.map(measurement => (
          <line
            key={measurement.side}
            x1={measurement.x1}
            y1={measurement.y1}
            x2={measurement.x2}
            y2={measurement.y2}
            strokeWidth={1}
            vectorEffect='non-scaling-stroke'
            className='stroke-rose-500'
          />
        ))}
      </svg>
      {measurements.map(measurement => (
        <span
          key={`label-${measurement.side}`}
          data-measurement={measurement.side}
          className='absolute -translate-x-1/2 -translate-y-1/2 rounded-sm bg-rose-500 px-1 font-mono text-white text-xs tabular-nums'
          style={{ left: (measurement.x1 + measurement.x2) / 2, top: (measurement.y1 + measurement.y2) / 2, ...STEADY }}
        >
          {measurement.value}
        </span>
      ))}
    </div>
  )
}

/** Margin outside the element in amber, padding inside it in green, the way browser tools tint them. */
function SpacingBands({ rect, model }: { rect: AnchorRect; model: BoxModel }) {
  const { padding, margin } = model
  return (
    <>
      <div
        data-spacing='margin'
        className='absolute border-amber-400/50 border-solid'
        style={{
          left: rect.left - margin.left,
          top: rect.top - margin.top,
          width: rect.width + margin.left + margin.right,
          height: rect.height + margin.top + margin.bottom,
          borderWidth: `${margin.top}px ${margin.right}px ${margin.bottom}px ${margin.left}px`,
        }}
      />
      <div
        data-spacing='padding'
        className='absolute border-emerald-400/50 border-solid'
        style={{
          left: rect.left,
          top: rect.top,
          width: rect.width,
          height: rect.height,
          borderWidth: `${padding.top}px ${padding.right}px ${padding.bottom}px ${padding.left}px`,
        }}
      />
    </>
  )
}
