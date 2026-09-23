import { Tag } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { Button } from '../ui'

export interface NameElementFormProps {
  /** What the element would be called, from what it is and what it says. */
  suggestion: string
  onName: (id: string) => void
  /** Set when the last attempt failed, so the person can fix the name and try again. */
  error?: string
  naming: boolean
}

/**
 * Gives the picked element a semantic id, without having to write a comment about it first.
 *
 * The id goes into the screen file, so it is there for the engineer to read, for a link to point
 * at, and for a comment written later to hold on to.
 */
export function NameElementForm({ suggestion, onName, error, naming }: NameElementFormProps) {
  const [open, setOpen] = useState(false)
  const [id, setId] = useState(suggestion)

  if (!open) {
    return (
      <div className='px-3 pb-2'>
        <Button
          variant='outline'
          size='sm'
          width='full'
          onClick={() => {
            setId(suggestion)
            setOpen(true)
          }}
        >
          <Tag />
          Name this element
        </Button>
      </div>
    )
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (id.trim() !== '') {
      onName(id.trim())
    }
  }

  return (
    <form onSubmit={submit} className='flex flex-col gap-2 px-3 pb-2'>
      <label className='flex flex-col gap-1 text-[10px] text-muted-foreground'>
        A name the screen keeps, written into its file
        <input
          // biome-ignore lint/a11y/noAutofocus: the field is the whole point of opening the form.
          autoFocus
          aria-label='Element name'
          value={id}
          onChange={event => setId(event.target.value)}
          className='rounded-md border border-border bg-background px-2 py-1 font-mono text-foreground text-xs'
        />
      </label>

      {error !== undefined && <p className='text-[10px] text-destructive'>{error}</p>}

      <div className='flex gap-1'>
        <Button type='submit' size='sm' disabled={id.trim() === '' || naming}>
          {naming ? 'Naming…' : 'Name it'}
        </Button>
        <Button type='button' variant='ghost' size='sm' onClick={() => setOpen(false)} disabled={naming}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
