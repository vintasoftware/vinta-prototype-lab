import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { buildPrototypes, type PrototypeSources } from '../lib/discovery'
import type { StorybookOptions } from '../lib/storybook-links'
import { PrototypeLabApp } from './prototype-lab-app'

export interface ViewerOptions {
  /** Where the component tree finds Storybook pages to link to; `false` shows no links. */
  storybook?: StorybookOptions | false
  /**
   * Shows the Mobile / Tablet / Desktop switcher; `false` draws every screen in its own viewport,
   * unless a size is chosen in the device toolbar, which shows either way.
   */
  viewportSwitcher?: boolean
  /** The tour player's address. The plugin passes it once `prototype-lab player` has built it. */
  player?: string
}

/**
 * Starts the viewer on the page. The Vite plugin calls it with the files it globbed from the
 * project's `prototypes/` folder, so adding a folder is all it takes to add a prototype.
 */
export function mountViewer(
  sources: PrototypeSources,
  options: ViewerOptions = {},
  container: HTMLElement | null = document.getElementById('root')
): void {
  if (container === null) {
    throw new Error('The page is missing the #root element the viewer mounts into.')
  }

  createRoot(container).render(
    <StrictMode>
      <PrototypeLabApp
        prototypes={buildPrototypes(sources)}
        {...(options.storybook === undefined ? {} : { storybook: options.storybook })}
        {...(options.viewportSwitcher === undefined ? {} : { viewportSwitcher: options.viewportSwitcher })}
        {...(options.player === undefined ? {} : { player: options.player })}
      />
    </StrictMode>
  )
}
