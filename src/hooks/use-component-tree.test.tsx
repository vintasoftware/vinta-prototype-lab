import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { OVERLAY_ATTRIBUTE } from '../lib/component-tree'
import { useComponentTree } from './use-component-tree'

function frame(): HTMLDivElement {
  const element = document.createElement('div')
  element.innerHTML = '<button data-slot="button">Book</button>'
  document.body.append(element)
  return element
}

const settle = () => new Promise(resolve => setTimeout(resolve, 50))

describe('useComponentTree', () => {
  it('reads the tree again when the screen changes', async () => {
    const element = frame()
    const ref = { current: element }
    const { result } = renderHook(() => useComponentTree(ref, 'home'))
    const first = result.current

    element.insertAdjacentHTML('beforeend', '<span data-slot="badge">2</span>')

    await waitFor(() => expect(result.current).not.toBe(first))
    expect(result.current.roots.map(node => node.label)).toEqual(['Button', 'Badge'])
    element.remove()
  })

  it("leaves the tree alone when only the viewer's overlays change, so a hover it drew is kept", async () => {
    const element = frame()
    const ref = { current: element }
    const { result } = renderHook(() => useComponentTree(ref, 'home'))
    await settle()
    const first = result.current

    const overlay = document.createElement('div')
    overlay.setAttribute(OVERLAY_ATTRIBUTE, '')
    element.append(overlay)
    overlay.innerHTML = '<div class="outline"></div>'
    overlay.remove()
    await settle()

    expect(result.current).toBe(first)
    element.remove()
  })
})
