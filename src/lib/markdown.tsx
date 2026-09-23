import type { ReactNode } from 'react'

/**
 * Renderer for the markdown designers write in `prototype.md` and in annotation bodies.
 *
 * It covers the blocks that show up in a handoff document — headings, paragraphs, lists, quotes,
 * fenced code, rules — plus bold, italic, inline code and links. The package renders it itself
 * rather than pulling a markdown library in, because a prototype doc is prose and a checklist, and
 * the whole grammar below fits on one screen.
 */

const INLINE_TOKEN = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_|\[[^\]]+\]\([^)\s]+\))/g

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(INLINE_TOKEN).filter(part => part !== '')

  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`

    if (part.startsWith('`') && part.endsWith('`')) {
      return (
        <code key={key} className='rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]'>
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={key} className='font-semibold'>
          {part.slice(2, -2)}
        </strong>
      )
    }
    if ((part.startsWith('*') && part.endsWith('*')) || (part.startsWith('_') && part.endsWith('_'))) {
      return <em key={key}>{part.slice(1, -1)}</em>
    }

    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part)
    if (link) {
      return (
        <a key={key} href={link[2]} className='text-link underline underline-offset-2' rel='noreferrer'>
          {link[1]}
        </a>
      )
    }

    return <span key={key}>{part}</span>
  })
}

const HEADING_CLASS = [
  'mt-6 mb-2 font-semibold text-xl first:mt-0',
  'mt-6 mb-2 font-semibold text-lg first:mt-0',
  'mt-5 mb-2 font-semibold text-base first:mt-0',
  'mt-4 mb-1 font-semibold text-sm first:mt-0',
  'mt-4 mb-1 font-semibold text-sm first:mt-0',
  'mt-4 mb-1 font-semibold text-sm first:mt-0',
]

type Block =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; text: string }
  | { type: 'rule' }

const BULLET_ITEM = /^\s*[-*]\s+(.*)$/
const NUMBERED_ITEM = /^\s*\d+[.)]\s+(.*)$/

/** Whether a line opens a block of its own, which is what ends the block being read. */
function startsBlock(line: string): boolean {
  return (
    line.trim() === '' ||
    line.startsWith('```') ||
    /^#{1,6}\s/.test(line) ||
    /^>\s?/.test(line) ||
    /^---+\s*$/.test(line) ||
    BULLET_ITEM.test(line) ||
    NUMBERED_ITEM.test(line)
  )
}

/** Splits markdown into the blocks the renderer knows. Exported so tests can read the structure. */
export function parseBlocks(markdown: string): Block[] {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n')
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ''

    if (line.trim() === '') {
      index += 1
      continue
    }

    if (line.startsWith('```')) {
      const code: string[] = []
      index += 1
      while (index < lines.length && !(lines[index] ?? '').startsWith('```')) {
        code.push(lines[index] ?? '')
        index += 1
      }
      index += 1
      blocks.push({ type: 'code', text: code.join('\n') })
      continue
    }

    if (/^---+\s*$/.test(line)) {
      blocks.push({ type: 'rule' })
      index += 1
      continue
    }

    const heading = /^(#{1,6})\s+(.*)$/.exec(line)
    if (heading) {
      blocks.push({ type: 'heading', level: (heading[1] ?? '#').length, text: (heading[2] ?? '').trim() })
      index += 1
      continue
    }

    if (/^>\s?/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^>\s?/.test(lines[index] ?? '')) {
        quote.push((lines[index] ?? '').replace(/^>\s?/, ''))
        index += 1
      }
      blocks.push({ type: 'quote', text: quote.join(' ').trim() })
      continue
    }

    if (BULLET_ITEM.test(line) || NUMBERED_ITEM.test(line)) {
      const ordered = NUMBERED_ITEM.test(line)
      const pattern = ordered ? NUMBERED_ITEM : BULLET_ITEM
      const items: string[] = []

      while (index < lines.length) {
        const current = lines[index] ?? ''
        const item = pattern.exec(current)
        if (item) {
          items.push((item[1] ?? '').trim())
          index += 1
          continue
        }
        // A wrapped item: the line carries no marker and opens no block, so it continues the item
        // above it. Designers wrap prose at the editor's margin, and each wrap would otherwise cut
        // the list and restart the numbering.
        const last = items.length - 1
        if (last >= 0 && !startsBlock(current)) {
          items[last] = `${items[last]} ${current.trim()}`
          index += 1
          continue
        }
        break
      }

      blocks.push({ type: 'list', ordered, items })
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length) {
      const current = lines[index] ?? ''
      if (paragraph.length > 0 && startsBlock(current)) {
        break
      }
      paragraph.push(current.trim())
      index += 1
    }
    blocks.push({ type: 'paragraph', text: paragraph.join(' ') })
  }

  return blocks
}

export interface MarkdownProps {
  source: string
  className?: string
}

export function Markdown({ source, className }: MarkdownProps) {
  const blocks = parseBlocks(source)

  return (
    <div className={className}>
      {blocks.map((block, index) => {
        const key = `block-${index}`

        switch (block.type) {
          case 'heading': {
            const Tag = `h${Math.min(block.level, 6)}` as 'h1'
            return (
              <Tag key={key} className={HEADING_CLASS[block.level - 1]}>
                {renderInline(block.text, key)}
              </Tag>
            )
          }
          case 'list':
            return block.ordered ? (
              <ol key={key} className='my-2 list-decimal space-y-1 pl-5 text-sm'>
                {block.items.map((item, itemIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the items are parsed text that never reorders.
                  <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ol>
            ) : (
              <ul key={key} className='my-2 list-disc space-y-1 pl-5 text-sm'>
                {block.items.map((item, itemIndex) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: the items are parsed text that never reorders.
                  <li key={`${key}-${itemIndex}`}>{renderInline(item, `${key}-${itemIndex}`)}</li>
                ))}
              </ul>
            )
          case 'quote':
            return (
              <blockquote
                key={key}
                className='my-3 border-primary-border border-l-2 pl-3 text-muted-foreground text-sm'
              >
                {renderInline(block.text, key)}
              </blockquote>
            )
          case 'code':
            return (
              <pre key={key} className='my-3 overflow-x-auto rounded-md bg-muted p-3 font-mono text-xs'>
                <code>{block.text}</code>
              </pre>
            )
          case 'rule':
            return <hr key={key} className='my-4 border-border' />
          default:
            return (
              <p key={key} className='my-2 text-sm leading-relaxed'>
                {renderInline(block.text, key)}
              </p>
            )
        }
      })}
    </div>
  )
}
