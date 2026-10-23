import path from 'node:path'
import type { Plugin } from 'vite'

/**
 * Reloads the page when the viewer's own built files change, as they do while the package is
 * linked from a checkout and rebuilt in watch mode. Swapping the module in place would leave the
 * screens holding the old copy's React context and the viewer the new one's, and every
 * `useScreenNavigation` would then fail. Stylesheets still update in place. An installed copy never
 * changes, so for it this does nothing.
 */
export function ownBuildReload(buildDir: string): Plugin {
  const inside = (file: string) => {
    const relative = path.relative(buildDir, file)
    return relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  }

  return {
    name: 'prototype-lab:own-build-reload',
    apply: 'serve',
    hotUpdate({ file }) {
      if (!inside(file) || file.endsWith('.css')) {
        return
      }
      this.environment.hot.send({ type: 'full-reload' })
      return []
    },
  }
}
