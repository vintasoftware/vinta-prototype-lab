// @vitest-environment node
import { readFileSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import type { Annotation } from '../types'
import { annotationsPathFor, editAnnotations, fromTheViewer, nameElement, servedBy } from './annotations-writer'

const NOTE: Annotation = {
  id: 'home-primary-action',
  target: 'book-follow-up',
  screen: 'home',
  kind: 'spec',
  title: 'One filled button per screen',
  status: 'open',
}

let root: string
let prototypesDir: string

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), 'prototype-lab-'))
  prototypesDir = path.join(root, 'prototypes')
  await mkdir(path.join(prototypesDir, 'booking', 'screens'), { recursive: true })
})

const notesOnDisk = async () =>
  JSON.parse(await readFile(path.join(prototypesDir, 'booking', 'annotations.json'), 'utf8')) as {
    notes: Annotation[]
  }

describe('annotationsPathFor', () => {
  it('takes a folder name', () => {
    expect(annotationsPathFor('/p', 'patient-booking')).toBe('/p/patient-booking/annotations.json')
  })

  it('takes a prototype inside group folders', () => {
    expect(annotationsPathFor('/p', 'billing/refunds')).toBe('/p/billing/refunds/annotations.json')
  })

  it('refuses anything that could climb out of the prototypes folder', () => {
    for (const slug of ['../secrets', 'a/../../b', 'a/./b', 'a//b', 'a/', '/etc', '..', 'Booking', '']) {
      expect(annotationsPathFor('/p', slug)).toBeUndefined()
    }
  })
})

describe('editAnnotations', () => {
  it('writes the first comment of a prototype that has no notes file yet', async () => {
    const result = await editAnnotations(prototypesDir, { slug: 'booking', edit: { op: 'save', note: NOTE } })

    expect(result.status).toBe(200)
    expect((await notesOnDisk()).notes).toEqual([NOTE])
  })

  it('keeps a note the viewer never saw, rather than writing over the file', async () => {
    const written = { ...NOTE, id: 'written-by-hand' }
    await writeFile(
      path.join(prototypesDir, 'booking', 'annotations.json'),
      JSON.stringify({ notes: [written] }),
      'utf8'
    )

    await editAnnotations(prototypesDir, { slug: 'booking', edit: { op: 'save', note: NOTE } })

    expect((await notesOnDisk()).notes.map(note => note.id)).toEqual(['written-by-hand', 'home-primary-action'])
  })

  it('says what it will write before the file changes, so the watcher can tell the write apart', async () => {
    const file = path.join(prototypesDir, 'booking', 'annotations.json')
    await writeFile(file, JSON.stringify({ notes: [] }), 'utf8')
    const told: { file: string; content: string; onDiskThen: string }[] = []

    await editAnnotations(prototypesDir, { slug: 'booking', edit: { op: 'save', note: NOTE } }, (at, content) => {
      told.push({ file: at, content, onDiskThen: readFileSync(at, 'utf8') })
    })

    expect(told).toHaveLength(1)
    expect(told[0]?.file).toBe(file)
    expect(told[0]?.onDiskThen).toBe(JSON.stringify({ notes: [] }))
    expect(told[0]?.content).toBe(await readFile(file, 'utf8'))
  })

  it('does not say it will write when it writes nothing', async () => {
    await writeFile(path.join(prototypesDir, 'booking', 'annotations.json'), '{ not json', 'utf8')
    const told: string[] = []

    const result = await editAnnotations(prototypesDir, { slug: 'booking', edit: { op: 'save', note: NOTE } }, file => {
      told.push(file)
    })

    expect(result.status).toBe(409)
    expect(told).toEqual([])
  })

  it('removes the note a delete names', async () => {
    await editAnnotations(prototypesDir, { slug: 'booking', edit: { op: 'save', note: NOTE } })

    const result = await editAnnotations(prototypesDir, { slug: 'booking', edit: { op: 'delete', id: NOTE.id } })

    expect(result.status).toBe(200)
    expect((await notesOnDisk()).notes).toEqual([])
  })

  it('refuses a slug that is not a folder name', async () => {
    const result = await editAnnotations(prototypesDir, {
      slug: '../../etc',
      edit: { op: 'save', note: NOTE },
    })

    expect(result.status).toBe(400)
  })
})

describe('nameElement', () => {
  const screen = 'prototypes/booking/screens/10-home.tsx'
  const source = "export default () => <Button variant='ghost'>Go</Button>\n"

  beforeEach(async () => {
    await writeFile(path.join(root, screen), source, 'utf8')
  })

  it('writes the name into the screen file', async () => {
    const result = await nameElement(root, { source: `${screen}:1:21:Button`, id: 'go-somewhere' })

    expect(result.status).toBe(200)
    expect(await readFile(path.join(root, screen), 'utf8')).toContain("<Button {...anchor('go-somewhere')}")
  })

  it('says why it wrote nothing when the element already carries a name', async () => {
    // An import is already there, so naming the button moves nothing and the position stays true.
    const imported = `import { anchor } from 'vinta-prototype-lab'\n${source}`
    await writeFile(path.join(root, screen), imported, 'utf8')
    const at = `${screen}:2:21:Button`

    await nameElement(root, { source: at, id: 'go-somewhere' })
    const again = await nameElement(root, { source: at, id: 'other-name' })

    expect(again.status).toBe(409)
    expect(again.body).toEqual({ error: 'That element already carries a name.' })
  })

  it('writes nothing when the position is stale, rather than editing the wrong place', async () => {
    // Naming the button adds an import above it, so every position below it has shifted.
    await nameElement(root, { source: `${screen}:1:21:Button`, id: 'go-somewhere' })

    const again = await nameElement(root, { source: `${screen}:1:21:Button`, id: 'other-name' })
    const after = await readFile(path.join(root, screen), 'utf8')

    expect(again.status).toBe(409)
    expect(after.match(/anchor\(/g)).toHaveLength(1)
  })

  it('refuses a file that is not a screen of a prototype', async () => {
    await writeFile(path.join(root, 'secrets.tsx'), source, 'utf8')

    const result = await nameElement(root, { source: 'secrets.tsx:1:21:Button', id: 'go' })

    expect(result.status).toBe(400)
    expect(await readFile(path.join(root, 'secrets.tsx'), 'utf8')).toBe(source)
  })

  it('refuses a path that climbs out of the package', async () => {
    const result = await nameElement(root, { source: '../../prototypes/x/screens/a.tsx:1:1:Button', id: 'go' })

    expect(result.status).toBe(400)
  })

  it('refuses an element that carries no position', async () => {
    expect((await nameElement(root, { source: 'nonsense', id: 'go' })).status).toBe(400)
  })
})

describe('a notes file that cannot be read', () => {
  const notesFile = () => path.join(prototypesDir, 'booking', 'annotations.json')
  const save = () => editAnnotations(prototypesDir, { slug: 'booking', edit: { op: 'save', note: NOTE } })

  it('keeps every note when one of them is malformed, rather than writing the file anew', async () => {
    const written = JSON.stringify({
      notes: [
        { id: 'a', target: 'x', kind: 'spec', title: 'Keep me', status: 'open' },
        { id: 'no-title', target: 'y', kind: 'spec', status: 'open' },
      ],
    })
    await writeFile(notesFile(), written, 'utf8')

    const result = await save()

    expect(result.status).toBe(409)
    expect(await readFile(notesFile(), 'utf8')).toBe(written)
  })

  it('says which note is wrong, so the designer can fix it', async () => {
    await writeFile(notesFile(), JSON.stringify({ notes: [{ id: 'no-title', target: 'y' }] }), 'utf8')

    const result = await save()

    expect('error' in result.body && result.body.error).toContain('title')
  })

  it('writes nothing when the file is not JSON at all', async () => {
    await writeFile(notesFile(), 'this is not json', 'utf8')

    expect((await save()).status).toBe(409)
    expect(await readFile(notesFile(), 'utf8')).toBe('this is not json')
  })

  it('still treats a file that is not there as an empty one', async () => {
    expect((await save()).status).toBe(200)
    expect((await notesOnDisk()).notes.map(note => note.id)).toEqual([NOTE.id])
  })
})

describe('fromTheViewer', () => {
  const served = ['http://localhost:6007/', 'http://192.168.1.4:6007/']

  it('takes the viewer this server is serving, on any address it serves', () => {
    expect(fromTheViewer({ 'content-type': 'application/json', origin: 'http://localhost:6007' }, served)).toBe(true)
    expect(fromTheViewer({ 'content-type': 'application/json', origin: 'http://192.168.1.4:6007' }, served)).toBe(true)
  })

  it('takes a tool that sends no origin', () => {
    expect(fromTheViewer({ 'content-type': 'application/json; charset=utf-8' }, served)).toBe(true)
  })

  it('refuses another page open beside the viewer', () => {
    expect(fromTheViewer({ 'content-type': 'application/json', origin: 'http://evil.example' }, served)).toBe(false)
    expect(fromTheViewer({ 'content-type': 'application/json', origin: 'null' }, served)).toBe(false)
  })

  it('refuses a body a form could have sent, which needs no permission to cross origins', () => {
    expect(fromTheViewer({ 'content-type': 'text/plain', origin: 'http://evil.example' }, served)).toBe(false)
    expect(fromTheViewer({ origin: 'http://evil.example' }, served)).toBe(false)
  })

  it('refuses everything when the server knows of no address of its own', () => {
    expect(fromTheViewer({ 'content-type': 'application/json', origin: 'http://localhost:6007' }, [])).toBe(false)
  })
})

describe('servedBy', () => {
  it('takes every address the server bound, so --host can write too', () => {
    const served = servedBy({
      resolvedUrls: { local: ['http://localhost:6007/'], network: ['http://192.168.1.4:6007/'] },
    })

    expect(served).toEqual(['http://localhost:6007/', 'http://192.168.1.4:6007/'])
  })

  it('reads a server that has bound nothing as serving nothing, which refuses every write', () => {
    expect(servedBy({ resolvedUrls: null })).toEqual([])
  })
})
