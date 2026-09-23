import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { Prototype } from '../types'
import { groupPrototypes, PrototypePicker } from './prototype-picker'

function prototype(slug: string, title: string, summary?: string): Prototype {
  return {
    slug,
    group: slug.split('/').slice(0, -1),
    doc: { title, body: '', ...(summary === undefined ? {} : { summary }) },
    screens: [],
    annotations: [],
    issues: [],
  }
}

const PROTOTYPES = [
  prototype('billing/refunds/partial-refund', 'Partial refund'),
  prototype('patient-booking', 'Patient booking', 'Book a follow-up visit'),
  prototype('billing/invoice-list', 'Invoice list'),
  prototype('billing/checkout', 'Checkout'),
]

describe('groupPrototypes', () => {
  it('lists the top of prototypes/ first, then one heading per folder', () => {
    expect(
      groupPrototypes(PROTOTYPES).map(group => [group.heading, group.prototypes.map(member => member.doc.title)])
    ).toEqual([
      ['', ['Patient booking']],
      ['Billing', ['Checkout', 'Invoice list']],
      ['Billing / Refunds', ['Partial refund']],
    ])
  })
})

describe('PrototypePicker', () => {
  it('shows the open prototype and lists every group', async () => {
    render(<PrototypePicker prototypes={PROTOTYPES} slug='patient-booking' onOpenPrototype={() => {}} />)

    const trigger = screen.getByRole('combobox', { name: 'Prototype' })
    expect(trigger).toHaveTextContent('Patient booking')

    await userEvent.click(trigger)

    expect(screen.getByText('Billing / Refunds')).toBeInTheDocument()
    expect(screen.getAllByRole('option')).toHaveLength(4)
  })

  it('searches by the folder a prototype sits in, and opens the one picked', async () => {
    const onOpenPrototype = vi.fn()
    render(<PrototypePicker prototypes={PROTOTYPES} slug='patient-booking' onOpenPrototype={onOpenPrototype} />)

    await userEvent.click(screen.getByRole('combobox', { name: 'Prototype' }))
    await userEvent.type(screen.getByPlaceholderText('Search prototypes…'), 'refunds')

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Partial refund'])

    await userEvent.click(screen.getByRole('option', { name: 'Partial refund' }))

    expect(onOpenPrototype).toHaveBeenCalledWith('billing/refunds/partial-refund')
    expect(screen.queryByPlaceholderText('Search prototypes…')).not.toBeInTheDocument()
  })

  it('searches the summary', async () => {
    render(<PrototypePicker prototypes={PROTOTYPES} slug='patient-booking' onOpenPrototype={() => {}} />)

    await userEvent.click(screen.getByRole('combobox', { name: 'Prototype' }))
    await userEvent.type(screen.getByPlaceholderText('Search prototypes…'), 'follow-up')

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Patient booking'])
  })

  it('matches whole words rather than scattered letters', async () => {
    render(<PrototypePicker prototypes={PROTOTYPES} slug='patient-booking' onOpenPrototype={() => {}} />)

    await userEvent.click(screen.getByRole('combobox', { name: 'Prototype' }))
    await userEvent.type(screen.getByPlaceholderText('Search prototypes…'), 'bill check')

    expect(screen.getAllByRole('option').map(option => option.textContent)).toEqual(['Checkout'])
  })

  it('says so when nothing matches', async () => {
    render(<PrototypePicker prototypes={PROTOTYPES} slug='patient-booking' onOpenPrototype={() => {}} />)

    await userEvent.click(screen.getByRole('combobox', { name: 'Prototype' }))
    await userEvent.type(screen.getByPlaceholderText('Search prototypes…'), 'zzz')

    expect(screen.getByText('No prototype matches.')).toBeInTheDocument()
  })
})
