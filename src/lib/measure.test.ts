// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { boxModel, measureBetween } from './measure'

const box = (left: number, top: number, width: number, height: number) => ({ left, top, width, height })

describe('measureBetween', () => {
  it('measures the space on each side of an element inside the picked one', () => {
    const values = measureBetween(box(0, 0, 200, 100), box(20, 10, 100, 50)).map(m => [m.side, m.value])

    expect(values).toEqual([
      ['top', 10],
      ['right', 80],
      ['bottom', 40],
      ['left', 20],
    ])
  })

  it('measures the same way when the picked element is the inner one', () => {
    const values = measureBetween(box(20, 10, 100, 50), box(0, 0, 200, 100)).map(m => m.value)

    expect(values).toEqual([10, 80, 40, 20])
  })

  it('measures the gap to an element beside it, drawn where they face each other', () => {
    const [gap] = measureBetween(box(0, 0, 100, 40), box(124, 10, 50, 40))

    expect(gap).toMatchObject({ side: 'right', value: 24, x1: 100, x2: 124, y1: 25, y2: 25 })
  })

  it('measures both gaps to an element off to one corner', () => {
    const sides = measureBetween(box(100, 100, 50, 50), box(0, 0, 40, 30)).map(m => [m.side, m.value])

    expect(sides).toEqual([
      ['left', 60],
      ['top', 70],
    ])
  })
})

describe('boxModel', () => {
  it('reads padding and margin by side', () => {
    const values: Record<string, string> = { 'padding-top': '12px', 'margin-left': '8.5px' }
    const model = boxModel({ getPropertyValue: (property: string) => values[property] ?? '0px' })

    expect(model.padding.top).toBe(12)
    expect(model.margin.left).toBe(8.5)
    expect(model.padding.right).toBe(0)
  })
})
