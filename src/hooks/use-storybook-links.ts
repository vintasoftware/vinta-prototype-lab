import { useEffect, useMemo, useState } from 'react'
import {
  buildStorybookLinks,
  looksLikeOurStorybook,
  resolveStorybookUrl,
  type StorybookEntry,
  type StorybookLink,
  type StorybookOptions,
} from '../lib/storybook-links'

export type StorybookStatus = 'loading' | 'ready' | 'unavailable' | 'mismatched' | 'disabled'

export interface StorybookLinks {
  links: Map<string, StorybookLink>
  status: StorybookStatus
  /** Where the viewer looked, so a message can name it. */
  url: string
}

const STORAGE_KEY = 'prototype-lab.storybook-url'

function readStored(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

function remember(url: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, url)
  } catch {
    // A browser that refuses storage still links fine for this visit.
  }
}

/**
 * Reads the pages Storybook is serving, so the component tree can link to them.
 *
 * Storybook's own index is the source of truth for what pages exist, and it is served with open
 * CORS. Two answers short of a usable index are normal and reported rather than thrown: Storybook
 * not running, and another project's Storybook holding the port. With `false`, nothing is fetched
 * and the rows carry no links.
 */
export function useStorybookLinks(options: StorybookOptions | false = {}): StorybookLinks {
  const enabled = options !== false
  const fallback = enabled ? options.url : undefined
  const marker = enabled ? options.marker : undefined
  const url = useMemo(() => resolveStorybookUrl(window.location.search, readStored(), fallback), [fallback])
  const [state, setState] = useState<StorybookLinks>({
    links: new Map(),
    status: enabled ? 'loading' : 'disabled',
    url,
  })

  useEffect(() => {
    if (!enabled) {
      setState({ links: new Map(), status: 'disabled', url })
      return
    }

    let active = true
    const controller = new AbortController()

    const read = async () => {
      try {
        const response = await fetch(`${url}/index.json`, { signal: controller.signal })
        if (!response.ok) {
          throw new Error(`Storybook answered ${response.status}`)
        }
        const index = (await response.json()) as { entries?: Record<string, StorybookEntry> }
        const entries = Object.values(index.entries ?? {})

        if (!active) {
          return
        }

        if (!looksLikeOurStorybook(entries, marker)) {
          setState({ links: new Map(), status: 'mismatched', url })
          return
        }

        remember(url)
        setState({ links: buildStorybookLinks(entries, url), status: 'ready', url })
      } catch {
        if (active) {
          setState({ links: new Map(), status: 'unavailable', url })
        }
      }
    }

    void read()

    return () => {
      active = false
      controller.abort()
    }
  }, [url, enabled, marker])

  return state
}
