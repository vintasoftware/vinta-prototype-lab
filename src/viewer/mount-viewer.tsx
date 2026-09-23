import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { buildPrototypes, type PrototypeSources } from '../lib/discovery'
import type { StorybookOptions } from '../lib/storybook-links'
import { PrototypeLabApp } from './prototype-lab-app'

export interface ViewerOptions {
  /** Where the component tree finds Storybook pages to link to; `false` shows no links. */
  storybook?: StorybookOptions | false
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
      />
    </StrictMode>
  )
}
