/**
 * Reads a picked element's styles back into the project's own vocabulary: the utility class that
 * set each value, the design token behind it, and the value the browser resolved. A value no token
 * produces says so; a token is never guessed.
 *
 * The rules here are pure and work on what the browser reports, so they test without a browser;
 * `collectTokens` and `resolveToken` are the parts that read the page.
 */

/** A design token: a custom property set on `:root`, with the value the browser resolves it to. */
export interface Token {
  name: string
  value: string
}

/** One style of the element, as the Dev tab shows it. */
export interface StyleReading {
  /** What it is: "Background", "Padding top". */
  label: string
  /** The value the browser resolved, as it reports it. */
  value: string
  /** The utility class that set it, when one did. */
  utility?: string
  /** The token behind it: named by the utility, or the tokens whose value it equals. */
  tokens: string[]
  /** Set when no token produces the value. */
  notToken: boolean
}

/** The kinds of style the Dev tab reads, each with the utilities that set it and its token prefix. */
export type StyleKind =
  | 'background'
  | 'color'
  | 'border-color'
  | 'spacing'
  | 'font-size'
  | 'line-height'
  | 'font-weight'
  | 'font-family'
  | 'radius'
  | 'shadow'

const TEXT_SIZES = new Set(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl'])
const TEXT_NOT_COLOR = new Set([
  ...TEXT_SIZES,
  'left',
  'center',
  'right',
  'justify',
  'start',
  'end',
  'wrap',
  'nowrap',
  'balance',
  'pretty',
  'ellipsis',
  'clip',
])
/** `[0.8rem]`, `[12px]`, `[length:var(--x)]`: an arbitrary value that is a size, not a colour. */
const ARBITRARY_LENGTH = /^\[(?:length:.+|-?[\d.]+(?:px|rem|em|%|vh|vw|ch)?)\]$/

const FONT_WEIGHTS = new Set([
  'thin',
  'extralight',
  'light',
  'normal',
  'medium',
  'semibold',
  'bold',
  'extrabold',
  'black',
])
const FONT_FAMILIES = new Set(['sans', 'serif', 'mono'])
const BORDER_NOT_COLOR = /^(?:\d+|x|y|t|r|b|l|s|e|solid|dashed|dotted|double|hidden|none|collapse|separate)(?:-|$)/

/** The class without a leading or trailing `!`, or `undefined` for one that applies only under a variant. */
function atRest(className: string): string | undefined {
  if (className.includes(':')) {
    return undefined
  }
  return className.replace(/^!|!$/g, '')
}

/** The utility among `classes` that sets a style of this kind, and the name inside it. */
export function utilityFor(
  classes: readonly string[],
  kind: StyleKind,
  side?: string
): { utility: string; name: string } | undefined {
  for (const raw of [...classes].reverse()) {
    const utility = atRest(raw)
    if (utility === undefined) {
      continue
    }
    const match = matchUtility(utility, kind, side)
    if (match !== undefined) {
      return { utility, name: match }
    }
  }
  return undefined
}

function after(utility: string, prefix: string): string | undefined {
  return utility.startsWith(prefix) ? utility.slice(prefix.length) : undefined
}

/** The name a utility of this kind carries, `muted` for `bg-muted`, or `undefined` when it is not one. */
function matchUtility(utility: string, kind: StyleKind, side?: string): string | undefined {
  switch (kind) {
    case 'background': {
      const name = after(utility, 'bg-')
      return name !== undefined &&
        !/^(?:clip|origin|repeat|no-repeat|fixed|local|scroll|cover|contain|center|top|bottom|left|right|none|linear|radial|conic|gradient)/.test(
          name
        )
        ? name
        : undefined
    }
    case 'color': {
      const name = after(utility, 'text-')
      const bare = name?.split('/')[0] ?? ''
      return name !== undefined && !TEXT_NOT_COLOR.has(bare) && !ARBITRARY_LENGTH.test(bare) ? name : undefined
    }
    case 'border-color': {
      const name = after(utility, 'border-')
      return name !== undefined && !BORDER_NOT_COLOR.test(name) ? name : undefined
    }
    case 'spacing': {
      // `side` is the utility's own prefix for the side read: `pt` reads `pt-`, `py-` and `p-`.
      const prefixes = side === undefined ? [] : spacingPrefixes(side)
      for (const prefix of prefixes) {
        const name = after(utility, `${prefix}-`)
        if (name !== undefined) {
          return name
        }
      }
      return undefined
    }
    case 'font-size': {
      const name = after(utility, 'text-')
      const bare = name?.split('/')[0] ?? ''
      return name !== undefined && (TEXT_SIZES.has(bare) || ARBITRARY_LENGTH.test(bare)) ? name : undefined
    }
    case 'line-height':
      return after(utility, 'leading-')
    case 'font-weight': {
      const name = after(utility, 'font-')
      return name !== undefined && FONT_WEIGHTS.has(name) ? name : undefined
    }
    case 'font-family': {
      const name = after(utility, 'font-')
      return name !== undefined && FONT_FAMILIES.has(name) ? name : undefined
    }
    case 'radius':
      return utility === 'rounded' ? 'DEFAULT' : after(utility, 'rounded-')
    case 'shadow':
      return utility === 'shadow' ? 'DEFAULT' : after(utility, 'shadow-')
  }
}

/**
 * The utility prefixes that set one side of padding, margin or gap, most specific first, so `pt-2`
 * wins over `py-4` and `p-6` the way the cascade has it in Tailwind.
 */
export function spacingPrefixes(side: string): string[] {
  const [base, edge] = [side.charAt(0), side.slice(1)]
  if (base === 'g') {
    return edge === 'x' ? ['gap-x', 'gap'] : edge === 'y' ? ['gap-y', 'gap'] : ['gap']
  }
  const axis = edge === 't' || edge === 'b' ? 'y' : 'x'
  return [`${base}${edge}`, `${base}${axis}`, base]
}

/** Colour names that are CSS keywords, not tokens: nothing to look up, and nothing wrong either. */
const COLOR_KEYWORDS = new Set(['transparent', 'current', 'inherit', 'initial', 'unset'])

/**
 * The tokens a utility's name may stand for, most likely first. Tailwind names a colour
 * `--color-<name>`; a shadcn/ui theme declared with `@theme inline` emits no such property, and the
 * token on the page is `--<name>` itself.
 */
export function tokenCandidatesFor(kind: StyleKind, name: string): string[] {
  const named = tokenNameFor(kind, name)
  if (named === undefined) {
    return []
  }
  const bare = name.split('/')[0] ?? name
  return kind === 'background' || kind === 'color' || kind === 'border-color' ? [named, `--${bare}`] : [named]
}

/** The token a utility's name stands for in Tailwind's theme, before checking that the page has it. */
export function tokenNameFor(kind: StyleKind, name: string): string | undefined {
  const bare = name.split('/')[0] ?? name
  if (bare.startsWith('[') || bare.startsWith('(')) {
    return undefined
  }
  switch (kind) {
    case 'background':
    case 'color':
    case 'border-color':
      return `--color-${bare}`
    case 'font-size':
      return `--text-${bare}`
    case 'line-height':
      return `--leading-${bare}`
    case 'font-weight':
      return `--font-weight-${bare}`
    case 'font-family':
      return `--font-${bare}`
    case 'radius':
      return bare === 'DEFAULT' ? '--radius' : `--radius-${bare}`
    case 'shadow':
      return bare === 'DEFAULT' ? '--shadow' : `--shadow-${bare}`
    case 'spacing':
      // A number is a step on the spacing scale; a name is not a token of its own.
      return /^\d+(?:\.\d+)?$/.test(bare) ? '--spacing' : undefined
  }
}

/**
 * Reads one style. The utility names the token when the page has it; without a utility, the tokens
 * whose value the browser reports for this one are named instead, all of them, since more than one
 * may share a value. Neither found reads as "not a token".
 */
export function readStyle(
  label: string,
  value: string,
  kind: StyleKind,
  classes: readonly string[],
  tokens: ReadonlyMap<string, string>,
  side?: string
): StyleReading {
  const found = utilityFor(classes, kind, side)
  // A text size utility sets the line height too, from its own token, unless a leading utility does.
  if (kind === 'line-height' && found === undefined) {
    const size = utilityFor(classes, 'font-size')
    const token = size === undefined ? undefined : `--text-${size.name}--line-height`
    if (size !== undefined && token !== undefined && tokens.has(token)) {
      return { label, value, utility: size.utility, tokens: [token], notToken: false }
    }
  }
  if (found !== undefined && COLOR_KEYWORDS.has(found.name) && kind !== 'spacing') {
    return { label, value, utility: found.utility, tokens: [], notToken: false }
  }
  const named =
    found === undefined ? undefined : tokenCandidatesFor(kind, found.name).find(candidate => tokens.has(candidate))
  if (found !== undefined && named !== undefined) {
    const step = kind === 'spacing' ? found.name : undefined
    return {
      label,
      value,
      utility: found.utility,
      tokens: [step === undefined ? named : `${named} × ${step}`],
      notToken: false,
    }
  }
  const matching =
    kind === 'spacing' ? [] : [...tokens].filter(([, resolved]) => resolved === value).map(([name]) => name)
  return {
    label,
    value,
    ...(found === undefined ? {} : { utility: found.utility }),
    tokens: matching,
    notToken: matching.length === 0,
  }
}

/** Every custom property set on `:root` (or `:root, :host`) in the page's stylesheets, layers and media included. */
export function collectTokenNames(doc: Document = document): string[] {
  const names = new Set<string>()
  const visit = (rules: CSSRuleList) => {
    for (const rule of Array.from(rules)) {
      if (rule instanceof CSSStyleRule && /(?:^|,)\s*(?::root|:host|html)\b/.test(rule.selectorText)) {
        for (const property of Array.from(rule.style)) {
          if (property.startsWith('--')) {
            names.add(property)
          }
        }
      }
      if ('cssRules' in rule && (rule as CSSGroupingRule).cssRules !== undefined) {
        visit((rule as CSSGroupingRule).cssRules)
      }
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) {
    try {
      visit(sheet.cssRules)
    } catch {
      // A stylesheet from another origin cannot be read; its tokens are not the project's.
    }
  }
  return [...names].sort()
}

/** What CSS property a probe sets to resolve a token of this kind the way the element's style is. */
const PROBE_PROPERTY: Readonly<Record<StyleKind, string>> = {
  background: 'background-color',
  color: 'color',
  'border-color': 'color',
  spacing: 'width',
  'font-size': 'font-size',
  'line-height': 'line-height',
  'font-weight': 'font-weight',
  'font-family': 'font-family',
  radius: 'border-top-left-radius',
  shadow: 'box-shadow',
}

/**
 * Resolves tokens to the values the browser gives them for a kind of style, by setting each on a
 * hidden probe inside `within` (so tokens a frame or screen overrides resolve as they do there).
 */
export function resolveTokens(names: readonly string[], kind: StyleKind, within: Element): Map<string, string> {
  const doc = within.ownerDocument
  // An unknown token leaves the property unset, which inherits the parent's value. The parent holds
  // values no token would have, so an inherited one never passes for a match.
  const host = doc.createElement('span')
  host.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;color:rgb(1, 2, 4);font-size:1.2345px;line-height:1.2345px;font-weight:123;font-family:prototype-lab-none'
  const probe = doc.createElement('span')
  probe.style.cssText = 'border-style:solid'
  host.appendChild(probe)
  within.appendChild(host)
  const property = PROBE_PROPERTY[kind]
  const resolved = new Map<string, string>()
  try {
    const unset = getComputedStyle(probe).getPropertyValue(property)
    for (const name of names) {
      probe.style.setProperty(property, `var(${name})`)
      const value = getComputedStyle(probe).getPropertyValue(property)
      if (value !== '' && value !== unset) {
        resolved.set(name, value)
      }
      probe.style.removeProperty(property)
    }
  } finally {
    host.remove()
  }
  return resolved
}
