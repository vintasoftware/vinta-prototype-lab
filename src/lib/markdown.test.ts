// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseBlocks } from './markdown'

describe('parseBlocks', () => {
  it('reads headings and paragraphs', () => {
    expect(parseBlocks('# Title\n\nSome prose.')).toEqual([
      { type: 'heading', level: 1, text: 'Title' },
      { type: 'paragraph', text: 'Some prose.' },
    ])
  })

  it('joins a wrapped list item instead of restarting the list', () => {
    const source = [
      '1. **Home** — the follow-up card is the',
      '   only card with a filled button.',
      '2. Second step.',
    ].join('\n')

    expect(parseBlocks(source)).toEqual([
      {
        type: 'list',
        ordered: true,
        items: ['**Home** — the follow-up card is the only card with a filled button.', 'Second step.'],
      },
    ])
  })

  it('ends a list at the next block', () => {
    expect(parseBlocks('- One\n- Two\n\n## After')).toEqual([
      { type: 'list', ordered: false, items: ['One', 'Two'] },
      { type: 'heading', level: 2, text: 'After' },
    ])
  })

  it('keeps a fenced code block verbatim', () => {
    expect(parseBlocks('```\nconst a = 1\n\nconst b = 2\n```')).toEqual([
      { type: 'code', text: 'const a = 1\n\nconst b = 2' },
    ])
  })

  it('reads a quote spanning several lines as one', () => {
    expect(parseBlocks('> First line\n> second line')).toEqual([{ type: 'quote', text: 'First line second line' }])
  })

  it('reads a rule', () => {
    expect(parseBlocks('Before\n\n---\n\nAfter')).toEqual([
      { type: 'paragraph', text: 'Before' },
      { type: 'rule' },
      { type: 'paragraph', text: 'After' },
    ])
  })
})
