// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ownBuildReload, SETTLE_MS, WAIT_LIMIT_MS } from './own-build-reload'

type Change = { file: string; type?: 'create' | 'update' | 'delete' }

/** The plugin over a build folder holding `files`, with every reload it sends recorded. */
function watch(files: Set<string>) {
  const send = vi.fn()
  const hotUpdate = ownBuildReload('/repo/dist', { exists: file => files.has(file) }).hotUpdate as (
    this: unknown,
    change: Change
  ) => unknown[] | undefined
  // Vite keeps one channel per environment, so every change comes through the same one.
  const context = { environment: { hot: { send } } }
  const change = ({ file, type = 'update' }: Change) => hotUpdate.call(context, { file, type })
  return { change, reloads: () => send.mock.calls.length, sent: () => send.mock.calls.map(([payload]) => payload) }
}

const BUILT = ['/repo/dist/index.js', '/repo/dist/viewer.css']

describe('ownBuildReload', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('reloads the page when a built script changes, instead of swapping the module', () => {
    const { change, sent } = watch(new Set(BUILT))

    expect(change({ file: '/repo/dist/index.js' })).toEqual([])
    vi.advanceTimersByTime(SETTLE_MS)

    expect(sent()).toEqual([{ type: 'full-reload' }])
  })

  it('reloads once for a burst of changed files', () => {
    const { change, reloads } = watch(new Set(BUILT))

    change({ file: '/repo/dist/index.js' })
    change({ file: '/repo/dist/index.js.map' })
    change({ file: '/repo/dist/index.d.ts' })
    vi.advanceTimersByTime(SETTLE_MS)

    expect(reloads()).toBe(1)
  })

  it('waits for the stylesheet a full build writes last, so the page never reloads without it', () => {
    const files = new Set(['/repo/dist/index.js'])
    const { change, reloads } = watch(files)

    change({ file: '/repo/dist/viewer.css', type: 'delete' })
    change({ file: '/repo/dist/index.js', type: 'create' })
    vi.advanceTimersByTime(SETTLE_MS * 10)
    expect(reloads()).toBe(0)

    files.add('/repo/dist/viewer.css')
    change({ file: '/repo/dist/viewer.css', type: 'create' })
    vi.advanceTimersByTime(SETTLE_MS)

    expect(reloads()).toBe(1)
  })

  it('reloads the browser even when the server environment hears of the change after it', () => {
    const browser = vi.fn()
    const server = vi.fn()
    const hotUpdate = ownBuildReload('/repo/dist', { exists: () => true }).hotUpdate as (
      this: unknown,
      change: Change
    ) => unknown[] | undefined
    const change = { file: '/repo/dist/index.js', type: 'update' as const }

    hotUpdate.call({ environment: { hot: { send: browser } } }, change)
    hotUpdate.call({ environment: { hot: { send: server } } }, change)
    vi.advanceTimersByTime(SETTLE_MS)

    expect(browser).toHaveBeenCalledWith({ type: 'full-reload' })
    expect(server).toHaveBeenCalledWith({ type: 'full-reload' })
  })

  it('gives up on a build that never finishes', () => {
    const { change, reloads } = watch(new Set(['/repo/dist/index.js']))

    change({ file: '/repo/dist/index.js' })
    vi.advanceTimersByTime(WAIT_LIMIT_MS + SETTLE_MS * 2)

    expect(reloads()).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('lets a built stylesheet changed in place update in place', () => {
    const { change, reloads } = watch(new Set(BUILT))

    expect(change({ file: '/repo/dist/viewer.css' })).toBeUndefined()
    vi.advanceTimersByTime(SETTLE_MS)

    expect(reloads()).toBe(0)
  })

  it('leaves the project own files to the usual hot update', () => {
    const { change, reloads } = watch(new Set(BUILT))

    expect(change({ file: '/project/prototypes/booking/screens/10-home.tsx' })).toBeUndefined()
    expect(change({ file: '/repo/dist-other/index.js' })).toBeUndefined()
    vi.advanceTimersByTime(SETTLE_MS)

    expect(reloads()).toBe(0)
  })
})
