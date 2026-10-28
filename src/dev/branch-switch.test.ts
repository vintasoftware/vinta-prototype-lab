// @vitest-environment node
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, utimes, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  activeSessions,
  type BranchContext,
  branchStatus,
  dependencyChange,
  findRepository,
  fromLocalViewer,
  insideRepository,
  installDependencies,
  operationInProgress,
  parsePorcelain,
  RECENT_CHANGE_MS,
  RecentChanges,
  STALE_SESSION_MS,
  switchBranch,
  uncommittedFiles,
} from './branch-switch'

const NOW = Date.parse('2026-10-28T12:00:00Z')
const SERVED = ['http://localhost:6007/']

let top: string

function run(...args: string[]): string {
  return execFileSync('git', args, {
    cwd: top,
    encoding: 'utf8',
    env: {
      ...process.env,
      // The person's own git config — signing, hooks, a default branch — stays out of the fixture.
      GIT_CONFIG_GLOBAL: '/dev/null',
      GIT_CONFIG_NOSYSTEM: '1',
      GIT_AUTHOR_NAME: 'Test',
      GIT_AUTHOR_EMAIL: 'test@example.com',
      GIT_COMMITTER_NAME: 'Test',
      GIT_COMMITTER_EMAIL: 'test@example.com',
    },
  })
}

async function write(file: string, content: string): Promise<void> {
  await mkdir(path.dirname(path.join(top, file)), { recursive: true })
  await writeFile(path.join(top, file), content, 'utf8')
}

const read = (file: string) => readFile(path.join(top, file), 'utf8')

async function commit(message: string, files: Record<string, string>): Promise<void> {
  for (const [file, content] of Object.entries(files)) {
    await write(file, content)
  }
  run('add', '-A')
  run('commit', '--quiet', '--no-verify', '-m', message)
}

async function context(localOnlyFiles: string[] = [], recent = new RecentChanges()): Promise<BranchContext> {
  const repository = await findRepository(top)
  if (repository === undefined) {
    throw new Error('not a repository')
  }
  return { repository, localOnlyFiles, recent, now: () => NOW, isAlive: () => true }
}

beforeEach(async () => {
  // realpath: on macOS the temporary folder sits behind a symlink, and git answers the real path.
  top = execFileSync('realpath', [await mkdtemp(path.join(tmpdir(), 'prototype-lab-git-'))], {
    encoding: 'utf8',
  }).trim()
  run('init', '--quiet', '-b', 'main')
  await commit('first', {
    'pnpm-workspace.yaml': 'packages:\n  - packages/*\n',
    'pnpm-lock.yaml': 'lockfileVersion: 9\n',
    'prototypes/home/prototype.md': '# Home\n',
  })
  run('branch', 'feature-notes')
})

afterEach(async () => {
  await rm(top, { recursive: true, force: true })
})

describe('parsePorcelain', () => {
  it('reads each path, and both paths of a rename', () => {
    const output = [' M src/a.ts', '?? new file.ts', 'R  to.ts', 'from.ts', 'A  added.ts', ''].join('\0')

    expect(parsePorcelain(output)).toEqual(['src/a.ts', 'new file.ts', 'to.ts', 'from.ts', 'added.ts'])
  })

  it('reads nothing from a clean tree', () => {
    expect(parsePorcelain('')).toEqual([])
  })
})

describe('uncommittedFiles', () => {
  it('leaves out the local-only files and the viewer state folder', () => {
    const output = [
      ' M pnpm-workspace.yaml',
      ' M pnpm-lock.yaml',
      '?? .prototype-lab/sessions/abc.json',
      ' M src/a.ts',
      '',
    ].join('\0')

    expect(uncommittedFiles(output, ['pnpm-workspace.yaml', 'pnpm-lock.yaml'])).toEqual(['src/a.ts'])
  })
})

describe('insideRepository', () => {
  it('keeps a path inside the repository, and refuses one that climbs out', () => {
    expect(insideRepository('/repo', 'pnpm-lock.yaml')).toBe('pnpm-lock.yaml')
    expect(insideRepository('/repo', '/repo/packages/a.ts')).toBe('packages/a.ts')
    expect(insideRepository('/repo', '../other/file')).toBeUndefined()
    expect(insideRepository('/repo', '/repo')).toBeUndefined()
  })
})

describe('fromLocalViewer', () => {
  const json = 'application/json'

  it('takes a write from the viewer on a loopback address of this server', () => {
    for (const host of ['localhost:6007', '127.0.0.1:6007', '[::1]:6007']) {
      expect(fromLocalViewer({ host, origin: `http://${host}`, 'content-type': json }, 'POST', SERVED), host).toBe(true)
    }
  })

  it('refuses a write with no origin, another origin, or without JSON', () => {
    const host = 'localhost:6007'
    expect(fromLocalViewer({ host, 'content-type': json }, 'POST', SERVED)).toBe(false)
    expect(fromLocalViewer({ host, origin: 'http://evil.test', 'content-type': json }, 'POST', SERVED)).toBe(false)
    expect(fromLocalViewer({ host, origin: 'http://localhost:9999', 'content-type': json }, 'POST', SERVED)).toBe(false)
    expect(
      fromLocalViewer({ host, origin: 'http://localhost:6007', 'content-type': 'text/plain' }, 'POST', SERVED)
    ).toBe(false)
  })

  it('refuses a host name that is not loopback, as a rebound DNS name or a --host address would be', () => {
    for (const host of ['evil.test:6007', '192.168.0.10:6007', 'localhost:6008', '']) {
      expect(fromLocalViewer({ host, origin: `http://${host}`, 'content-type': json }, 'POST', SERVED), host).toBe(
        false
      )
      expect(fromLocalViewer({ host }, 'GET', SERVED), host).toBe(false)
    }
  })

  it('reads the status for a same-origin request or one with no origin', () => {
    expect(fromLocalViewer({ host: 'localhost:6007' }, 'GET', SERVED)).toBe(true)
    expect(fromLocalViewer({ host: 'localhost:6007', origin: 'http://localhost:6007' }, 'GET', SERVED)).toBe(true)
    expect(fromLocalViewer({ host: 'localhost:6007', origin: 'http://evil.test' }, 'GET', SERVED)).toBe(false)
  })
})

describe('RecentChanges', () => {
  it('lists the files changed within the window, the latest first', () => {
    const recent = new RecentChanges()
    recent.record('old.ts', NOW - RECENT_CHANGE_MS - 1)
    recent.record('a.ts', NOW - 90_000)
    recent.record('b.ts', NOW - 5_000)

    expect(recent.since(NOW, () => false)).toEqual([
      { kind: 'recent-change', file: 'b.ts', secondsAgo: 5 },
      { kind: 'recent-change', file: 'a.ts', secondsAgo: 90 },
    ])
  })

  it('leaves out exempt files', () => {
    const recent = new RecentChanges()
    recent.record('pnpm-lock.yaml', NOW)

    expect(recent.since(NOW, file => file === 'pnpm-lock.yaml')).toEqual([])
  })

  it('forgets everything, and ignores what the switch itself changes', () => {
    const recent = new RecentChanges()
    recent.record('a.ts', NOW - 1_000)
    recent.quiet(NOW + 3_000)
    recent.record('b.ts', NOW + 1_000)
    recent.record('c.ts', NOW + 4_000)

    expect(recent.since(NOW + 5_000, () => false).map(change => change.file)).toEqual(['c.ts'])
  })
})

describe('activeSessions', () => {
  const marker = (id: string, body: unknown) => write(`.prototype-lab/sessions/${id}.json`, JSON.stringify(body))

  it('lists a live session by its name', async () => {
    await marker('abc', { name: 'Claude Code', startedAt: new Date(NOW - 60_000).toISOString(), pid: 42 })

    expect(await activeSessions(top, NOW, () => true)).toEqual([
      { kind: 'session', name: 'Claude Code', startedAt: new Date(NOW - 60_000).toISOString() },
    ])
  })

  it('ignores a marker whose process is gone', async () => {
    await marker('abc', { name: 'Claude Code', startedAt: new Date(NOW).toISOString(), pid: 42 })

    expect(await activeSessions(top, NOW, () => false)).toEqual([])
  })

  it('ignores a marker that has not been touched in too long', async () => {
    const startedAt = new Date(NOW - STALE_SESSION_MS - 60_000)
    await marker('abc', { name: 'Claude Code', startedAt: startedAt.toISOString() })
    await utimes(path.join(top, '.prototype-lab/sessions/abc.json'), startedAt, startedAt)

    expect(await activeSessions(top, NOW, () => true)).toEqual([])
  })

  it('counts a marker touched recently as fresh, however long ago the session started', async () => {
    const startedAt = new Date(NOW - STALE_SESSION_MS - 60_000)
    await marker('abc', { name: 'Long session', startedAt: startedAt.toISOString() })
    const touched = new Date(NOW - 60_000)
    await utimes(path.join(top, '.prototype-lab/sessions/abc.json'), touched, touched)

    expect((await activeSessions(top, NOW, () => true)).map(session => session.name)).toEqual(['Long session'])
  })

  it('ignores a marker it cannot read', async () => {
    await write('.prototype-lab/sessions/bad.json', '{ not json')
    await marker('nameless', { startedAt: new Date(NOW).toISOString() })

    expect(await activeSessions(top, NOW, () => true)).toEqual([])
  })

  it('reads no sessions where there is no folder for them', async () => {
    expect(await activeSessions(top, NOW)).toEqual([])
  })
})

describe('operationInProgress', () => {
  it('names a merge, rebase or running git command left in the git folder', async () => {
    const { gitDir } = (await findRepository(top)) ?? { gitDir: '' }
    expect(await operationInProgress(gitDir)).toBeUndefined()

    await writeFile(path.join(gitDir, 'MERGE_HEAD'), 'abc\n')
    expect(await operationInProgress(gitDir)).toBe('merge')
    await rm(path.join(gitDir, 'MERGE_HEAD'))

    await mkdir(path.join(gitDir, 'rebase-merge'))
    expect(await operationInProgress(gitDir)).toBe('rebase')
    await rm(path.join(gitDir, 'rebase-merge'), { recursive: true })

    await writeFile(path.join(gitDir, 'index.lock'), '')
    expect(await operationInProgress(gitDir)).toBe('git')
  })
})

describe('branchStatus', () => {
  it('lists the branches and the one checked out', async () => {
    const status = await branchStatus(await context())

    expect(status.current).toBe('main')
    expect(status.branches).toEqual(['feature-notes', 'main'])
    expect(status.blockers).toEqual([])
    expect(status.warnings).toEqual([])
  })

  it('blocks on an uncommitted or untracked file, naming it, but not on a local-only file', async () => {
    await write('pnpm-workspace.yaml', 'overrides:\n  vinta-prototype-lab: link:../vinta-prototype-lab\n')
    await write('prototypes/home/prototype.md', '# Home, edited\n')
    await write('prototypes/home/screens/10-home.tsx', 'export default () => null\n')

    const status = await branchStatus(await context(['pnpm-workspace.yaml']))

    expect(status.blockers).toEqual([
      { kind: 'uncommitted', files: ['prototypes/home/prototype.md', 'prototypes/home/screens/10-home.tsx'] },
    ])
  })

  it('warns about recent changes and live sessions, but not about the local-only files', async () => {
    const recent = new RecentChanges()
    recent.record('prototypes/home/prototype.md', NOW - 30_000)
    recent.record('pnpm-lock.yaml', NOW - 1_000)
    await write(
      '.prototype-lab/sessions/abc.json',
      JSON.stringify({ name: 'Claude Code', startedAt: new Date(NOW).toISOString() })
    )

    const status = await branchStatus(await context(['pnpm-lock.yaml'], recent))

    expect(status.warnings).toEqual([
      { kind: 'session', name: 'Claude Code', startedAt: new Date(NOW).toISOString() },
      { kind: 'recent-change', file: 'prototypes/home/prototype.md', secondsAgo: 30 },
    ])
  })
})

describe('switchBranch', () => {
  it('switches to a local branch', async () => {
    run('switch', '--quiet', 'feature-notes')
    await commit('notes', { 'prototypes/notes/prototype.md': '# Notes\n' })
    run('switch', '--quiet', 'main')

    const result = await switchBranch(await context(), { branch: 'feature-notes', confirm: false })

    expect(result).toEqual({ status: 200, body: { switched: 'feature-notes' } })
    expect(run('symbolic-ref', '--short', 'HEAD').trim()).toBe('feature-notes')
    expect(await read('prototypes/notes/prototype.md')).toBe('# Notes\n')
  })

  it('refuses a name that is not a local branch, without running it', async () => {
    for (const branch of ['--orphan=x', 'origin/main', 'nope', 'main; rm -rf /']) {
      const result = await switchBranch(await context(), { branch, confirm: true })
      expect(result.status, branch).toBe(400)
    }
    expect(run('symbolic-ref', '--short', 'HEAD').trim()).toBe('main')
  })

  it('refuses the branch already checked out', async () => {
    expect((await switchBranch(await context(), { branch: 'main', confirm: true })).status).toBe(400)
  })

  it('never switches over uncommitted work, and leaves it as it was', async () => {
    await write('prototypes/home/prototype.md', '# Home, edited\n')

    const result = await switchBranch(await context(), { branch: 'feature-notes', confirm: true })

    expect(result.status).toBe(409)
    expect(run('symbolic-ref', '--short', 'HEAD').trim()).toBe('main')
    expect(await read('prototypes/home/prototype.md')).toBe('# Home, edited\n')
    expect(run('stash', 'list')).toBe('')
  })

  it('never switches during a merge', async () => {
    const { gitDir } = (await findRepository(top)) ?? { gitDir: '' }
    await writeFile(path.join(gitDir, 'MERGE_HEAD'), 'abc\n')

    const result = await switchBranch(await context(), { branch: 'feature-notes', confirm: true })

    expect(result.status).toBe(409)
    expect(run('symbolic-ref', '--short', 'HEAD').trim()).toBe('main')
  })

  it('asks for confirmation when there is a warning, and switches once given', async () => {
    const recent = new RecentChanges()
    recent.record('prototypes/home/prototype.md', NOW - 10_000)

    const unconfirmed = await switchBranch(await context([], recent), { branch: 'feature-notes', confirm: false })
    expect(unconfirmed.status).toBe(409)
    expect('status' in unconfirmed.body && unconfirmed.body.status?.warnings).toHaveLength(1)
    expect(run('symbolic-ref', '--short', 'HEAD').trim()).toBe('main')

    const confirmed = await switchBranch(await context([], recent), { branch: 'feature-notes', confirm: true })
    expect(confirmed.status).toBe(200)
  })

  it('keeps the local-only files as they were across the switch', async () => {
    const linked = 'packages:\n  - packages/*\noverrides:\n  vinta-prototype-lab: link:../vinta-prototype-lab\n'
    await write('pnpm-workspace.yaml', linked)
    await write('pnpm-lock.yaml', 'lockfileVersion: 9\n# linked\n')
    run('add', 'pnpm-lock.yaml')

    const result = await switchBranch(await context(['pnpm-workspace.yaml', 'pnpm-lock.yaml']), {
      branch: 'feature-notes',
      confirm: false,
    })

    expect(result).toEqual({ status: 200, body: { switched: 'feature-notes' } })
    expect(await read('pnpm-workspace.yaml')).toBe(linked)
    expect(await read('pnpm-lock.yaml')).toBe('lockfileVersion: 9\n# linked\n')
    expect(run('stash', 'list')).toBe('')
  })

  it("merges a local edit onto the branch's own change to the same file", async () => {
    run('switch', '--quiet', 'feature-notes')
    await commit('catalog', { 'pnpm-workspace.yaml': 'catalog:\n  react: ^19\npackages:\n  - packages/*\n' })
    run('switch', '--quiet', 'main')
    await write('pnpm-workspace.yaml', 'packages:\n  - packages/*\noverrides:\n  a: link:../a\n')

    const result = await switchBranch(await context(['pnpm-workspace.yaml']), {
      branch: 'feature-notes',
      confirm: false,
    })

    expect(result.status).toBe(200)
    expect(await read('pnpm-workspace.yaml')).toBe(
      'catalog:\n  react: ^19\npackages:\n  - packages/*\noverrides:\n  a: link:../a\n'
    )
    expect('switched' in result.body && result.body.afterSwitch?.notes).toEqual([
      'pnpm-workspace.yaml changed on this branch too. Your local edit was applied on top of it.',
    ])
  })

  it('keeps the local copy when its edit overlaps the branch change', async () => {
    run('switch', '--quiet', 'feature-notes')
    await commit('packages', { 'pnpm-workspace.yaml': 'packages:\n  - apps/*\n' })
    run('switch', '--quiet', 'main')
    await write('pnpm-workspace.yaml', 'packages:\n  - libs/*\n')

    const result = await switchBranch(await context(['pnpm-workspace.yaml']), {
      branch: 'feature-notes',
      confirm: false,
    })

    expect(result.status).toBe(200)
    expect(await read('pnpm-workspace.yaml')).toBe('packages:\n  - libs/*\n')
    expect('switched' in result.body && result.body.afterSwitch?.notes[0]).toMatch(/overlaps it\. Your copy was kept/)
  })

  it('puts the local-only files back when git refuses the switch', async () => {
    // A branch checked out in another worktree is listed, but git will not check it out twice.
    const elsewhere = await mkdtemp(path.join(tmpdir(), 'prototype-lab-worktree-'))
    run('worktree', 'add', '--quiet', path.join(elsewhere, 'tree'), 'feature-notes')
    await write('pnpm-workspace.yaml', 'local edit\n')

    try {
      const result = await switchBranch(await context(['pnpm-workspace.yaml']), {
        branch: 'feature-notes',
        confirm: false,
      })

      expect(result.status).toBe(409)
      expect('error' in result.body && result.body.error).toMatch(/git could not switch/)
      expect(run('symbolic-ref', '--short', 'HEAD').trim()).toBe('main')
      expect(await read('pnpm-workspace.yaml')).toBe('local edit\n')
    } finally {
      run('worktree', 'remove', '--force', path.join(elsewhere, 'tree'))
      await rm(elsewhere, { recursive: true, force: true })
    }
  })

  it('says when the lockfile differs on the new branch, and keeps saying it after a reload', async () => {
    run('switch', '--quiet', 'feature-notes')
    await commit('deps', { 'pnpm-lock.yaml': 'lockfileVersion: 9\npackages: {}\n' })
    run('switch', '--quiet', 'main')

    const result = await switchBranch(await context(), { branch: 'feature-notes', confirm: false })

    const afterSwitch = {
      from: 'main',
      to: 'feature-notes',
      notes: [],
      dependencies: { lockfile: 'pnpm-lock.yaml', command: 'pnpm install' },
    }
    expect(result).toEqual({ status: 200, body: { switched: 'feature-notes', afterSwitch } })
    expect((await branchStatus(await context())).afterSwitch).toEqual(afterSwitch)
  })
})

describe('dependencyChange', () => {
  it('finds no change between commits with the same lockfile', async () => {
    expect(await dependencyChange(top, 'main', 'feature-notes')).toBeUndefined()
  })
})

describe('installDependencies', () => {
  it('runs only the install the last switch called for, and then forgets it', async () => {
    run('switch', '--quiet', 'feature-notes')
    await commit('deps', { 'pnpm-lock.yaml': 'lockfileVersion: 9\npackages: {}\n' })
    run('switch', '--quiet', 'main')
    await switchBranch(await context(), { branch: 'feature-notes', confirm: false })
    const ran: string[] = []

    const result = await installDependencies(await context(), async (command, args, cwd) => {
      ran.push(`${command} ${args.join(' ')} in ${cwd}`)
    })

    expect(result).toEqual({ status: 200, body: { installed: 'pnpm install' } })
    expect(ran).toEqual([`pnpm install in ${top}`])
    expect((await branchStatus(await context())).afterSwitch).toBeUndefined()
  })

  it('runs nothing when no switch called for it', async () => {
    const ran: string[] = []

    const result = await installDependencies(await context(), async command => {
      ran.push(command)
    })

    expect(result.status).toBe(409)
    expect(ran).toEqual([])
  })
})
