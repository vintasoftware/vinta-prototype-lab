import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { anchor } from '../components/anchor'
import { useScreenNavigation } from '../components/prototype-runtime'
import { buildPrototypes } from '../lib/discovery'
import type { ScreenModule } from '../types'
import { checkTours } from './tour-check'
import { buildTours, type Tour } from './tours'

// The example prototypes, read the way `prototype-lab player` reads them, with their tours.
const example = buildPrototypes({
  docs: import.meta.glob<string>('../../example/prototypes/**/prototype.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  annotations: import.meta.glob('../../example/prototypes/**/annotations.json', { import: 'default', eager: true }),
  screens: import.meta.glob<ScreenModule>('../../example/prototypes/**/screens/*.tsx', { eager: true }),
})
const exampleTours = buildTours(
  import.meta.glob('../../example/prototypes/**/tours/*.json', { import: 'default', eager: true })
)

function Home() {
  const { goToScreen } = useScreenNavigation()
  const [open, setOpen] = useState(false)
  return (
    <div>
      <button type='button' {...anchor('next')} onClick={() => goToScreen('done')}>
        Next
      </button>
      <button type='button' {...anchor('toggle')} onClick={() => setOpen(!open)}>
        {open ? 'Close' : 'Open'}
      </button>
      <a href='#/p/other/start/empty' {...anchor('away')}>
        Other
      </a>
      <p {...anchor('text')}>Words</p>
    </div>
  )
}

function Done() {
  return <p {...anchor('done-title')}>Done</p>
}

const prototypes = buildPrototypes({
  docs: { '/prototypes/demo/prototype.md': '---\ntitle: Demo\n---\n', '/prototypes/other/prototype.md': '' },
  annotations: {},
  screens: {
    '/prototypes/demo/screens/10-home.tsx': { default: Home },
    '/prototypes/demo/screens/20-done.tsx': { default: Done },
    '/prototypes/other/screens/10-start.empty.tsx': { default: Done },
  },
})

function tourOf(steps: Tour['steps']): Tour {
  return { id: 't', title: 'T', summary: 'S', home: 'demo', steps }
}

const at = (screen: string, extra: Partial<Tour['steps'][number]> = {}) => ({
  prototype: 'demo',
  screen,
  variant: 'default',
  title: screen,
  caption: 'C',
  ...extra,
})

async function problems(tour: Tour) {
  const results = await checkTours([tour], prototypes, document.body)
  return results.map(result => result.problems)
}

describe('checkTours', () => {
  it('passes the example tours', async () => {
    expect(exampleTours.issues).toEqual([])
    const results = await checkTours(exampleTours.tours, example, document.body)
    expect(results.filter(result => result.problems.length > 0)).toEqual([])
    expect(results.length).toBeGreaterThan(0)
  })

  it('passes a click that opens the next step', async () => {
    expect(await problems(tourOf([at('home', { click: 'next' }), at('done', { anchor: 'done-title' })]))).toEqual([
      [],
      [],
    ])
  })

  it('follows a link to another prototype', async () => {
    const tour = tourOf([at('home', { click: 'away' }), at('start', { prototype: 'other', variant: 'empty' })])
    expect(await problems(tour)).toEqual([[], []])
  })

  it('reports a screen or state that does not exist', async () => {
    expect(await problems(tourOf([at('nowhere')]))).toEqual([
      ['demo/nowhere/default is not a screen and state of the prototype.'],
    ])
  })

  it('reports an anchor that is not on the screen', async () => {
    expect(await problems(tourOf([at('done', { anchor: 'missing' })]))).toEqual([
      ['anchor "missing" is not on the screen.'],
    ])
  })

  it('reports a click that only changes the screen it is on', async () => {
    expect((await problems(tourOf([at('home', { click: 'toggle' }), at('done')])))[0]).toEqual([
      'clicking "toggle" opens no screen; it only changes this one. Leave the click out of this step.',
    ])
  })

  it('reports a click that opens another screen than the next step', async () => {
    expect((await problems(tourOf([at('home', { click: 'next' }), at('home')])))[0]).toEqual([
      'clicking "next" opens demo/done/default, but the next step is demo/home/default.',
    ])
  })

  it('reports a click on something that cannot be clicked, and one on the last step', async () => {
    expect(await problems(tourOf([at('home', { click: 'text' }), at('home', { click: 'next' })]))).toEqual([
      ['click "text" holds nothing a person can click.'],
      ['the last step has a click, but there is no step to go to. Leave the click out.'],
    ])
  })
})
