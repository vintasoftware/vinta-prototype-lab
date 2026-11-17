import { existsSync } from 'node:fs'
import path from 'node:path'
import type { Plugin } from 'vite'

/** How long the build output has to stay still before the page reloads. */
export const SETTLE_MS = 150

/** How long a reload waits for a rebuild that never finishes before it gives up. */
export const WAIT_LIMIT_MS = 30_000

/** What the page loads from the build. A reload while one of them is missing leaves the page blank. */
const PAGE_FILES = ['index.js', 'viewer.css']

export interface OwnBuildReloadOptions {
  /** Whether a file exists. Tests pass their own. */
  exists?: (file: string) => boolean
}

/**
 * Reloads the page when the viewer's own built files change, as they do while the package is
 * linked from a checkout and rebuilt. Swapping the module in place would leave the screens holding
 * the old copy's React context and the viewer the new one's, and every `useScreenNavigation` would
 * then fail. An installed copy never changes, so for it this does nothing.
 *
 * A full build empties the build folder and writes the script before the stylesheet, so the reload
 * waits until the output has been still for a moment and the page's files are all there. A page
 * reloaded in that gap finds no stylesheet, fails to start and stays blank. A stylesheet changed in
 * place still updates in place; one written afresh is part of a rebuild and reloads with it.
 */
export function ownBuildReload(buildDir: string, { exists = existsSync }: OwnBuildReloadOptions = {}): Plugin {
  const inside = (file: string) => {
    const relative = path.relative(buildDir, file)
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  }
  const complete = () => PAGE_FILES.every(name => exists(path.join(buildDir, name)))

  let timer: ReturnType<typeof setTimeout> | undefined
  let waitingSince = 0
  // Vite asks once per environment, the browser's and the server's; each one asking is reloaded.
  const waiting = new Set<{ send: (payload: { type: 'full-reload' }) => void }>()

  const reloadWhenReady = (hot: { send: (payload: { type: 'full-reload' }) => void }) => {
    if (timer === undefined) {
      waitingSince = Date.now()
    }
    waiting.add(hot)
    clearTimeout(timer)
    timer = setTimeout(function check() {
      if (complete()) {
        for (const channel of waiting) {
          channel.send({ type: 'full-reload' })
        }
      } else if (Date.now() - waitingSince < WAIT_LIMIT_MS) {
        timer = setTimeout(check, SETTLE_MS)
        return
      }
      timer = undefined
      waiting.clear()
    }, SETTLE_MS)
  }

  return {
    name: 'prototype-lab:own-build-reload',
    apply: 'serve',
    hotUpdate({ file, type }) {
      if (!inside(file)) {
        return
      }
      if (file.endsWith('.css') && type === 'update' && timer === undefined) {
        return
      }
      reloadWhenReady(this.environment.hot)
      return []
    },
  }
}
