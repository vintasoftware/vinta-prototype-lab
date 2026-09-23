import type { AnnotationKind } from '../types'

/**
 * Look of each comment kind. The viewer is a tool rather than product UI, so these use raw palette
 * scales: the four kinds have to stay apart at a glance, and the semantic roles carry meanings
 * ("destructive", "warning") that a designer's note does not.
 */
export const ANNOTATION_KIND: Record<AnnotationKind, { label: string; pin: string; ring: string; dot: string }> = {
  spec: { label: 'Spec', pin: 'bg-fuchsia-600 text-white', ring: 'ring-fuchsia-500', dot: 'bg-fuchsia-600' },
  flow: { label: 'Flow', pin: 'bg-cyan-700 text-white', ring: 'ring-cyan-600', dot: 'bg-cyan-700' },
  question: { label: 'Question', pin: 'bg-orange-600 text-white', ring: 'ring-orange-500', dot: 'bg-orange-600' },
  todo: { label: 'To do', pin: 'bg-red-600 text-white', ring: 'ring-red-500', dot: 'bg-red-600' },
}

export const ANNOTATION_KINDS: AnnotationKind[] = ['spec', 'flow', 'question', 'todo']
