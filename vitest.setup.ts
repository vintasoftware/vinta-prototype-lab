import { afterEach, vi } from 'vitest'

// Load DOM-only helpers only when a DOM exists. `// @vitest-environment node` test files then
// skip the react-dom, @testing-library/react, and jest-dom imports.
let cleanup: (() => void) | undefined

if (typeof document !== 'undefined') {
  await import('@testing-library/jest-dom/vitest')
  ;({ cleanup } = await import('@testing-library/react'))

  // happy-dom does not implement the Pointer Events APIs Radix UI relies on to manage focus.
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => {}
  Element.prototype.releasePointerCapture ??= () => {}
  Element.prototype.scrollIntoView ??= () => {}
}

// Unmount rendered trees, restore real timers and spies, and clear storage after each test, so one
// test's state cannot leak into the next.
afterEach(() => {
  cleanup?.()
  vi.useRealTimers()
  vi.restoreAllMocks()
  if (typeof localStorage !== 'undefined') {
    localStorage.clear()
  }
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.clear()
  }
})
