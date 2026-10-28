import { BRANCHES_ENDPOINT, type BranchStatus, type SwitchResult } from './branch-status'

/**
 * Whether the branch picker can be offered at all. It needs the dev server; a built copy has none.
 * The server still decides: a project that has not turned the picker on answers with no status.
 */
export function canSwitchBranches(): boolean {
  return import.meta.env.DEV
}

/** Why a switch did not go through, with the status as it stands when the server sent one. */
export class BranchSwitchError extends Error {
  readonly status: BranchStatus | undefined

  constructor(message: string, status?: BranchStatus) {
    super(message)
    this.status = status
  }
}

/** The branches and what stands in the way of a switch, or undefined when the server offers no picker. */
export async function fetchBranchStatus(): Promise<BranchStatus | undefined> {
  try {
    const response = await fetch(BRANCHES_ENDPOINT, { headers: { Accept: 'application/json' } })
    if (!response.ok) {
      return undefined
    }
    return (await response.json()) as BranchStatus
  } catch {
    return undefined
  }
}

async function post<T>(action: string, body: unknown): Promise<T> {
  const response = await fetch(`${BRANCHES_ENDPOINT}/${action}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const payload = (await response.json()) as T & { error?: string; status?: BranchStatus }
  if (!response.ok) {
    throw new BranchSwitchError(payload.error ?? `The dev server answered ${response.status}.`, payload.status)
  }
  return payload
}

/** Checks out `branch`. `confirm` says the warnings were seen. */
export function switchBranch(branch: string, confirm: boolean): Promise<SwitchResult> {
  return post('switch', { branch, confirm })
}

/** Runs the install the last switch called for. */
export function installDependencies(): Promise<{ installed: string }> {
  return post('install', {})
}

/** Forgets what the last switch had to tell. */
export async function dismissAfterSwitch(): Promise<void> {
  await post('dismiss', {})
}

export interface BranchesApi {
  fetchStatus: typeof fetchBranchStatus
  switchBranch: typeof switchBranch
  installDependencies: typeof installDependencies
  dismissAfterSwitch: typeof dismissAfterSwitch
  reload: () => void
}

export const BRANCHES_API: BranchesApi = {
  fetchStatus: fetchBranchStatus,
  switchBranch,
  installDependencies,
  dismissAfterSwitch,
  reload: () => window.location.reload(),
}
