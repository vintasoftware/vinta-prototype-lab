/**
 * The static page a share becomes: the screen (or the whole canvas) as it was drawn, the prototype's
 * documentation and its comments beside it, and the Open Graph tags that give the link a preview
 * card in Slack, ClickUp, Asana and the like.
 *
 * It runs in the browser, for a download, and on the dev server, which knows the public address
 * and adds it before the upload. It is plain strings so both can use it.
 */

export type ShareKind = 'screen' | 'canvas'

/** Marks the comment pins' layer, so the shared page's Comments toggle can hide it. */
export const SHARE_PINS_ATTRIBUTE = 'data-share-pins'

export interface SharePageParts {
  kind: ShareKind
  /** "Patient booking · Review", the page title and the card's title. */
  title: string
  /** One or two sentences for the card. */
  description: string
  /** The prototype's name, for the page's header. */
  prototypeTitle: string
  /** What the share shows, for the header: "Review · Empty" or "Canvas". */
  subject: string
  /** The component picked when the view was shared, if one was. */
  component?: string
  /** The viewer's address when the view was shared, so whoever runs Prototype Lab can open it live. */
  sourceUrl?: string
  /** The captured screen or canvas, as HTML. */
  stage: string
  /** Its size in CSS pixels, before any zoom. */
  stageSize: { width: number; height: number }
  /** The documentation, as HTML. */
  doc: string
  /** The comment list, as HTML. */
  comments: string
  commentCount: number
  /** The viewer's stylesheets and the project's, so the capture draws as it did. */
  css: string
  /** ISO time the share was made. */
  sharedAt: string
}

export interface SharePageLinks {
  /** Where the page itself is published. */
  url?: string
  /** The preview image the card shows. */
  image?: { url: string; width: number; height: number }
}

/** Escapes text for an HTML attribute or element. */
export function escapeHtml(text: string): string {
  return text.replace(/[&<>"']/g, char => `&#${char.charCodeAt(0)};`)
}

/** A stylesheet can hold any text; this keeps it from closing its own `<style>`. */
function safeStyle(css: string): string {
  return css.replace(/<\/style/gi, '<\\/style')
}

const MAX_DESCRIPTION = 300

function clip(text: string, length: number): string {
  const flat = text.replace(/\s+/g, ' ').trim()
  return flat.length <= length ? flat : `${flat.slice(0, length - 1).trimEnd()}…`
}

/** The `<meta>` tags a link unfurler reads. */
export function openGraphTags(parts: Pick<SharePageParts, 'title' | 'description'>, links: SharePageLinks): string {
  const description = clip(parts.description, MAX_DESCRIPTION)
  const tags: [string, string, string][] = [
    ['name', 'description', description],
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'Prototype Lab'],
    ['property', 'og:title', parts.title],
    ['property', 'og:description', description],
    ['name', 'twitter:title', parts.title],
    ['name', 'twitter:description', description],
  ]
  if (links.url !== undefined) {
    tags.push(['property', 'og:url', links.url])
  }
  if (links.image !== undefined) {
    tags.push(
      ['property', 'og:image', links.image.url],
      ['property', 'og:image:type', 'image/png'],
      ['property', 'og:image:width', String(links.image.width)],
      ['property', 'og:image:height', String(links.image.height)],
      ['property', 'og:image:alt', parts.title],
      ['name', 'twitter:card', 'summary_large_image'],
      ['name', 'twitter:image', links.image.url]
    )
  } else {
    tags.push(['name', 'twitter:card', 'summary'])
  }
  return tags.map(([key, name, value]) => `<meta ${key}="${name}" content="${escapeHtml(value)}" />`).join('\n    ')
}

/** The page's own layout. Plain CSS, so it does not depend on which utility classes the capture's CSS has. */
const PAGE_CSS = `
html, body { height: 100%; margin: 0; }
body { display: flex; flex-direction: column; background: var(--muted, #f4f4f5); color: var(--foreground, #18181b); }
.pl-share-header { display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 12px; padding: 10px 16px; border-bottom: 1px solid var(--border, #e4e4e7); background: var(--card, #fff); font: 14px/1.4 system-ui, sans-serif; }
.pl-share-header h1 { margin: 0; font-size: 15px; font-weight: 600; }
.pl-share-header .pl-share-meta { color: var(--muted-foreground, #71717a); font-size: 12px; }
.pl-share-header .pl-share-component { font-family: ui-monospace, monospace; font-size: 12px; padding: 1px 6px; border-radius: 4px; background: #4f46e5; color: #fff; }
.pl-share-main { flex: 1; display: flex; min-height: 0; }
.pl-share-stage { flex: 1; min-width: 0; overflow: auto; padding: 32px 24px; }
.pl-share-frame { margin: 0 auto; }
.pl-share-stage[data-kind="canvas"] { position: relative; padding: 0; overflow: hidden; cursor: grab; touch-action: none; }
.pl-share-stage[data-kind="canvas"].pl-share-panning { cursor: grabbing; }
.pl-share-canvas { position: absolute; top: 0; left: 0; transform-origin: 0 0; }
.pl-share-zoom { position: absolute; right: 12px; bottom: 12px; display: flex; gap: 4px; z-index: 50; }
.pl-share-zoom button { min-width: 32px; height: 32px; padding: 0 8px; border: 1px solid var(--border, #e4e4e7); border-radius: 6px; background: var(--card, #fff); color: inherit; font: 13px system-ui, sans-serif; cursor: pointer; }
.pl-share-aside { width: 384px; flex-shrink: 0; overflow: auto; border-left: 1px solid var(--border, #e4e4e7); background: var(--card, #fff); padding: 16px; box-sizing: border-box; }
.pl-share-aside details + details { margin-top: 20px; border-top: 1px solid var(--border, #e4e4e7); padding-top: 16px; }
.pl-share-aside summary { cursor: pointer; font: 600 12px/1.4 system-ui, sans-serif; text-transform: uppercase; letter-spacing: .04em; color: var(--muted-foreground, #71717a); margin-bottom: 12px; }
.pl-share-source { font-size: 12px; font-weight: 500; color: #4f46e5; text-decoration: none; }
.pl-share-source:hover { text-decoration: underline; }
.pl-share-toggle { position: absolute; width: 1px; height: 1px; margin: -1px; padding: 0; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }
.pl-share-toggles { display: flex; gap: 6px; margin-left: auto; }
.pl-share-toggles label { display: inline-flex; align-items: center; gap: 6px; height: 28px; padding: 0 10px; border: 1px solid var(--border, #e4e4e7); border-radius: 6px; background: var(--card, #fff); color: var(--muted-foreground, #71717a); font: 500 12px system-ui, sans-serif; cursor: pointer; user-select: none; }
.pl-share-toggles label::before { content: ""; width: 8px; height: 8px; border-radius: 50%; border: 1.5px solid currentColor; box-sizing: border-box; }
#pl-show-comments:checked ~ .pl-share-header label[for="pl-show-comments"],
#pl-show-sidebar:checked ~ .pl-share-header label[for="pl-show-sidebar"] { color: var(--foreground, #18181b); background: var(--muted, #f4f4f5); }
#pl-show-comments:checked ~ .pl-share-header label[for="pl-show-comments"]::before,
#pl-show-sidebar:checked ~ .pl-share-header label[for="pl-show-sidebar"]::before { background: #4f46e5; border-color: #4f46e5; }
#pl-show-comments:focus-visible ~ .pl-share-header label[for="pl-show-comments"],
#pl-show-sidebar:focus-visible ~ .pl-share-header label[for="pl-show-sidebar"] { outline: 2px solid #4f46e5; outline-offset: 2px; }
#pl-show-comments:not(:checked) ~ .pl-share-main [${SHARE_PINS_ATTRIBUTE}],
#pl-show-comments:not(:checked) ~ .pl-share-main .pl-share-comments { display: none; }
#pl-show-sidebar:not(:checked) ~ .pl-share-main .pl-share-aside { display: none; }
@media (max-width: 800px) {
  .pl-share-main { flex-direction: column; overflow: auto; }
  .pl-share-stage { flex: none; padding: 16px; }
  .pl-share-stage[data-kind="canvas"] { height: 70vh; }
  .pl-share-aside { width: auto; border-left: 0; border-top: 1px solid var(--border, #e4e4e7); overflow: visible; }
}
`

/** Pan and zoom for a shared canvas: drag or scroll to pan, Ctrl or Cmd and scroll to zoom. */
const CANVAS_SCRIPT = `
(function () {
  var stage = document.querySelector('.pl-share-stage[data-kind="canvas"]');
  if (!stage) return;
  var content = stage.querySelector('.pl-share-canvas');
  var width = Number(content.getAttribute('data-width'));
  var height = Number(content.getAttribute('data-height'));
  var x = 0, y = 0, zoom = 1;
  function apply() {
    content.style.transform = 'translate(' + x + 'px, ' + y + 'px) scale(' + zoom + ')';
    content.style.setProperty('--canvas-zoom', String(zoom));
    content.style.setProperty('--canvas-label-scale', String(Math.min(6, Math.max(1, 1 / zoom))));
  }
  function fit() {
    var box = stage.getBoundingClientRect();
    zoom = Math.min(1, (box.width * 0.95) / width, (box.height * 0.95) / height);
    x = (box.width - width * zoom) / 2;
    y = (box.height - height * zoom) / 2;
    apply();
  }
  function zoomAt(factor, px, py) {
    var next = Math.min(4, Math.max(0.02, zoom * factor));
    x = px - ((px - x) * next) / zoom;
    y = py - ((py - y) * next) / zoom;
    zoom = next;
    apply();
  }
  function centre() { var box = stage.getBoundingClientRect(); return [box.width / 2, box.height / 2]; }
  stage.addEventListener('wheel', function (event) {
    event.preventDefault();
    var box = stage.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey) {
      zoomAt(Math.exp(-event.deltaY * 0.01), event.clientX - box.left, event.clientY - box.top);
    } else {
      x -= event.deltaX; y -= event.deltaY; apply();
    }
  }, { passive: false });
  var last = null;
  stage.addEventListener('pointerdown', function (event) {
    if (event.target.closest('.pl-share-zoom')) return;
    last = [event.clientX, event.clientY];
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('pl-share-panning');
  });
  stage.addEventListener('pointermove', function (event) {
    if (!last) return;
    x += event.clientX - last[0]; y += event.clientY - last[1];
    last = [event.clientX, event.clientY];
    apply();
  });
  function stop() { last = null; stage.classList.remove('pl-share-panning'); }
  stage.addEventListener('pointerup', stop);
  stage.addEventListener('pointercancel', stop);
  stage.querySelector('[data-zoom="in"]').addEventListener('click', function () { var c = centre(); zoomAt(1.25, c[0], c[1]); });
  stage.querySelector('[data-zoom="out"]').addEventListener('click', function () { var c = centre(); zoomAt(0.8, c[0], c[1]); });
  stage.querySelector('[data-zoom="fit"]').addEventListener('click', fit);
  fit();
})();
`

/** The link back to the live viewer, when there is an http(s) address to link to. */
function sourceLink(url: string | undefined): string {
  if (url === undefined || !/^https?:\/\//i.test(url)) {
    return ''
  }
  return `<a class="pl-share-source" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="Opens this view in Prototype Lab. It works only where its dev server is running.">Open in Prototype Lab ↗</a>`
}

function sharedOn(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10)
}

/** The whole page, ready to open from a file or a bucket. */
export function sharePageHtml(parts: SharePageParts, links: SharePageLinks = {}): string {
  const { width, height } = parts.stageSize
  const stage =
    parts.kind === 'canvas'
      ? `<section class="pl-share-stage" data-kind="canvas" aria-label="Canvas">
        <div class="pl-share-canvas" data-width="${width}" data-height="${height}" style="width:${width}px;height:${height}px">${parts.stage}</div>
        <div class="pl-share-zoom"><button type="button" data-zoom="out" aria-label="Zoom out">−</button><button type="button" data-zoom="fit">Fit</button><button type="button" data-zoom="in" aria-label="Zoom in">+</button></div>
      </section>`
      : `<section class="pl-share-stage" data-kind="screen" aria-label="Screen">
        <div class="pl-share-frame" style="width:${width}px">${parts.stage}</div>
      </section>`

  const day = sharedOn(parts.sharedAt)
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>${escapeHtml(parts.title)}</title>
    ${openGraphTags(parts, links)}
    <style>${safeStyle(parts.css)}</style>
    <style>${PAGE_CSS}</style>
  </head>
  <body>
    <input type="checkbox" class="pl-share-toggle" id="pl-show-comments" checked />
    <input type="checkbox" class="pl-share-toggle" id="pl-show-sidebar" checked />
    <header class="pl-share-header">
      <h1>${escapeHtml(parts.prototypeTitle)}</h1>
      <span>${escapeHtml(parts.subject)}</span>
      ${parts.component === undefined ? '' : `<span class="pl-share-component" title="Picked component">${escapeHtml(parts.component)}</span>`}
      <span class="pl-share-meta">Shared from Prototype Lab${day === '' ? '' : ` on ${day}`}. A static copy: nothing here can be edited.</span>
      ${sourceLink(parts.sourceUrl)}
      <span class="pl-share-toggles">
        <label for="pl-show-comments" title="Show or hide the comment pins and the comment list">Comments</label>
        <label for="pl-show-sidebar" title="Show or hide the documentation and comments panel">Sidebar</label>
      </span>
    </header>
    <div class="pl-share-main">
      ${stage}
      <aside class="pl-share-aside">
        <details open><summary>Documentation</summary>${parts.doc}</details>
        <details open class="pl-share-comments"><summary>Comments (${parts.commentCount})</summary>${parts.comments}</details>
      </aside>
    </div>
    ${parts.kind === 'canvas' ? `<script>${CANVAS_SCRIPT}</script>` : ''}
  </body>
</html>
`
}
