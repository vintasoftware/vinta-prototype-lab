// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { findConfigFile, optionsFromFlags, run, viewerConfig } from './cli'

describe('optionsFromFlags', () => {
  it('passes only the flags that were given', () => {
    expect(optionsFromFlags('/project', {})).toEqual({ root: '/project' })
  })

  it('reads the folder, the stylesheets and the Storybook URL', () => {
    expect(
      optionsFromFlags('/project', { dir: 'design/prototypes', css: ['src/a.css'], storybook: 'http://localhost:6100' })
    ).toEqual({
      root: '/project',
      dir: 'design/prototypes',
      css: ['src/a.css'],
      storybook: { url: 'http://localhost:6100' },
    })
  })

  it('turns Storybook off', () => {
    expect(optionsFromFlags('/project', { noStorybook: true }).storybook).toBe(false)
  })
})

describe('config files', () => {
  let project: string

  beforeEach(async () => {
    project = await mkdtemp(path.join(os.tmpdir(), 'prototype-lab-cli-'))
  })

  afterEach(async () => {
    await rm(project, { recursive: true, force: true })
  })

  it('finds none in a project without one', () => {
    expect(findConfigFile(project, undefined)).toBeUndefined()
  })

  it('finds prototype-lab.config.ts', async () => {
    await writeFile(path.join(project, 'prototype-lab.config.ts'), 'export default {}')

    expect(findConfigFile(project, undefined)).toBe(path.join(project, 'prototype-lab.config.ts'))
  })

  it('says so when the file it was pointed at is not there', () => {
    expect(() => findConfigFile(project, 'vite.proto.ts')).toThrow(/no config file at/)
  })

  it('runs without a config file when there is none', () => {
    const config = viewerConfig(project, undefined, {})

    expect(config.configFile).toBe(false)
    expect(config.plugins?.length).toBeGreaterThan(0)
  })

  it('refuses viewer flags beside a config file rather than ignoring them', () => {
    expect(() => viewerConfig(project, path.join(project, 'prototype-lab.config.ts'), { dir: 'prototypes' })).toThrow(
      /--dir cannot be combined with prototype-lab.config.ts/
    )
  })

  it('installs the skill from the command line', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await run(['install-skill', '--target', '.agents/skills'], project)

    expect(await readFile(path.join(project, '.agents/skills/build-prototype/SKILL.md'), 'utf8')).toContain(
      'name: build-prototype'
    )
    expect(log).toHaveBeenCalledWith('Installed build-prototype into .agents/skills/build-prototype')
  })
})

describe('run', () => {
  it('prints the help when no command is given', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await run([])

    expect(log.mock.calls[0]?.[0]).toContain('Usage: prototype-lab <command>')
  })

  it('prints the version', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {})

    await run(['--version'])

    expect(log.mock.calls[0]?.[0]).toMatch(/^\d+\.\d+\.\d+/)
  })

  it('names an unknown command', async () => {
    await expect(run(['serve'], os.tmpdir())).rejects.toThrow(/unknown command "serve"/)
  })
})
