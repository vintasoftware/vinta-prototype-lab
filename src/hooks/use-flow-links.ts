import { useEffect, useState } from 'react'
import type { FlowNodeKey, ScreenLinks } from '../lib/flow-graph'
import { probePrototype } from '../lib/probe-screen'
import type { Prototype } from '../types'

export type FlowLinksStatus = 'idle' | 'reading' | 'ready'

export interface FlowLinks {
  status: FlowLinksStatus
  linksByNode: ReadonlyMap<FlowNodeKey, ScreenLinks>
}

const NONE: ReadonlyMap<FlowNodeKey, ScreenLinks> = new Map()

/**
 * Reads where every control in the prototype leads, once the map asks for it.
 *
 * The probe renders each screen synchronously and React refuses a synchronous render from inside
 * an effect, so the read is deferred to a task of its own. It runs again when the prototype object
 * changes, which is what a reload of a screen file produces.
 */
export function useFlowLinks(prototype: Prototype | undefined, enabled: boolean): FlowLinks {
  const [state, setState] = useState<FlowLinks>({ status: 'idle', linksByNode: NONE })

  useEffect(() => {
    if (!enabled || prototype === undefined) {
      setState({ status: 'idle', linksByNode: NONE })
      return
    }

    setState({ status: 'reading', linksByNode: NONE })
    const task = setTimeout(() => {
      setState({ status: 'ready', linksByNode: probePrototype(prototype) })
    }, 0)

    return () => clearTimeout(task)
  }, [enabled, prototype])

  return state
}
