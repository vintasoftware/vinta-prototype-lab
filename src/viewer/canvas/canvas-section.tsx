import type { CanvasSection } from '../../lib/canvas-layout'
import { cn } from '../../ui'

export interface CanvasSectionBoxProps {
  section: CanvasSection
}

/**
 * The box behind one screen's states, with the screen's name above it. The name keeps one size on
 * screen at any zoom, the way a frame title does.
 */
export function CanvasSectionBox({ section }: CanvasSectionBoxProps) {
  const states = section.frames.length

  return (
    <section
      aria-label={section.missing ? `Missing screen ${section.screenId}` : `Screen ${section.title}`}
      data-canvas-section={section.screenId}
      style={{ left: section.x, top: section.y, width: section.width, height: section.height }}
      className={cn(
        'pointer-events-none absolute rounded-xl border-2 border-dashed',
        section.missing ? 'border-destructive-border' : 'border-border bg-background/40'
      )}
    >
      {/* Above the box, growing upward into the gap between sections, so it never meets a frame title. */}
      <div
        className='absolute bottom-full left-2 mb-2 flex origin-bottom-left items-baseline gap-2 whitespace-nowrap'
        style={{ transform: 'scale(var(--canvas-label-scale, 1))' }}
      >
        <h2 className={cn('font-semibold text-base', section.missing && 'text-destructive')}>
          {section.missing ? `“${section.screenId}”` : section.title}
        </h2>
        {!section.missing && (
          <span className='text-muted-foreground text-xs'>
            {states} {states === 1 ? 'state' : 'states'}
          </span>
        )}
      </div>
    </section>
  )
}
