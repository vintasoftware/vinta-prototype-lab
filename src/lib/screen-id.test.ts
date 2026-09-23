// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { buildScreenMeta, parseScreenFileName, titleize } from './screen-id'

describe('parseScreenFileName', () => {
  it('reads a plain screen file', () => {
    expect(parseScreenFileName('home.tsx')).toEqual({
      id: 'home',
      variant: 'default',
      order: Number.POSITIVE_INFINITY,
    })
  })

  it('reads the second segment as a variant of the same screen', () => {
    expect(parseScreenFileName('choose-time.no-slots.tsx')).toEqual({
      id: 'choose-time',
      variant: 'no-slots',
      order: Number.POSITIVE_INFINITY,
    })
  })

  it('takes a numeric prefix as the sort position and drops it from the id', () => {
    expect(parseScreenFileName('20-choose-time.tsx')).toEqual({ id: 'choose-time', variant: 'default', order: 20 })
  })
})

describe('buildScreenMeta', () => {
  it('fills every field from the filename when the file exports nothing', () => {
    expect(buildScreenMeta('30-review-details.tsx', undefined)).toEqual({
      id: 'review-details',
      title: 'Review Details',
      variant: 'default',
      variantLabel: 'Default',
      viewport: 'desktop',
      order: 30,
    })
  })

  it('lets the file override any of it', () => {
    expect(
      buildScreenMeta('10-home.empty.tsx', { title: 'Dashboard', viewport: 'mobile', variantLabel: 'No data' })
    ).toEqual({
      id: 'home',
      title: 'Dashboard',
      variant: 'empty',
      variantLabel: 'No data',
      viewport: 'mobile',
      order: 10,
    })
  })
})

describe('titleize', () => {
  it('turns a slug into words', () => {
    expect(titleize('choose-time')).toBe('Choose Time')
  })
})
