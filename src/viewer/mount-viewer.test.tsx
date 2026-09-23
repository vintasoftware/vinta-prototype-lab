import { beforeEach, describe, expect, it, vi } from 'vitest'

const render = vi.fn()
const createRoot = vi.fn(() => ({ render, unmount: vi.fn() }))

vi.mock('react-dom/client', () => ({ createRoot }))

// The viewer itself is tested on its own; this file tests the mount call only.
vi.mock('./prototype-lab-app', () => ({ PrototypeLabApp: () => null }))

const { mountViewer } = await import('./mount-viewer')

const NO_FILES = { docs: {}, annotations: {}, screens: {} }

describe('mountViewer', () => {
  beforeEach(() => {
    createRoot.mockClear()
    render.mockClear()
    document.body.innerHTML = ''
  })

  it('mounts the viewer into the root element', () => {
    const root = document.createElement('div')
    root.id = 'root'
    document.body.append(root)

    mountViewer(NO_FILES)

    expect(createRoot).toHaveBeenCalledWith(root)
    expect(render).toHaveBeenCalledTimes(1)
  })

  it('says which element is missing rather than mounting nothing', () => {
    expect(() => mountViewer(NO_FILES)).toThrow(/#root/)
  })
})
