import { Check, ChevronsUpDown, GitBranch, LoaderCircle, OctagonX, TriangleAlert } from 'lucide-react'
import { type ReactNode, useCallback, useEffect, useState } from 'react'
import type { AfterSwitch, BranchBlocker, BranchStatus, BranchWarning } from '../lib/branch-status'
import { BRANCHES_API, type BranchesApi, BranchSwitchError } from '../lib/branches-api'
import {
  Button,
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui'
import { matchesSearch } from './prototype-picker'

/** How many changed files a blocker names before it says how many more there are. */
const FILES_SHOWN = 6

/** `just now`, `40 seconds ago`, `3 minutes ago`, `2 hours ago`. */
export function timeAgo(seconds: number): string {
  if (seconds < 10) {
    return 'just now'
  }
  if (seconds < 60) {
    return `${seconds} seconds ago`
  }
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) {
    return minutes === 1 ? '1 minute ago' : `${minutes} minutes ago`
  }
  const hours = Math.round(minutes / 60)
  return hours === 1 ? '1 hour ago' : `${hours} hours ago`
}

const OPERATION_TEXT: Record<Extract<BranchBlocker, { kind: 'operation' }>['operation'], string> = {
  merge: 'A merge is in progress. Finish or abort it first.',
  rebase: 'A rebase is in progress. Finish or abort it first.',
  'cherry-pick': 'A cherry-pick is in progress. Finish or abort it first.',
  revert: 'A revert is in progress. Finish or abort it first.',
  bisect: 'A bisect is in progress. Run `git bisect reset` first.',
  git: 'Another git command is running in this repository. Wait for it to finish.',
}

/** What the picker is doing, on top of listing the branches. */
type Step =
  | { kind: 'list' }
  | { kind: 'confirm'; branch: string }
  | { kind: 'switching'; branch: string }
  | { kind: 'installing'; command: string }

export interface BranchPickerProps {
  /** The calls the picker makes. Tests pass their own. */
  api?: BranchesApi
}

/**
 * The header's branch switcher, under `prototype-lab dev`: the project's local branches, and a
 * switch that refuses to run over someone's work. It shows nothing when the dev server offers no
 * branches, as in a project that has not turned it on.
 */
export function BranchPicker({ api = BRANCHES_API }: BranchPickerProps) {
  const [status, setStatus] = useState<BranchStatus | undefined>(undefined)
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>({ kind: 'list' })
  const [error, setError] = useState<string | undefined>(undefined)
  // Whether this page ran the switch, and so still shows the branch it was loaded on.
  const [switchedHere, setSwitchedHere] = useState(false)

  const refresh = useCallback(async () => {
    const next = await api.fetchStatus()
    setStatus(next)
    return next
  }, [api])

  useEffect(() => {
    void refresh().then(next => {
      // A switch that left something to say — changed dependencies — opens on it after the reload.
      if (next?.afterSwitch !== undefined) {
        setOpen(true)
      }
    })
  }, [refresh])

  if (status === undefined) {
    return null
  }

  const onOpenChange = (next: boolean) => {
    if (step.kind === 'switching' || step.kind === 'installing') {
      return
    }
    setOpen(next)
    if (next) {
      setStep({ kind: 'list' })
      setError(undefined)
      void refresh()
    }
  }

  const runSwitch = async (branch: string, confirm: boolean) => {
    setStep({ kind: 'switching', branch })
    setError(undefined)
    try {
      const result = await api.switchBranch(branch, confirm)
      setSwitchedHere(true)
      if (result.afterSwitch === undefined) {
        api.reload()
        return
      }
      setStatus(current => (current === undefined ? current : { ...current, afterSwitch: result.afterSwitch }))
      setStep({ kind: 'list' })
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
      if (thrown instanceof BranchSwitchError && thrown.status !== undefined) {
        setStatus(thrown.status)
      } else {
        await refresh()
      }
      setStep({ kind: 'list' })
    }
  }

  const pick = (branch: string) => {
    if (branch === status.current || status.blockers.length > 0) {
      return
    }
    if (status.warnings.length > 0) {
      setStep({ kind: 'confirm', branch })
      return
    }
    void runSwitch(branch, false)
  }

  const install = async (command: string) => {
    setStep({ kind: 'installing', command })
    setError(undefined)
    try {
      await api.installDependencies()
      api.reload()
    } catch (thrown) {
      setError(thrown instanceof Error ? thrown.message : String(thrown))
      setStep({ kind: 'list' })
    }
  }

  const dismiss = async () => {
    try {
      await api.dismissAfterSwitch()
    } catch {
      // Nothing is lost: the note shows again next time.
    }
    if (switchedHere) {
      api.reload()
      return
    }
    setStatus(current => (current === undefined ? current : { ...current, afterSwitch: undefined }))
    setOpen(false)
  }

  const label = status.current ?? `${status.head} (detached)`
  const blocked = status.blockers.length > 0
  const busy = step.kind === 'switching' || step.kind === 'installing'

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          role='combobox'
          aria-expanded={open}
          aria-label='Branch'
          title={`Branch: ${label}`}
          className='relative max-w-56 justify-between font-normal max-[1100px]:max-w-30!'
        >
          <GitBranch className='text-muted-foreground' />
          <span className='truncate'>{label}</span>
          <ChevronsUpDown className='text-muted-foreground' />
          {status.afterSwitch !== undefined && (
            <span className='absolute -top-0.5 -right-0.5 size-2 rounded-full bg-primary' aria-hidden />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-80 p-0'>
        {step.kind === 'switching' && (
          <Progress>
            Switching to <strong className='font-semibold'>{step.branch}</strong>…
          </Progress>
        )}
        {step.kind === 'installing' && (
          <Progress>
            Running <code className='font-mono text-xs'>{step.command}</code>…
          </Progress>
        )}
        {step.kind === 'confirm' && (
          <ConfirmSwitch
            branch={step.branch}
            warnings={status.warnings}
            onConfirm={() => void runSwitch(step.branch, true)}
            onCancel={() => setStep({ kind: 'list' })}
          />
        )}
        {step.kind === 'list' && (
          <>
            {error !== undefined && (
              <p role='alert' className='border-border border-b px-3 py-2 text-destructive text-xs'>
                {error}
              </p>
            )}
            {status.afterSwitch !== undefined && (
              <AfterSwitchNotice
                afterSwitch={status.afterSwitch}
                onInstall={command => void install(command)}
                onDismiss={() => void dismiss()}
              />
            )}
            {blocked && <Blockers blockers={status.blockers} />}
            {!blocked && status.warnings.length > 0 && <Warnings warnings={status.warnings} />}
            <Command filter={matchesSearch}>
              <CommandInput placeholder='Search branches…' />
              <CommandList>
                <CommandEmpty>No branch matches.</CommandEmpty>
                {status.branches.map(branch => (
                  <CommandItem
                    key={branch}
                    value={branch}
                    disabled={busy || blocked || branch === status.current}
                    onSelect={() => pick(branch)}
                  >
                    <span className='truncate'>{branch}</span>
                    {branch === status.current && <Check className='ml-auto' aria-label='Checked out' />}
                  </CommandItem>
                ))}
              </CommandList>
            </Command>
          </>
        )}
      </PopoverContent>
    </Popover>
  )
}

function Progress({ children }: { children: ReactNode }) {
  return (
    <p role='status' className='flex items-center gap-2 px-3 py-3 text-sm'>
      <LoaderCircle className='size-4 shrink-0 animate-spin text-muted-foreground' aria-hidden />
      <span>{children}</span>
    </p>
  )
}

function Blockers({ blockers }: { blockers: readonly BranchBlocker[] }) {
  return (
    <div role='alert' className='space-y-2 border-border border-b bg-destructive-subtle px-3 py-2 text-xs'>
      <p className='flex items-center gap-1.5 font-semibold text-destructive'>
        <OctagonX className='size-3.5' aria-hidden />
        Can't switch branches
      </p>
      {blockers.map(blocker =>
        blocker.kind === 'operation' ? (
          <p key='operation'>{OPERATION_TEXT[blocker.operation]}</p>
        ) : (
          <div key='uncommitted'>
            <p>These files have uncommitted changes. Commit them, or ask whoever is editing them, first:</p>
            <ul className='mt-1 space-y-0.5 font-mono'>
              {blocker.files.slice(0, FILES_SHOWN).map(file => (
                <li key={file} className='truncate' title={file}>
                  {file}
                </li>
              ))}
              {blocker.files.length > FILES_SHOWN && <li>and {blocker.files.length - FILES_SHOWN} more</li>}
            </ul>
          </div>
        )
      )}
    </div>
  )
}

function warningText(warning: BranchWarning): ReactNode {
  if (warning.kind === 'session') {
    const seconds = Math.max(0, Math.round((Date.now() - Date.parse(warning.startedAt)) / 1000))
    return (
      <>
        <strong className='font-semibold'>{warning.name}</strong> is editing this project (started {timeAgo(seconds)}).
      </>
    )
  }
  return (
    <>
      <code className='font-mono'>{warning.file}</code> changed {timeAgo(warning.secondsAgo)}.
    </>
  )
}

function Warnings({ warnings }: { warnings: readonly BranchWarning[] }) {
  return (
    <div className='space-y-1 border-border border-b bg-warning-subtle px-3 py-2 text-xs'>
      <p className='flex items-center gap-1.5 font-semibold text-warning'>
        <TriangleAlert className='size-3.5' aria-hidden />
        Someone may be at work here
      </p>
      <ul className='space-y-0.5'>
        {warnings.map(warning => (
          <li key={warning.kind === 'session' ? `session:${warning.name}` : `file:${warning.file}`}>
            {warningText(warning)}
          </li>
        ))}
      </ul>
    </div>
  )
}

interface ConfirmSwitchProps {
  branch: string
  warnings: readonly BranchWarning[]
  onConfirm: () => void
  onCancel: () => void
}

function ConfirmSwitch({ branch, warnings, onConfirm, onCancel }: ConfirmSwitchProps) {
  return (
    <div className='space-y-3 p-3 text-sm'>
      <p>
        Switch to <strong className='font-semibold'>{branch}</strong>? The files on disk change for everyone using this
        checkout.
      </p>
      <Warnings warnings={warnings} />
      <div className='flex justify-end gap-2'>
        <Button variant='ghost' size='sm' onClick={onCancel}>
          Cancel
        </Button>
        <Button size='sm' onClick={onConfirm}>
          Switch anyway
        </Button>
      </div>
    </div>
  )
}

interface AfterSwitchNoticeProps {
  afterSwitch: AfterSwitch
  onInstall: (command: string) => void
  onDismiss: () => void
}

function AfterSwitchNotice({ afterSwitch, onInstall, onDismiss }: AfterSwitchNoticeProps) {
  const { dependencies } = afterSwitch

  return (
    <div role='status' className='space-y-2 border-border border-b bg-info-subtle px-3 py-2 text-xs'>
      <p>
        Switched from <strong className='font-semibold'>{afterSwitch.from}</strong> to{' '}
        <strong className='font-semibold'>{afterSwitch.to}</strong>.
      </p>
      {afterSwitch.notes.map(note => (
        <p key={note}>{note}</p>
      ))}
      {dependencies !== undefined && (
        <p>
          The dependencies changed (<code className='font-mono'>{dependencies.lockfile}</code>). Run{' '}
          <code className='font-mono'>{dependencies.command}</code> now?
        </p>
      )}
      <div className='flex justify-end gap-2'>
        <Button variant='ghost' size='xs' onClick={onDismiss}>
          {dependencies === undefined ? 'OK' : 'Not now'}
        </Button>
        {dependencies !== undefined && (
          <Button size='xs' onClick={() => onInstall(dependencies.command)}>
            Run {dependencies.command}
          </Button>
        )}
      </div>
    </div>
  )
}
