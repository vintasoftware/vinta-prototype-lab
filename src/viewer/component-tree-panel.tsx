import { BookOpen, ChevronDown, ChevronRight } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { CopyLinkButton } from '../components/copy-link-button'
import type { ComponentNode, ComponentTree } from '../lib/component-tree'
import { findStorybookLink, type StorybookLink } from '../lib/storybook-links'
import { cn } from '../ui'

export interface ComponentTreePanelProps {
  tree: ComponentTree
  selectedPath?: string
  hoveredPath?: string
  /** Rows the person collapsed. Everything else is open, so a pick is always visible. */
  collapsed: Set<string>
  onSelect: (path: string | undefined) => void
  onHover: (path: string | undefined) => void
  onToggle: (path: string) => void
  /** Storybook pages by component name. Empty when Storybook is not running. */
  storybookLinks: ReadonlyMap<string, StorybookLink>
}

/** The screen's components, read from the DOM. Clicking a row picks that component. */
export function ComponentTreePanel({
  tree,
  selectedPath,
  hoveredPath,
  collapsed,
  onSelect,
  onHover,
  onToggle,
  storybookLinks,
}: ComponentTreePanelProps) {
  if (tree.roots.length === 0) {
    return <p className='px-2 text-muted-foreground text-xs'>Nothing to show for this screen.</p>
  }

  return (
    <ul aria-label='Components' onMouseLeave={() => onHover(undefined)} onBlur={() => onHover(undefined)}>
      {tree.roots.map(node => (
        <ComponentRow
          key={node.path}
          node={node}
          depth={0}
          {...{ selectedPath, hoveredPath, collapsed, onSelect, onHover, onToggle, storybookLinks }}
        />
      ))}
    </ul>
  )
}

interface ComponentRowProps extends Omit<ComponentTreePanelProps, 'tree'> {
  node: ComponentNode
  depth: number
}

function ComponentRow({
  node,
  depth,
  selectedPath,
  hoveredPath,
  collapsed,
  onSelect,
  onHover,
  onToggle,
  storybookLinks,
}: ComponentRowProps) {
  const rowRef = useRef<HTMLButtonElement>(null)
  const selected = node.path === selectedPath
  const isOpen = !collapsed.has(node.path)
  const hasChildren = node.children.length > 0
  // Only a component has a page. A landmark tag like `header` is part of the screen's markup, and
  // a story that happens to share the word is not about it.
  const story = node.kind === 'component' ? findStorybookLink(storybookLinks, node.label) : undefined

  // A pick on the screen can land on a row far down a long tree.
  useEffect(() => {
    if (selected) {
      rowRef.current?.scrollIntoView({ block: 'nearest' })
    }
  }, [selected])

  return (
    <li>
      <div className='flex items-center' style={{ paddingLeft: depth * 12 }}>
        {hasChildren ? (
          <button
            type='button'
            aria-label={isOpen ? `Collapse ${node.label}` : `Expand ${node.label}`}
            aria-expanded={isOpen}
            onClick={() => onToggle(node.path)}
            className='flex size-4 shrink-0 items-center justify-center text-muted-foreground'
          >
            {isOpen ? <ChevronDown className='size-3' /> : <ChevronRight className='size-3' />}
          </button>
        ) : (
          <span className='size-4 shrink-0' />
        )}

        <button
          ref={rowRef}
          type='button'
          aria-current={selected ? 'true' : undefined}
          onClick={() => onSelect(selected ? undefined : node.path)}
          onMouseEnter={() => onHover(node.path)}
          onFocus={() => onHover(node.path)}
          className={cn(
            'flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs',
            selected && 'bg-primary-subtle text-primary',
            !selected && node.path === hoveredPath && 'bg-muted'
          )}
        >
          <span className='truncate font-medium'>{node.label}</span>
          {node.anchorId !== undefined && (
            <span className='truncate font-mono text-[10px] text-muted-foreground'>#{node.anchorId}</span>
          )}
        </button>

        {selected && (
          <CopyLinkButton picked={node.label} className='text-muted-foreground hover:bg-muted hover:text-foreground' />
        )}

        {story !== undefined && (
          <a
            href={story.url}
            target='_blank'
            rel='noreferrer'
            aria-label={`Open ${node.label} in Storybook`}
            title={`Storybook: ${story.title} — ${story.name}`}
            className='flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground'
          >
            <BookOpen className='size-3' />
          </a>
        )}
      </div>

      {hasChildren && isOpen && (
        <ul>
          {node.children.map(child => (
            <ComponentRow
              key={child.path}
              node={child}
              depth={depth + 1}
              {...{ selectedPath, hoveredPath, collapsed, onSelect, onHover, onToggle, storybookLinks }}
            />
          ))}
        </ul>
      )}
    </li>
  )
}
