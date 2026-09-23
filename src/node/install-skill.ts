import { cp, readdir, stat } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * The `skills/` folder shipped with the package. The built CLI sits in `dist/`, and this file sits
 * in `src/node/` while the repo runs its own tests, and `skills/` is at the package root from both.
 */
export function bundledSkillsDir(from: string = fileURLToPath(import.meta.url)): string {
  let dir = path.dirname(from)
  while (path.basename(dir) !== 'dist' && path.basename(dir) !== 'src' && path.dirname(dir) !== dir) {
    dir = path.dirname(dir)
  }
  return path.join(path.dirname(dir), 'skills')
}

export interface InstallSkillOptions {
  /** The project the skills go into. */
  cwd: string
  /** Skills folder to install into, relative to `cwd`. Defaults to `.claude/skills`. */
  target?: string
  /** Install for the current user rather than the project: `~/.claude/skills`. */
  global?: boolean
  /** Replace a skill that is already installed. */
  force?: boolean
  /** Report what would be copied, and copy nothing. */
  dryRun?: boolean
  /** Where the skills are read from. Defaults to the package's own `skills/`. */
  source?: string
  /** Stands in for the user's home folder, for tests. */
  home?: string
}

export interface InstallSkillResult {
  target: string
  installed: string[]
  /** Skills left alone because they are already there. */
  skipped: string[]
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

/** The skills folder a set of options points at. */
export function skillsTarget(options: Pick<InstallSkillOptions, 'cwd' | 'target' | 'global' | 'home'>): string {
  if (options.global === true) {
    return path.join(options.home ?? os.homedir(), '.claude', 'skills')
  }
  return path.resolve(options.cwd, options.target ?? path.join('.claude', 'skills'))
}

/**
 * Copies the package's agent skills into a project, one folder per skill. A skill that is already
 * there is left alone unless `force` is set, since a team may have edited its copy.
 */
export async function installSkills(options: InstallSkillOptions): Promise<InstallSkillResult> {
  const source = options.source ?? bundledSkillsDir()
  const target = skillsTarget(options)
  const entries = await readdir(source, { withFileTypes: true })
  const skills = entries.filter(entry => entry.isDirectory()).map(entry => entry.name)

  const result: InstallSkillResult = { target, installed: [], skipped: [] }

  for (const skill of skills.sort()) {
    const destination = path.join(target, skill)
    if (options.force !== true && (await exists(destination))) {
      result.skipped.push(skill)
      continue
    }
    if (options.dryRun !== true) {
      await cp(path.join(source, skill), destination, { recursive: true, force: true })
    }
    result.installed.push(skill)
  }

  return result
}
