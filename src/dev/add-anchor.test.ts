// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { addAnchor } from './add-anchor'
import { findOpeningElements } from './stamp-jsx-source'

/** Shaped like the screens in this package: a value import from the package, then the UI ones. */
const SCREEN = `import { type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'
import { Button, Card } from '../ui'

export const screen: Partial<ScreenMeta> = { title: 'Home' }

export default function HomeScreen() {
  const { back } = useScreenNavigation()
  return (
    <Card>
      <Button variant='ghost' width='full' onClick={back}>
        View medication
      </Button>
    </Card>
  )
}
`

/** Where an element sits, read the way the stamp reads it, so the two halves agree on a position. */
function positionOf(source: string, tag: string, which = 0): { line: number; column: number } {
  const found = findOpeningElements(source).filter(element => element.tag === tag)[which]

  if (found === undefined) {
    throw new Error(`the fixture holds no <${tag}`)
  }
  return { line: found.line, column: found.column }
}

function nameButton(source: string, id: string, which = 0) {
  const at = positionOf(source, 'Button', which)
  return addAnchor(source, at.line, at.column, id, 'Button')
}

describe('addAnchor', () => {
  it('writes the name onto the element, leaving the attributes it already has', () => {
    const { source, skipped } = nameButton(SCREEN, 'view-medication')

    expect(skipped).toBeUndefined()
    expect(source).toContain("<Button {...anchor('view-medication')} variant='ghost' width='full' onClick={back}>")
  })

  it('adds anchor to the import the screen already has', () => {
    const { source } = nameButton(SCREEN, 'view-medication')

    expect(source).toContain("import { anchor, type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'")
    expect(source.match(/vinta-prototype-lab/g)).toHaveLength(1)
  })

  it('writes an import when the screen imports nothing from the package', () => {
    const bare = "import { Button } from '../ui'\n\nexport default () => <Button>Go</Button>\n"

    const { source } = nameButton(bare, 'go')

    expect(source.startsWith("import { anchor } from 'vinta-prototype-lab'\n")).toBe(true)
    expect(source).toContain("<Button {...anchor('go')}>")
  })

  it('writes its own import beside a type-only one, which cannot carry a value', () => {
    const typesOnly = `import type { ScreenMeta } from 'vinta-prototype-lab'\n\nexport default () => <Button>Go</Button>\n`

    const { source } = nameButton(typesOnly, 'go')

    expect(source).toContain("import { anchor } from 'vinta-prototype-lab'")
    expect(source).toContain("import type { ScreenMeta } from 'vinta-prototype-lab'")
  })

  it('leaves an element that already carries a name alone', () => {
    const named = nameButton(SCREEN, 'view-medication').source

    const { source, skipped } = nameButton(named, 'second-name')

    expect(skipped).toBe('That element already carries a name.')
    expect(source).toBe(named)
  })

  it('names the element the position points at, not another of the same tag', () => {
    const two = '<div>\n  <Button>One</Button>\n  <Button>Two</Button>\n</div>\n'

    const { source } = nameButton(two, 'two', 1)

    expect(source).toContain("<Button {...anchor('two')}>Two</Button>")
    expect(source).toContain('<Button>One</Button>')
  })

  it('refuses a name that is not one', () => {
    for (const id of ['View Medication', 'view_medication', '', '-leading']) {
      expect(nameButton(SCREEN, id).skipped).toContain('is not a name')
    }
  })

  it('writes nothing when the element has moved since the screen was drawn', () => {
    const { source, skipped } = addAnchor(SCREEN, 3, 0, 'view-medication')

    expect(skipped).toContain('has moved')
    expect(source).toBe(SCREEN)
  })

  it('writes nothing for a position past the end of the file', () => {
    expect(addAnchor(SCREEN, 400, 0, 'view-medication').skipped).toContain('has moved')
  })
})

describe('a position that has drifted onto another element', () => {
  it('writes nothing when the tag there is not the one the stamp named', () => {
    const two = '<div>\n  <Card>one</Card>\n  <Button>two</Button>\n</div>\n'
    const button = positionOf(two, 'Button')

    // The same line and column, but the stamp said the element there was a Card.
    const { source, skipped } = addAnchor(two, button.line, button.column, 'drifted', 'Card')

    expect(skipped).toContain('has moved')
    expect(source).toBe(two)
  })
})
