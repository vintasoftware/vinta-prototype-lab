// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { jsxSnippet } from './source-snippet'

const screen = `import { Button, Card } from '../../../ui'

export default function Home() {
  return (
    <Card className='p-4'>
      <Button
        variant='outline'
        onClick={() => goToScreen('review')}
      >
        Book a visit
      </Button>
      <hr className='my-2' />
      <span></span>
    </Card>
  )
}
`

describe('jsxSnippet', () => {
  it('gives the tag and its props as written, with the children collapsed', () => {
    expect(jsxSnippet(screen, 6, 6, 'Button')).toBe(
      "<Button\n  variant='outline'\n  onClick={() => goToScreen('review')}\n>\n  …\n</Button>"
    )
  })

  it('keeps a self-closing element as it is, and closes an empty one', () => {
    expect(jsxSnippet(screen, 12, 6, 'hr')).toBe("<hr className='my-2' />")
    expect(jsxSnippet(screen, 13, 6, 'span')).toBe('<span></span>')
  })

  it('answers nothing when the position or the tag no longer match', () => {
    expect(jsxSnippet(screen, 6, 7, 'Button')).toBeUndefined()
    expect(jsxSnippet(screen, 6, 6, 'Card')).toBeUndefined()
    expect(jsxSnippet('not <valid', 1, 0, 'valid')).toBeUndefined()
  })
})
