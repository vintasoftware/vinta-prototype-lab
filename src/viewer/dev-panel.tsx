import { BookOpen, ExternalLink, Ruler, TriangleAlert } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { measureAnchor } from '../lib/anchor-rect'
import type { BoxModel, Measurement } from '../lib/measure'
import { boxModel } from '../lib/measure'
import { parseSourceRef, SOURCE_ATTRIBUTE } from '../lib/source-ref'
import type { StorybookLink } from '../lib/storybook-links'
import { collectTokenNames, readStyle, resolveTokens, type StyleKind, type StyleReading } from '../lib/style-tokens'
import { Badge, Button, cn } from '../ui'

export interface DevPanelProps {
  /** The picked element and the frame its screen renders in. Without them the panel says how to pick. */
  element?: Element
  frame?: Element
  /** The component's name, as the tree shows it. */
  label?: string
  /** How a link names the component. */
  selector?: string
  anchorId?: string
  storybookLink?: StorybookLink
  /** Off in a built copy: there is no dev server to open the editor. */
  canOpenSource: boolean
  /** Measuring is on: hovering another element shows the distances to it. */
  measuring: boolean
  onToggleMeasure: () => void
  /** The distances to the element under the pointer, while measuring. */
  measurements: readonly Measurement[]
}

/** `prototypes/booking/screens/10-home.tsx` → `screens/10-home.tsx`, which is what a person looks for. */
function shortFile(file: string): string {
  const cut = file.lastIndexOf('/screens/')
  return cut === -1 ? file : file.slice(cut + 1)
}

/** Opens a source position in the editor, through the dev server's own open-in-editor support. */
async function openInEditor(file: string, line: number, column: number): Promise<void> {
  const response = await fetch(`/__open-in-editor?file=${encodeURIComponent(`${file}:${line}:${column}`)}`)
  if (!response.ok) {
    throw new Error(`The dev server answered ${response.status}.`)
  }
}

/** Where the element was written: its own stamp, or the nearest element above it that has one. */
function sourceOf(element: Element): { ref: ReturnType<typeof parseSourceRef>; own: boolean } {
  const stamped = element.closest(`[${SOURCE_ATTRIBUTE}]`)
  const ref = stamped === null ? undefined : parseSourceRef(stamped.getAttribute(SOURCE_ATTRIBUTE) ?? '')
  return { ref, own: stamped === element }
}

const TRANSPARENT = new Set(['rgba(0, 0, 0, 0)', 'transparent'])

/** How many tokens of the same value a row names before it sums up the rest. */
const SHOWN_MATCHES = 3

interface Readings {
  colors: StyleReading[]
  spacing: StyleReading[]
  typography: StyleReading[]
  shape: StyleReading[]
  box: BoxModel
}

/**
 * The picked element's styles, each read back to its utility and token. Tokens are read from the
 * page's stylesheets and resolved inside the element's own screen, so a token a screen overrides
 * resolves as it does there.
 */
function readElement(element: Element): Readings {
  const style = getComputedStyle(element)
  const classes = Array.from(element.classList)
  const names = collectTokenNames(element.ownerDocument)
  const parent = element.parentElement ?? element
  const tokensFor = (kind: StyleKind, prefix?: string) =>
    resolveTokens(prefix === undefined ? names : names.filter(name => name.startsWith(prefix)), kind, parent)
  const colorTokens = tokensFor('color')
  const read = (label: string, property: string, kind: StyleKind, tokens: ReadonlyMap<string, string>, side?: string) =>
    readStyle(label, style.getPropertyValue(property), kind, classes, tokens, side)

  const colors: StyleReading[] = []
  if (!TRANSPARENT.has(style.backgroundColor)) {
    colors.push(read('Background', 'background-color', 'background', colorTokens))
  }
  colors.push(read('Text', 'color', 'color', colorTokens))
  if (Number.parseFloat(style.borderTopWidth) > 0) {
    colors.push(read('Border', 'border-top-color', 'border-color', colorTokens))
  }

  const spacingTokens = tokensFor('spacing', '--spacing')
  const spacing: StyleReading[] = []
  for (const [label, property, side] of [
    ['Padding top', 'padding-top', 'pt'],
    ['Padding right', 'padding-right', 'pr'],
    ['Padding bottom', 'padding-bottom', 'pb'],
    ['Padding left', 'padding-left', 'pl'],
    ['Margin top', 'margin-top', 'mt'],
    ['Margin right', 'margin-right', 'mr'],
    ['Margin bottom', 'margin-bottom', 'mb'],
    ['Margin left', 'margin-left', 'ml'],
    ['Gap', 'row-gap', 'gy'],
    ['Column gap', 'column-gap', 'gx'],
  ] as const) {
    const value = style.getPropertyValue(property)
    if (value !== '' && value !== '0px' && value !== 'normal') {
      spacing.push(read(label, property, 'spacing', spacingTokens, side))
    }
  }

  const typography = [
    read('Font size', 'font-size', 'font-size', tokensFor('font-size', '--text-')),
    read(
      'Line height',
      'line-height',
      'line-height',
      resolveTokens(
        names.filter(name => name.startsWith('--leading-') || name.endsWith('--line-height')),
        'line-height',
        parent
      )
    ),
    read('Weight', 'font-weight', 'font-weight', tokensFor('font-weight', '--font-weight-')),
    read('Family', 'font-family', 'font-family', tokensFor('font-family', '--font-')),
  ]

  const shape: StyleReading[] = []
  if (Number.parseFloat(style.borderTopLeftRadius) > 0) {
    shape.push(read('Radius', 'border-top-left-radius', 'radius', tokensFor('radius', '--radius')))
  }
  if (style.boxShadow !== '' && style.boxShadow !== 'none') {
    shape.push(read('Shadow', 'box-shadow', 'shadow', tokensFor('shadow', '--shadow')))
  }

  return { colors, spacing, typography, shape, box: boxModel(style) }
}

/**
 * The Dev tab: what an engineer needs to build the picked element. Which component it is and where
 * it was written, and every style read back to the utility and token that set it, so "which token
 * is this?" has an answer from the code, not from a drawing.
 */
export function DevPanel({
  element,
  frame,
  label,
  selector,
  anchorId,
  storybookLink,
  canOpenSource,
  measuring,
  onToggleMeasure,
  measurements,
}: DevPanelProps) {
  const readings = useMemo(() => (element === undefined ? undefined : readElement(element)), [element])
  const size = useMemo(
    () => (element === undefined || frame === undefined ? undefined : measureAnchor(element, frame)),
    [element, frame]
  )
  const [openError, setOpenError] = useState<string | undefined>(undefined)

  if (element === undefined || readings === undefined) {
    return (
      <p className='text-muted-foreground text-sm'>
        Turn on Inspect (I) and pick an element, on the stage or the canvas, to see how it is built.
      </p>
    )
  }

  const { ref, own } = sourceOf(element)

  return (
    <div className='flex flex-col gap-4 text-sm'>
      <Section title='Element'>
        <dl className='grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1'>
          <dt className='text-muted-foreground'>Component</dt>
          <dd className='font-mono'>{label ?? element.tagName.toLowerCase()}</dd>
          {selector !== undefined && (
            <>
              <dt className='text-muted-foreground'>Path</dt>
              <dd className='break-all font-mono text-xs'>{selector}</dd>
            </>
          )}
          {anchorId !== undefined && (
            <>
              <dt className='text-muted-foreground'>Id</dt>
              <dd className='font-mono'>#{anchorId}</dd>
            </>
          )}
          {storybookLink !== undefined && (
            <>
              <dt className='text-muted-foreground'>Storybook</dt>
              <dd>
                <a
                  href={storybookLink.url}
                  target='_blank'
                  rel='noreferrer'
                  className='inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline'
                >
                  <BookOpen className='size-3.5' />
                  {storybookLink.title}
                </a>
              </dd>
            </>
          )}
          <dt className='text-muted-foreground'>Source</dt>
          <dd>
            {ref === undefined ? (
              <span className='text-muted-foreground'>
                {/* The dev server stamps where each element was written; a built copy has no stamps. */}
                {canOpenSource ? 'Not written in a screen file.' : 'Known under prototype-lab dev.'}
              </span>
            ) : (
              <span className='flex flex-wrap items-center gap-2'>
                <span className='font-mono text-xs'>
                  {shortFile(ref.file)}:{ref.line}
                </span>
                {!own && <span className='text-muted-foreground text-xs'>(inside &lt;{ref.tag}&gt;)</span>}
                {canOpenSource && (
                  <Button
                    variant='outline'
                    size='xs'
                    onClick={() => {
                      setOpenError(undefined)
                      openInEditor(ref.file, ref.line, ref.column).catch((thrown: unknown) =>
                        setOpenError(thrown instanceof Error ? thrown.message : String(thrown))
                      )
                    }}
                  >
                    <ExternalLink />
                    Open in editor
                  </Button>
                )}
              </span>
            )}
          </dd>
          {size !== undefined && (
            <>
              <dt className='text-muted-foreground'>Size</dt>
              <dd className='font-mono tabular-nums'>
                {Math.round(size.width * 10) / 10} × {Math.round(size.height * 10) / 10}
              </dd>
            </>
          )}
        </dl>
        {openError !== undefined && (
          <p role='alert' className='mt-1 text-destructive text-xs'>
            The editor did not open: {openError}
          </p>
        )}
      </Section>

      <Section title='Colors'>
        <Readings readings={readings.colors} />
      </Section>
      {readings.spacing.length > 0 && (
        <Section title='Spacing'>
          <Readings readings={readings.spacing} />
        </Section>
      )}
      <Section title='Typography'>
        <Readings readings={readings.typography} />
      </Section>
      {readings.shape.length > 0 && (
        <Section title='Radius and shadow'>
          <Readings readings={readings.shape} />
        </Section>
      )}

      <Section title='Measure'>
        <Button variant={measuring ? 'light' : 'outline'} size='sm' aria-pressed={measuring} onClick={onToggleMeasure}>
          <Ruler />
          Measure
        </Button>
        <p className='mt-2 text-muted-foreground text-xs'>
          Hold Alt, or turn Measure on (M), and point at another element, or focus its row in the component tree, to see
          the distances to it in the frame's own pixels.
        </p>
        {measurements.length > 0 && (
          <ul aria-label='Distances' className='mt-2 grid grid-cols-2 gap-1 font-mono text-xs tabular-nums'>
            {measurements.map(measurement => (
              <li key={measurement.side}>
                {measurement.side}: {measurement.value}
              </li>
            ))}
          </ul>
        )}
        <BoxModelTable box={readings.box} />
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className='mb-1.5 font-semibold text-muted-foreground text-xs uppercase tracking-wide'>{title}</h3>
      {children}
    </section>
  )
}

/** One row per style: what it is, the utility and token that set it, and the value. */
function Readings({ readings }: { readings: readonly StyleReading[] }) {
  return (
    <ul className='flex flex-col gap-1.5'>
      {readings.map(reading => (
        <li key={reading.label} className='flex flex-col gap-0.5 rounded-md border border-border p-2'>
          <div className='flex items-center justify-between gap-2'>
            <span className='font-medium'>{reading.label}</span>
            {reading.utility !== undefined && <code className='rounded bg-muted px-1 text-xs'>{reading.utility}</code>}
          </div>
          <div className='flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs'>
            {reading.tokens.slice(0, SHOWN_MATCHES).map(token => (
              <code key={token} className='text-primary'>
                {token}
              </code>
            ))}
            {reading.tokens.length > SHOWN_MATCHES && (
              <span className='text-muted-foreground' title={reading.tokens.join(', ')}>
                and {reading.tokens.length - SHOWN_MATCHES} more with the same value
              </span>
            )}
            {reading.notToken && (
              <Badge variant='warning'>
                <TriangleAlert />
                not a token
              </Badge>
            )}
            <span className={cn('break-all font-mono text-muted-foreground')}>{reading.value}</span>
          </div>
        </li>
      ))}
    </ul>
  )
}

/** Padding and margin of the picked element, side by side, so they can be read without a pointer. */
function BoxModelTable({ box }: { box: BoxModel }) {
  const sides = ['top', 'right', 'bottom', 'left'] as const
  return (
    <table className='mt-2 w-full text-xs tabular-nums'>
      <caption className='sr-only'>Padding and margin of the picked element, in pixels</caption>
      <thead>
        <tr className='text-muted-foreground'>
          <th className='text-left font-normal' scope='col'>
            Side
          </th>
          <th className='text-right font-normal' scope='col'>
            Padding
          </th>
          <th className='text-right font-normal' scope='col'>
            Margin
          </th>
        </tr>
      </thead>
      <tbody>
        {sides.map(side => (
          <tr key={side}>
            <th className='text-left font-normal' scope='row'>
              {side}
            </th>
            <td className='text-right font-mono'>{box.padding[side]}</td>
            <td className='text-right font-mono'>{box.margin[side]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
