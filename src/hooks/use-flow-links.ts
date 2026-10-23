import { useEffect, useState } from 'react'
import { type FlowNodeKey, flowNodeKey, type ScreenLinks } from '../lib/flow-graph'
import { probeScreen } from '../lib/probe-screen'
import type { Prototype } from '../types'

export type FlowLinksStatus = 'idle' | 'reading' | 'ready'

export interface FlowLinks {
  status: FlowLinksStatus
  linksByNode: ReadonlyMap<FlowNodeKey, ScreenLinks>
  /** How many screen states have been read so far, out of `total`, while reading. */
  read: number
  total: number
}

const NONE: ReadonlyMap<FlowNodeKey, ScreenLinks> = new Map()

/**
 * Reads where every control in the prototype leads, once the canvas asks for it.
 *
 * The probe renders each screen synchronously and React refuses a synchronous render from inside
 * an effect, so each screen is read in a task of its own. One task per screen also keeps the page
 * answering while a prototype with many states is read, and lets the canvas say how far along it
 * is. It runs again when the prototype object changes, which is what a reload of a screen file
 * produces.
 */
export function useFlowLinks(prototype: Prototype | undefined, enabled: boolean): FlowLinks {
  const [state, setState] = useState<FlowLinks>({ status: 'idle', linksByNode: NONE, read: 0, total: 0 })

  useEffect(() => {
    if (!enabled || prototype === undefined) {
      setState({ status: 'idle', linksByNode: NONE, read: 0, total: 0 })
      return
    }

    const screens = prototype.screens
    const found = new Map<FlowNodeKey, ScreenLinks>()
    setState({ status: 'reading', linksByNode: NONE, read: 0, total: screens.length })

    let task: ReturnType<typeof setTimeout>
    const readNext = (index: number) => {
      task = setTimeout(() => {
        const screen = screens[index]
        if (screen === undefined) {
          setState({ status: 'ready', linksByNode: found, read: screens.length, total: screens.length })
          return
        }
        found.set(flowNodeKey(screen.id, screen.variant), probeScreen(screen))
        setState(current => ({ ...current, read: index + 1 }))
        readNext(index + 1)
      }, 0)
    }
    readNext(0)

    return () => clearTimeout(task)
  }, [enabled, prototype])

  return state
}
