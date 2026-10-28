import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { BranchStatus, SwitchResult } from '../lib/branch-status'
import { type BranchesApi, BranchSwitchError } from '../lib/branches-api'
import { BranchPicker, timeAgo } from './branch-picker'

const CLEAN: BranchStatus = {
  current: 'main',
  head: 'abc1234',
  branches: ['feature-clinical-notes', 'feature/billing-prototype', 'main'],
  blockers: [],
  warnings: [],
}

function fakeApi(status: BranchStatus | undefined, overrides: Partial<BranchesApi> = {}) {
  return {
    fetchStatus: vi.fn(async () => status),
    switchBranch: vi.fn(async (branch: string): Promise<SwitchResult> => ({ switched: branch })),
    installDependencies: vi.fn(async () => ({ installed: 'pnpm install' })),
    dismissAfterSwitch: vi.fn(async () => {}),
    reload: vi.fn(),
    ...overrides,
  } satisfies BranchesApi
}

async function openPicker() {
  await userEvent.click(await screen.findByRole('combobox', { name: 'Branch' }))
}

describe('timeAgo', () => {
  it('reads seconds as the picker says them', () => {
    expect(timeAgo(3)).toBe('just now')
    expect(timeAgo(40)).toBe('40 seconds ago')
    expect(timeAgo(60)).toBe('1 minute ago')
    expect(timeAgo(200)).toBe('3 minutes ago')
    expect(timeAgo(7200)).toBe('2 hours ago')
  })
})

describe('BranchPicker', () => {
  it('shows nothing when the dev server offers no branches', async () => {
    const api = fakeApi(undefined)
    const { container } = render(<BranchPicker api={api} />)

    await vi.waitFor(() => expect(api.fetchStatus).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('shows the branch checked out, and switches to the one picked, then reloads', async () => {
    const api = fakeApi(CLEAN)
    render(<BranchPicker api={api} />)

    expect(await screen.findByRole('combobox', { name: 'Branch' })).toHaveTextContent('main')
    await openPicker()
    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual([
      'feature-clinical-notes',
      'feature/billing-prototype',
      'main',
    ])

    await userEvent.click(screen.getByRole('option', { name: 'feature-clinical-notes' }))

    expect(api.switchBranch).toHaveBeenCalledWith('feature-clinical-notes', false)
    await vi.waitFor(() => expect(api.reload).toHaveBeenCalled())
  })

  it('names a detached HEAD by its commit', async () => {
    render(<BranchPicker api={fakeApi({ ...CLEAN, current: null })} />)

    expect(await screen.findByRole('combobox', { name: 'Branch' })).toHaveTextContent('abc1234 (detached)')
  })

  it('blocks the switch and names the files with uncommitted changes', async () => {
    const files = ['a.ts', 'b.ts', 'c.ts', 'd.ts', 'e.ts', 'f.ts', 'g.ts', 'h.ts']
    const api = fakeApi({ ...CLEAN, blockers: [{ kind: 'uncommitted', files }] })
    render(<BranchPicker api={api} />)

    await openPicker()

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent("Can't switch branches")
    expect(alert).toHaveTextContent('a.ts')
    expect(alert).toHaveTextContent('and 2 more')
    expect(alert).not.toHaveTextContent('h.ts')

    await userEvent.click(screen.getByRole('option', { name: 'feature-clinical-notes' }))
    expect(api.switchBranch).not.toHaveBeenCalled()
  })

  it('blocks the switch during a merge', async () => {
    render(<BranchPicker api={fakeApi({ ...CLEAN, blockers: [{ kind: 'operation', operation: 'merge' }] })} />)

    await openPicker()

    expect(screen.getByRole('alert')).toHaveTextContent('A merge is in progress')
  })

  it('warns about a session and a recent change, and switches only once confirmed', async () => {
    const api = fakeApi({
      ...CLEAN,
      warnings: [
        {
          kind: 'session',
          name: 'Claude Code (clinical notes)',
          startedAt: new Date(Date.now() - 120_000).toISOString(),
        },
        { kind: 'recent-change', file: 'prototypes/notes/screens/10-list.tsx', secondsAgo: 45 },
      ],
    })
    render(<BranchPicker api={api} />)

    await openPicker()
    expect(screen.getByText(/is editing this project/)).toHaveTextContent(
      'Claude Code (clinical notes) is editing this project (started 2 minutes ago).'
    )
    expect(screen.getByText(/changed 45 seconds ago/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('option', { name: 'feature-clinical-notes' }))
    expect(api.switchBranch).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(screen.getAllByRole('option')).toHaveLength(3)

    await userEvent.click(screen.getByRole('option', { name: 'feature-clinical-notes' }))
    await userEvent.click(screen.getByRole('button', { name: 'Switch anyway' }))

    expect(api.switchBranch).toHaveBeenCalledWith('feature-clinical-notes', true)
  })

  it('says it is switching while the switch runs', async () => {
    let finish: (result: SwitchResult) => void = () => {}
    const api = fakeApi(CLEAN, {
      switchBranch: vi.fn(() => new Promise<SwitchResult>(resolve => (finish = resolve))),
    })
    render(<BranchPicker api={api} />)

    await openPicker()
    await userEvent.click(screen.getByRole('option', { name: 'feature-clinical-notes' }))

    expect(screen.getByRole('status')).toHaveTextContent('Switching to feature-clinical-notes…')
    expect(screen.queryByRole('option')).not.toBeInTheDocument()

    finish({ switched: 'feature-clinical-notes' })
    await vi.waitFor(() => expect(api.reload).toHaveBeenCalled())
  })

  it('shows why a switch was refused, with the status the server sent back', async () => {
    const api = fakeApi(CLEAN, {
      switchBranch: vi.fn(async () => {
        throw new BranchSwitchError('Something in the repository stops the switch.', {
          ...CLEAN,
          blockers: [{ kind: 'uncommitted', files: ['prototypes/notes/prototype.md'] }],
        })
      }),
    })
    render(<BranchPicker api={api} />)

    await openPicker()
    await userEvent.click(screen.getByRole('option', { name: 'feature-clinical-notes' }))

    const alerts = await screen.findAllByRole('alert')
    expect(alerts[0]).toHaveTextContent('Something in the repository stops the switch.')
    expect(alerts[1]).toHaveTextContent('prototypes/notes/prototype.md')
    expect(api.reload).not.toHaveBeenCalled()
  })

  it('offers to install when the dependencies changed, and reloads after', async () => {
    const afterSwitch = {
      from: 'main',
      to: 'feature-clinical-notes',
      notes: [],
      dependencies: { lockfile: 'pnpm-lock.yaml', command: 'pnpm install' },
    }
    const api = fakeApi(CLEAN, {
      switchBranch: vi.fn(async () => ({ switched: 'feature-clinical-notes', afterSwitch })),
    })
    render(<BranchPicker api={api} />)

    await openPicker()
    await userEvent.click(screen.getByRole('option', { name: 'feature-clinical-notes' }))

    expect(await screen.findByText(/The dependencies changed/)).toBeInTheDocument()
    expect(api.reload).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole('button', { name: 'Run pnpm install' }))

    expect(api.installDependencies).toHaveBeenCalled()
    await vi.waitFor(() => expect(api.reload).toHaveBeenCalled())
  })

  it('opens on what the last switch left to say after the reload, and installs nothing unless asked', async () => {
    const api = fakeApi({
      ...CLEAN,
      current: 'feature-clinical-notes',
      afterSwitch: {
        from: 'main',
        to: 'feature-clinical-notes',
        notes: ['pnpm-workspace.yaml changed on this branch too. Your local edit was applied on top of it.'],
        dependencies: { lockfile: 'pnpm-lock.yaml', command: 'pnpm install' },
      },
    })
    render(<BranchPicker api={api} />)

    expect(await screen.findByText(/Your local edit was applied/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Not now' }))

    expect(api.dismissAfterSwitch).toHaveBeenCalled()
    expect(api.installDependencies).not.toHaveBeenCalled()
    expect(api.reload).not.toHaveBeenCalled()
    expect(screen.queryByText(/Your local edit was applied/)).not.toBeInTheDocument()
  })
})
