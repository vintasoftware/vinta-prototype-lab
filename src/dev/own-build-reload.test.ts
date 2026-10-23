// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ownBuildReload } from './own-build-reload'

/** Runs the plugin's hot update for one changed file, and returns what it sent and returned. */
function changed(file: string) {
  const send = vi.fn()
  const hotUpdate = ownBuildReload('/repo/dist').hotUpdate as (
    this: unknown,
    options: { file: string }
  ) => unknown[] | undefined
  const result = hotUpdate.call({ environment: { hot: { send } } }, { file })
  return { sent: send.mock.calls.map(([payload]) => payload), result }
}

describe('ownBuildReload', () => {
  it('reloads the page when a built script changes, instead of swapping the module', () => {
    expect(changed('/repo/dist/index.js')).toEqual({ sent: [{ type: 'full-reload' }], result: [] })
  })

  it('lets a built stylesheet update in place', () => {
    expect(changed('/repo/dist/viewer.css')).toEqual({ sent: [], result: undefined })
  })

  it('leaves the project own files to the usual hot update', () => {
    expect(changed('/project/prototypes/booking/screens/10-home.tsx')).toEqual({ sent: [], result: undefined })
    expect(changed('/repo/dist-other/index.js')).toEqual({ sent: [], result: undefined })
  })
})
