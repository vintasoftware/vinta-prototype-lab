import { Check, Copy, Download, ExternalLink, Share2, TriangleAlert, Upload } from 'lucide-react'
import { useState } from 'react'
import { Button, Popover, PopoverContent, PopoverTrigger } from '../ui'
import type { ShareStatus } from './share'

export interface ShareButtonProps {
  /** What the share will show: "Review · Empty" or "Canvas". */
  subject: string
  /** The picked component, which the share outlines. */
  component?: string
  commentCount: number
  /** Whether the dev server can upload. Left out of a built copy, which can only download. */
  status?: ShareStatus
  onUpload: () => Promise<string>
  onDownload: () => Promise<void>
}

type Step =
  | { name: 'idle' }
  | { name: 'working'; doing: 'upload' | 'download' }
  | { name: 'uploaded'; url: string }
  | { name: 'failed'; error: string }

/**
 * Shares what is on show as a static page: uploaded to the team's bucket for a link anyone can
 * open, or downloaded as one HTML file. The page holds the screen or the whole canvas, the
 * documentation and the comments, so the people it goes to need no Prototype Lab to read it.
 */
export function ShareButton({ subject, component, commentCount, status, onUpload, onDownload }: ShareButtonProps) {
  const [step, setStep] = useState<Step>({ name: 'idle' })
  const [copied, setCopied] = useState(false)
  const working = step.name === 'working'

  const run = async (doing: 'upload' | 'download') => {
    setStep({ name: 'working', doing })
    setCopied(false)
    try {
      if (doing === 'upload') {
        setStep({ name: 'uploaded', url: await onUpload() })
      } else {
        await onDownload()
        setStep({ name: 'idle' })
      }
    } catch (thrown) {
      setStep({ name: 'failed', error: thrown instanceof Error ? thrown.message : String(thrown) })
    }
  }

  return (
    <Popover
      onOpenChange={open => {
        if (open && !working) {
          setStep({ name: 'idle' })
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button variant='ghost' size='sm' aria-label='Share' title='Share a static copy of this view'>
          <Share2 />
          <span className='max-[1920px]:hidden!'>Share</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-80 space-y-3 text-sm'>
        <div>
          <p className='font-semibold'>Share a static copy</p>
          <p className='mt-1 text-muted-foreground text-xs'>
            {subject}
            {component === undefined ? '' : `, with ${component} picked`}, plus the documentation and{' '}
            {commentCount === 1 ? '1 comment' : `${commentCount} comments`}. Whoever opens it needs no Prototype Lab.
          </p>
        </div>

        <p className='flex gap-2 rounded-md border border-warning-border bg-warning-subtle p-2 text-warning text-xs'>
          <TriangleAlert className='mt-0.5 size-3.5 shrink-0' />
          <span>
            Anyone with the link can open it. Share only made-up data, never real patient or customer records.
          </span>
        </p>

        {step.name === 'uploaded' ? (
          <div className='space-y-2'>
            <label className='block font-medium text-xs' htmlFor='share-link'>
              Public link
            </label>
            <div className='flex gap-1'>
              <input
                id='share-link'
                readOnly
                value={step.url}
                onFocus={event => event.currentTarget.select()}
                className='h-8 min-w-0 flex-1 rounded-md border border-border bg-background px-2 font-mono text-xs'
              />
              <Button
                variant='outline'
                size='icon-sm'
                aria-label={copied ? 'Link copied' : 'Copy the link'}
                title={copied ? 'Link copied' : 'Copy the link'}
                onClick={() => {
                  void navigator.clipboard?.writeText(step.url).then(() => setCopied(true))
                }}
              >
                {copied ? <Check /> : <Copy />}
              </Button>
              <Button variant='outline' size='icon-sm' asChild>
                <a href={step.url} target='_blank' rel='noopener noreferrer' aria-label='Open the shared page'>
                  <ExternalLink />
                </a>
              </Button>
            </div>
          </div>
        ) : (
          <div className='flex flex-wrap gap-2'>
            {status?.upload === true && (
              <Button size='sm' disabled={working} onClick={() => void run('upload')}>
                <Upload />
                {step.name === 'working' && step.doing === 'upload' ? 'Uploading…' : 'Upload and get a link'}
              </Button>
            )}
            <Button
              variant={status?.upload === true ? 'outline' : 'default'}
              size='sm'
              disabled={working}
              onClick={() => void run('download')}
            >
              <Download />
              {step.name === 'working' && step.doing === 'download' ? 'Saving…' : 'Download HTML'}
            </Button>
          </div>
        )}

        {status !== undefined && !status.upload && (
          <p className='text-muted-foreground text-xs'>
            {status.problem ??
              `To upload, set ${(status.missing ?? []).join(', ')} in .env.local and restart the dev server.`}
          </p>
        )}

        {step.name === 'failed' && (
          <p role='alert' className='text-destructive text-xs'>
            {step.error}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
