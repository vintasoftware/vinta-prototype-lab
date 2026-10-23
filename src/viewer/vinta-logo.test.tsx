import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { VintaLogo } from './vinta-logo'

describe('VintaLogo', () => {
  it('is an image named Vinta, drawn in the text colour', () => {
    render(<VintaLogo />)

    expect(screen.getByRole('img', { name: 'Vinta' })).toHaveAttribute('fill', 'currentColor')
  })
})
