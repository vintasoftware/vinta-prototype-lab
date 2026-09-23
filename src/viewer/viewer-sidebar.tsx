import type { Prototype } from '../types'
import { ComponentsSection, type ComponentsSectionProps } from './components-section'
import { ScreenList } from './screen-list'

export interface ViewerSidebarProps {
  prototype: Prototype
  screenId: string
  variant: string
  noteCountByScreen: Map<string, number>
  onSelectScreen: (screenId: string) => void
  onSelectVariant: (variant: string) => void
  /** Everything the components half of the rail needs, passed through as one thing. */
  components: ComponentsSectionProps
}

/** The left rail: the prototype's screens, and the components of the screen on stage. */
export function ViewerSidebar({
  prototype,
  screenId,
  variant,
  noteCountByScreen,
  onSelectScreen,
  onSelectVariant,
  components,
}: ViewerSidebarProps) {
  return (
    <div className='flex w-64 shrink-0 flex-col border-border border-r bg-card'>
      <div className='max-h-[45%] shrink-0 overflow-y-auto'>
        <ScreenList
          prototype={prototype}
          screenId={screenId}
          variant={variant}
          noteCountByScreen={noteCountByScreen}
          onSelectScreen={onSelectScreen}
          onSelectVariant={onSelectVariant}
        />
      </div>

      <ComponentsSection {...components} />
    </div>
  )
}
