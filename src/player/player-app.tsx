import { useCallback, useEffect, useState } from 'react'
import type { Prototype } from '../types'
import type { PlayerText } from './player-text'
import { TourCheckPage } from './tour-check-page'
import { TourPicker } from './tour-picker'
import { TourPlayer } from './tour-player'
import { parseTourHash, type Tour } from './tours'

export interface PlayerAppProps {
  prototypes: Prototype[]
  tours: Tour[]
  /** Problems found while reading the tour files. `#/check` lists them. */
  issues?: string[]
  text: Required<PlayerText>
}

interface Playing {
  tourId: string
  step: number
  autoPlay: boolean
  /** Bumped on every start, so playing the same tour again starts it fresh. */
  run: number
}

function fromHash(hash: string, tours: readonly Tour[]): Playing | undefined {
  const route = parseTourHash(hash)
  if (route === undefined || !tours.some(tour => tour.id === route.tourId)) {
    return undefined
  }
  // A shared link opens paused on its step, so whoever opens it chooses when to start.
  return { tourId: route.tourId, step: route.step - 1, autoPlay: false, run: 0 }
}

/** `#/check` opens the tour check instead of the picker. */
function isCheckHash(hash: string): boolean {
  return /^#?\/?check\/?$/.test(hash)
}

/**
 * The guided demo on its own: the tour picker, and one tour playing at a time. It has no free
 * clicking, comments or flow map; the full prototype lab keeps those.
 */
export function PlayerApp({ prototypes, tours, issues = [], text }: PlayerAppProps) {
  const [playing, setPlaying] = useState<Playing | undefined>(() => fromHash(window.location.hash, tours))
  const [checking, setChecking] = useState(() => isCheckHash(window.location.hash))

  useEffect(() => {
    const onHashChange = () => {
      setChecking(isCheckHash(window.location.hash))
      const next = fromHash(window.location.hash, tours)
      setPlaying(current =>
        next === undefined ? undefined : current?.tourId === next.tourId ? current : { ...next, run: Date.now() }
      )
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [tours])

  const play = useCallback((tourId: string) => {
    window.history.replaceState(null, '', `#/tour/${tourId}/1`)
    setPlaying({ tourId, step: 0, autoPlay: true, run: Date.now() })
  }, [])

  const exit = useCallback(() => {
    window.history.replaceState(null, '', '#/')
    setPlaying(undefined)
    setChecking(false)
  }, [])

  if (checking) {
    return <TourCheckPage tours={tours} prototypes={prototypes} issues={issues} onExit={exit} />
  }

  const tour = tours.find(candidate => candidate.id === playing?.tourId)
  if (playing === undefined || tour === undefined) {
    return <TourPicker tours={tours} prototypes={prototypes} text={text} onPlay={play} />
  }

  return (
    <TourPlayer
      key={`${tour.id}/${playing.run}`}
      tour={tour}
      prototypes={prototypes}
      initialStep={playing.step}
      autoPlay={playing.autoPlay}
      onExit={exit}
    />
  )
}
