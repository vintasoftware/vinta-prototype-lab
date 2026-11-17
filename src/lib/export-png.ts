import { OVERLAY_ATTRIBUTE } from './component-tree'

/** `booking/home/default` → `booking--home--default.png`: one flat name a download can take. */
export function pngFileName(slug: string, screenId: string, variant: string): string {
  return `${[slug, screenId, variant].join('--').replace(/[^a-z0-9-]+/gi, '-')}.png`
}

/**
 * Saves an element as a PNG, drawn at twice its size so text stays sharp, without
 * the viewer's layers drawn over it. The library that draws it
 * is loaded on first use, so a viewer nobody exports from never loads it.
 */
export async function exportPng(element: HTMLElement, fileName: string): Promise<void> {
  const { toPng } = await import('html-to-image')
  const dataUrl = await toPng(element, {
    pixelRatio: 2,
    cacheBust: true,
    // The viewer's own layers (comment pins, the inspect outline and its label) are not the screen.
    filter: node => !(node instanceof Element && node.hasAttribute(OVERLAY_ATTRIBUTE)),
  })
  const link = element.ownerDocument.createElement('a')
  link.download = fileName
  link.href = dataUrl
  link.click()
}
