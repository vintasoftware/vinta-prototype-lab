import type { Prototype } from '../types'

/**
 * The name a tour shows for the prototype a step is in: the prototype's title, with a leading
 * number such as "Acme 2. " dropped, since prototypes are often numbered to sort them.
 */
export function roleOf(prototypes: readonly Prototype[], slug: string): string {
  const title = prototypes.find(candidate => candidate.slug === slug)?.doc.title ?? slug
  return title.replace(/^.*?\b\d+\.\s+/, '')
}
