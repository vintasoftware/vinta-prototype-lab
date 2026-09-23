import { defineConfig } from 'tsdown'

/**
 * Two builds. The browser library screens import (`.`), and the Node side: the Vite plugin
 * (`./vite`) and the CLI behind the `prototype-lab` bin. `dist/viewer.css` is compiled by the
 * Tailwind CLI in the build script; the two stylesheets a project's own Tailwind reads are copied
 * as they are.
 */
export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    dts: true,
    sourcemap: true,
    clean: true,
    copy: [
      { from: 'src/theme.css', to: 'dist' },
      { from: 'src/default.css', to: 'dist' },
    ],
  },
  {
    entry: { vite: 'src/node/vite.ts', cli: 'src/node/bin.ts' },
    format: 'esm',
    platform: 'node',
    target: 'node20.19',
    // The package is `"type": "module"`, so plain `.js` is ESM and matches the paths in `exports`.
    outExtensions: () => ({ js: '.js', dts: '.d.ts' }),
    dts: true,
    sourcemap: true,
    clean: false,
  },
])
