import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { prototypeLab } from './src/node/plugin'

const here = path.dirname(fileURLToPath(import.meta.url))

/**
 * Runs the viewer over the example prototypes, from source. It is the same plugin a project gets
 * from `vinta-prototype-lab/vite`; the aliases point the package's own name at `src`, so the example
 * screens import it the way a project's screens do.
 */
export default defineConfig({
  root: here,
  plugins: [prototypeLab({ root: here, dir: 'example/prototypes', css: 'example/styles.css', storybook: false })],
  resolve: {
    alias: [
      { find: /^vinta-prototype-lab$/, replacement: path.join(here, 'src/index.ts') },
      { find: /^vinta-prototype-lab\/viewer\.css$/, replacement: path.join(here, 'src/viewer.css') },
    ],
  },
  server: {
    port: 6007,
    // The viewer writes the notes files itself and shows the result, so reloading the page on every
    // comment would only throw away what is on screen. The screens stay watched.
    watch: { ignored: ['**/prototypes/*/annotations.json'] },
  },
  preview: { port: 6007 },
  build: { outDir: 'example-dist' },
})
