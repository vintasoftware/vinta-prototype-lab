import type { StorybookStatus } from '../hooks/use-storybook-links'
import type { ComponentTree } from '../lib/component-tree'
import type { StorybookLink } from '../lib/storybook-links'
import { ComponentTreePanel } from './component-tree-panel'
import { NameElementForm } from './name-element-form'

export interface ComponentsSectionProps {
  tree: ComponentTree
  selectedPath?: string
  hoveredPath?: string
  collapsed: Set<string>
  onSelect: (path: string | undefined) => void
  onHover: (path: string | undefined) => void
  onToggle: (path: string) => void
  storybookLinks: ReadonlyMap<string, StorybookLink>
  storybookStatus: StorybookStatus
  /** Where the viewer looked for Storybook, named in the message when it found nothing usable. */
  storybookUrl: string
  /** A component a link asked for that this screen does not have. Reported rather than ignored. */
  missingComponent?: string
  /** A name offered for the picked element, when it carries none and its screen can be written to. */
  suggestedName?: string
  onName: (id: string) => void
  namingError?: string
  naming: boolean
}

/**
 * The components of the screen on stage, under whatever the viewer has to say about them — a link
 * that points at nothing here, or a Storybook it could not read.
 */
export function ComponentsSection({
  tree,
  selectedPath,
  hoveredPath,
  collapsed,
  onSelect,
  onHover,
  onToggle,
  storybookLinks,
  storybookStatus,
  storybookUrl,
  missingComponent,
  suggestedName,
  onName,
  namingError,
  naming,
}: ComponentsSectionProps) {
  return (
    <div className='flex min-h-0 flex-1 flex-col border-border border-t'>
      <p className='px-5 pt-3 pb-1 font-semibold text-muted-foreground text-xs uppercase tracking-wide'>Components</p>

      {suggestedName !== undefined && (
        <NameElementForm
          // The suggestion is seeded once, so each element gets a form of its own: two elements
          // can be called the same thing.
          key={selectedPath ?? suggestedName}
          suggestion={suggestedName}
          onName={onName}
          naming={naming}
          {...(namingError === undefined ? {} : { error: namingError })}
        />
      )}

      {missingComponent !== undefined && (
        <Notice tone='warning'>
          The link points at <span className='font-mono'>{missingComponent}</span>, which this screen does not have.
        </Notice>
      )}

      {storybookStatus === 'unavailable' && (
        <Notice tone='quiet'>
          Nothing is serving Storybook at <span className='font-mono'>{storybookUrl}</span>. Start the project's
          Storybook to link these rows, or set <code className='font-mono'>storybook: false</code> in the config.
        </Notice>
      )}

      {storybookStatus === 'mismatched' && (
        <Notice tone='warning'>
          <span className='font-mono'>{storybookUrl}</span> is serving another project's Storybook, so these rows stay
          unlinked. Free the port for this project's Storybook, or open the viewer with{' '}
          <code className='font-mono'>?storybook=http://localhost:PORT</code>.
        </Notice>
      )}

      <div className='min-h-0 flex-1 overflow-y-auto px-3 pb-3'>
        <ComponentTreePanel
          tree={tree}
          {...(selectedPath === undefined ? {} : { selectedPath })}
          {...(hoveredPath === undefined ? {} : { hoveredPath })}
          collapsed={collapsed}
          onSelect={onSelect}
          onHover={onHover}
          onToggle={onToggle}
          storybookLinks={storybookLinks}
        />
      </div>
    </div>
  )
}

/** One line the panel says about the rows below it. */
function Notice({ tone, children }: { tone: 'warning' | 'quiet'; children: React.ReactNode }) {
  return (
    <p className={`px-5 pb-2 text-[10px] ${tone === 'warning' ? 'text-warning' : 'text-muted-foreground'}`}>
      {children}
    </p>
  )
}
