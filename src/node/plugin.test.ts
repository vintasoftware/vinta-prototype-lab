// @vitest-environment node
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer, type ViteDevServer } from 'vite'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { ENTRY_URL, entryCode, indexHtml, prototypeLab, resolvePrototypesDir } from './plugin'

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SERVER_TIMEOUT = 60_000

describe('resolvePrototypesDir', () => {
  it('defaults to a prototypes folder at the root', () => {
    expect(resolvePrototypesDir('/project')).toBe('/project/prototypes')
  })

  it('takes a prototypes folder deeper in the project', () => {
    expect(resolvePrototypesDir('/project', 'design/prototypes')).toBe('/project/design/prototypes')
  })

  it('refuses a folder with another name, since screen files are recognised by it', () => {
    expect(() => resolvePrototypesDir('/project', 'flows')).toThrow(/must be named "prototypes"/)
  })

  it('refuses a folder outside the project', () => {
    expect(() => resolvePrototypesDir('/project', '../prototypes')).toThrow(/outside the project root/)
  })
})

describe('entryCode', () => {
  it('globs the three kinds of file under the folder, from the root', () => {
    const code = entryCode({ root: '/project', prototypesDir: '/project/design/prototypes', css: [] })

    expect(code).toContain("import.meta.glob('/design/prototypes/*/prototype.md', { query: '?raw'")
    expect(code).toContain("import.meta.glob('/design/prototypes/*/annotations.json'")
    expect(code).toContain("import.meta.glob('/design/prototypes/*/screens/*.tsx', { eager: true })")
    expect(code).toContain('mountViewer({ docs, annotations, screens }, {})')
  })

  it("loads the viewer's stylesheet first and the default one when the project names none", () => {
    const code = entryCode({ root: '/project', prototypesDir: '/project/prototypes', css: [] })
    const imports = code.split('\n').filter(line => line.startsWith('import '))

    expect(imports).toEqual([
      "import 'vinta-prototype-lab/viewer.css'",
      'import "vinta-prototype-lab/default.css"',
      "import { mountViewer } from 'vinta-prototype-lab'",
    ])
  })

  it("loads the project's stylesheets after the viewer's, by their path from the root", () => {
    const code = entryCode({
      root: '/project',
      prototypesDir: '/project/prototypes',
      css: ['./src/styles.css', 'src/tokens.css'],
    })

    expect(code).toContain(
      'import \'vinta-prototype-lab/viewer.css\'\nimport "/src/styles.css"\nimport "/src/tokens.css"'
    )
    expect(code).not.toContain('default.css')
  })

  it('passes the Storybook options through', () => {
    const code = entryCode({
      root: '/project',
      prototypesDir: '/project/prototypes',
      css: [],
      storybook: { url: 'http://localhost:6100', marker: 'Design System' },
    })

    expect(code).toContain('{"storybook":{"url":"http://localhost:6100","marker":"Design System"}}')
  })
})

describe('indexHtml', () => {
  it('loads the entry and escapes the title', () => {
    const html = indexHtml('Flows <draft>')

    expect(html).toContain('<title>Flows &#60;draft&#62;</title>')
    expect(html).toContain(`<script type="module" src="${ENTRY_URL}"></script>`)
    expect(html).toContain('<div id="root"></div>')
  })
})

describe('prototypeLab', () => {
  it('adds React and Tailwind unless told not to', () => {
    const names = (plugins: ReturnType<typeof prototypeLab>) =>
      plugins.flat().map(plugin => (plugin as { name?: string } | undefined)?.name ?? '')

    const all = names(prototypeLab({ root: repo, dir: 'example/prototypes' }))
    const bare = names(prototypeLab({ root: repo, dir: 'example/prototypes', react: false, tailwind: false }))

    expect(all.some(name => name.startsWith('vite:react'))).toBe(true)
    expect(all.some(name => name.startsWith('@tailwindcss/vite'))).toBe(true)
    expect(bare).toEqual(['prototype-lab:viewer', 'prototype-lab:stamp-jsx-source', 'prototype-lab:annotations-writer'])
  })
})

/**
 * The globs are all that stands between a prototype folder and the viewer. A typo in one gives no
 * error and no prototypes, so this runs a dev server over the example folder and reads what the
 * entry expands to.
 */
describe('the dev server', () => {
  let server: ViteDevServer
  let origin: string

  beforeAll(async () => {
    server = await createServer({
      root: repo,
      configFile: false,
      logLevel: 'silent',
      server: { port: 0 },
      plugins: [prototypeLab({ root: repo, dir: 'example/prototypes', tailwind: false })],
      // The package's own name, pointed at its source the way the repo's vite.config.ts does.
      resolve: {
        alias: [
          { find: /^vinta-prototype-lab$/, replacement: path.join(repo, 'src/index.ts') },
          { find: /^vinta-prototype-lab\/(viewer|default)\.css$/, replacement: path.join(repo, 'src/$1.css') },
        ],
      },
    })
    await server.listen()
    origin = server.resolvedUrls?.local[0]?.replace(/\/$/, '') ?? ''
  }, SERVER_TIMEOUT)

  // Closing waits for Vite's first dependency pre-bundle, which takes a while on a cold cache.
  afterAll(async () => {
    await server.close()
  }, SERVER_TIMEOUT)

  it('serves the viewer page at the root', async () => {
    const response = await fetch(`${origin}/`)
    const html = await response.text()

    expect(response.headers.get('content-type')).toBe('text/html')
    expect(html).toContain('<title>Prototype Lab</title>')
    expect(html).toContain(ENTRY_URL)
  })

  it('expands the entry to every file of the example prototype', async () => {
    const result = await server.transformRequest(ENTRY_URL)
    const code = result?.code ?? ''

    for (const file of [
      'prototype.md',
      'annotations.json',
      'screens/10-home.tsx',
      'screens/20-choose-time.tsx',
      'screens/20-choose-time.no-slots.tsx',
      'screens/30-review.tsx',
      'screens/40-confirmed.tsx',
    ]) {
      expect(code).toContain(`/example/prototypes/patient-booking/${file}`)
    }
  })
})
