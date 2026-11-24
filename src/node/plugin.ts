import { existsSync, readFileSync, realpathSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin, PluginOption } from 'vite'
import { annotationsWriter } from '../dev/annotations-writer'
import { ownBuildReload } from '../dev/own-build-reload'
import { type ShareOptions, type ShareSetup, type ShareStatus, shareStatus, shareUploader } from '../dev/share-uploader'
import { stampJsxSource } from '../dev/stamp-jsx-source'
import type { StorybookOptions } from '../lib/storybook-links'
import type { PlayerText } from '../player/player-text'

/** The name screens import from, and the name the generated entry imports the viewer by. */
export const PACKAGE_NAME = 'vinta-prototype-lab'

/** Name of the plugin that serves the viewer. The CLI looks for it in a project's config file. */
export const VIEWER_PLUGIN_NAME = 'prototype-lab:viewer'

/** What the page's script tag asks for, and the id the plugin answers it with. */
export const ENTRY_URL = '/@prototype-lab/entry.js'
const ENTRY_ID = '\0prototype-lab:entry.js'

/** Vite mode `prototype-lab player` builds in. The plugin then builds the tour player, not the viewer. */
export const PLAYER_MODE = 'player'

/** The file the player build writes when the project names none. */
export const PLAYER_FILE_NAME = 'tours.html'

/** The folder the player build writes to when the project names none. */
export const PLAYER_OUT_DIR = 'prototype-lab-player'

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
  /**
   * Shows the Mobile / Tablet / Desktop switcher in the header. Pass `false` for a project that
   * targets one form factor: the switcher goes, and every screen draws in its own `viewport`
   * unless a size is chosen in the device toolbar, which stays.
   */
  viewportSwitcher?: boolean
  /** The page title. Defaults to `Prototype Lab`. */
  title?: string
  /** Adds `@vitejs/plugin-react`. Pass `false` when the project's config already has it. */
  react?: boolean
  /** Adds `@tailwindcss/vite`. Pass `false` when the project's config already has it. */
  tailwind?: boolean
  /**
   * The guided tour player that `prototype-lab player` builds: the words on its home page, the name
   * of the one HTML file it writes (default `tours.html`), and the folder it writes it to (default
   * `prototype-lab-player`). Once that file exists, the viewer's header links to it.
   */
  player?: PlayerOptions
  /**
   * The S3-compatible bucket the viewer's Share button uploads static copies of a view to. Only
   * the non-secret parts belong here; the keys are read from the environment
   * (`PROTOTYPE_LAB_S3_ACCESS_KEY_ID` and `PROTOTYPE_LAB_S3_SECRET_ACCESS_KEY`), and every field
   * can be. Pass `false` to keep the upload out of the viewer. Downloading a copy works either way.
   */
  share?: ShareOptions | false
}

export type PlayerOptions = PlayerText & { fileName?: string; outDir?: string }

/** Where `prototype-lab player` writes the player, and so where the viewer looks for it. */
export function playerFile(root: string, player: PlayerOptions | undefined): { dir: string; name: string } {
  const name = player?.fileName ?? PLAYER_FILE_NAME
  if (name === '' || path.basename(name) !== name || !name.endsWith('.html')) {
    throw new Error(`prototype-lab: player.fileName must be a file name ending in .html, got "${name}".`)
  }
  return { dir: path.resolve(root, player?.outDir ?? PLAYER_OUT_DIR), name }
}

function toPosix(file: string): string {
  return file.split(path.sep).join('/')
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
  viewportSwitcher?: boolean
  /** The tour player's address, relative to the viewer's page. Given only when the player is built. */
  player?: string
  /** Whether the dev server can upload shares, and if not, what it is missing. Left out of a build. */
  share?: ShareStatus
}

/**
 * The module the page loads. It globs the project's prototype folders, so adding a folder is all it
 * takes to add a prototype, and hands the files to the viewer.
 *
 * The viewer's stylesheet goes first so the project's stylesheets, loaded after it, win wherever
 * both set the same token.
 */
export function entryCode({
  root,
  prototypesDir,
  css,
  storybook,
  viewportSwitcher,
  player,
  share,
}: EntryOptions): string {
  const base = `/${toPosix(path.relative(root, prototypesDir))}`
  const stylesheets =
    css.length === 0
      ? [`${PACKAGE_NAME}/default.css`]
      : css.map(file => `/${toPosix(path.relative(root, path.resolve(root, file)))}`)
  const options = {
    ...(storybook === undefined ? {} : { storybook }),
    ...(viewportSwitcher === undefined ? {} : { viewportSwitcher }),
    ...(player === undefined ? {} : { player }),
    ...(share === undefined ? {} : { share }),
  }

  return [
    `import '${PACKAGE_NAME}/viewer.css'`,
    ...stylesheets.map(file => `import ${JSON.stringify(file)}`),
    `import { mountViewer } from '${PACKAGE_NAME}'`,
    '',
    // `**` reaches prototypes inside group folders, e.g. `billing/refunds/prototype.md`.
    `const docs = import.meta.glob('${base}/**/prototype.md', { query: '?raw', import: 'default', eager: true })`,
    `const annotations = import.meta.glob('${base}/**/annotations.json', { import: 'default', eager: true })`,
    `const canvases = import.meta.glob('${base}/**/canvas.json', { import: 'default', eager: true })`,
    `const screens = import.meta.glob('${base}/**/screens/*.tsx', { eager: true })`,
    '',
    `mountViewer({ docs, annotations, screens, canvases }, ${JSON.stringify(options)})`,
    '',
  ].join('\n')
}

export interface PlayerEntryOptions {
  root: string
  prototypesDir: string
  css: readonly string[]
  text?: PlayerText
}

/**
 * The module the player's page loads: the same prototype files as the viewer's, plus every
 * `tours/*.json`, handed to the player.
 */
export function playerEntryCode({ root, prototypesDir, css, text }: PlayerEntryOptions): string {
  const base = `/${toPosix(path.relative(root, prototypesDir))}`
  const stylesheets =
    css.length === 0
      ? [`${PACKAGE_NAME}/default.css`]
      : css.map(file => `/${toPosix(path.relative(root, path.resolve(root, file)))}`)

  return [
    `import '${PACKAGE_NAME}/viewer.css'`,
    ...stylesheets.map(file => `import ${JSON.stringify(file)}`),
    `import { mountPlayer } from '${PACKAGE_NAME}'`,
    '',
    `const docs = import.meta.glob('${base}/**/prototype.md', { query: '?raw', import: 'default', eager: true })`,
    `const annotations = import.meta.glob('${base}/**/annotations.json', { import: 'default', eager: true })`,
    `const screens = import.meta.glob('${base}/**/screens/*.tsx', { eager: true })`,
    `const tours = import.meta.glob('${base}/**/tours/*.json', { import: 'default', eager: true })`,
    '',
    `mountPlayer({ docs, annotations, screens, tours }, ${JSON.stringify(text === undefined ? {} : { text })})`,
    '',
  ].join('\n')
}

/**
 * Folds the built script and stylesheet into the page, so the player is one HTML file that opens
 * with a double-click, offline, from `file://`. Fonts and images are inlined as data URLs by
 * `assetsInlineLimit`. The page is renamed to the file name the project asked for.
 */
export function inlineIntoPage(
  bundle: Record<string, { type: 'chunk' | 'asset'; fileName: string } & Record<string, unknown>>,
  fileName: string
): void {
  const page = Object.values(bundle).find(file => file.type === 'asset' && file.fileName.endsWith('.html'))
  if (page === undefined) {
    return
  }
  let html = String(page.source)
  for (const [name, file] of Object.entries(bundle)) {
    if (file.type === 'chunk' && file.isEntry === true) {
      const code = String(file.code).replace(/<\/script/gi, '<\\/script')
      html = html.replace(
        new RegExp(`<script[^>]*src="[^"]*${escapeRegExp(file.fileName)}"[^>]*></script>`),
        () => `<script type="module">${code}</script>`
      )
      delete bundle[name]
    } else if (file.type === 'asset' && file.fileName.endsWith('.css')) {
      const css = String(file.source).replace(/<\/style/gi, '<\\/style')
      html = html.replace(
        new RegExp(`<link[^>]*href="[^"]*${escapeRegExp(file.fileName)}"[^>]*>`),
        () => `<style>${css}</style>`
      )
      delete bundle[name]
    }
  }
  page.source = html
  page.fileName = fileName
}

/** The player page's title: the client's name, when the project gives one. */
function playerTitle(player: PrototypeLabOptions['player']): string {
  return player?.client === undefined || player.client === '' ? 'Guided tours' : `${player.client} · Guided tours`
}

/** Whether two paths name the same file, through symlinks such as macOS's /var to /private/var. */
function isFile(file: string, expected: string): boolean {
  if (path.basename(file) !== path.basename(expected)) {
    return false
  }
  const real = (dir: string) => (existsSync(dir) ? realpathSync(dir) : path.resolve(dir))
  return real(path.dirname(file)) === real(path.dirname(expected))
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
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
function viewerPlugin(
  root: string,
  prototypesDir: string,
  options: PrototypeLabOptions,
  shareSetup: () => ShareSetup | undefined
): Plugin {
  const htmlPath = path.join(root, 'index.html')
  const css = options.css === undefined ? [] : [options.css].flat()
  const title = options.title ?? 'Prototype Lab'
  const screensGlob = `${toPosix(path.relative(root, prototypesDir))}/**/screens/*.tsx`
  const tourPlayer = playerFile(root, options.player)
  const tourPlayerPath = path.join(tourPlayer.dir, tourPlayer.name)
  let player = false

  return {
    name: VIEWER_PLUGIN_NAME,
    enforce: 'pre',
    config(config, env) {
      player = env.mode === PLAYER_MODE
      const playerBuild = player
        ? {
            // One self-contained file: nothing to split, preload or load from beside it.
            assetsInlineLimit: Number.POSITIVE_INFINITY,
            cssCodeSplit: false,
            modulePreload: false,
            sourcemap: false,
            chunkSizeWarningLimit: 100_000,
            // `prototype-lab player --out-dir` and `vite build --outDir` win over the project's folder.
            ...(config.build?.outDir === undefined ? { outDir: tourPlayer.dir } : {}),
          }
        : {}
      return {
        // A built copy opens from any folder; the viewer routes by hash, so no path depends on where.
        ...(env.command === 'build' && config.base === undefined ? { base: './' } : {}),
        resolve: { dedupe: ['react', 'react-dom'] },
        optimizeDeps: {
          // The page is not on disk, so Vite cannot scan it for dependencies. The screens are.
          entries: [screensGlob],
          include: ['react', 'react-dom', 'react-dom/client', 'react/jsx-runtime', 'react/jsx-dev-runtime'],
        },
        build: { ...playerBuild, rollupOptions: { input: htmlPath } },
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
      if (id === ENTRY_ID && player) {
        const { fileName: _fileName, outDir: _outDir, ...text } = options.player ?? {}
        return playerEntryCode({ root, prototypesDir, css, text })
      }
      if (id === ENTRY_ID) {
        const share = shareSetup()
        return entryCode({
          root,
          prototypesDir,
          css,
          ...(options.storybook === undefined ? {} : { storybook: options.storybook }),
          ...(options.viewportSwitcher === undefined ? {} : { viewportSwitcher: options.viewportSwitcher }),
          // The viewer's page sits at the root of what is served or built, and the player beside it.
          ...(existsSync(tourPlayerPath) ? { player: tourPlayer.name } : {}),
          // Known only to the dev server; a build has no server to upload through.
          ...(share === undefined ? {} : { share: shareStatus(share) }),
        })
      }
      if (id === htmlPath) {
        return indexHtml(player ? playerTitle(options.player) : title)
      }
      return null
    },
    generateBundle() {
      // A built copy carries the player beside its page, so the header's link works there too.
      if (!player && existsSync(tourPlayerPath)) {
        this.emitFile({ type: 'asset', fileName: tourPlayer.name, source: readFileSync(tourPlayerPath) })
      }
    },
    configureServer(server) {
      // Building the player, or deleting it, shows or hides the header's link. The watcher reports a
      // new file only through its folder, and already watches a folder inside the project.
      server.watcher.add(tourPlayer.dir)
      const playerChanged = (file: string) => {
        if (!isFile(file, tourPlayerPath)) {
          return
        }
        const entry = server.moduleGraph.getModuleById(ENTRY_ID)
        if (entry !== undefined) {
          server.moduleGraph.invalidateModule(entry)
          server.ws.send({ type: 'full-reload' })
        }
      }
      server.watcher.on('add', playerChanged)
      server.watcher.on('unlink', playerChanged)

      server.middlewares.use((request, response, next) => {
        const url = (request.url ?? '').split('?')[0]
        const base = server.config.base
        if (url === `${base}${tourPlayer.name}` && request.method === 'GET' && existsSync(tourPlayerPath)) {
          response.statusCode = 200
          response.setHeader('Content-Type', 'text/html')
          response.end(readFileSync(tourPlayerPath))
          return
        }
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
 * Makes the player build one file. It runs after Vite has written the page, which the inlining needs.
 */
function playerSingleFile(options: PrototypeLabOptions): Plugin {
  let player = false
  return {
    name: 'prototype-lab:player-single-file',
    enforce: 'post',
    apply: 'build',
    config(_config, env) {
      player = env.mode === PLAYER_MODE
    },
    generateBundle(_output, bundle) {
      if (player) {
        inlineIntoPage(
          bundle as unknown as Parameters<typeof inlineIntoPage>[0],
          options.player?.fileName ?? PLAYER_FILE_NAME
        )
      }
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
  let setup: ShareSetup | undefined

  return [
    viewerPlugin(root, prototypesDir, options, () => setup),
    playerSingleFile(options),
    stampJsxSource({ root }),
    annotationsWriter({ prototypesDir, root }),
    shareUploader({
      share: options.share,
      onSetup: resolved => {
        setup = resolved
      },
    }),
    // This file runs from the package's build folder, which the page imports the viewer from.
    ownBuildReload(path.dirname(fileURLToPath(import.meta.url))),
    ...(options.tailwind === false ? [] : [tailwindcss()]),
    ...(options.react === false ? [] : [react()]),
  ]
}
