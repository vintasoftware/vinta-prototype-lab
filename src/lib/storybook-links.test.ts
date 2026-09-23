// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  buildStorybookLinks,
  findStorybookLink,
  looksLikeOurStorybook,
  nameFamily,
  normalizeName,
  resolveStorybookUrl,
  type StorybookEntry,
} from './storybook-links'

/**
 * Shapes taken from this repo's own Storybook index. Two kinds sit in it: a component with a title
 * of its own, and the primitives catalogue, where one page holds a story per component.
 */
const ENTRIES: StorybookEntry[] = [
  { id: 'design-system-atoms-button--docs', title: 'Design System/Atoms/Button', name: 'Docs', type: 'docs' },
  { id: 'design-system-atoms-badge--docs', title: 'Design System/Atoms/Badge', name: 'Docs', type: 'docs' },
  {
    id: 'design-system-atoms-nativeselect--docs',
    title: 'Design System/Atoms/NativeSelect',
    name: 'Docs',
    type: 'docs',
  },
  {
    id: 'design-system-base-primitives--card-story',
    title: 'Design System/Base/Primitives',
    name: 'Card',
    type: 'story',
  },
  {
    id: 'design-system-base-primitives--tabs-story',
    title: 'Design System/Base/Primitives',
    name: 'Tabs',
    type: 'story',
  },
  {
    id: 'design-system-surfaces-sectioncard--default',
    title: 'Design System/Surfaces/SectionCard',
    name: 'Default',
    type: 'story',
  },
]

const links = buildStorybookLinks(ENTRIES, 'http://localhost:6006')

describe('normalizeName', () => {
  it('reads a story name and a component name the same way', () => {
    expect(normalizeName('Buttons')).toBe(normalizeName('Button'))
    expect(normalizeName('Native Selects')).toBe(normalizeName('NativeSelect'))
  })
})

describe('nameFamily', () => {
  it('offers the component, then the family above it', () => {
    expect(nameFamily('CardHeader')).toEqual(['CardHeader', 'Card'])
    expect(nameFamily('Button')).toEqual(['Button'])
  })
})

describe('buildStorybookLinks', () => {
  it('indexes a component that has a page of its own', () => {
    expect(links.get('button')).toEqual({
      url: 'http://localhost:6006/?path=/docs/design-system-atoms-button--docs',
      title: 'Design System/Atoms/Button',
      name: 'Docs',
    })
  })

  it('indexes a component that is one story on a catalogue page', () => {
    expect(links.get('card')?.url).toBe('http://localhost:6006/?path=/story/design-system-base-primitives--card-story')
  })

  it('leaves a docs page out of the names, since every one of them is called Docs', () => {
    expect(links.get('doc')).toBeUndefined()
  })

  it('keeps a docs page reachable by its own title', () => {
    const docsOnly = buildStorybookLinks(
      [{ id: 'components-topnav--docs', title: 'Components/TopNav', name: 'Docs', type: 'docs' }],
      'http://localhost:6006'
    )

    expect(docsOnly.get('topnav')?.url).toBe('http://localhost:6006/?path=/docs/components-topnav--docs')
  })
})

describe('findStorybookLink', () => {
  it('finds the page named for the component', () => {
    expect(findStorybookLink(links, 'Button')?.title).toBe('Design System/Atoms/Button')
    expect(findStorybookLink(links, 'Badge')?.title).toBe('Design System/Atoms/Badge')
  })

  it('finds a component that is one story on a catalogue page', () => {
    expect(findStorybookLink(links, 'Tabs')?.name).toBe('Tabs')
  })

  it('sends a part of a component to the page for the component', () => {
    expect(findStorybookLink(links, 'CardHeader')?.name).toBe('Card')
    expect(findStorybookLink(links, 'CardContent')?.name).toBe('Card')
  })

  it('reads a two-word component name', () => {
    expect(findStorybookLink(links, 'NativeSelect')?.title).toBe('Design System/Atoms/NativeSelect')
  })

  it('reads a component name against a story name written in the plural', () => {
    const grouped = buildStorybookLinks(
      [{ id: 'design-system-atoms--buttons', title: 'Design System/Atoms', name: 'Buttons', type: 'story' }],
      'http://localhost:6006'
    )

    expect(findStorybookLink(grouped, 'Button')?.name).toBe('Buttons')
  })

  it('finds nothing for a component Storybook does not cover', () => {
    expect(findStorybookLink(links, 'ProviderShell')).toBeUndefined()
  })

  it('finds nothing when Storybook is not running', () => {
    expect(findStorybookLink(new Map(), 'Button')).toBeUndefined()
  })
})

describe('looksLikeOurStorybook', () => {
  const stranger: StorybookEntry[] = [
    { id: 'billing-invoices--paid', title: 'Billing/Invoices', name: 'Paid', type: 'story' },
    { id: 'components-topnav--docs', title: 'Components/TopNav', name: 'Docs', type: 'docs' },
  ]

  it('recognizes an index holding the marker section', () => {
    expect(looksLikeOurStorybook(ENTRIES, 'Design System')).toBe(true)
  })

  it("rejects another project's Storybook on the same port", () => {
    expect(looksLikeOurStorybook(stranger, 'Design System')).toBe(false)
  })

  it('takes any index with entries when there is no marker', () => {
    expect(looksLikeOurStorybook(stranger)).toBe(true)
    expect(looksLikeOurStorybook(stranger, '')).toBe(true)
  })

  it('rejects an empty index', () => {
    expect(looksLikeOurStorybook([])).toBe(false)
    expect(looksLikeOurStorybook([], 'Design System')).toBe(false)
  })
})

describe('resolveStorybookUrl', () => {
  it("uses Storybook's default port when nothing else is asked for", () => {
    expect(resolveStorybookUrl('', null)).toBe('http://localhost:6006')
  })

  it('takes the URL the viewer was opened with', () => {
    expect(resolveStorybookUrl('?storybook=http://localhost:6010', null)).toBe('http://localhost:6010')
  })

  it('prefers what was asked for now over what was saved before', () => {
    expect(resolveStorybookUrl('?storybook=http://localhost:6010', 'http://localhost:6009')).toBe(
      'http://localhost:6010'
    )
  })

  it('remembers the URL from an earlier visit', () => {
    expect(resolveStorybookUrl('', 'http://localhost:6009')).toBe('http://localhost:6009')
  })

  it('drops a trailing slash, so the index path is built once', () => {
    expect(resolveStorybookUrl('?storybook=http://localhost:6010/', null)).toBe('http://localhost:6010')
  })

  it('falls back to the configured URL, without its trailing slash', () => {
    expect(resolveStorybookUrl('', null, 'http://localhost:6100/')).toBe('http://localhost:6100')
  })

  it('ignores anything that is not an http URL', () => {
    expect(resolveStorybookUrl('?storybook=javascript:alert(1)', null)).toBe('http://localhost:6006')
    expect(resolveStorybookUrl('?storybook=', null)).toBe('http://localhost:6006')
  })
})
