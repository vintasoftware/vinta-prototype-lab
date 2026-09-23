import { AlertTriangle, MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import type { NumberedAnnotation } from '../components/annotation-overlay'
import { ANNOTATION_KIND } from '../lib/annotation-kind'
import { Markdown } from '../lib/markdown'
import type { Annotation, Prototype } from '../types'
import { Badge, Button, cn, Tabs, TabsContent, TabsList, TabsTrigger } from '../ui'
import { CommentComposer, type CommentDraft } from './comment-composer'

export interface SidePanelProps {
  prototype: Prototype
  notes: NumberedAnnotation[]
  /** Notes whose target is not on the screen right now. Listed apart so the drift is visible. */
  unanchored: Set<string>
  selectedId?: string
  onSelect: (id: string | undefined) => void
  /** What a new comment would point at: the component picked on the screen. */
  target?: string
  /** Off in a built copy of the viewer, which has no dev server to write the file. */
  canEdit: boolean
  /** The comment being written or changed, if any. `new` means one is being written. */
  composing?: 'new' | Annotation
  onCompose: (composing: 'new' | Annotation | undefined) => void
  onSave: (draft: CommentDraft) => void
  onDelete: (note: Annotation) => void
  onToggleResolved: (note: Annotation) => void
  author: string
  saving: boolean
  saveError?: string
  /** Offered when the picked element carries no semantic id and could be given one. */
  suggestedName?: string
}

export function SidePanel({
  prototype,
  notes,
  unanchored,
  selectedId,
  onSelect,
  target,
  canEdit,
  composing,
  onCompose,
  onSave,
  onDelete,
  onToggleResolved,
  author,
  saving,
  saveError,
  suggestedName,
}: SidePanelProps) {
  const issueCount = prototype.issues.length

  return (
    <aside className='flex w-96 shrink-0 flex-col border-border border-l bg-card'>
      <Tabs defaultValue='doc' className='flex min-h-0 flex-1 flex-col gap-0'>
        <TabsList variant='line' className='shrink-0 px-3 pt-2'>
          <TabsTrigger value='doc'>Doc</TabsTrigger>
          <TabsTrigger value='notes'>Comments {notes.length > 0 && `(${notes.length})`}</TabsTrigger>
          <TabsTrigger value='issues'>Problems {issueCount > 0 && `(${issueCount})`}</TabsTrigger>
        </TabsList>

        <TabsContent value='doc' className='min-h-0 flex-1 overflow-y-auto px-4 py-3'>
          <PrototypeDocPanel prototype={prototype} />
        </TabsContent>

        <TabsContent value='notes' className='min-h-0 flex-1 overflow-y-auto px-4 py-3'>
          {canEdit && composing === undefined && (
            <div className='mb-3'>
              <Button
                size='sm'
                variant='outline'
                width='full'
                disabled={target === undefined}
                onClick={() => onCompose('new')}
              >
                <MessageSquarePlus />
                {target === undefined ? 'Pick a component to comment on' : `Comment on ${target}`}
              </Button>
            </div>
          )}

          {composing !== undefined && (
            <div className='mb-3'>
              <CommentComposer
                // A new form per comment, and per element: the fields are seeded once, so a reused
                // instance would carry the name written for whatever was picked before.
                key={composing === 'new' ? `new:${target ?? ''}` : composing.id}
                target={composing === 'new' ? (target ?? '') : composing.target}
                {...(composing === 'new' ? {} : { editing: composing })}
                author={author}
                onSave={onSave}
                onCancel={() => onCompose(undefined)}
                saving={saving}
                {...(saveError === undefined ? {} : { error: saveError })}
                {...(composing !== 'new' || suggestedName === undefined ? {} : { suggestedName })}
              />
            </div>
          )}

          {notes.length === 0 ? (
            <p className='text-muted-foreground text-sm'>No comments on this screen yet.</p>
          ) : (
            <ul className='flex flex-col gap-2'>
              {notes.map(note => (
                <li key={note.id}>
                  <NoteRow
                    note={note}
                    anchored={!unanchored.has(note.id)}
                    selected={note.id === selectedId}
                    onSelect={onSelect}
                    canEdit={canEdit}
                    onEdit={() => onCompose(note)}
                    onDelete={() => onDelete(note)}
                    onToggleResolved={() => onToggleResolved(note)}
                  />
                </li>
              ))}
            </ul>
          )}
        </TabsContent>

        <TabsContent value='issues' className='min-h-0 flex-1 overflow-y-auto px-4 py-3'>
          {issueCount === 0 ? (
            <p className='text-muted-foreground text-sm'>Nothing to fix — the prototype loaded cleanly.</p>
          ) : (
            <ul className='flex flex-col gap-2'>
              {prototype.issues.map(issue => (
                <li key={issue} className='flex gap-2 rounded-md bg-warning-subtle p-2 text-sm text-warning'>
                  <AlertTriangle className='mt-0.5 size-4 shrink-0' />
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      </Tabs>
    </aside>
  )
}

function PrototypeDocPanel({ prototype }: { prototype: Prototype }) {
  const { doc } = prototype

  return (
    <div>
      <h2 className='font-semibold text-lg'>{doc.title}</h2>
      {doc.summary !== undefined && <p className='mt-1 text-muted-foreground text-sm'>{doc.summary}</p>}

      <dl className='mt-3 flex flex-wrap gap-2 text-xs'>
        {doc.status !== undefined && <Badge variant='neutral'>{doc.status}</Badge>}
        {doc.owner !== undefined && <Badge variant='outline'>{doc.owner}</Badge>}
        {doc.updated !== undefined && <Badge variant='outline'>Updated {doc.updated}</Badge>}
      </dl>

      {doc.body === '' ? (
        <p className='mt-4 text-muted-foreground text-sm'>prototype.md has no body yet.</p>
      ) : (
        <Markdown source={doc.body} className='mt-3' />
      )}
    </div>
  )
}

interface NoteRowProps {
  note: NumberedAnnotation
  anchored: boolean
  selected: boolean
  onSelect: (id: string | undefined) => void
  canEdit: boolean
  onEdit: () => void
  onDelete: () => void
  onToggleResolved: () => void
}

/**
 * One comment. The card selects the note; the actions along its foot change it, so the two never
 * nest a button inside a button.
 */
function NoteRow({ note, anchored, selected, onSelect, canEdit, onEdit, onDelete, onToggleResolved }: NoteRowProps) {
  const kind = ANNOTATION_KIND[note.kind]

  return (
    <div
      className={cn(
        'rounded-md border',
        selected ? 'border-primary-border bg-primary-subtle' : 'border-border hover:bg-muted'
      )}
    >
      <button type='button' onClick={() => onSelect(selected ? undefined : note.id)} className='w-full p-3 text-left'>
        <div className='flex items-center gap-2'>
          <span className={cn('flex size-5 items-center justify-center rounded-full font-semibold text-xs', kind.pin)}>
            {note.number}
          </span>
          <Badge variant='outline'>{kind.label}</Badge>
          {note.status === 'resolved' && <Badge variant='success'>Resolved</Badge>}
          {!anchored && <Badge variant='warning'>Target missing</Badge>}
        </div>

        <p className='mt-2 font-medium text-sm'>{note.title}</p>
        {note.body !== undefined && <Markdown source={note.body} className='text-muted-foreground' />}

        <p className='mt-2 font-mono text-muted-foreground text-xs'>{note.target}</p>
        {note.author !== undefined && <p className='text-muted-foreground text-xs'>— {note.author}</p>}
      </button>

      {canEdit && (
        <div className='flex items-center gap-1 border-border border-t px-2 py-1'>
          <Button variant='ghost' size='sm' onClick={onEdit}>
            <Pencil />
            Edit
          </Button>
          <Button variant='ghost' size='sm' onClick={onToggleResolved}>
            {note.status === 'resolved' ? 'Reopen' : 'Resolve'}
          </Button>
          <Button
            variant='ghost'
            size='icon-sm'
            className='ml-auto text-muted-foreground hover:text-destructive'
            aria-label={`Delete the comment "${note.title}"`}
            onClick={onDelete}
          >
            <Trash2 />
          </Button>
        </div>
      )}
    </div>
  )
}
