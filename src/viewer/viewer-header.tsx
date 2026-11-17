import {
  ArrowLeft,
  Crosshair,
  LayoutGrid,
  type LucideIcon,
  Maximize,
  MessageSquare,
  MonitorPlay,
  PanelLeft,
  PanelLeftClose,
  PanelRight,
  PanelRightClose,
  RotateCcw,
  SquareDashedMousePointer,
} from 'lucide-react'
import type { ViewToggle, ViewToggles } from '../hooks/use-view-toggles'
import { VIEWPORT_LABEL } from '../lib/constants'
import type { Prototype, PrototypeVersion, ScreenViewport } from '../types'
import { Badge, Button, SegmentedToggle } from '../ui'
import { DeviceToolbar, type DeviceToolbarProps } from './device-toolbar'
import { PrototypePicker } from './prototype-picker'
import { VersionPicker } from './version-picker'
import { VintaWordmark } from './vinta-wordmark'

const VIEWPORT_OPTIONS = (['mobile', 'tablet', 'desktop'] as const).map(value => ({
  value,
  label: VIEWPORT_LABEL[value],
}))

/** The toggles the header shows as named buttons, in the order they sit. */
const MODES: readonly { name: ViewToggle; label: string; Icon: LucideIcon }[] = [
  { name: 'canvas', label: 'Canvas', Icon: LayoutGrid },
  { name: 'inspect', label: 'Inspect', Icon: Crosshair },
  { name: 'hotspots', label: 'Hotspots', Icon: SquareDashedMousePointer },
  { name: 'notes', label: 'Comments', Icon: MessageSquare },
]

export interface ViewerHeaderProps {
  prototypes: readonly Prototype[]
  slug: string
  onOpenPrototype: (slug: string) => void
  /** The switcher shows only when both are given; a project that turns it off passes neither. */
  viewport?: ScreenViewport
  onViewportChange?: (viewport: ScreenViewport) => void
  toggles: ViewToggles
  onToggle: (name: ViewToggle) => void
  /** Shown on the Comments button, so the count is visible with the panel closed. */
  noteCount: number
  canGoBack: boolean
  onBack: () => void
  onRestart: () => void
  /** The device list, size, rotate and zoom, beside the viewport switcher. */
  device: DeviceToolbarProps
  /** Shows the screen alone, without the viewer; left out when there is no screen to show. */
  onPresent?: () => void
  /** The open prototype's versions. The version picker shows only when there are some. */
  versions?: readonly PrototypeVersion[]
  /** The picked version's id. Left out for All. */
  version?: string
  /** The guided tour player's address. The Tours link shows only when the project has built one. */
  playerHref?: string
  onVersionChange?: (version: string | undefined) => void
}

/** A button's text, dropped on a window too narrow for it; the icon and tooltip stay. */
function Label({ children }: { children: string }) {
  return <span className='max-[1920px]:hidden!'>{children}</span>
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
  versions = [],
  version,
  onVersionChange = () => {},
  playerHref,
}: ViewerHeaderProps) {
  return (
    // One row always: a narrower window drops the labels first, then the title and the size fields,
    // and a window narrower still scrolls the row sideways rather than hiding a button. The widths
    // where each drops are set so the row fits a 13-inch laptop with any prototype open.
    <header className='flex shrink-0 items-center gap-2 overflow-x-auto whitespace-nowrap border-border border-b bg-card px-4 py-2 *:shrink-0 max-[1200px]:gap-1! max-[1200px]:px-2!'>
      <span className='max-[1200px]:hidden! flex items-center gap-2'>
        <VintaWordmark className='h-[19px] w-auto shrink-0 text-primary' />
        <span className='font-semibold text-sm max-[1560px]:hidden!'>Prototype Lab</span>
      </span>

      <PanelButton
        open={toggles.screens}
        onToggle={() => onToggle('screens')}
        name='screens panel'
        OpenIcon={PanelLeftClose}
        ClosedIcon={PanelLeft}
      />

      <PrototypePicker prototypes={prototypes} slug={slug} onOpenPrototype={onOpenPrototype} />
      {versions.length > 0 && <VersionPicker versions={versions} selected={version} onSelect={onVersionChange} />}

      <div className='flex items-center gap-1'>
        <Button variant='outline' size='icon-sm' aria-label='Back' title='Back' onClick={onBack} disabled={!canGoBack}>
          <ArrowLeft />
        </Button>
        <Button variant='ghost' size='icon-sm' aria-label='Restart' title='Restart' onClick={onRestart}>
          <RotateCcw />
        </Button>
      </div>

      <div className='ml-auto flex items-center gap-2'>
        {viewport !== undefined && onViewportChange !== undefined && (
          <SegmentedToggle size='sm' options={VIEWPORT_OPTIONS} value={viewport} onValueChange={onViewportChange} />
        )}

        <DeviceToolbar {...device} />

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

        {playerHref !== undefined && (
          <Button variant='ghost' size='sm' asChild>
            <a
              href={playerHref}
              target='_blank'
              rel='noopener'
              aria-label='Tours'
              title='Tours: open the guided tour player in a new tab'
            >
              <MonitorPlay />
              <Label>Tours</Label>
            </a>
          </Button>
        )}

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
