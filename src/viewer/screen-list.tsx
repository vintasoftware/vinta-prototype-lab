import { distinctScreens, variantsOf } from '../lib/discovery'
import type { Prototype } from '../types'
import { Badge, cn } from '../ui'

export interface ScreenListProps {
  prototype: Prototype
  screenId: string
  variant: string
  noteCountByScreen: Map<string, number>
  onSelectScreen: (screenId: string) => void
  onSelectVariant: (variant: string) => void
}

/** The prototype's screens, with the states of the open screen listed under it. */
export function ScreenList({
  prototype,
  screenId,
  variant,
  noteCountByScreen,
  onSelectScreen,
  onSelectVariant,
}: ScreenListProps) {
  return (
    <nav aria-label='Screens' className='flex flex-col gap-1 p-3'>
      <p className='px-2 pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wide'>Screens</p>

      {distinctScreens(prototype).map(screen => {
        const isOpen = screen.id === screenId
        const variants = variantsOf(prototype, screen.id)
        const notes = noteCountByScreen.get(screen.id) ?? 0

        return (
          <div key={screen.id}>
            <button
              type='button'
              onClick={() => onSelectScreen(screen.id)}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm',
                isOpen ? 'bg-primary-subtle font-medium text-primary' : 'hover:bg-muted'
              )}
            >
              <span className='truncate'>{screen.title}</span>
              {notes > 0 && <Badge variant='neutral'>{notes}</Badge>}
            </button>

            {isOpen && variants.length > 1 && (
              <div className='mt-1 mb-1 ml-3 flex flex-col gap-0.5 border-border border-l pl-2'>
                {variants.map(candidate => (
                  <button
                    key={candidate.variant}
                    type='button'
                    onClick={() => onSelectVariant(candidate.variant)}
                    className={cn(
                      'rounded px-2 py-1 text-left text-xs',
                      candidate.variant === variant ? 'bg-muted font-medium' : 'text-muted-foreground hover:bg-muted'
                    )}
                  >
                    {candidate.variantLabel}
                  </button>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </nav>
  )
}
