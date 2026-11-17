import { useEffect, useMemo, useRef, useState } from 'react'
import { useRuntimeVersion } from '../components/prototype-runtime'
import type { FrameSize } from '../lib/device-frame'
import { measureScreenPage } from '../lib/probe-screen'
import type { PrototypeScreen } from '../types'

/** A frame whose full page height is needed at a size the probe did not measure. */
export interface PageHeightRequest {
  key: string
  screen: PrototypeScreen
  size: FrameSize
}

export interface PageHeights {
  /** Measured heights, by frame key. */
  heights: ReadonlyMap<string, number>
  /** Whether every requested frame has been measured. */
  ready: boolean
}

const sizeKey = (request: PageHeightRequest) => `${request.key}@${request.size.width}x${request.size.height}`

/**
 * Measures the full page height of screens drawn at a size other than their own, as the canvas
 * needs when the device toolbar or a viewport pair sets the frames. Like the probe, it renders one
 * screen per task, so the page keeps answering, and it remembers what it measured.
 */
export function usePageHeights(requests: readonly PageHeightRequest[]): PageHeights {
  // A version can hide parts of a screen, so each version is measured on its own.
  const version = useRuntimeVersion()
  const cacheKey = (request: PageHeightRequest) => `${sizeKey(request)}~${version?.selected ?? 'all'}`
  const cache = useRef(new Map<string, number>())
  const [measured, setMeasured] = useState(0)
  const signature = requests.map(cacheKey).join('|')
  const pending = requests.filter(request => !cache.current.has(cacheKey(request)))

  // biome-ignore lint/correctness/useExhaustiveDependencies: the signature names every request; the list itself is a new array each render.
  useEffect(() => {
    let task: ReturnType<typeof setTimeout> | undefined
    const measureNext = (index: number) => {
      const request = pending[index]
      if (request === undefined) {
        return
      }
      task = setTimeout(() => {
        cache.current.set(cacheKey(request), measureScreenPage(request.screen, request.size, document, version))
        setMeasured(count => count + 1)
        measureNext(index + 1)
      }, 0)
    }
    measureNext(0)
    return () => clearTimeout(task)
  }, [signature])

  // The same object until something new is measured, so the canvas does not lay itself out again
  // on every render, as it renders on every step of a pan.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the signature names every request, and `measured` counts what the cache gained.
  return useMemo(() => {
    const heights = new Map<string, number>()
    for (const request of requests) {
      const height = cache.current.get(cacheKey(request))
      if (height !== undefined) {
        heights.set(request.key, height)
      }
    }
    return { heights, ready: heights.size === requests.length }
  }, [signature, measured])
}
