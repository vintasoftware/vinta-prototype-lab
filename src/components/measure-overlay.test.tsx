import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MeasureOverlay } from './measure-overlay'

describe('MeasureOverlay', () => {
  it('draws a line and a number for each distance, halfway along it', () => {
    const { container } = render(
      <MeasureOverlay measurements={[{ side: 'right', value: 24, x1: 100, y1: 20, x2: 124, y2: 20 }]} />
    )

    expect(container.querySelectorAll('line')).toHaveLength(1)
    const label = container.querySelector('[data-measurement="right"]')
    expect(label).toHaveTextContent('24')
    expect(label).toHaveStyle({ left: '112px', top: '20px' })
  })

  it("tints an element's margin and padding as bands of the width the browser computed", () => {
    const { container } = render(
      <MeasureOverlay
        measurements={[]}
        spacing={{
          rect: { left: 10, top: 10, width: 100, height: 40 },
          model: {
            padding: { top: 4, right: 8, bottom: 4, left: 8 },
            margin: { top: 0, right: 0, bottom: 16, left: 0 },
          },
        }}
      />
    )

    expect(container.querySelector('[data-spacing="padding"]')).toHaveStyle({ borderWidth: '4px 8px 4px 8px' })
    expect(container.querySelector('[data-spacing="margin"]')).toHaveStyle({ height: '56px' })
  })
})
