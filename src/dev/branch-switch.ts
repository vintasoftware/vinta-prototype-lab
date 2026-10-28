import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { Connect, Plugin, ViteDevServer } from 'vite'
import { z } from 'zod'
import {
  type AfterSwitch,
  BRANCHES_ENDPOINT,
  type BranchBlocker,
  type BranchStatus,
  type BranchWarning,
  type DependencyChange,
  SESSIONS_FOLDER,
  STATE_FOLDER,
  type SwitchResult,
} from '../lib/branch-status'

export interface BranchSwitchOptions {
  /**
   * Files, from the top of the repository, a developer keeps changed on purpose and never commits —
   * a `pnpm-workspace.yaml` that links a package from a sibling checkout, and the lockfile that link
   * produces. They never block a switch, and the switch keeps their changes.
   */
  localOnlyFiles?: string[]
}

/** A file changed this recently is someone at work; switching under them is worth a second click. */
export const RECENT_CHANGE_MS = 5 * 60_000

/**
 * A session marker this old is taken to be left over from a session that ended without removing
 * it. Touching the file counts as activity, so a hook that runs on every prompt keeps it fresh.
 */
export const STALE_SESSION_MS = 12 * 60 * 60_000

/** How long after a switch the watcher's reports are the switch's own. */
const SWITCH_SETTLE_MS = 3_000

/** Where the last switch's report waits for the page that comes back after the reload. */
const AFTER_SWITCH_FILE = `${STATE_FOLDER}/branch-switch.json`

/** Where a local-only file's contents wait while the switch runs, so a crash cannot lose them. */
const LOCAL_ONLY_BACKUP = `${STATE_FOLDER}/local-only`

/** Each lockfile, and the install that brings `node_modules` in line with it. */
const LOCKFILES: readonly { file: string; command: readonly [string, ...string[]] }[] = [
  { file: 'pnpm-lock.yaml', command: ['pnpm', 'install'] },
  { file: 'package-lock.json', command: ['npm', 'install'] },
  { file: 'yarn.lock', command: ['yarn', 'install'] },
  { file: 'bun.lock', command: ['bun', 'install'] },
  { file: 'bun.lockb', command: ['bun', 'install'] },
]

/** Files whose presence in the git folder means an operation is half done. */
const IN_PROGRESS: readonly { file: string; operation: Extract<BranchBlocker, { kind: 'operation' }>['operation'] }[] =
  [
    { file: 'MERGE_HEAD', operation: 'merge' },
    { file: 'rebase-merge', operation: 'rebase' },
    { file: 'rebase-apply', operation: 'rebase' },
    { file: 'CHERRY_PICK_HEAD', operation: 'cherry-pick' },
    { file: 'REVERT_HEAD', operation: 'revert' },
    { file: 'BISECT_LOG', operation: 'bisect' },
    // Another git command — a commit, a checkout — is running right now.
    { file: 'index.lock', operation: 'git' },
  ]

export class GitError extends Error {
  /** git's exit code; for `merge-file`, how many conflicts it left. */
  readonly code: number | undefined

  constructor(message: string, code: number | undefined) {
    super(message)
    this.code = code
  }
}

/**
 * Runs one git command in the repository. Only fixed subcommands are ever passed, with no shell in
 * between, and git is told never to stop and ask for anything.
 */
export function git(cwd: string, args: readonly string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'git',
      args,
      {
        cwd,
        maxBuffer: 64 * 1024 * 1024,
        env: { ...process.env, GIT_TERMINAL_PROMPT: '0', GIT_OPTIONAL_LOCKS: '0', LC_ALL: 'C' },
      },
      (error, stdout, stderr) => {
        if (error) {
          const code = typeof error.code === 'number' ? error.code : undefined
          reject(new GitError((stderr || error.message).trim(), code))
          return
        }
        resolve(stdout)
      }
    )
  })
}

export interface Repository {
  /** The top of the working tree, which every path below is relative to. */
  top: string
  /** The git folder; for a worktree, its own folder under the main checkout's `.git/worktrees`. */
  gitDir: string
}

/** The repository a folder sits in, or undefined when it is not in one. */
export async function findRepository(folder: string): Promise<Repository | undefined> {
  try {
    const [top = '', gitDir = ''] = (await git(folder, ['rev-parse', '--show-toplevel', '--absolute-git-dir']))
      .trim()
      .split('\n')
    return { top, gitDir }
  } catch {
    return undefined
  }
}

/** Every local branch, as `git branch --list` names them. */
export async function listBranches(top: string): Promise<string[]> {
  const output = await git(top, ['branch', '--list', '--format=%(refname:short)'])
  return output.split('\n').filter(name => name !== '' && !name.startsWith('('))
}

/**
 * Reads `git status --porcelain -z` into the paths it lists. A rename lists both its paths, since
 * both are changes a switch would carry along or trip on.
 */
export function parsePorcelain(output: string): string[] {
  const fields = output.split('\0')
  const files: string[] = []
  for (let index = 0; index < fields.length; index++) {
    const field = fields[index] ?? ''
    if (field.length < 4) {
      continue
    }
    const code = field.slice(0, 2)
    files.push(field.slice(3))
    // A rename or copy carries the path it came from as the next field.
    if (code.includes('R') || code.includes('C')) {
      const from = fields[++index]
      if (from !== undefined && from !== '') {
        files.push(from)
      }
    }
  }
  return files
}

/** Whether a path, from the top of the repository, is one of the given files or inside the state folder. */
function isExempt(file: string, localOnlyFiles: readonly string[]): boolean {
  return localOnlyFiles.includes(file) || file === STATE_FOLDER || file.startsWith(`${STATE_FOLDER}/`)
}

/** The changed files a switch must not run over: everything but the local-only files and the viewer's own state. */
export function uncommittedFiles(porcelain: string, localOnlyFiles: readonly string[]): string[] {
  return [...new Set(parsePorcelain(porcelain))].filter(file => !isExempt(file, localOnlyFiles))
}

async function exists(file: string): Promise<boolean> {
  try {
    await stat(file)
    return true
  } catch {
    return false
  }
}

/** The git operation left half done in the repository, if any. */
export async function operationInProgress(
  gitDir: string
): Promise<Extract<BranchBlocker, { kind: 'operation' }>['operation'] | undefined> {
  for (const { file, operation } of IN_PROGRESS) {
    if (await exists(path.join(gitDir, file))) {
      return operation
    }
  }
  return undefined
}

/**
 * A session marker, as a tool writes it to `.prototype-lab/sessions/<id>.json` when a session
 * starts and removes when it ends.
 */
export const sessionMarkerSchema = z.object({
  /** What the picker calls the session, e.g. `Claude Code (feature-clinical-notes)`. */
  name: z.string().min(1),
  /** When the session started, as an ISO 8601 time. */
  startedAt: z.string().refine(value => !Number.isNaN(Date.parse(value)), 'an ISO 8601 time'),
  /** The process doing the editing. A marker whose process is gone is ignored. */
  pid: z.number().int().positive().optional(),
})

/** Whether a process is still running. One owned by another user still counts. */
export function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0)
    return true
  } catch (thrown) {
    return (thrown as NodeJS.ErrnoException).code === 'EPERM'
  }
}

/**
 * The sessions at work in the repository. A marker that cannot be read, is older than
 * {@link STALE_SESSION_MS} or names a process that is gone is ignored, so one left behind never locks
 * the picker.
 */
export async function activeSessions(
  top: string,
  now: number,
  isAlive: (pid: number) => boolean = processIsAlive
): Promise<Extract<BranchWarning, { kind: 'session' }>[]> {
  const folder = path.join(top, SESSIONS_FOLDER)
  let names: string[]
  try {
    names = (await readdir(folder)).filter(name => name.endsWith('.json')).sort()
  } catch {
    return []
  }

  const sessions: Extract<BranchWarning, { kind: 'session' }>[] = []
  for (const name of names) {
    const file = path.join(folder, name)
    try {
      const marker = sessionMarkerSchema.safeParse(JSON.parse(await readFile(file, 'utf8')))
      if (!marker.success) {
        continue
      }
      const touched = Math.max(Date.parse(marker.data.startedAt), (await stat(file)).mtimeMs)
      if (now - touched > STALE_SESSION_MS) {
        continue
      }
      if (marker.data.pid !== undefined && !isAlive(marker.data.pid)) {
        continue
      }
      sessions.push({ kind: 'session', name: marker.data.name, startedAt: marker.data.startedAt })
    } catch {
      // Removed while being read, or not JSON: either way not a session at work.
    }
  }
  return sessions
}

/**
 * When each file under watch last changed, as the dev server's watcher reports it. A switch changes
 * files too; those reports are dropped, so the switch does not warn about itself next time.
 */
export class RecentChanges {
  private readonly changed = new Map<string, number>()
  private quietUntil = 0

  record(file: string, at: number): void {
    if (at < this.quietUntil) {
      return
    }
    this.changed.set(file, at)
  }

  /** Forgets every change, and ignores what is reported until `until`. */
  quiet(until: number): void {
    this.changed.clear()
    this.quietUntil = until
  }

  /** The files changed within {@link RECENT_CHANGE_MS} of `now`, the latest first. */
  since(now: number, exempt: (file: string) => boolean): Extract<BranchWarning, { kind: 'recent-change' }>[] {
    const recent: Extract<BranchWarning, { kind: 'recent-change' }>[] = []
    for (const [file, at] of this.changed) {
      if (now - at > RECENT_CHANGE_MS) {
        this.changed.delete(file)
      } else if (!exempt(file)) {
        recent.push({ kind: 'recent-change', file, secondsAgo: Math.max(0, Math.round((now - at) / 1000)) })
      }
    }
    return recent.sort((a, b) => a.secondsAgo - b.secondsAgo)
  }
}

/** A path from the top of the repository, or undefined when it reaches outside it. */
export function insideRepository(top: string, file: string): string | undefined {
  const relative = path.relative(top, path.resolve(top, file))
  if (relative === '' || relative.startsWith('..') || path.isAbsolute(relative)) {
    return undefined
  }
  return relative.split(path.sep).join('/')
}

/** A file's contents at a commit, or null when the commit does not have it. */
async function contentAt(top: string, commit: string, file: string): Promise<string | null> {
  try {
    return await git(top, ['cat-file', 'blob', `${commit}:${file}`])
  } catch {
    return null
  }
}

async function readOrNull(file: string): Promise<string | null> {
  try {
    return await readFile(file, 'utf8')
  } catch (thrown) {
    if ((thrown as NodeJS.ErrnoException).code === 'ENOENT') {
      return null
    }
    throw thrown
  }
}

async function writeOrRemove(file: string, content: string | null): Promise<void> {
  if (content === null) {
    await rm(file, { force: true })
    return
  }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, content, 'utf8')
}

/** A local-only file's contents from before the switch. `null` when the file was not there. */
interface SavedFile {
  file: string
  content: string | null
}

/**
 * Puts a local-only file back as committed, after keeping a copy of it in the state folder. Files
 * that already match the commit are left alone and not returned.
 */
export async function setAsideLocalOnly(top: string, files: readonly string[]): Promise<SavedFile[]> {
  const saved: SavedFile[] = []
  for (const file of files) {
    const content = await readOrNull(path.join(top, file))
    const committed = await contentAt(top, 'HEAD', file)
    const staged = (await git(top, ['diff', '--cached', '--name-only', '-z', '--', file])) !== ''
    if (content === committed && !staged) {
      continue
    }

    if (content !== null) {
      await writeOrRemove(path.join(top, LOCAL_ONLY_BACKUP, file), content)
    }
    saved.push({ file, content })

    if (committed === null) {
      await git(top, ['rm', '--cached', '--quiet', '--ignore-unmatch', '--', file])
      await rm(path.join(top, file), { force: true })
    } else {
      await git(top, ['restore', '--source=HEAD', '--staged', '--worktree', '--', file])
    }
  }
  return saved
}

/**
 * The three-way merge of a local-only file the branch changed too: the local edit applied to the
 * branch's version. Undefined when the two edits overlap.
 */
async function mergeLocalEdit(top: string, ours: string, base: string, theirs: string): Promise<string | undefined> {
  const folder = await mkdtemp(path.join(tmpdir(), 'prototype-lab-merge-'))
  try {
    const [oursFile, baseFile, theirsFile] = ['ours', 'base', 'theirs'].map(name => path.join(folder, name)) as [
      string,
      string,
      string,
    ]
    await writeFile(oursFile, ours, 'utf8')
    await writeFile(baseFile, base, 'utf8')
    await writeFile(theirsFile, theirs, 'utf8')
    return await git(top, ['merge-file', '-p', oursFile, baseFile, theirsFile])
  } catch (thrown) {
    // Any other failure is git's, and is passed on.
    if (thrown instanceof GitError && thrown.code !== undefined && thrown.code > 0) {
      return undefined
    }
    throw thrown
  } finally {
    await rm(folder, { recursive: true, force: true })
  }
}

/**
 * Writes the local-only files back once the switch is done.
 *
 * Where the branch left a file as it was on the commit switched from, the saved contents go back as
 * they were. Where the branch changed it too, the local edit is merged onto the branch's version; if
 * the two overlap, the saved contents still win and a note says so. Either way the local edit is
 * never lost. Answers the notes.
 */
export async function restoreLocalOnly(
  top: string,
  saved: readonly SavedFile[],
  from: string,
  to: string
): Promise<string[]> {
  const notes: string[] = []
  for (const { file, content } of saved) {
    const base = from === to ? null : await contentAt(top, from, file)
    const theirs = from === to ? null : await contentAt(top, to, file)
    let next = content

    if (base !== theirs && content !== null && base !== null && theirs !== null) {
      const merged = await mergeLocalEdit(top, content, base, theirs)
      if (merged === undefined) {
        notes.push(
          `${file} changed on this branch too, and your local edit overlaps it. Your copy was kept; compare it with \`git diff\`.`
        )
      } else {
        next = merged
        notes.push(`${file} changed on this branch too. Your local edit was applied on top of it.`)
      }
    } else if (base !== theirs) {
      notes.push(`${file} differs on this branch. Your copy was kept; compare it with \`git diff\`.`)
    }

    await writeOrRemove(path.join(top, file), next)
    await rm(path.join(top, LOCAL_ONLY_BACKUP, file), { force: true })
  }
  return notes
}

/** The lockfile the commits disagree on, and the install it calls for. */
export async function dependencyChange(top: string, from: string, to: string): Promise<DependencyChange | undefined> {
  for (const { file, command } of LOCKFILES) {
    const [before, after] = await Promise.all([contentAt(top, from, file), contentAt(top, to, file)])
    if (before === null && after === null) {
      continue
    }
    return before === after ? undefined : { lockfile: file, command: command.join(' ') }
  }
  return undefined
}

async function readAfterSwitch(top: string): Promise<AfterSwitch | undefined> {
  try {
    return JSON.parse(await readFile(path.join(top, AFTER_SWITCH_FILE), 'utf8')) as AfterSwitch
  } catch {
    return undefined
  }
}

export async function clearAfterSwitch(top: string): Promise<void> {
  await rm(path.join(top, AFTER_SWITCH_FILE), { force: true })
}

export interface BranchContext {
  repository: Repository
  localOnlyFiles: readonly string[]
  recent: RecentChanges
  now: () => number
  isAlive?: (pid: number) => boolean
}

/** What the picker shows: the branches, and what stands in the way of leaving this one. */
export async function branchStatus(context: BranchContext): Promise<BranchStatus> {
  const { top, gitDir } = context.repository
  const now = context.now()

  const [current, head, branches, porcelain, operation, sessions, afterSwitch] = await Promise.all([
    git(top, ['symbolic-ref', '--quiet', '--short', 'HEAD']).then(
      name => name.trim(),
      () => null
    ),
    git(top, ['rev-parse', '--short', 'HEAD']).then(sha => sha.trim()),
    listBranches(top),
    git(top, ['status', '--porcelain=v1', '-z', '--untracked-files=all']),
    operationInProgress(gitDir),
    activeSessions(top, now, context.isAlive),
    readAfterSwitch(top),
  ])

  const blockers: BranchBlocker[] = []
  if (operation !== undefined) {
    blockers.push({ kind: 'operation', operation })
  }
  const files = uncommittedFiles(porcelain, context.localOnlyFiles)
  if (files.length > 0) {
    blockers.push({ kind: 'uncommitted', files })
  }

  const warnings: BranchWarning[] = [
    ...sessions,
    ...context.recent.since(now, file => isExempt(file, context.localOnlyFiles)),
  ]

  return { current, head, branches, blockers, warnings, ...(afterSwitch === undefined ? {} : { afterSwitch }) }
}

export interface SwitchRequest {
  branch: string
  /** The warnings were shown and the person chose to switch anyway. */
  confirm: boolean
}

export interface SwitchResponse {
  status: number
  body: SwitchResult | { error: string; status?: BranchStatus }
}

/**
 * Checks out another local branch, if nothing stands in the way.
 *
 * Everything is checked again here rather than taken from what the picker last showed, since the
 * repository may have changed since. Nothing is ever stashed, discarded or reset: a change outside
 * the local-only files stops the switch, and the local-only files are put back as they were, or as
 * near as the branch allows.
 */
export async function switchBranch(context: BranchContext, request: SwitchRequest): Promise<SwitchResponse> {
  const { top } = context.repository
  const status = await branchStatus(context)

  if (!status.branches.includes(request.branch)) {
    return { status: 400, body: { error: `There is no local branch named "${request.branch}".` } }
  }
  if (request.branch === status.current) {
    return { status: 400, body: { error: `${request.branch} is already checked out.` } }
  }
  if (status.blockers.length > 0) {
    return { status: 409, body: { error: 'Something in the repository stops the switch.', status } }
  }
  if (status.warnings.length > 0 && !request.confirm) {
    return { status: 409, body: { error: 'Confirm the warnings to switch anyway.', status } }
  }

  const from = (await git(top, ['rev-parse', 'HEAD'])).trim()
  const saved = await setAsideLocalOnly(top, context.localOnlyFiles)

  try {
    // The name is one `git branch --list` gave, and no branch name can start with `-`.
    await git(top, ['switch', '--no-guess', request.branch])
  } catch (thrown) {
    await restoreLocalOnly(top, saved, from, from)
    const reason = thrown instanceof Error ? thrown.message : String(thrown)
    return { status: 409, body: { error: `git could not switch: ${reason}` } }
  }

  const to = (await git(top, ['rev-parse', 'HEAD'])).trim()
  const notes = await restoreLocalOnly(top, saved, from, to)
  const dependencies = await dependencyChange(top, from, to)
  context.recent.quiet(context.now() + SWITCH_SETTLE_MS)

  const fromName = status.current ?? status.head
  let afterSwitch: AfterSwitch | undefined
  if (dependencies !== undefined || notes.length > 0) {
    afterSwitch = { from: fromName, to: request.branch, notes, ...(dependencies === undefined ? {} : { dependencies }) }
    await writeOrRemove(path.join(top, AFTER_SWITCH_FILE), `${JSON.stringify(afterSwitch, null, 2)}\n`)
  } else {
    await clearAfterSwitch(top)
  }

  return { status: 200, body: { switched: request.branch, ...(afterSwitch === undefined ? {} : { afterSwitch }) } }
}

/**
 * Runs the install the last switch called for. Only that one: the command comes from the lockfile
 * the switch found changed, never from the request.
 */
export async function installDependencies(
  context: BranchContext,
  run: (command: string, args: readonly string[], cwd: string) => Promise<void> = runCommand
): Promise<{ status: number; body: { installed: string } | { error: string } }> {
  const { top } = context.repository
  const afterSwitch = await readAfterSwitch(top)
  const lockfile = afterSwitch?.dependencies?.lockfile
  const known = LOCKFILES.find(entry => entry.file === lockfile)
  if (known === undefined) {
    return { status: 409, body: { error: 'The last switch did not change any dependencies.' } }
  }

  const [command, ...args] = known.command
  await run(command, args, top)
  await clearAfterSwitch(top)
  return { status: 200, body: { installed: known.command.join(' ') } }
}

function runCommand(command: string, args: readonly string[], cwd: string): Promise<void> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      // Package managers are `.cmd` files on Windows, which only a shell runs. The command is fixed.
      { cwd, maxBuffer: 64 * 1024 * 1024, shell: process.platform === 'win32' },
      (error, _stdout, stderr) => {
        if (error) {
          reject(new Error(`${command} ${args.join(' ')} failed: ${stderr.trim() || error.message}`))
          return
        }
        resolve()
      }
    )
  })
}

const LOOPBACK = new Set(['localhost', '127.0.0.1', '[::1]', '::1'])

function parseHost(host: string): { hostname: string; port: string } | undefined {
  try {
    const url = new URL(`http://${host}`)
    return { hostname: url.hostname, port: url.port }
  } catch {
    return undefined
  }
}

/**
 * Whether a request came from the viewer this dev server serves, opened on this machine.
 *
 * Switching branches rewrites the working tree, so this is stricter than the comment endpoints: the
 * `Host` must be a loopback name on one of this server's own ports, which keeps out a page that
 * points a name of its own at this machine. A write must also carry JSON and an `Origin` from that
 * same loopback address — a tool that sends no origin is turned away too. A `--host` address on the
 * network never qualifies.
 */
export function fromLocalViewer(
  headers: { host?: string | undefined; origin?: string | undefined; 'content-type'?: string | undefined },
  method: string,
  served: readonly string[]
): boolean {
  const ports = new Set(served.map(url => new URL(url).port))
  const host = parseHost(headers.host ?? '')
  if (host === undefined || !LOOPBACK.has(host.hostname) || !ports.has(host.port)) {
    return false
  }

  if (method === 'GET') {
    return headers.origin === undefined || sameLoopbackOrigin(headers.origin, host)
  }
  return (
    (headers['content-type'] ?? '').startsWith('application/json') &&
    headers.origin !== undefined &&
    sameLoopbackOrigin(headers.origin, host)
  )
}

function sameLoopbackOrigin(origin: string, host: { hostname: string; port: string }): boolean {
  try {
    const url = new URL(origin)
    return LOOPBACK.has(url.hostname) && url.port === host.port
  } catch {
    return false
  }
}

async function readJson(request: Connect.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = []
  for await (const chunk of request) {
    chunks.push(chunk as Buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  return text === '' ? {} : JSON.parse(text)
}

const switchRequestSchema = z.object({ branch: z.string().min(1).max(255), confirm: z.boolean().default(false) })

/**
 * The branch picker's endpoints, while `prototype-lab dev` runs. A built copy has no server and
 * never shows the picker.
 *
 * The repository is the one the project root sits in — for a package inside a monorepo, the
 * monorepo — and `localOnlyFiles` are paths from its top.
 */
export function branchSwitch(options: { root: string } & BranchSwitchOptions): Plugin {
  const recent = new RecentChanges()
  let repository: Promise<Repository | undefined> | undefined
  let busy = false

  return {
    name: 'prototype-lab:branch-switch',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      repository = findRepository(options.root)

      const context = async (): Promise<BranchContext | undefined> => {
        const found = await repository
        if (found === undefined) {
          return undefined
        }
        const localOnlyFiles = (options.localOnlyFiles ?? []).flatMap(file => {
          const inside = insideRepository(found.top, file)
          return inside === undefined ? [] : [inside]
        })
        return { repository: found, localOnlyFiles, recent, now: Date.now }
      }

      server.watcher.on('all', (event, file) => {
        if (event !== 'add' && event !== 'change' && event !== 'unlink') {
          return
        }
        void repository?.then(found => {
          const inside = found === undefined ? undefined : insideRepository(found.top, file)
          if (inside !== undefined && !inside.split('/').includes('node_modules')) {
            recent.record(inside, Date.now())
          }
        })
      })

      server.middlewares.use(BRANCHES_ENDPOINT, (request, response, next) => {
        const action = (request.url ?? '/').split('?')[0]
        const send = (status: number, body: unknown) => {
          response.statusCode = status
          response.setHeader('Content-Type', 'application/json')
          response.setHeader('Cache-Control', 'no-store')
          response.end(JSON.stringify(body))
        }
        const served = server.resolvedUrls?.local ?? []

        const isStatus = request.method === 'GET' && action === '/'
        const isWrite = request.method === 'POST' && ['/switch', '/install', '/dismiss'].includes(action ?? '')
        if (!isStatus && !isWrite) {
          next()
          return
        }

        void (async () => {
          if (!fromLocalViewer(request.headers, request.method ?? '', served)) {
            send(403, { error: 'Only the viewer this dev server serves, opened on this machine, may switch branches.' })
            return
          }
          const found = await context()
          if (found === undefined) {
            send(404, { error: 'The project is not in a git repository.' })
            return
          }

          if (isStatus) {
            send(200, await branchStatus(found))
            return
          }
          if (busy) {
            send(409, { error: 'A switch or an install is already running.' })
            return
          }

          busy = true
          try {
            if (action === '/switch') {
              const payload = switchRequestSchema.safeParse(await readJson(request))
              if (!payload.success) {
                send(400, { error: 'That request is not one this endpoint takes.' })
                return
              }
              const { status, body } = await switchBranch(found, payload.data)
              send(status, body)
            } else if (action === '/install') {
              const { status, body } = await installDependencies(found)
              send(status, body)
            } else {
              await clearAfterSwitch(found.repository.top)
              send(200, {})
            }
          } catch (thrown) {
            const detail = thrown instanceof Error ? thrown.stack : String(thrown)
            server.config.logger.error(`${BRANCHES_ENDPOINT}${action}: ${detail}`)
            send(500, {
              error:
                thrown instanceof Error
                  ? thrown.message
                  : 'That could not be carried out. The dev server log says why.',
            })
          } finally {
            busy = false
          }
        })()
      })
    },
  }
}
