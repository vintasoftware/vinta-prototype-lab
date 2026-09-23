import { type FormEvent, useState } from 'react'
import { ANNOTATION_KIND, ANNOTATION_KINDS } from '../lib/annotation-kind'
import type { Annotation, AnnotationKind } from '../types'
import { Button, NativeSelect, NativeSelectOption } from '../ui'

export interface CommentDraft {
  kind: AnnotationKind
  title: string
  body: string
  author: string
  /** Set when the element is being given a semantic id as the comment is written. */
  name?: string
}

/**
 * The name the element is to be given, or undefined when it is to get none: the element carries a
 * name already, or the person cleared the field to pin the comment by position.
 */
export function chosenName(draft: Pick<CommentDraft, 'name'>): string | undefined {
  const name = draft.name?.trim() ?? ''
  return name === '' ? undefined : name
}

export interface CommentComposerProps {
  /** The element the comment will point at, shown so it is clear what is being commented on. */
  target: string
  /** Set when an existing comment is being changed rather than a new one written. */
  editing?: Annotation
  /** Name to fill in, remembered from the last comment written here. */
  author: string
  onSave: (draft: CommentDraft) => void
  onCancel: () => void
  /** Set when the last save failed, so the person can try again without losing what they typed. */
  error?: string
  saving: boolean
  /**
   * A name to give the element, offered when it carries none. Writing the comment writes the name
   * into the screen file, so the comment points at something the screen keeps.
   */
  suggestedName?: string
}

/** The form for writing or changing one comment. */
export function CommentComposer({
  target,
  editing,
  author,
  onSave,
  onCancel,
  error,
  saving,
  suggestedName,
}: CommentComposerProps) {
  const [draft, setDraft] = useState<CommentDraft>({
    kind: editing?.kind ?? 'spec',
    title: editing?.title ?? '',
    body: editing?.body ?? '',
    author: editing?.author ?? author,
    ...(suggestedName === undefined ? {} : { name: suggestedName }),
  })

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (draft.title.trim() === '') {
      return
    }
    onSave(draft)
  }

  return (
    <form onSubmit={submit} className='flex flex-col gap-2 rounded-md border border-primary-border bg-card p-3'>
      <p className='text-muted-foreground text-xs'>
        {editing === undefined ? 'New comment on' : 'Editing the comment on'}{' '}
        <span className='font-mono text-foreground'>{chosenName(draft) ?? target}</span>
      </p>

      {draft.name !== undefined && (
        <label className='flex flex-col gap-1 text-muted-foreground text-xs'>
          Name this element, so the comment survives the screen being edited
          <input
            aria-label='Name this element'
            value={draft.name}
            onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
            className='rounded-md border border-border bg-background px-2 py-1.5 font-mono text-foreground text-sm'
          />
        </label>
      )}

      <NativeSelect
        size='sm'
        aria-label='Kind'
        value={draft.kind}
        onChange={event => setDraft(current => ({ ...current, kind: event.target.value as AnnotationKind }))}
      >
        {ANNOTATION_KINDS.map(kind => (
          <NativeSelectOption key={kind} value={kind}>
            {ANNOTATION_KIND[kind].label}
          </NativeSelectOption>
        ))}
      </NativeSelect>

      <input
        aria-label='Title'
        placeholder='What must the engineer get right?'
        value={draft.title}
        onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}
        className='rounded-md border border-border bg-background px-2 py-1.5 text-sm'
      />

      <textarea
        aria-label='Detail'
        placeholder='Markdown. The detail behind the title.'
        rows={4}
        value={draft.body}
        onChange={event => setDraft(current => ({ ...current, body: event.target.value }))}
        className='rounded-md border border-border bg-background px-2 py-1.5 text-sm'
      />

      <input
        aria-label='Author'
        placeholder='Your name'
        value={draft.author}
        onChange={event => setDraft(current => ({ ...current, author: event.target.value }))}
        className='rounded-md border border-border bg-background px-2 py-1.5 text-sm'
      />

      {error !== undefined && <p className='text-destructive text-xs'>{error}</p>}

      <div className='flex gap-2'>
        <Button type='submit' size='sm' disabled={draft.title.trim() === '' || saving}>
          {saving ? 'Saving…' : 'Save comment'}
        </Button>
        <Button type='button' variant='ghost' size='sm' onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
