// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseFrontmatter } from './frontmatter'

describe('parseFrontmatter', () => {
  it('reads the fenced block and returns the markdown after it', () => {
    const source = ['---', 'title: Book a visit', 'entry: home', '---', '', '## The flow', '', 'Step one.'].join('\n')

    expect(parseFrontmatter(source)).toEqual({
      data: { title: 'Book a visit', entry: 'home' },
      body: '## The flow\n\nStep one.',
    })
  })

  it('keeps colons inside a value', () => {
    expect(parseFrontmatter('---\nsummary: Booking: end to end\n---\nBody').data).toEqual({
      summary: 'Booking: end to end',
    })
  })

  it('strips matching quotes around a value', () => {
    expect(parseFrontmatter(`---\ntitle: "Book a visit"\nowner: 'Ana'\n---\n`).data).toEqual({
      title: 'Book a visit',
      owner: 'Ana',
    })
  })

  it('skips comments and lines with no key', () => {
    expect(parseFrontmatter('---\n# a comment\nnot-a-pair\ntitle: Kept\n---\n').data).toEqual({ title: 'Kept' })
  })

  it('treats a file with no fence as all body', () => {
    expect(parseFrontmatter('# Just markdown')).toEqual({ data: {}, body: '# Just markdown' })
  })
})
