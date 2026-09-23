// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { parseSourceRef, SOURCE_ATTRIBUTE } from '../lib/source-ref'
import { formatSourceRef, isScreenFile, stampSource } from './stamp-jsx-source'

const ROOT = '/repo/packages/prototype-lab'
const FILE = `${ROOT}/prototypes/booking/screens/10-home.tsx`

describe('isScreenFile', () => {
  it('takes a screen of a prototype and nothing else', () => {
    expect(isScreenFile(FILE)).toBe(true)
    expect(isScreenFile(`${ROOT}/prototypes/billing/refunds/screens/10-home.tsx`)).toBe(true)
    expect(isScreenFile(`${ROOT}/prototypes/screens/10-home.tsx`)).toBe(false)
    expect(isScreenFile(`${ROOT}/prototypes/booking/prototype.md`)).toBe(false)
    expect(isScreenFile(`${ROOT}/src/viewer/side-panel.tsx`)).toBe(false)
    expect(isScreenFile('/elsewhere/screens/10-home.tsx')).toBe(false)
  })
})

describe('stampSource', () => {
  const screen = `export default function Home() {
  return (
    <Card>
      <Button variant='ghost'>Go</Button>
    </Card>
  )
}
`
  const stamped = stampSource(screen, FILE, ROOT)

  it('records where each element was written, keeping the attributes it had', () => {
    expect(stamped).toContain(`<Card ${SOURCE_ATTRIBUTE}="prototypes/booking/screens/10-home.tsx:3:4:Card">`)
    expect(stamped).toContain(
      `<Button ${SOURCE_ATTRIBUTE}="prototypes/booking/screens/10-home.tsx:4:6:Button" variant='ghost'>`
    )
  })

  it('points at the element it stamped, so the codemod lands on the same one', () => {
    const ref = parseSourceRef(/data-proto-src="([^"]+)"/.exec(stamped.slice(stamped.indexOf('<Button')))?.[1] ?? '')
    const line = screen.split('\n')[(ref?.line ?? 1) - 1] ?? ''

    expect(line.slice(ref?.column ?? 0).startsWith('<Button')).toBe(true)
  })

  it('leaves a file it has already stamped alone', () => {
    expect(stampSource(stamped, FILE, ROOT)).toBe(stamped)
  })

  it('reads a screen with no elements at all', () => {
    expect(stampSource('export const screen = { title: "Home" }\n', FILE, ROOT)).toBe(
      'export const screen = { title: "Home" }\n'
    )
  })

  it('takes a generic for what it is rather than an element', () => {
    const generic = 'const [open, setOpen] = useState<boolean>(false)\nexport default () => <div>{open}</div>\n'

    const result = stampSource(generic, FILE, ROOT)

    expect(result).toContain('useState<boolean>(false)')
    expect(result.match(new RegExp(SOURCE_ATTRIBUTE, 'g'))).toHaveLength(1)
  })
})

describe('formatSourceRef', () => {
  it('writes the file relative to the package, so the ref is short and portable', () => {
    expect(formatSourceRef(FILE, ROOT, 12, 4, 'Button')).toBe('prototypes/booking/screens/10-home.tsx:12:4:Button')
  })
})
