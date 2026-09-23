import type { ScreenMeta } from '../types'

const ORDER_PREFIX = /^(\d+)-(.*)$/

/** `booking-review` -> `Booking Review`. */
export function titleize(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(part => part !== '')
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

export interface ScreenFileName {
  id: string
  variant: string
  order: number
}

/**
 * Reads a screen's id, variant and position out of its filename, so the common case needs no
 * metadata export at all:
 *
 * - `home.tsx` -> id `home`, variant `default`
 * - `home.empty.tsx` -> id `home`, variant `empty` (a state of the same screen)
 * - `20-booking.tsx` -> id `booking`, order 20 (the prefix only sorts; it is not part of the id)
 */
export function parseScreenFileName(fileName: string): ScreenFileName {
  const base = fileName.replace(/\.tsx?$/, '')
  const [name = '', variant = 'default'] = base.split('.')

  const ordered = ORDER_PREFIX.exec(name)
  if (ordered) {
    return { id: ordered[2] ?? name, variant, order: Number(ordered[1]) }
  }

  return { id: name, variant, order: Number.POSITIVE_INFINITY }
}

/** Fills in everything a screen file left out. */
export function buildScreenMeta(fileName: string, overrides: Partial<ScreenMeta> | undefined): ScreenMeta {
  const parsed = parseScreenFileName(fileName)
  const id = overrides?.id ?? parsed.id
  const variant = overrides?.variant ?? parsed.variant

  return {
    id,
    variant,
    title: overrides?.title ?? titleize(id),
    variantLabel: overrides?.variantLabel ?? titleize(variant),
    viewport: overrides?.viewport ?? 'desktop',
    order: overrides?.order ?? parsed.order,
  }
}
