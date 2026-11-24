import { SOURCE_ATTRIBUTE } from './source-ref'

/**
 * Marks viewer chrome that is not part of a shared view: the hover outline, the copy-link button.
 * The comment pins and the picked component's outline carry no mark, so a share keeps them.
 */
export const SHARE_OMIT_ATTRIBUTE = 'data-share-omit'

/** Gives form fields their current state as attributes, which is all a copy of the DOM keeps. */
function copyFormState(from: Element, to: Element): void {
  const sources = from.querySelectorAll('input, textarea, select')
  const targets = to.querySelectorAll('input, textarea, select')
  sources.forEach((source, index) => {
    const target = targets[index]
    if (target === undefined) {
      return
    }
    if (source instanceof HTMLInputElement) {
      if (source.type === 'checkbox' || source.type === 'radio') {
        target.toggleAttribute('checked', source.checked)
      } else if (source.type !== 'password' && source.type !== 'file') {
        target.setAttribute('value', source.value)
      }
    } else if (source instanceof HTMLTextAreaElement) {
      target.textContent = source.value
    } else if (source instanceof HTMLSelectElement) {
      Array.from(source.options).forEach((option, optionIndex) => {
        ;(target as HTMLSelectElement).options[optionIndex]?.toggleAttribute('selected', option.selected)
      })
    }
  })
}

/** Canvases draw into memory a copy does not carry; an image of each takes its place. */
function freezeCanvases(from: Element, to: Element): void {
  const sources = from.querySelectorAll('canvas')
  const targets = to.querySelectorAll('canvas')
  sources.forEach((source, index) => {
    const target = targets[index]
    if (target === undefined) {
      return
    }
    try {
      const image = to.ownerDocument.createElement('img')
      image.src = source.toDataURL('image/png')
      image.width = source.width
      image.height = source.height
      image.className = source.className
      image.setAttribute('style', source.getAttribute('style') ?? '')
      target.replaceWith(image)
    } catch {
      // A canvas drawn from another origin cannot be read; it stays blank.
    }
  })
}

/**
 * A copy of an element that stands on its own as static HTML: no scripts, no handlers, form
 * fields as they are filled in, and none of the viewer's own chrome. The copy's root keeps its
 * size, but not the transform the canvas camera puts on it.
 */
export function cloneForShare(element: HTMLElement): HTMLElement {
  const clone = element.cloneNode(true) as HTMLElement
  copyFormState(element, clone)
  freezeCanvases(element, clone)

  for (const removed of clone.querySelectorAll(
    `[${SHARE_OMIT_ATTRIBUTE}], script, noscript, iframe, object, embed, template`
  )) {
    removed.remove()
  }
  for (const node of [clone, ...clone.querySelectorAll('*')]) {
    node.removeAttribute(SOURCE_ATTRIBUTE)
    for (const attribute of Array.from(node.attributes)) {
      if (/^on/i.test(attribute.name) || /^\s*javascript:/i.test(attribute.value)) {
        node.removeAttribute(attribute.name)
      }
    }
  }
  clone.style.removeProperty('transform')
  clone.style.removeProperty('will-change')
  clone.style.removeProperty('visibility')
  return clone
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/**
 * Puts each image's bytes into the copy, since the address it was served from is the dev server's
 * and will not answer the people the share goes to. An image that cannot be fetched keeps its
 * address, made absolute.
 */
export async function inlineImages(clone: HTMLElement, base: string = document.baseURI): Promise<void> {
  const cache = new Map<string, Promise<string>>()
  const images = Array.from(clone.querySelectorAll('img'))
  for (const source of clone.querySelectorAll('picture source')) {
    source.remove()
  }
  await Promise.all(
    images.map(async image => {
      image.removeAttribute('srcset')
      image.removeAttribute('loading')
      const src = image.getAttribute('src')
      if (src === null || src.startsWith('data:')) {
        return
      }
      const absolute = new URL(src, base).href
      let pending = cache.get(absolute)
      if (pending === undefined) {
        pending = fetch(absolute).then(response => {
          if (!response.ok) {
            throw new Error(String(response.status))
          }
          return response.blob().then(blobToDataUrl)
        })
        cache.set(absolute, pending)
      }
      try {
        image.setAttribute('src', await pending)
      } catch {
        image.setAttribute('src', absolute)
      }
    })
  )
}

/** Every style rule on the page: the viewer's, the project's, and Tailwind's. */
export function collectCss(doc: Document = document): string {
  const parts: string[] = []
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      parts.push(Array.from(sheet.cssRules, rule => rule.cssText).join('\n'))
    } catch {
      // A stylesheet from another origin cannot be read. Its rules stay out of the share.
    }
  }
  return parts.join('\n')
}

/** The fonts the element uses, embedded, so the share reads in the same type off the dev server. */
export async function embeddedFontCss(element: HTMLElement): Promise<string> {
  try {
    const { getFontEmbedCSS } = await import('html-to-image')
    return await getFontEmbedCSS(element)
  } catch {
    return ''
  }
}

/** The size link unfurlers (Slack, ClickUp, Asana, LinkedIn…) draw a large preview card at. */
export const PREVIEW_SIZE = { width: 1200, height: 630 } as const

const PREVIEW_PADDING = 32
const PREVIEW_BACKGROUND = '#f4f4f5'

export interface PreviewImage {
  /** Base64 PNG, without the `data:` prefix. */
  data: string
  width: number
  height: number
}

/**
 * Where the element is drawn on the card: as wide as fits, but a tall screen (a phone) is not shrunk
 * until it is unreadable. It may be up to half again the card's height, its top shown and its foot
 * cut off, since the top of a screen is what says which one it is.
 */
export function previewPlacement(width: number, height: number): { scale: number; x: number; y: number } {
  const room = { width: PREVIEW_SIZE.width - 2 * PREVIEW_PADDING, height: PREVIEW_SIZE.height - 2 * PREVIEW_PADDING }
  const scale = Math.min(2, room.width / Math.max(1, width), (1.5 * room.height) / Math.max(1, height))
  const drawnHeight = height * scale
  return {
    scale,
    x: Math.round((PREVIEW_SIZE.width - width * scale) / 2),
    y: drawnHeight <= room.height ? Math.round((PREVIEW_SIZE.height - drawnHeight) / 2) : PREVIEW_PADDING,
  }
}

/** A 1200 × 630 PNG of the element as it is on screen, for the link's preview card. */
export async function previewPng(element: HTMLElement): Promise<PreviewImage> {
  const { toCanvas } = await import('html-to-image')
  const placement = previewPlacement(element.offsetWidth, element.offsetHeight)
  const drawn = await toCanvas(element, {
    pixelRatio: placement.scale,
    cacheBust: true,
    filter: node => !(node instanceof Element && node.hasAttribute(SHARE_OMIT_ATTRIBUTE)),
  })

  const card = element.ownerDocument.createElement('canvas')
  card.width = PREVIEW_SIZE.width
  card.height = PREVIEW_SIZE.height
  const context = card.getContext('2d')
  if (context === null) {
    throw new Error('This browser cannot draw the preview.')
  }
  context.fillStyle = PREVIEW_BACKGROUND
  context.fillRect(0, 0, card.width, card.height)
  context.drawImage(drawn, placement.x, placement.y)

  const dataUrl = card.toDataURL('image/png')
  return { data: dataUrl.slice(dataUrl.indexOf(',') + 1), ...PREVIEW_SIZE }
}

/** Waits for React to commit and the browser to lay the result out. */
export function nextPaint(): Promise<void> {
  return new Promise(resolve => {
    if (typeof requestAnimationFrame === 'undefined') {
      setTimeout(resolve, 0)
      return
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  })
}
