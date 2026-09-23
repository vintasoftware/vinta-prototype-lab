import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { build, createServer, type InlineConfig, preview, type ResolvedConfig } from 'vite'
import { installSkills } from './install-skill'
import { type PrototypeLabOptions, prototypeLab, VIEWER_PLUGIN_NAME } from './plugin'

const DEFAULT_PORT = 6007
const DEFAULT_OUT_DIR = 'prototype-lab-dist'
const CONFIG_FILES = [
  'prototype-lab.config.ts',
  'prototype-lab.config.mts',
  'prototype-lab.config.js',
  'prototype-lab.config.mjs',
]

const HELP = `Usage: prototype-lab <command> [options]

Commands
  dev              Run the viewer with live editing of comments and names (default port ${DEFAULT_PORT})
  build            Write a static, read-only copy of the viewer
  preview          Serve the copy that build wrote
  install-skill    Copy the build-prototype agent skill into this project

Viewer options (dev, build, preview)
  --dir <path>        Prototypes folder, named "prototypes" (default: prototypes)
  --css <path>        The project's stylesheet; repeat for more than one
  --storybook <url>   Where the project's Storybook runs (default: http://localhost:6006)
  --no-storybook      Show no Storybook links
  --config <path>     Vite config to use (default: prototype-lab.config.{ts,mts,js,mjs} when present)
  --port <number>     Port to serve on
  --host              Listen on the network too
  --open              Open the browser
  --out-dir <path>    Where build writes, and preview reads (default: ${DEFAULT_OUT_DIR})

install-skill options
  --target <path>     Skills folder to install into (default: .claude/skills; use .agents/skills for other agents)
  --global            Install into ~/.claude/skills
  --force             Replace a skill that is already installed
  --dry-run           Say what would be copied, and copy nothing

  -h, --help          Show this help
  -v, --version       Show the version
`

function packageVersion(): string {
  const here = path.dirname(fileURLToPath(import.meta.url))
  for (const candidate of [path.join(here, '..', 'package.json'), path.join(here, '..', '..', 'package.json')]) {
    if (existsSync(candidate)) {
      return (JSON.parse(readFileSync(candidate, 'utf8')) as { version: string }).version
    }
  }
  return 'unknown'
}

/** The config file to load: the one named on the command line, or the first one found. */
export function findConfigFile(root: string, asked: string | undefined): string | undefined {
  if (asked !== undefined) {
    const file = path.resolve(root, asked)
    if (!existsSync(file)) {
      throw new Error(`prototype-lab: no config file at ${file}.`)
    }
    return file
  }
  return CONFIG_FILES.map(name => path.join(root, name)).find(file => existsSync(file))
}

export interface ViewerFlags {
  dir?: string | undefined
  css?: string[] | undefined
  storybook?: string | undefined
  noStorybook?: boolean | undefined
}

/** The plugin options the command-line flags ask for. */
export function optionsFromFlags(root: string, flags: ViewerFlags): PrototypeLabOptions {
  const options: PrototypeLabOptions = { root }
  if (flags.dir !== undefined) {
    options.dir = flags.dir
  }
  if (flags.css !== undefined && flags.css.length > 0) {
    options.css = flags.css
  }
  if (flags.noStorybook === true) {
    options.storybook = false
  } else if (flags.storybook !== undefined) {
    options.storybook = { url: flags.storybook }
  }
  return options
}

/**
 * The Vite config a command runs with. A project with a config file sets the viewer up there, so the
 * viewer flags would be ignored; asking for both is reported rather than half-applied.
 */
export function viewerConfig(root: string, configFile: string | undefined, flags: ViewerFlags): InlineConfig {
  if (configFile === undefined) {
    return { root, configFile: false, plugins: [prototypeLab(optionsFromFlags(root, flags))] }
  }

  const given = [
    flags.dir !== undefined && '--dir',
    (flags.css?.length ?? 0) > 0 && '--css',
    flags.storybook !== undefined && '--storybook',
    flags.noStorybook === true && '--no-storybook',
  ].filter(Boolean)
  if (given.length > 0) {
    throw new Error(
      `prototype-lab: ${given.join(', ')} cannot be combined with ${path.basename(configFile)}. Set them in prototypeLab({ … }) there.`
    )
  }
  return { root, configFile }
}

function assertViewerPlugin(config: ResolvedConfig, configFile: string | undefined): void {
  if (configFile !== undefined && !config.plugins.some(plugin => plugin.name === VIEWER_PLUGIN_NAME)) {
    throw new Error(
      `prototype-lab: ${path.basename(configFile)} does not add the viewer. Add prototypeLab() from 'vinta-prototype-lab/vite' to its plugins.`
    )
  }
}

function portOf(value: string | undefined): number | undefined {
  if (value === undefined) {
    return undefined
  }
  const port = Number(value)
  if (!Number.isInteger(port) || port < 0 || port > 65535) {
    throw new Error(`prototype-lab: --port must be a port number, got "${value}".`)
  }
  return port
}

export async function run(argv: string[], cwd: string = process.cwd()): Promise<void> {
  const { values, positionals } = parseArgs({
    args: argv,
    allowPositionals: true,
    options: {
      dir: { type: 'string' },
      css: { type: 'string', multiple: true },
      storybook: { type: 'string' },
      'no-storybook': { type: 'boolean' },
      config: { type: 'string' },
      port: { type: 'string' },
      host: { type: 'boolean' },
      open: { type: 'boolean' },
      'out-dir': { type: 'string' },
      target: { type: 'string' },
      global: { type: 'boolean' },
      force: { type: 'boolean' },
      'dry-run': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
      version: { type: 'boolean', short: 'v' },
    },
  })

  const [command = 'help'] = positionals

  if (values.version === true) {
    console.log(packageVersion())
    return
  }
  if (values.help === true || command === 'help') {
    console.log(HELP)
    return
  }

  if (command === 'install-skill') {
    const result = await installSkills({
      cwd,
      ...(values.target === undefined ? {} : { target: values.target }),
      ...(values.global === undefined ? {} : { global: values.global }),
      ...(values.force === undefined ? {} : { force: values.force }),
      ...(values['dry-run'] === undefined ? {} : { dryRun: values['dry-run'] }),
    })
    const verb = values['dry-run'] === true ? 'Would install' : 'Installed'
    for (const skill of result.installed) {
      console.log(`${verb} ${skill} into ${path.relative(cwd, path.join(result.target, skill)) || '.'}`)
    }
    for (const skill of result.skipped) {
      console.log(`Skipped ${skill}: it is already in ${result.target}. Pass --force to replace it.`)
    }
    return
  }

  const flags: ViewerFlags = {
    dir: values.dir,
    css: values.css,
    storybook: values.storybook,
    noStorybook: values['no-storybook'],
  }
  const configFile = findConfigFile(cwd, values.config)
  const config = viewerConfig(cwd, configFile, flags)
  const port = portOf(values.port)
  const host = values.host === true ? { host: true } : {}
  const outDir = path.resolve(cwd, values['out-dir'] ?? DEFAULT_OUT_DIR)

  if (command === 'dev') {
    const server = await createServer({
      ...config,
      server: { port: port ?? DEFAULT_PORT, ...host, ...(values.open === true ? { open: true } : {}) },
    })
    assertViewerPlugin(server.config, configFile)
    await server.listen()
    server.printUrls()
    server.bindCLIShortcuts({ print: true })
    return
  }

  if (command === 'build') {
    await build({ ...config, build: { outDir, emptyOutDir: true } })
    console.log(`Wrote the viewer to ${path.relative(cwd, outDir)}. Serve it with: prototype-lab preview`)
    return
  }

  if (command === 'preview') {
    const server = await preview({
      ...config,
      build: { outDir },
      preview: { port: port ?? DEFAULT_PORT, ...host, ...(values.open === true ? { open: true } : {}) },
    })
    server.printUrls()
    return
  }

  throw new Error(`prototype-lab: unknown command "${command}". Run prototype-lab --help for the list.`)
}
