import {
  ArrowLeft,
  Crosshair,
  type LucideIcon,
  Maximize,
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
import { DeviceToolbar, type DeviceToolbarProps } from './device-toolbar'
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
  /** The device toolbar. Without it the header offers the three viewports instead. */
  device?: DeviceToolbarProps
  /** Shows the Present button, which gives the screen the whole window. */
  onPresent?: () => void
}

/** A button's text, dropped on a window too narrow for it; the icon and tooltip stay. */
function Label({ children }: { children: string }) {
  return <span className='max-[1460px]:hidden!'>{children}</span>
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
  device,
  onPresent,
}: ViewerHeaderProps) {
  return (
    // One row always: a narrower window drops the labels first, then the title and the size fields,
    // and a window narrower still scrolls the row sideways rather than hiding a button.
    <header className='flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-border border-b bg-card px-4 py-2 *:shrink-0 max-[1100px]:gap-1! max-[1100px]:px-2!'>
      <span className='max-[1100px]:hidden! font-semibold text-sm'>Prototype Lab</span>

      <PanelButton
        open={toggles.screens}
        onToggle={() => onToggle('screens')}
        name='screens panel'
        OpenIcon={PanelLeftClose}
        ClosedIcon={PanelLeft}
      />

      <PrototypePicker prototypes={prototypes} slug={slug} onOpenPrototype={onOpenPrototype} />

      <div className='flex items-center gap-1'>
        <Button variant='outline' size='sm' title='Back' onClick={onBack} disabled={!canGoBack}>
          <ArrowLeft />
          <Label>Back</Label>
        </Button>
        <Button variant='ghost' size='sm' title='Restart' onClick={onRestart}>
          <RotateCcw />
          <Label>Restart</Label>
        </Button>
      </div>

      <div className='ml-auto flex items-center gap-2'>
        {device === undefined ? (
          <SegmentedToggle size='sm' options={VIEWPORT_OPTIONS} value={viewport} onValueChange={onViewportChange} />
        ) : (
          <DeviceToolbar {...device} />
        )}

        {MODES.map(({ name, label, Icon }) => (
          <Button
            key={name}
            variant={toggles[name] ? 'light' : 'ghost'}
            size='sm'
            aria-label={label}
            title={label}
            onClick={() => onToggle(name)}
          >
            <Icon />
            <Label>{label}</Label>
            {name === 'notes' && noteCount > 0 && <Badge variant='neutral'>{noteCount}</Badge>}
          </Button>
        ))}

        {onPresent !== undefined && (
          <Button
            variant='ghost'
            size='icon-sm'
            aria-label='Present the screen'
            title='Present: only the screen, without the viewer (P)'
            onClick={onPresent}
          >
            <Maximize />
          </Button>
        )}

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
