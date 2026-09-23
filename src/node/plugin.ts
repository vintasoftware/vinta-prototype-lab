import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin, PluginOption } from 'vite'
import { annotationsWriter } from '../dev/annotations-writer'
import { stampJsxSource } from '../dev/stamp-jsx-source'
import type { StorybookOptions } from '../lib/storybook-links'

/** The name screens import from, and the name the generated entry imports the viewer by. */
export const PACKAGE_NAME = 'vinta-prototype-lab'

/** Name of the plugin that serves the viewer. The CLI looks for it in a project's config file. */
export const VIEWER_PLUGIN_NAME = 'prototype-lab:viewer'

/** What the page's script tag asks for, and the id the plugin answers it with. */
export const ENTRY_URL = '/@prototype-lab/entry.js'
const ENTRY_ID = '\0prototype-lab:entry.js'

/** The folder name the viewer reads prototypes from. It is part of how a screen file is recognised. */
const PROTOTYPES_FOLDER = 'prototypes'

export interface PrototypeLabOptions {
  /**
   * The project root the paths below are relative to. Defaults to the directory the command runs
   * in, which is also Vite's default root.
   */
  root?: string
  /** Folder holding one sub-folder per prototype. It must be named `prototypes`. Defaults to `prototypes`. */
  dir?: string
  /**
   * The project's own stylesheets, loaded after the viewer's so their tokens win. Leave it out to
   * give screens Tailwind with the package's shadcn/ui theme.
   */
  css?: string | string[]
  /** Where the component tree finds Storybook pages to link to; `false` shows no links. */
  storybook?: StorybookOptions | false
  /** The page title. Defaults to `Prototype Lab`. */
  title?: string
  /** Adds `@vitejs/plugin-react`. Pass `false` when the project's config already has it. */
  react?: boolean
  /** Adds `@tailwindcss/vite`. Pass `false` when the project's config already has it. */
  tailwind?: boolean
}

function toPosix(file: string): string {
  return file.split(path.sep).join('/')
}

/** A path as a glob that matches only itself, whatever characters its folders are named with. */
function escapeGlob(file: string): string {
  return file.replace(/[()[\]{}*?!+@]/g, '\\$&')
}

/**
 * The notes files of a prototypes folder, as a watcher ignore pattern.
 *
 * The viewer writes these itself and shows the result, so letting the watcher see the write would
 * only reload the page and throw away what is on screen. The screens beside them stay watched.
 */
export function annotationsIgnorePattern(prototypesDir: string): string {
  return `${escapeGlob(toPosix(prototypesDir))}/*/annotations.json`
}

/** The prototypes folder as an absolute path, or an error saying what is wrong with it. */
export function resolvePrototypesDir(root: string, dir = PROTOTYPES_FOLDER): string {
  const resolved = path.resolve(root, dir)
  const inside = path.relative(root, resolved)

  if (inside.startsWith('..') || path.isAbsolute(inside)) {
    throw new Error(`prototype-lab: "${dir}" is outside the project root ${root}. Keep the prototypes inside it.`)
  }
  if (path.basename(resolved) !== PROTOTYPES_FOLDER) {
    throw new Error(`prototype-lab: the prototypes folder must be named "${PROTOTYPES_FOLDER}", got "${dir}".`)
  }
  return resolved
}

export interface EntryOptions {
  root: string
  prototypesDir: string
  css: readonly string[]
  storybook?: StorybookOptions | false
}

/**
 * The module the page loads. It globs the project's prototype folders, so adding a folder is all it
 * takes to add a prototype, and hands the files to the viewer.
 *
 * The viewer's stylesheet goes first so the project's stylesheets, loaded after it, win wherever
 * both set the same token.
 */
export function entryCode({ root, prototypesDir, css, storybook }: EntryOptions): string {
  const base = `/${toPosix(path.relative(root, prototypesDir))}`
  const stylesheets =
    css.length === 0
      ? [`${PACKAGE_NAME}/default.css`]
      : css.map(file => `/${toPosix(path.relative(root, path.resolve(root, file)))}`)
  const options = storybook === undefined ? {} : { storybook }

  return [
    `import '${PACKAGE_NAME}/viewer.css'`,
    ...stylesheets.map(file => `import ${JSON.stringify(file)}`),
    `import { mountViewer } from '${PACKAGE_NAME}'`,
    '',
    `const docs = import.meta.glob('${base}/*/prototype.md', { query: '?raw', import: 'default', eager: true })`,
    `const annotations = import.meta.glob('${base}/*/annotations.json', { import: 'default', eager: true })`,
    `const screens = import.meta.glob('${base}/*/screens/*.tsx', { eager: true })`,
    '',
    `mountViewer({ docs, annotations, screens }, ${JSON.stringify(options)})`,
    '',
  ].join('\n')
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
}

/** The page the viewer runs in. It exists only in memory, so a project's own `index.html` is left alone. */
export function indexHtml(title: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(title)}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="${ENTRY_URL}"></script>
  </body>
</html>
`
}

/**
 * Serves the viewer's page and entry. The page is kept in memory and answered at `/` in dev, and
 * handed to the build as `index.html`, so the viewer runs from a project that has no page for it.
 */
function viewerPlugin(root: string, prototypesDir: string, options: PrototypeLabOptions): Plugin {
  const htmlPath = path.join(root, 'index.html')
  const css = options.css === undefined ? [] : [options.css].flat()
  const title = options.title ?? 'Prototype Lab'
  const screensGlob = `${toPosix(path.relative(root, prototypesDir))}/*/screens/*.tsx`
  const notesIgnored = annotationsIgnorePattern(prototypesDir)

  return {
    name: VIEWER_PLUGIN_NAME,
    enforce: 'pre',
    config(config, env) {
      return {
        // A built copy opens from any folder; the viewer routes by hash, so no path depends on where.
        ...(env.command === 'build' && config.base === undefined ? { base: './' } : {}),
        resolve: { dedupe: ['react', 'react-dom'] },
        // An array, so Vite adds it to whatever the project ignores, be that a list, a glob, a
        // RegExp or a function. `watch: null` turns the watcher off, and giving it options would
        // turn it back on.
        ...(config.server?.watch === null ? {} : { server: { watch: { ignored: [notesIgnored] } } }),
        optimizeDeps: {
          // The page is not on disk, so Vite cannot scan it for dependencies. The screens are.
          entries: [screensGlob],
          include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
        },
        build: { rollupOptions: { input: htmlPath } },
      }
    },
    configResolved(config) {
      if (path.resolve(config.root) !== root) {
        throw new Error(
          `prototype-lab: Vite's root is ${config.root}, but the plugin was set up for ${root}. Pass the same \`root\` to both.`
        )
      }
    },
    resolveId(id) {
      if (id === ENTRY_URL) {
        return ENTRY_ID
      }
      if (id === htmlPath) {
        return htmlPath
      }
      return null
    },
    load(id) {
      if (id === ENTRY_ID) {
        return entryCode({
          root,
          prototypesDir,
          css,
          ...(options.storybook === undefined ? {} : { storybook: options.storybook }),
        })
      }
      if (id === htmlPath) {
        return indexHtml(title)
      }
      return null
    },
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const url = (request.url ?? '').split('?')[0]
        const base = server.config.base
        if (url !== base && url !== `${base}index.html`) {
          next()
          return
        }

        server
          .transformIndexHtml(request.url ?? '/', indexHtml(title), request.originalUrl)
          .then(html => {
            response.statusCode = 200
            response.setHeader('Content-Type', 'text/html')
            response.end(html)
          })
          .catch(next)
      })
    },
  }
}

/**
 * The Vite plugins that run the viewer over a project's `prototypes/` folder: the page and its entry,
 * the dev-server endpoints that write comments and names back to the files, and (unless turned off)
 * React and Tailwind.
 *
 * ```ts
 * // prototype-lab.config.ts
 * import { defineConfig } from 'vite'
 * import { prototypeLab } from 'vinta-prototype-lab/vite'
 *
 * export default defineConfig({ plugins: [prototypeLab({ css: './src/styles.css' })] })
 * ```
 */
export function prototypeLab(options: PrototypeLabOptions = {}): PluginOption[] {
  const root = path.resolve(options.root ?? process.cwd())
  const prototypesDir = resolvePrototypesDir(root, options.dir)

  return [
    viewerPlugin(root, prototypesDir, options),
    stampJsxSource({ root }),
    annotationsWriter({ prototypesDir, root }),
    ...(options.tailwind === false ? [] : [tailwindcss()]),
    ...(options.react === false ? [] : [react()]),
  ]
}
