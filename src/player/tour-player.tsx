import { ChevronLeft, ChevronRight, House, Pause, Play, RotateCcw, SkipForward } from 'lucide-react'
import { type SyntheticEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ANCHOR_ATTRIBUTE } from '../components/anchor'
import { PrototypeFrame } from '../components/prototype-frame'
import { NO_NAVIGATION, PrototypeRuntime, type ScreenNavigation } from '../components/prototype-runtime'
import type { Prototype } from '../types'
import { Badge, Button, cn } from '../ui'
import { roleOf } from './role'
import { formatTourHash, readingTimeMs, screenForStep, type Tour } from './tours'
import { VintaWordmark } from './vinta-wordmark'

const SPEEDS = [1, 1.5, 2] as const
type Speed = (typeof SPEEDS)[number]

/** How long the cursor takes to reach the step's element before the reading clock starts. */
const SETTLE_MS = 750
/** The click: press, ripple, then the next screen. */
const CLICK_MS = 520
const TICK_MS = 100
/** Looks for the step's element every 100 ms, this many times, before saying it is missing. */
const ANCHOR_TRIES = 15

interface Box {
  left: number
  top: number
  width: number
  height: number
}

type Phase = 'settling' | 'reading' | 'clicking'

export interface TourPlayerProps {
  tour: Tour
  prototypes: readonly Prototype[]
  initialStep: number
  autoPlay: boolean
  onExit: () => void
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  )
  useEffect(() => {
    const query = window.matchMedia?.('(prefers-reduced-motion: reduce)')
    if (query === undefined) {
      return
    }
    const onChange = () => setReduced(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [])
  return reduced
}

/** The element's box, or its children's when it draws no box of its own (`<Anchor>` is `display: contents`). */
function boxOf(element: Element): DOMRect | undefined {
  const own = element.getBoundingClientRect()
  if (own.width > 0 && own.height > 0) {
    return own
  }
  const parts = [...element.children].map(child => child.getBoundingClientRect()).filter(r => r.width > 0)
  if (parts.length === 0) {
    return undefined
  }
  const left = Math.min(...parts.map(r => r.left))
  const top = Math.min(...parts.map(r => r.top))
  const right = Math.max(...parts.map(r => r.right))
  const bottom = Math.max(...parts.map(r => r.bottom))
  return new DOMRect(left, top, right - left, bottom - top)
}

/** The first element with this anchor that is drawn on screen. */
function findAnchor(frame: HTMLElement, id: string): Element | undefined {
  const candidates = frame.querySelectorAll(`[${ANCHOR_ATTRIBUTE}="${CSS.escape(id)}"]`)
  return [...candidates].find(candidate => boxOf(candidate) !== undefined)
}

const CLICKABLE = 'button, a[href], [role="button"], [role="link"], [role="tab"], [role="menuitem"], summary, input'

/** Where the cursor clicks inside an element: its first control, or the element itself. */
function clickPoint(frame: HTMLElement, id: string): DOMRect | undefined {
  const element = findAnchor(frame, id)
  if (element === undefined) {
    return undefined
  }
  const control = element.matches(CLICKABLE) ? element : element.querySelector(CLICKABLE)
  return (control === null ? undefined : boxOf(control)) ?? boxOf(element)
}

/**
 * Hides the designers' own shortcuts drawn inside a screen, such as "Prototype: both locations".
 * They jump between states for a review; in a tour they would only distract.
 */
function hidePrototypeControls(frame: HTMLElement) {
  for (const control of frame.querySelectorAll<HTMLElement>(CLICKABLE)) {
    if (/^Prototype:/.test(control.textContent?.trim() ?? '')) {
      control.style.display = 'none'
      const group = control.parentElement
      if (
        group !== null &&
        group !== frame &&
        [...group.children].every(child => (child as HTMLElement).style.display === 'none')
      ) {
        group.style.display = 'none'
      }
    }
  }
}

/** Stops a person's clicks inside the screen: in a tour the screens are shown, not used. */
function swallow(event: SyntheticEvent) {
  if (event.nativeEvent.isTrusted) {
    event.preventDefault()
    event.stopPropagation()
  }
}

const PLAYER_NAVIGATION: ScreenNavigation = { ...NO_NAVIGATION }

/**
 * Plays one tour: the step's screen fills the stage, a cursor moves to the element that matters and
 * clicks it, and a caption says what the screen is for. Steps advance on their own reading time, or
 * by hand with Back and Next.
 */
export function TourPlayer({ tour, prototypes, initialStep, autoPlay, onExit }: TourPlayerProps) {
  const [stepIndex, setStepIndex] = useState(() => Math.min(Math.max(0, initialStep), tour.steps.length - 1))
  const [playing, setPlaying] = useState(autoPlay)
  const [speed, setSpeed] = useState<Speed>(1)
  const [hovered, setHovered] = useState(false)
  const [phase, setPhase] = useState<Phase>('settling')
  const [elapsed, setElapsed] = useState(0)
  const [finished, setFinished] = useState(false)
  const [target, setTarget] = useState<Box | undefined>(undefined)
  const [cursor, setCursor] = useState<{ x: number; y: number } | undefined>(undefined)
  const [clickBox, setClickBox] = useState<Box | undefined>(undefined)
  const [anchorMissing, setAnchorMissing] = useState(false)

  const stageRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLOListElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const reducedMotion = usePrefersReducedMotion()

  const step = tour.steps[stepIndex]
  const screen = step === undefined ? undefined : screenForStep(prototypes, step)
  const duration = step === undefined ? 0 : readingTimeMs(step)
  const isLast = stepIndex === tour.steps.length - 1
  const broken = screen === undefined || anchorMissing

  // Keep the link in step, so the address bar can be shared to open this step.
  useEffect(() => {
    const next = formatTourHash(tour.id, stepIndex)
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next)
    }
  }, [tour.id, stepIndex])

  /** Measures the step's element against the stage, so the ring and cursor sit on it. */
  const measure = useCallback(() => {
    const stage = stageRef.current
    const frame = frameRef.current
    if (stage === null || frame === null || step?.anchor === undefined) {
      setTarget(undefined)
      return
    }
    const element = findAnchor(frame, step.anchor)
    const box = element === undefined ? undefined : boxOf(element)
    if (box === undefined) {
      setTarget(undefined)
      return
    }
    const stageBox = stage.getBoundingClientRect()
    // Clip to what is on screen: the frame and every scrolling box between it and the element, so a
    // ring never floats over a header or outside the screen.
    let { left, top, right, bottom } = box
    const frameBox = frame.getBoundingClientRect()
    for (let parent = element?.parentElement ?? null; parent !== null; parent = parent.parentElement) {
      const style = window.getComputedStyle(parent)
      if (parent === frame || style.overflowX !== 'visible' || style.overflowY !== 'visible') {
        const clip = parent.getBoundingClientRect()
        left = Math.max(left, clip.left)
        top = Math.max(top, clip.top)
        right = Math.min(right, clip.right)
        bottom = Math.min(bottom, clip.bottom)
      }
      if (parent === frame) {
        break
      }
    }
    // A sliver left after clipping means the element sits in a layer over the scroller that clipped
    // it, such as a sheet; the frame alone is the better clip then.
    if (right - left < 16 || bottom - top < 16) {
      left = Math.max(box.left, frameBox.left)
      top = Math.max(box.top, frameBox.top)
      right = Math.min(box.right, frameBox.right)
      bottom = Math.min(box.bottom, frameBox.bottom)
    }
    if (right <= left || bottom <= top) {
      setTarget(undefined)
      return
    }
    setTarget({ left: left - stageBox.left, top: top - stageBox.top, width: right - left, height: bottom - top })
    const point = step.click === undefined ? undefined : clickPoint(frame, step.click)
    setClickBox(
      point === undefined
        ? undefined
        : { left: point.left - stageBox.left, top: point.top - stageBox.top, width: point.width, height: point.height }
    )
  }, [step?.anchor, step?.click])

  // A new step: bring its element into view, then move the cursor there. A screen may draw its
  // element a moment after it mounts, so the anchor is looked for a few times before the step
  // reports it missing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once per step, not when a measure or a flag changes.
  useLayoutEffect(() => {
    setPhase('settling')
    setElapsed(0)
    setAnchorMissing(false)
    setClickBox(undefined)
    const frame = frameRef.current
    if (frame === null || step === undefined || screen === undefined) {
      setTarget(undefined)
      return
    }
    frame.scrollTop = 0
    hidePrototypeControls(frame)
    const timers: number[] = []
    const later = (run: () => void, ms: number) => timers.push(window.setTimeout(run, ms))

    if (step.anchor === undefined) {
      setTarget(undefined)
      later(() => setPhase('reading'), 200)
    } else {
      const anchorId = step.anchor
      let tries = 0
      const look = () => {
        hidePrototypeControls(frame)
        const element = findAnchor(frame, anchorId)
        if (element === undefined) {
          tries += 1
          if (tries > ANCHOR_TRIES) {
            setAnchorMissing(true)
            setTarget(undefined)
          } else {
            later(look, 100)
          }
          return
        }
        // A tall element shows its top; a short one sits in the middle of the screen.
        const tall = (boxOf(element)?.height ?? 0) > frame.clientHeight * 0.5
        element.scrollIntoView({ block: tall ? 'start' : 'center', inline: 'nearest', behavior: 'auto' })
        // scrollIntoView also scrolls the stage around the frame; the stage never scrolls.
        if (stageRef.current !== null) {
          stageRef.current.scrollTop = 0
          stageRef.current.scrollLeft = 0
        }
        later(measure, reducedMotion ? 0 : 320)
        later(
          () => {
            measure()
            setPhase('reading')
          },
          reducedMotion ? 50 : SETTLE_MS
        )
      }
      look()
    }
    return () => {
      for (const timer of timers) {
        window.clearTimeout(timer)
      }
    }
  }, [stepIndex, screen])

  // Keep the current step visible in the list, scrolling only the list itself.
  useEffect(() => {
    const list = listRef.current
    const item = list?.querySelector<HTMLElement>(`[data-step="${stepIndex}"]`)
    if (list == null || item == null) {
      return
    }
    const top = item.offsetTop
    if (top < list.scrollTop + 24 || top + item.offsetHeight > list.scrollTop + list.clientHeight - 24) {
      list.scrollTop = top - list.clientHeight / 3
    }
  }, [stepIndex])

  // The cursor follows the target's centre. With nothing to point at, it stays where it was.
  useEffect(() => {
    const aim = clickBox ?? target
    if (aim !== undefined) {
      setCursor({ x: aim.left + Math.min(aim.width / 2, 120), y: aim.top + Math.min(aim.height / 2, 28) })
    }
  }, [target, clickBox])

  // Re-measure when the window or the screen scrolls or resizes.
  useEffect(() => {
    const frame = frameRef.current
    window.addEventListener('resize', measure)
    frame?.addEventListener('scroll', measure, { passive: true })
    return () => {
      window.removeEventListener('resize', measure)
      frame?.removeEventListener('scroll', measure)
    }
  }, [measure])

  const goTo = useCallback(
    (index: number) => {
      setFinished(false)
      setStepIndex(Math.min(Math.max(0, index), tour.steps.length - 1))
    },
    [tour.steps.length]
  )

  /** Leaves the step: through its click when it has one, then on to the next step or the end. */
  const advance = useCallback(() => {
    if (phase === 'clicking') {
      return
    }
    const leave = () => {
      if (isLast) {
        setPlaying(false)
        setFinished(true)
      } else {
        // Reset the clock in the same render as the step change. Otherwise the next step can open
        // still "reading" with this step's elapsed time, and move on at once.
        setPhase('settling')
        setElapsed(0)
        setStepIndex(index => index + 1)
      }
    }
    if (step?.click !== undefined && target !== undefined && !broken) {
      setPhase('clicking')
      window.setTimeout(leave, reducedMotion ? 250 : CLICK_MS)
    } else {
      leave()
    }
  }, [phase, isLast, step?.click, target, broken, reducedMotion])

  // The reading clock. Hovering the caption holds it; manual mode never moves on its own.
  useEffect(() => {
    if (!playing || hovered || phase !== 'reading' || finished || broken) {
      return
    }
    const timer = window.setInterval(() => setElapsed(current => current + TICK_MS * speed), TICK_MS)
    return () => window.clearInterval(timer)
  }, [playing, hovered, phase, finished, broken, speed])

  useEffect(() => {
    if (phase === 'reading' && elapsed >= duration && playing) {
      advance()
    }
  }, [elapsed, duration, phase, playing, advance])

  const back = useCallback(() => goTo(stepIndex - 1), [goTo, stepIndex])
  const togglePlay = useCallback(() => {
    if (finished) {
      goTo(0)
      setPlaying(true)
      return
    }
    setPlaying(current => !current)
  }, [finished, goTo])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return
      }
      if (event.key === ' ' || event.key === 'Spacebar') {
        // A focused button already answers Space with its own click.
        if ((event.target as HTMLElement | null)?.closest('button, a, input, select, textarea') != null) {
          return
        }
        event.preventDefault()
        togglePlay()
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        advance()
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        back()
      } else if (event.key === 'Escape') {
        onExit()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [togglePlay, advance, back, onExit])

  const roleName = (slug: string) => roleOf(prototypes, slug)
  const role = step === undefined ? '' : roleName(step.prototype)
  const progress = duration === 0 ? 0 : Math.min(1, elapsed / duration)
  const showPointer = !broken && target !== undefined && cursor !== undefined

  return (
    <div className='flex h-screen flex-col bg-muted'>
      <header className='flex items-center gap-3 border-border border-b bg-background px-4 py-2'>
        <VintaWordmark className='h-4 text-foreground' />
        <span aria-hidden className='h-5 w-px bg-border' />
        <Button variant='ghost' size='sm' onClick={onExit} aria-label='Tours home'>
          <House aria-hidden />
          Tours home
        </Button>
        <span aria-hidden className='h-5 w-px bg-border' />
        <span className='font-semibold text-foreground text-sm'>{tour.title}</span>
        {role !== '' && <Badge variant='secondary'>{role}</Badge>}
        <span className='truncate text-muted-foreground text-sm'>{screen?.title}</span>
        <div className='ml-auto flex items-center gap-2'>
          <span className='text-muted-foreground text-sm tabular-nums'>
            Step {stepIndex + 1} of {tour.steps.length}
          </span>
        </div>
      </header>
      <div className='h-1 bg-border' aria-hidden>
        <div
          className='h-full bg-primary transition-[width] duration-300'
          style={{ width: `${((stepIndex + (finished ? 1 : progress)) / tour.steps.length) * 100}%` }}
        />
      </div>

      {/* The screen takes the full height; the step's explanation sits in a panel beside it. */}
      <div className='flex min-h-0 flex-1'>
        <main ref={stageRef} className='relative flex min-h-0 min-w-0 flex-1 justify-center overflow-hidden p-4'>
          {screen === undefined ? (
            <p className='self-center text-muted-foreground'>This step's screen is missing.</p>
          ) : (
            <div
              className='contents'
              onClickCapture={swallow}
              onPointerDownCapture={swallow}
              onMouseDownCapture={swallow}
              onKeyDownCapture={swallow}
            >
              <PrototypeFrame viewport={screen.viewport} frameRef={frameRef} className='h-full!'>
                <PrototypeRuntime value={{ ...PLAYER_NAVIGATION, screenId: screen.id, variant: screen.variant }}>
                  <screen.Component key={`${step?.prototype}/${screen.id}/${screen.variant}`} />
                </PrototypeRuntime>
              </PrototypeFrame>
            </div>
          )}

          {target !== undefined && !broken && (
            <div
              aria-hidden
              className='tour-ring pointer-events-none absolute rounded-md ring-2 ring-fuchsia-500 ring-offset-2'
              style={{ left: target.left - 2, top: target.top - 2, width: target.width + 4, height: target.height + 4 }}
            />
          )}

          {cursor !== undefined && (
            <div
              aria-hidden
              data-pressing={phase === 'clicking'}
              className='tour-cursor pointer-events-none absolute'
              style={{ left: cursor.x, top: cursor.y, opacity: showPointer ? 1 : 0, zIndex: 40 }}
            >
              {phase === 'clicking' && (
                <span className='tour-ripple absolute top-0 left-0 size-12 rounded-full border-4 border-fuchsia-500' />
              )}
              <svg width='26' height='30' viewBox='0 0 26 30' className='drop-shadow-md' aria-hidden>
                <path
                  d='M3 2 L3 24 L9 18.5 L13 28 L17 26.3 L13 17 L21 17 Z'
                  className='fill-foreground stroke-background'
                  strokeWidth='2'
                  strokeLinejoin='round'
                />
              </svg>
            </div>
          )}
        </main>

        {step !== undefined && (
          <aside
            aria-label='Tour step'
            className='flex w-80 shrink-0 flex-col gap-4 border-border border-l bg-background p-5 xl:w-96'
          >
            {/* Hovering the words holds the step; the buttons below do not, so Play still plays. */}
            {/* biome-ignore lint/a11y/noStaticElementInteractions: hover only holds the clock; Space does it from the keyboard. */}
            <div
              aria-live='polite'
              className='flex shrink-0 flex-col gap-2'
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
            >
              {finished ? (
                <>
                  <h2 className='font-semibold text-foreground text-lg'>That is the end of this tour</h2>
                  <p className='text-muted-foreground'>Play it again, or go back to pick another one.</p>
                </>
              ) : broken ? (
                <>
                  <h2 className='font-semibold text-foreground text-lg'>{step.title}</h2>
                  <p className='text-destructive'>This step's screen is missing.</p>
                </>
              ) : (
                <>
                  <h2 className='font-semibold text-foreground text-xl'>{step.title}</h2>
                  <p className='text-foreground leading-relaxed'>{step.caption}</p>
                  {step.fixes !== undefined && (
                    <p className='text-muted-foreground text-sm'>
                      <span className='font-medium text-foreground'>Fixes: </span>
                      {step.fixes}
                    </p>
                  )}
                </>
              )}
            </div>

            <nav aria-label='All steps' className='flex min-h-0 flex-1 flex-col gap-2 border-border border-t pt-4'>
              <h3 className='font-medium text-muted-foreground text-xs uppercase tracking-wide'>All steps</h3>
              <ol ref={listRef} className='relative -mx-2 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto'>
                {tour.steps.map((item, index) => {
                  const itemRole = roleName(item.prototype)
                  const newRole = index === 0 || roleName(tour.steps[index - 1]?.prototype ?? '') !== itemRole
                  const current = index === stepIndex && !finished
                  return (
                    // biome-ignore lint/suspicious/noArrayIndexKey: a tour may open the same state twice; the list never reorders.
                    <li key={`${index}-${item.screen}-${item.variant}`} className='flex flex-col'>
                      {newRole && (
                        <span className='px-2 pt-2 pb-1 font-medium text-muted-foreground text-xs'>{itemRole}</span>
                      )}
                      <button
                        type='button'
                        data-step={index}
                        aria-current={current ? 'step' : undefined}
                        onClick={() => goTo(index)}
                        className={cn(
                          'flex items-start gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted',
                          current ? 'bg-muted font-medium text-foreground' : 'text-muted-foreground'
                        )}
                      >
                        <span
                          className={cn(
                            'mt-px flex size-5 shrink-0 items-center justify-center rounded-full border text-xs tabular-nums',
                            current ? 'border-primary bg-primary text-primary-foreground' : 'border-border'
                          )}
                        >
                          {index + 1}
                        </span>
                        <span>{item.title}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </nav>

            <div className='flex flex-wrap items-center gap-2'>
              <Button variant='outline' size='icon' onClick={back} disabled={stepIndex === 0} aria-label='Back'>
                <ChevronLeft aria-hidden />
              </Button>
              <Button onClick={togglePlay} className='min-w-28' aria-label={playing ? 'Pause' : 'Play'}>
                {finished ? <RotateCcw aria-hidden /> : playing ? <Pause aria-hidden /> : <Play aria-hidden />}
                {finished ? 'Replay' : playing ? 'Pause' : 'Play'}
              </Button>
              {broken && !finished ? (
                <Button variant='outline' onClick={() => (isLast ? setFinished(true) : goTo(stepIndex + 1))}>
                  <SkipForward aria-hidden />
                  Skip
                </Button>
              ) : (
                <Button
                  variant='outline'
                  size='icon'
                  onClick={advance}
                  disabled={finished || phase === 'clicking'}
                  aria-label='Next'
                >
                  <ChevronRight aria-hidden />
                </Button>
              )}
              <Button
                variant='ghost'
                size='sm'
                className='tabular-nums'
                onClick={() => setSpeed(current => SPEEDS[(SPEEDS.indexOf(current) + 1) % SPEEDS.length] ?? 1)}
                aria-label={`Speed ${speed}x, change`}
              >
                {speed}x
              </Button>
              <span className='ml-auto text-muted-foreground text-sm tabular-nums'>
                {finished ? `${tour.steps.length} of ${tour.steps.length}` : `${stepIndex + 1} of ${tour.steps.length}`}
                {hovered && playing && !finished ? ' · paused while you read' : ''}
              </span>
            </div>
            <div className={cn('h-0.5 overflow-hidden rounded-full bg-border', !playing && 'opacity-40')} aria-hidden>
              <div className='h-full bg-primary' style={{ width: `${(finished ? 1 : progress) * 100}%` }} />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
