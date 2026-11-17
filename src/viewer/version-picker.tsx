import { Check, ChevronsUpDown } from 'lucide-react'
import { useRef, useState } from 'react'
import { ALL_VERSIONS } from '../lib/version'
import type { PrototypeVersion } from '../types'
import { Button, Command, CommandItem, CommandList, Popover, PopoverContent, PopoverTrigger } from '../ui'

export interface VersionPickerProps {
  versions: readonly PrototypeVersion[]
  /** The picked version's id. Left out for All. */
  selected: string | undefined
  /** Called with a version id, or `undefined` for All. */
  onSelect: (version: string | undefined) => void
}

/**
 * The header's version switcher: each version the prototype declares, in order, then All. It opens
 * like the other header pickers, with the list focused: arrows move, Enter picks, Escape closes.
 */
export function VersionPicker({ versions, selected, onSelect }: VersionPickerProps) {
  const [open, setOpen] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const current = versions.find(version => version.id === selected)
  const options = [
    ...versions.map(version => ({ value: version.id, label: version.label })),
    { value: ALL_VERSIONS, label: 'All' },
  ]

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          role='combobox'
          aria-expanded={open}
          aria-label='Version'
          title={`Version: ${current?.label ?? 'All'}`}
          className='max-w-52 justify-between font-normal max-[1200px]:max-w-35!'
        >
          <span className='truncate'>{current?.label ?? 'All'}</span>
          <ChevronsUpDown className='text-muted-foreground' />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        className='w-64 p-0'
        // The list has no search field, so the list itself takes the focus and its keys.
        onOpenAutoFocus={event => {
          event.preventDefault()
          list.current?.focus()
        }}
      >
        <Command ref={list} tabIndex={-1} defaultValue={selected ?? ALL_VERSIONS} className='outline-none'>
          <CommandList label='Versions'>
            {options.map(option => {
              const picked = option.value === (selected ?? ALL_VERSIONS)
              return (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  keywords={[option.label]}
                  onSelect={() => {
                    onSelect(option.value === ALL_VERSIONS ? undefined : option.value)
                    setOpen(false)
                  }}
                >
                  <span className='truncate'>{option.label}</span>
                  {picked && <Check className='ml-auto' aria-label='Picked' />}
                </CommandItem>
              )
            })}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
