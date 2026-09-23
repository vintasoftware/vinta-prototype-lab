import { type AnchorRect, overlayBox, overlayRing } from '../lib/anchor-rect'
import { OVERLAY_ATTRIBUTE } from '../lib/component-tree'
import { CopyLinkButton } from './copy-link-button'

export interface InspectOverlayProps {
  selected?: AnchorRect
  hovered?: AnchorRect
  /** Name of the picked component, shown on the label under its box. */
  label?: string
}

const LABEL_WIDTH = 240

/** Outlines the picked component on the screen, and whatever the pointer is over while inspecting. */
export function InspectOverlay({ selected, hovered, label }: InspectOverlayProps) {
  return (
    <div {...{ [OVERLAY_ATTRIBUTE]: '' }} className='pointer-events-none absolute inset-0 z-10'>
      {hovered !== undefined && (
        <div
          className='absolute bg-cyan-400/15 ring-1 ring-cyan-500'
          style={{ top: hovered.top, height: hovered.height, ...overlayRing(hovered) }}
        />
      )}

      {selected !== undefined && (
        <>
          <div
            className='absolute rounded-sm ring-2 ring-indigo-500'
            style={{ top: selected.top, height: selected.height, ...overlayRing(selected) }}
          />
          {label !== undefined && (
            <span
              className='pointer-events-auto absolute flex items-center gap-1 rounded-sm bg-indigo-600 py-0.5 pr-0.5 pl-1.5 font-mono text-white text-xs'
              style={{
                top: selected.top + selected.height + 4,
                left: overlayBox(selected.left, LABEL_WIDTH).left,
                maxWidth: `min(${LABEL_WIDTH}px, 100%)`,
              }}
            >
              <span className='truncate'>{label}</span>
              <CopyLinkButton picked={label} className='hover:bg-white/20' />
            </span>
          )}
        </>
      )}
    </div>
  )
}
