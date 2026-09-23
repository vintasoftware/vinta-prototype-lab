// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { goBack, navigateTo, selectComponent, showVariant, startSession } from './session'

const home = { screenId: 'home', variant: 'default' }
const review = { screenId: 'review', variant: 'default' }

describe('navigateTo', () => {
  it('remembers where the click came from', () => {
    const state = navigateTo(startSession('booking', home), review)

    expect(state.current).toEqual(review)
    expect(state.history).toEqual([home])
  })

  it('ignores a link to the screen already open', () => {
    const start = startSession('booking', home)

    expect(navigateTo(start, home)).toBe(start)
  })
})

describe('goBack', () => {
  it('returns to the previous screen and forgets it', () => {
    const state = goBack(navigateTo(startSession('booking', home), review))

    expect(state.current).toEqual(home)
    expect(state.history).toEqual([])
  })

  it('stays put with nothing behind it', () => {
    const start = startSession('booking', home)

    expect(goBack(start)).toBe(start)
  })
})

describe('showVariant', () => {
  it('swaps the state of the open screen without touching history', () => {
    const state = showVariant(navigateTo(startSession('booking', home), review), 'empty')

    expect(state.current).toEqual({ screenId: 'review', variant: 'empty' })
    expect(state.history).toEqual([home])
  })
})

describe('selectComponent', () => {
  it('picks a component, and clears the pick', () => {
    const picked = selectComponent(startSession('booking', home), 'book-follow-up')

    expect(picked.component).toBe('book-follow-up')
    expect(selectComponent(picked, undefined).component).toBeUndefined()
  })

  it('ignores a pick that changes nothing', () => {
    const picked = selectComponent(startSession('booking', home), 'book-follow-up')

    expect(selectComponent(picked, 'book-follow-up')).toBe(picked)
  })

  it('opens a session on the component a link named', () => {
    expect(startSession('booking', home, 'book-follow-up').component).toBe('book-follow-up')
  })
})

describe('leaving a screen', () => {
  const picked = selectComponent(startSession('booking', home), 'book-follow-up')

  it('drops the pick when the flow moves on, since the next screen has its own components', () => {
    expect(navigateTo(picked, review).component).toBeUndefined()
  })

  it('drops the pick on the way back', () => {
    expect(goBack(navigateTo(picked, review)).component).toBeUndefined()
  })

  it('drops the pick when another state of the screen is shown', () => {
    expect(showVariant(picked, 'empty').component).toBeUndefined()
  })
})
