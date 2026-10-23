// Writes example/prototypes/canvas-sixty: 12 screens with 5 states each, 60 screen states in all,
// for measuring the canvas against its performance target (time to a usable canvas, panning frame
// rate). Every state is a full desktop screen built from the example's components, with links
// between screens, so the probe has controls to click and the arrows have somewhere to go.
//
//   node scripts/generate-canvas-fixture.mjs && pnpm check:fix
//
// The output is checked in. Run the script again after changing it; it replaces the folder.
import { mkdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const here = path.dirname(fileURLToPath(import.meta.url))
const folder = path.join(here, '..', 'example', 'prototypes', 'canvas-sixty')

const SCREENS = [
  'Inbox',
  'Patients',
  'Patient summary',
  'Visits',
  'Visit detail',
  'Orders',
  'Order detail',
  'Results',
  'Messages',
  'Billing',
  'Reports',
  'Settings',
]

const STATES = [
  { id: 'default', label: 'Default', rows: 8 },
  { id: 'empty', label: 'Empty', rows: 0 },
  { id: 'loading', label: 'Loading', rows: 0 },
  { id: 'error', label: 'Error', rows: 0 },
  { id: 'long', label: 'Long list', rows: 20 },
]

const slug = title => title.toLowerCase().replace(/[^a-z0-9]+/g, '-')

function body(state, index) {
  if (state.id === 'empty') {
    return `<Card>
          <CardContent className='flex flex-col items-center gap-3 py-16 text-center'>
            <p className='font-medium'>Nothing here yet</p>
            <p className='text-muted-foreground text-sm'>Items appear here as soon as the first one is added.</p>
            <Button onClick={() => goToScreen(NEXT)}>Add the first one</Button>
          </CardContent>
        </Card>`
  }
  if (state.id === 'loading') {
    return `<Card>
          <CardContent className='flex flex-col gap-3 py-6'>
            {SKELETON_ROWS.map(row => (
              <div key={row} className='h-6 animate-pulse rounded bg-muted' />
            ))}
          </CardContent>
        </Card>`
  }
  if (state.id === 'error') {
    return `<Card className='border-destructive-border'>
          <CardContent className='flex flex-col gap-3 py-8'>
            <p className='font-medium text-destructive'>This list could not be loaded</p>
            <p className='text-muted-foreground text-sm'>The server did not answer. Nothing was changed.</p>
            <div className='flex gap-2'>
              <Button variant='outline' onClick={() => goToScreen(SELF)}>Try again</Button>
              <Button variant='ghost' onClick={back}>Go back</Button>
            </div>
          </CardContent>
        </Card>`
  }
  const rows = Array.from({ length: state.rows }, (_, row) => {
    const amount = ((index + 3) * (row + 7) * 37) % 900
    return `            <tr className='border-border border-t'>
              <td className='py-2'>Item ${index + 1}.${row + 1}</td>
              <td className='py-2 text-muted-foreground'>Synthetic record ${row + 1}</td>
              <td className='py-2'><Badge variant='${row % 3 === 0 ? 'warning' : 'neutral'}'>${row % 3 === 0 ? 'Pending' : 'Done'}</Badge></td>
              <td className='py-2 text-right tabular-nums'>${amount}</td>
              <td className='py-2 text-right'>
                <Button variant='ghost' size='sm' onClick={() => goToScreen(NEXT)}>Open</Button>
              </td>
            </tr>`
  }).join('\n')
  return `<Card>
          <CardHeader>
            <CardTitle>All items</CardTitle>
          </CardHeader>
          <CardContent>
            <table className='w-full text-sm'>
              <thead className='text-left text-muted-foreground'>
                <tr>
                  <th className='py-2 font-medium'>Name</th>
                  <th className='py-2 font-medium'>Detail</th>
                  <th className='py-2 font-medium'>Status</th>
                  <th className='py-2 text-right font-medium'>Amount</th>
                  <th />
                </tr>
              </thead>
              <tbody>
${rows}
              </tbody>
            </table>
          </CardContent>
        </Card>`
}

function screenFile(title, index, state) {
  const id = slug(title)
  const next = slug(SCREENS[(index + 1) % SCREENS.length])
  const previous = slug(SCREENS[(index + SCREENS.length - 1) % SCREENS.length])
  const nav = SCREENS.map(
    (item, position) =>
      `          <Button variant='${position === index ? 'secondary' : 'ghost'}' size='sm' className='justify-start' onClick={() => goToScreen('${slug(item)}')}>
            ${item}
          </Button>`
  ).join('\n')

  const listed = state.rows > 0
  const ui = listed
    ? 'Badge, Button, Card, CardContent, CardHeader, CardTitle'
    : 'Button, Card, CardContent, CardHeader, CardTitle'
  const constants = [
    state.id === 'loading' ? "const SKELETON_ROWS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']" : '',
    state.id === 'loading' || state.id === 'error' ? '' : `const NEXT = '${next}'`,
    state.id === 'error' ? `const SELF = '${id}'` : '',
  ].filter(Boolean)
  const navigation = state.id === 'error' ? '{ goToScreen, back }' : '{ goToScreen }'

  return `// Generated by scripts/generate-canvas-fixture.mjs. Run the script again instead of editing.
import { anchor, type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'
import { ${ui} } from '../../../ui'

export const screen: Partial<ScreenMeta> = { title: '${title}', variantLabel: '${state.label}', viewport: 'desktop' }

${constants.join('\n')}

export default function Screen() {
  const ${navigation} = useScreenNavigation()

  return (
    <div className='flex h-full bg-muted'>
      <nav className='flex w-56 shrink-0 flex-col gap-1 border-border border-r bg-card p-3' aria-label='Sections'>
${nav}
      </nav>
      <main className='flex min-w-0 flex-1 flex-col gap-4 overflow-auto p-6'>
        <header className='flex items-center justify-between'>
          <div>
            <p className='text-muted-foreground text-sm'>Step ${index + 1} of ${SCREENS.length}</p>
            <h1 className='font-semibold text-2xl' {...anchor('${id}-title')}>${title}</h1>
          </div>
          <div className='flex gap-2'>
            <Button variant='outline' onClick={() => goToScreen('${previous}')}>Previous</Button>
            <Button onClick={() => goToScreen('${next}')} {...anchor('${id}-next')}>Next</Button>
          </div>
        </header>
        <div className='grid grid-cols-3 gap-4'>
          {['Open', 'This week', 'Overdue'].map((label, position) => (
            <Card key={label}>
              <CardHeader>
                <CardTitle className='text-muted-foreground text-sm'>{label}</CardTitle>
              </CardHeader>
              <CardContent className='font-semibold text-2xl tabular-nums'>{(position + 2) * ${index + 3}}</CardContent>
            </Card>
          ))}
        </div>
        ${body(state, index)}
      </main>
    </div>
  )
}
`
}

await rm(folder, { recursive: true, force: true })
await mkdir(path.join(folder, 'screens'), { recursive: true })

await writeFile(
  path.join(folder, 'prototype.md'),
  `---
title: Canvas, sixty states
summary: Twelve screens with five states each, for measuring the canvas. Generated; every record is synthetic.
entry: ${slug(SCREENS[0])}
status: Fixture
---

Generated by \`scripts/generate-canvas-fixture.mjs\`. It exists to measure the canvas with 60 screen
states: how long it takes to be usable, and whether panning keeps the display's frame rate.
`
)

const notes = SCREENS.slice(0, 6).flatMap((title, index) => [
  {
    id: `${slug(title)}-next`,
    screen: slug(title),
    target: `${slug(title)}-next`,
    kind: 'flow',
    title: `Next leads to ${SCREENS[index + 1]}`,
  },
  {
    id: `${slug(title)}-title`,
    screen: slug(title),
    target: `${slug(title)}-title`,
    kind: index % 2 === 0 ? 'spec' : 'question',
    title: `Title of ${title}`,
  },
])
await writeFile(path.join(folder, 'annotations.json'), `${JSON.stringify({ notes }, null, 2)}\n`)

for (const [index, title] of SCREENS.entries()) {
  for (const state of STATES) {
    const order = String((index + 1) * 10).padStart(3, '0')
    const name = state.id === 'default' ? `${order}-${slug(title)}.tsx` : `${order}-${slug(title)}.${state.id}.tsx`
    await writeFile(path.join(folder, 'screens', name), screenFile(title, index, state))
  }
}

console.log(`Wrote ${SCREENS.length * STATES.length} screen states to ${path.relative(process.cwd(), folder)}`)
