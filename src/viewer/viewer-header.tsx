import {
  ArrowLeft,
  Crosshair,
  type LucideIcon,
  MessageSquare,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  RotateCcw,
  SquareDashedMousePointer,
  Workflow,
} from 'lucide-react'
import type { ViewToggle, ViewToggles } from '../hooks/use-view-toggles'
import type { Prototype, ScreenViewport } from '../types'
import { Badge, Button, SegmentedToggle } from '../ui'
import { PrototypePicker } from './prototype-picker'

const VIEWPORT_OPTIONS = [
  { value: 'mobile' as const, label: 'Mobile' },
  { value: 'tablet' as const, label: 'Tablet' },
  { value: 'desktop' as const, label: 'Desktop' },
]

/** The toggles the header shows as named buttons, in the order they sit. */
const MODES: readonly { name: ViewToggle; label: string; Icon: LucideIcon }[] = [
  { name: 'flow', label: 'Flow', Icon: Workflow },
  { name: 'inspect', label: 'Inspect', Icon: Crosshair },
  { name: 'hotspots', label: 'Hotspots', Icon: SquareDashedMousePointer },
  { name: 'notes', label: 'Comments', Icon: MessageSquare },
]

export interface ViewerHeaderProps {
  prototypes: readonly Prototype[]
  slug: string
  onOpenPrototype: (slug: string) => void
  viewport: ScreenViewport
  onViewportChange: (viewport: ScreenViewport) => void
  toggles: ViewToggles
  onToggle: (name: ViewToggle) => void
  /** Shown on the Comments button, so the count is visible with the panel closed. */
  noteCount: number
  canGoBack: boolean
  onBack: () => void
  onRestart: () => void
}

export function ViewerHeader({
  prototypes,
  slug,
  onOpenPrototype,
  viewport,
  onViewportChange,
  toggles,
  onToggle,
  noteCount,
  canGoBack,
  onBack,
  onRestart,
}: ViewerHeaderProps) {
  return (
    <header className='flex shrink-0 flex-wrap items-center gap-3 border-border border-b bg-card px-4 py-2'>
      <span className='font-semibold text-sm'>Prototype Lab</span>

      <PanelButton
        open={toggles.screens}
        onToggle={() => onToggle('screens')}
        name='screens panel'
        OpenIcon={PanelLeftClose}
        ClosedIcon={PanelLeft}
      />

      <PrototypePicker prototypes={prototypes} slug={slug} onOpenPrototype={onOpenPrototype} />

      <div className='flex items-center gap-1'>
        <Button variant='outline' size='sm' onClick={onBack} disabled={!canGoBack}>
          <ArrowLeft />
          Back
        </Button>
        <Button variant='ghost' size='sm' onClick={onRestart}>
          <RotateCcw />
          Restart
        </Button>
      </div>

      <div className='ml-auto flex items-center gap-2'>
        <SegmentedToggle size='sm' options={VIEWPORT_OPTIONS} value={viewport} onValueChange={onViewportChange} />

        {MODES.map(({ name, label, Icon }) => (
          <Button key={name} variant={toggles[name] ? 'light' : 'ghost'} size='sm' onClick={() => onToggle(name)}>
            <Icon />
            {label}
            {name === 'notes' && noteCount > 0 && <Badge variant='neutral'>{noteCount}</Badge>}
          </Button>
        ))}

        <PanelButton
          open={toggles.doc}
          onToggle={() => onToggle('doc')}
          name='doc panel'
          OpenIcon={PanelRightClose}
          ClosedIcon={PanelRight}
        />
      </div>
    </header>
  )
}

interface PanelButtonProps {
  open: boolean
  onToggle: () => void
  /** What the button says it hides or shows, e.g. `doc panel`. */
  name: string
  OpenIcon: LucideIcon
  ClosedIcon: LucideIcon
}

/** Closes or reopens one of the panels either side of the stage. */
function PanelButton({ open, onToggle, name, OpenIcon, ClosedIcon }: PanelButtonProps) {
  const label = `${open ? 'Hide' : 'Show'} the ${name}`

  return (
    <Button variant='ghost' size='icon-sm' aria-label={label} title={label} onClick={onToggle}>
      {open ? <OpenIcon /> : <ClosedIcon />}
    </Button>
  )
}
