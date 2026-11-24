import { describe, expect, it } from 'vitest'
import { openGraphTags, SHARE_PINS_ATTRIBUTE, type SharePageParts, sharePageHtml } from './share-page'

const parts: SharePageParts = {
  kind: 'screen',
  title: 'Booking · Review · Button #confirm',
  description: 'Four screens. The screen, the documentation and 2 comments.',
  prototypeTitle: 'Booking',
  subject: 'Review',
  component: 'Button #confirm',
  stage: '<div id="screen">Hello</div>',
  stageSize: { width: 390, height: 844 },
  doc: '<h2>Booking</h2>',
  comments: '<article>Note</article>',
  commentCount: 2,
  css: '.a { color: red }',
  sharedAt: '2026-11-24T10:00:00.000Z',
}

describe('sharePageHtml', () => {
  it('holds the screen, the doc and the comments', () => {
    const html = sharePageHtml(parts)
    expect(html).toContain('<div id="screen">Hello</div>')
    expect(html).toContain('<h2>Booking</h2>')
    expect(html).toContain('Comments (2)')
    expect(html).toContain('Button #confirm')
    expect(html).toContain('on 2026-11-24')
    expect(html).toContain('<meta name="robots" content="noindex, nofollow" />')
  })

  it('carries no script for a screen, and pan and zoom for a canvas', () => {
    expect(sharePageHtml(parts)).not.toContain('<script')
    const canvas = sharePageHtml({ ...parts, kind: 'canvas', stageSize: { width: 4000, height: 2000 } })
    expect(canvas).toContain('<script>')
    expect(canvas).toContain('data-width="4000" data-height="2000"')
  })

  it('toggles the comments and the sidebar without a script', () => {
    const html = sharePageHtml(parts)
    expect(html).toContain('<input type="checkbox" class="pl-share-toggle" id="pl-show-comments" checked />')
    expect(html).toContain('<input type="checkbox" class="pl-share-toggle" id="pl-show-sidebar" checked />')
    expect(html).toContain('<label for="pl-show-comments"')
    expect(html).toContain('<label for="pl-show-sidebar"')
    expect(html).toContain(`#pl-show-comments:not(:checked) ~ .pl-share-main [${SHARE_PINS_ATTRIBUTE}]`)
    expect(html).toContain('#pl-show-sidebar:not(:checked) ~ .pl-share-main .pl-share-aside { display: none; }')
    expect(html).not.toContain('<script')
  })

  it('links back to the live view, but only to an http address', () => {
    const live = sharePageHtml({ ...parts, sourceUrl: 'http://localhost:6007/#/p/booking/review?x=1&y=2' })
    expect(live).toContain('href="http://localhost:6007/#/p/booking/review?x=1&#38;y=2"')
    expect(live).toContain('Open in Prototype Lab')
    expect(sharePageHtml(parts)).not.toContain('pl-share-source"')
    expect(sharePageHtml({ ...parts, sourceUrl: 'javascript:alert(1)' })).not.toContain('javascript:')
  })

  it('keeps a stylesheet from closing its own tag', () => {
    const html = sharePageHtml({ ...parts, css: 'a::after { content: "</style><script>x()</script>" }' })
    expect(html).not.toContain('</style><script>')
  })

  it('escapes the title wherever it goes', () => {
    const html = sharePageHtml({ ...parts, title: '<b>"x"</b>', prototypeTitle: '<i>' })
    expect(html).toContain('<title>&#60;b&#62;&#34;x&#34;&#60;/b&#62;</title>')
    expect(html).not.toContain('<i>')
  })
})

describe('openGraphTags', () => {
  it('names the page, the image and its size, for a large card', () => {
    const tags = openGraphTags(parts, {
      url: 'https://cdn.example.com/a/index.html',
      image: { url: 'https://cdn.example.com/a/preview.png', width: 1200, height: 630 },
    })
    expect(tags).toContain('<meta property="og:title" content="Booking · Review · Button #confirm" />')
    expect(tags).toContain('<meta property="og:url" content="https://cdn.example.com/a/index.html" />')
    expect(tags).toContain('<meta property="og:image" content="https://cdn.example.com/a/preview.png" />')
    expect(tags).toContain('<meta property="og:image:width" content="1200" />')
    expect(tags).toContain('<meta name="twitter:card" content="summary_large_image" />')
  })

  it('falls back to a small card without an image, and clips a long description', () => {
    const tags = openGraphTags({ ...parts, description: 'word '.repeat(200) }, {})
    expect(tags).toContain('<meta name="twitter:card" content="summary" />')
    expect(tags).not.toContain('og:image')
    const description = /property="og:description" content="([^"]*)"/.exec(tags)?.[1] ?? ''
    expect(description.length).toBeLessThanOrEqual(300)
    expect(description.endsWith('…')).toBe(true)
  })
})
