// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  arrangedCanvas,
  parseCanvasFile,
  resetCanvas,
  savedPositions,
  serializeCanvasFile,
  withViewports,
} from './canvas-file'

const screens = new Set(['home', 'review'])

describe('parseCanvasFile', () => {
  it('reads the sections and viewports', () => {
    const { canvas, issues } = parseCanvasFile(
      { version: 1, sections: [{ screen: 'home', x: 0, y: 0 }], viewports: ['desktop', 'tablet'] },
      'canvas.json',
      screens
    )

    expect(issues).toEqual([])
    expect(canvas).toEqual({ version: 1, sections: [{ screen: 'home', x: 0, y: 0 }], viewports: ['desktop', 'tablet'] })
  })

  it('drops a section for a screen that no longer exists, and says so', () => {
    const { canvas, issues } = parseCanvasFile(
      {
        version: 1,
        sections: [
          { screen: 'gone', x: 10, y: 10 },
          { screen: 'review', x: 2400, y: 0 },
        ],
      },
      'canvas.json',
      screens
    )

    expect(canvas?.sections).toEqual([{ screen: 'review', x: 2400, y: 0 }])
    expect(issues).toEqual(['canvas.json: section "gone" is for a screen that does not exist, so it was dropped.'])
  })

  it('keeps the first place of a screen placed twice', () => {
    const { canvas, issues } = parseCanvasFile(
      {
        version: 1,
        sections: [
          { screen: 'home', x: 1, y: 1 },
          { screen: 'home', x: 2, y: 2 },
        ],
      },
      'canvas.json',
      screens
    )

    expect(canvas?.sections).toEqual([{ screen: 'home', x: 1, y: 1 }])
    expect(issues).toHaveLength(1)
  })

  it('reads a file it cannot use as a problem, and no arrangement', () => {
    const { canvas, issues } = parseCanvasFile({ version: 2, sections: 'all of them' }, 'canvas.json', screens)

    expect(canvas).toBeUndefined()
    expect(issues.length).toBeGreaterThan(0)
    expect(issues[0]).toContain('canvas.json:')
    expect(issues[0]).toContain('the canvas uses its own layout')
  })
})

describe('arranging', () => {
  const canvas = { version: 1 as const, sections: [{ screen: 'home', x: 0, y: 0 }], viewports: ['tablet' as const] }

  it('reads the positions by screen', () => {
    expect(savedPositions(canvas).get('home')).toEqual({ x: 0, y: 0 })
    expect(savedPositions(undefined).size).toBe(0)
  })

  it('writes every section in whole pixels and keeps the viewports', () => {
    expect(arrangedCanvas(canvas, [{ screen: 'review', x: 10.4, y: -3.6 }])).toEqual({
      version: 1,
      sections: [{ screen: 'review', x: 10, y: -4 }],
      viewports: ['tablet'],
    })
  })

  it('resets to no placed section, keeping the viewports', () => {
    expect(resetCanvas(canvas)).toEqual({ version: 1, sections: [], viewports: ['tablet'] })
  })

  it('changes the viewports, keeping the sections', () => {
    expect(withViewports(canvas, ['desktop', 'mobile'])).toEqual({
      version: 1,
      sections: canvas.sections,
      viewports: ['desktop', 'mobile'],
    })
  })

  it('serializes as two-space JSON with a final newline', () => {
    expect(serializeCanvasFile(resetCanvas(undefined))).toBe('{\n  "version": 1,\n  "sections": []\n}\n')
  })
})
