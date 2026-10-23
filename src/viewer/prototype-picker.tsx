import { Check, ChevronsUpDown } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { titleize } from '../lib/screen-id'
import type { Prototype } from '../types'
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '../ui'

/** Prototypes that sit in the same group folder, under the heading the picker shows for it. */
export interface PrototypeGroup {
  /** `Billing / Refunds` for `prototypes/billing/refunds/`. Empty for the top of `prototypes/`. */
  heading: string
  prototypes: Prototype[]
}

/**
 * The prototypes as the picker lists them: those directly in `prototypes/` first, then one group
 * per folder, sorted by path. Nested folders get a heading of their own rather than a tree, so the
 * search filters one flat list.
 */
export function groupPrototypes(prototypes: readonly Prototype[]): PrototypeGroup[] {
  const byPath = new Map<string, Prototype[]>()
  for (const prototype of prototypes) {
    const path = prototype.group.join('/')
    byPath.set(path, [...(byPath.get(path) ?? []), prototype])
  }

  return [...byPath.entries()]
    .sort(([a], [b]) => (a === '' ? -1 : b === '' ? 1 : a.localeCompare(b)))
    .map(([path, members]) => ({
      heading: path === '' ? '' : path.split('/').map(titleize).join(' / '),
      prototypes: members.sort((a, b) => a.doc.title.localeCompare(b.doc.title)),
    }))
}

/**
 * Whether an item matches: every word searched appears somewhere in its slug, title, summary or
 * folders. cmdk's own scoring is fuzzy, and a fuzzy match over a whole summary matches nearly
 * anything.
 */
export function matchesSearch(value: string, search: string, keywords: readonly string[] = []): number {
  const text = [value, ...keywords].join(' ').toLowerCase()
  const words = search.toLowerCase().split(/\s+/).filter(Boolean)
  return words.every(word => text.includes(word)) ? 1 : 0
}

export interface PrototypePickerProps {
  prototypes: readonly Prototype[]
  slug: string
  onOpenPrototype: (slug: string) => void
}

/**
 * Scrolls a list so its current item sits in the middle, or as near as the list's ends allow, when
 * the item is out of view. An item already in view stays where it is.
 */
export function scrollToCurrent(list: HTMLElement | null) {
  const item = list?.querySelector<HTMLElement>('[data-current]')
  if (list === null || list === undefined || item === null || item === undefined) {
    return
  }
  const listBox = list.getBoundingClientRect()
  const itemBox = item.getBoundingClientRect()
  if (itemBox.top >= listBox.top && itemBox.bottom <= listBox.bottom) {
    return
  }
  list.scrollTop = itemBox.top - listBox.top + list.scrollTop - (list.clientHeight - item.offsetHeight) / 2
}

/** The header's prototype switcher: a searchable list, grouped by the folders under `prototypes/`. */
export function PrototypePicker({ prototypes, slug, onOpenPrototype }: PrototypePickerProps) {
  const [open, setOpen] = useState(false)
  const groups = useMemo(() => groupPrototypes(prototypes), [prototypes])
  const current = prototypes.find(prototype => prototype.slug === slug)
  const list = useRef<HTMLDivElement>(null)

  // Once per opening, so it never pulls the list back while someone scrolls it.
  useEffect(() => {
    if (open) {
      scrollToCurrent(list.current)
    }
  }, [open])

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          role='combobox'
          aria-expanded={open}
          aria-label='Prototype'
          className='max-w-52 justify-between font-normal max-[1200px]:max-w-35!'
        >
          <span className='truncate'>{current?.doc.title ?? 'Choose a prototype'}</span>
          <ChevronsUpDown className='text-muted-foreground' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-72 p-0'>
        {/* Opens on the prototype that is open now, highlighted, and scrolled to it when it is out of view. */}
        <Command filter={matchesSearch} defaultValue={slug}>
          <CommandInput placeholder='Search prototypes…' />
          <CommandList ref={list}>
            <CommandEmpty>No prototype matches.</CommandEmpty>
            {groups.map(group => (
              <CommandGroup key={group.heading} heading={group.heading === '' ? undefined : group.heading}>
                {group.prototypes.map(prototype => (
                  <CommandItem
                    key={prototype.slug}
                    // The slug is unique where titles may not be; the rest is what a search matches.
                    value={prototype.slug}
                    data-current={prototype.slug === slug ? '' : undefined}
                    keywords={[prototype.doc.title, prototype.doc.summary ?? '', ...prototype.group]}
                    onSelect={() => {
                      onOpenPrototype(prototype.slug)
                      setOpen(false)
                    }}
                  >
                    <span className='truncate'>{prototype.doc.title}</span>
                    {prototype.slug === slug && <Check className='ml-auto' aria-label='Open now' />}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
