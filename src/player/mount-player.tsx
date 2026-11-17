import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { buildPrototypes, type PrototypeSources } from '../lib/discovery'
import { PlayerApp } from './player-app'
import { type PlayerText, playerText } from './player-text'
import { buildTours } from './tours'

export interface PlayerSources extends PrototypeSources {
  /** `tours/*.json` files, keyed by path. */
  tours: Record<string, unknown>
}

export interface PlayerOptions {
  /** The words on the tours home. */
  text?: PlayerText
}

/**
 * Starts the guided tour player on the page. `prototype-lab player` builds a page that calls it with
 * the project's prototype folders and their `tours/` files.
 */
export function mountPlayer(
  sources: PlayerSources,
  options: PlayerOptions = {},
  container: HTMLElement | null = document.getElementById('root')
): void {
  if (container === null) {
    throw new Error('The page is missing the #root element the player mounts into.')
  }
  const { tours, ...prototypeSources } = sources
  // A file that does not load is listed on `#/check`, not thrown, so the other tours still play.
  const built = buildTours(tours)

  createRoot(container).render(
    <StrictMode>
      <PlayerApp
        prototypes={buildPrototypes(prototypeSources)}
        tours={built.tours}
        issues={built.issues}
        text={playerText(options.text)}
      />
    </StrictMode>
  )
}
