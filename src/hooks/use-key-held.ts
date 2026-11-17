import { useEffect, useState } from 'react'

/** Whether a modifier key (`Alt`, `Shift`) is held down now. Leaving the window lets it go. */
export function useKeyHeld(key: string): boolean {
  const [held, setHeld] = useState(false)

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.key === key) {
        setHeld(true)
      }
    }
    const up = (event: KeyboardEvent) => {
      if (event.key === key) {
        setHeld(false)
      }
    }
    const release = () => setHeld(false)
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', release)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('blur', release)
    }
  }, [key])

  return held
}
