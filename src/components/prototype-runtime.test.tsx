import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import type { PrototypeVersion } from '../types'
import { NO_NAVIGATION, PrototypeRuntime, Since, useVersion } from './prototype-runtime'

const VERSIONS: PrototypeVersion[] = [
  { id: 'v1', label: 'V1: Send claims', short: 'V1' },
  { id: 'v2', label: 'V2: Resolve denials', short: 'V2' },
]

function VersionLabel() {
  const version = useVersion()
  return <span>{`${version.label}${version.atLeast('v2') ? ' with denials' : ''}`}</span>
}

function Screen() {
  return (
    <>
      <VersionLabel />
      <Since version='v2'>
        <button type='button'>Appeal</button>
      </Since>
      <Since until='v1'>
        <button type='button'>Record a letter</button>
      </Since>
    </>
  )
}

function renderIn(selected: string | undefined) {
  render(
    <PrototypeRuntime value={{ ...NO_NAVIGATION, version: { versions: VERSIONS, selected } }}>
      <Screen />
    </PrototypeRuntime>
  )
}

describe('useVersion and Since', () => {
  it('show the parts of the picked version', () => {
    renderIn('v1')

    expect(screen.getByText('V1: Send claims')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record a letter' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Appeal' })).not.toBeInTheDocument()
  })

  it('show a later version without the parts it replaced', () => {
    renderIn('v2')

    expect(screen.getByText('V2: Resolve denials with denials')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Appeal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record a letter' })).not.toBeInTheDocument()
  })

  it('render All like the last version', () => {
    renderIn(undefined)

    expect(screen.getByText('All with denials')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Appeal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record a letter' })).not.toBeInTheDocument()
  })

  it('behave as All outside a runtime', () => {
    render(<Screen />)

    expect(screen.getByText('All with denials')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Appeal' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record a letter' })).not.toBeInTheDocument()
  })
})
