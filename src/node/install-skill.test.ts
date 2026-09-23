// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { bundledSkillsDir, installSkills, skillsTarget } from './install-skill'

describe('bundledSkillsDir', () => {
  it('finds skills/ at the package root from the built CLI', () => {
    expect(bundledSkillsDir('/pkg/dist/cli.js')).toBe('/pkg/skills')
  })

  it('finds skills/ at the package root from the source', () => {
    expect(bundledSkillsDir('/pkg/src/node/install-skill.ts')).toBe('/pkg/skills')
  })
})

describe('skillsTarget', () => {
  it("defaults to the project's .claude/skills", () => {
    expect(skillsTarget({ cwd: '/project' })).toBe('/project/.claude/skills')
  })

  it('takes another folder, relative to the project', () => {
    expect(skillsTarget({ cwd: '/project', target: '.agents/skills' })).toBe('/project/.agents/skills')
  })

  it("installs for the user into the home folder's .claude/skills", () => {
    expect(skillsTarget({ cwd: '/project', global: true, home: '/home/ana' })).toBe('/home/ana/.claude/skills')
  })
})

describe('installSkills', () => {
  let project: string

  beforeEach(async () => {
    project = await mkdtemp(path.join(os.tmpdir(), 'prototype-lab-skill-'))
  })

  afterEach(async () => {
    await rm(project, { recursive: true, force: true })
  })

  it('copies the build-prototype skill the package ships', async () => {
    const result = await installSkills({ cwd: project })
    const installed = path.join(project, '.claude/skills/build-prototype/SKILL.md')

    expect(result).toEqual({
      target: path.join(project, '.claude/skills'),
      installed: ['build-prototype'],
      skipped: [],
    })
    expect(await readFile(installed, 'utf8')).toContain('name: build-prototype')
  })

  it('leaves a copy the team has edited alone', async () => {
    const existing = path.join(project, '.claude/skills/build-prototype')
    await mkdir(existing, { recursive: true })
    await writeFile(path.join(existing, 'SKILL.md'), 'our edits')

    const result = await installSkills({ cwd: project })

    expect(result.skipped).toEqual(['build-prototype'])
    expect(result.installed).toEqual([])
    expect(await readFile(path.join(existing, 'SKILL.md'), 'utf8')).toBe('our edits')
  })

  it('replaces that copy when forced', async () => {
    const existing = path.join(project, '.claude/skills/build-prototype')
    await mkdir(existing, { recursive: true })
    await writeFile(path.join(existing, 'SKILL.md'), 'our edits')

    await installSkills({ cwd: project, force: true })

    expect(await readFile(path.join(existing, 'SKILL.md'), 'utf8')).toContain('name: build-prototype')
  })

  it('writes nothing on a dry run', async () => {
    const result = await installSkills({ cwd: project, dryRun: true })

    expect(result.installed).toEqual(['build-prototype'])
    await expect(readFile(path.join(project, '.claude/skills/build-prototype/SKILL.md'))).rejects.toThrow()
  })
})
