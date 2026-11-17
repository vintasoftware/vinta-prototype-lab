import { CircleCheck, CircleX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import type { Prototype } from '../types'
import { Button, cn } from '../ui'
import { checkTours, type StepCheck } from './tour-check'
import type { Tour } from './tours'

declare global {
  interface Window {
    /** The finished check, for a script that opens `#/check` and reads the result. */
    __TOUR_CHECK__?: StepCheck[]
  }
}

export interface TourCheckPageProps {
  tours: readonly Tour[]
  prototypes: readonly Prototype[]
  /** Problems found while reading the tour files. */
  issues: readonly string[]
  onExit: () => void
}

/**
 * `#/check`: plays every step of every tour without waiting and lists what would stop a tour in
 * front of a client. `<html data-tour-check="done">` marks the end, and `window.__TOUR_CHECK__`
 * holds the result.
 */
export function TourCheckPage({ tours, prototypes, issues, onExit }: TourCheckPageProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [results, setResults] = useState<StepCheck[]>([])
  const [done, setDone] = useState(false)

  useEffect(() => {
    const host = hostRef.current
    if (host === null) {
      return
    }
    let cancelled = false
    document.documentElement.dataset.tourCheck = 'running'
    checkTours(tours, prototypes, host, result => {
      if (!cancelled) {
        setResults(current => [...current, result])
      }
    }).then(all => {
      if (!cancelled) {
        window.__TOUR_CHECK__ = all
        document.documentElement.dataset.tourCheck = 'done'
        setDone(true)
      }
    })
    return () => {
      cancelled = true
    }
  }, [tours, prototypes])

  const failing = results.filter(result => result.problems.length > 0)

  return (
    <div className='min-h-screen bg-background p-8 text-foreground'>
      <div className='mx-auto flex max-w-4xl flex-col gap-6'>
        <header className='flex items-center justify-between gap-4'>
          <div>
            <h1 className='font-semibold text-2xl'>Tour check</h1>
            <p className='text-muted-foreground'>
              {done
                ? `${results.length} steps checked, ${failing.length} with problems.`
                : `Checking step ${results.length + 1}…`}
            </p>
          </div>
          <Button variant='outline' onClick={onExit}>
            Tours home
          </Button>
        </header>

        {issues.length > 0 && (
          <section className='rounded-lg border border-destructive/40 p-4'>
            <h2 className='font-medium'>Tour files that did not load</h2>
            <ul className='mt-2 list-disc pl-5 text-sm'>
              {issues.map(issue => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </section>
        )}

        <ol className='flex flex-col divide-y divide-border rounded-lg border border-border'>
          {results.map(result => (
            <li key={`${result.tourId}/${result.step}`} className='flex gap-3 px-4 py-2 text-sm'>
              {result.problems.length === 0 ? (
                <CircleCheck aria-label='Plays' className='mt-0.5 size-4 shrink-0 text-success' />
              ) : (
                <CircleX aria-label='Has problems' className='mt-0.5 size-4 shrink-0 text-destructive' />
              )}
              <div className='flex flex-col'>
                <span className={cn(result.problems.length > 0 && 'font-medium')}>
                  {result.tourId} step {result.step}: {result.title}
                </span>
                {result.problems.map(problem => (
                  <span key={problem} className='text-destructive'>
                    {problem}
                  </span>
                ))}
              </div>
            </li>
          ))}
        </ol>
      </div>
      {/* Screens are drawn here one at a time, out of sight, while they are checked. */}
      <div ref={hostRef} aria-hidden className='pointer-events-none fixed top-0 left-[-10000px]' />
    </div>
  )
}
