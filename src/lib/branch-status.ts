/**
 * Where the dev server answers what the branch picker shows. `GET` it for the status; `POST` to
 * `/switch`, `/install` and `/dismiss` under it to act.
 */
export const BRANCHES_ENDPOINT = '/__branches'

/** Folder, at the top of the host project's repository, that the viewer keeps its own state in. */
export const STATE_FOLDER = '.prototype-lab'

/** Where tools editing the project leave a marker for as long as they are at work. */
export const SESSIONS_FOLDER = `${STATE_FOLDER}/sessions`

/** Something that stops a switch outright. Nothing in the picker overrides it. */
export type BranchBlocker =
  | { kind: 'uncommitted'; files: string[] }
  | { kind: 'operation'; operation: 'merge' | 'rebase' | 'cherry-pick' | 'revert' | 'bisect' | 'git' }

/** Something worth knowing before a switch. The picker asks for a second click. */
export type BranchWarning =
  | { kind: 'recent-change'; file: string; secondsAgo: number }
  | { kind: 'session'; name: string; startedAt: string }

/** The lockfile changed between the branch left and the branch now checked out. */
export interface DependencyChange {
  lockfile: string
  /** The command the dev server runs when asked, e.g. `pnpm install`. */
  command: string
}

/** What the last switch left to tell, kept until it is dismissed so a reload does not lose it. */
export interface AfterSwitch {
  from: string
  to: string
  dependencies?: DependencyChange
  /** What happened to the local-only files, when it was more than putting them back. */
  notes: string[]
}

export interface BranchStatus {
  /** The branch checked out, or `null` on a detached HEAD. */
  current: string | null
  /** The commit checked out, abbreviated. */
  head: string
  /** Every local branch, sorted as git sorts them. */
  branches: string[]
  blockers: BranchBlocker[]
  warnings: BranchWarning[]
  afterSwitch?: AfterSwitch
}

/** What `POST /switch` answers when the switch went through. */
export interface SwitchResult {
  switched: string
  afterSwitch?: AfterSwitch
}
