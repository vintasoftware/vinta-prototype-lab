import { ArrowRight, Clock } from 'lucide-react'
import type { Prototype } from '../types'
import type { PlayerText } from './player-text'
import { roleOf } from './role'
import { type Tour, tourLengthMs } from './tours'
import { VintaWordmark } from './vinta-wordmark'

export interface TourPickerProps {
  tours: readonly Tour[]
  prototypes: readonly Prototype[]
  text: Required<PlayerText>
  onPlay: (tourId: string) => void
}

function minutes(ms: number): string {
  return `About ${Math.max(1, Math.round(ms / 60000))} min`
}

/** Roles a tour passes through, in the order it meets them. */
function rolesOf(tour: Tour, prototypes: readonly Prototype[]): string[] {
  const seen: string[] = []
  for (const step of tour.steps) {
    const role = roleOf(prototypes, step.prototype)
    if (!seen.includes(role)) {
      seen.push(role)
    }
  }
  return seen
}

/**
 * The player's front page, in Vinta's look: the wordmark, one large headline, and one card per tour.
 * Its colours live in `player.css` under `.vinta-home`, so the prototype screens keep their own theme.
 */
export function TourPicker({ tours, prototypes, text, onPlay }: TourPickerProps) {
  return (
    <div className='vinta-home min-h-screen'>
      <header className='mx-auto flex max-w-6xl items-center justify-between px-6 py-6 sm:px-10'>
        <VintaWordmark className='vinta-accent h-7' />
        {text.client !== '' && <span className='vinta-muted hidden text-sm sm:inline'>{text.client}</span>}
      </header>

      <main className='mx-auto flex max-w-6xl flex-col gap-14 px-6 pt-10 pb-20 sm:px-10 sm:pt-16'>
        <section className='flex max-w-3xl flex-col gap-6'>
          <span className='vinta-eyebrow'>{text.eyebrow}</span>
          <h1 className='vinta-headline'>
            {text.headline} <span className='vinta-accent'>{text.accent}</span>
          </h1>
          <p className='vinta-muted max-w-2xl text-lg leading-relaxed'>{text.intro}</p>
        </section>

        <ol className='grid gap-5 md:grid-cols-2'>
          {tours.map((tour, index) => (
            <li key={tour.id}>
              <button type='button' onClick={() => onPlay(tour.id)} className='vinta-card group'>
                <span className='vinta-number'>{String(index + 1).padStart(2, '0')}</span>
                <span className='flex flex-col gap-2'>
                  <span className='font-semibold text-2xl leading-tight'>{tour.title}</span>
                  <span className='vinta-muted leading-relaxed'>{tour.summary}</span>
                </span>
                <span className='flex flex-wrap gap-2'>
                  {rolesOf(tour, prototypes).map(role => (
                    <span key={role} className='vinta-chip'>
                      {role}
                    </span>
                  ))}
                </span>
                <span className='mt-auto flex items-center justify-between gap-3 pt-2'>
                  <span className='vinta-muted flex items-center gap-1.5 text-sm'>
                    <Clock aria-hidden className='size-4' />
                    {tour.steps.length} steps · {minutes(tourLengthMs(tour))}
                  </span>
                  <span className='vinta-button'>
                    Play tour
                    <ArrowRight aria-hidden className='size-4 transition-transform group-hover:translate-x-0.5' />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </main>

      <footer className='vinta-footer'>
        <div className='mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-10'>
          <span>{text.footer}</span>
          <span>Space plays or pauses · arrows move between steps · Esc comes back here</span>
        </div>
      </footer>
    </div>
  )
}
