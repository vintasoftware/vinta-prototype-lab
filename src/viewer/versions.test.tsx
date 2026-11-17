import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildPrototypes } from '../lib/discovery'
import type { ScreenModule } from '../types'
import { PrototypeLabApp } from './prototype-lab-app'

// The example prototypes, read the way the dev server reads them. The invoice list declares V1 and
// V2; patient booking declares none.
const prototypes = buildPrototypes({
  docs: import.meta.glob<string>('../../example/prototypes/**/prototype.md', {
    query: '?raw',
    import: 'default',
    eager: true,
  }),
  annotations: import.meta.glob('../../example/prototypes/**/annotations.json', { import: 'default', eager: true }),
  screens: import.meta.glob<ScreenModule>('../../example/prototypes/**/screens/*.tsx', { eager: true }),
})

const screenList = () => screen.getByRole('navigation', { name: 'Screens' })

async function pickVersion(label: string) {
  await userEvent.click(screen.getByRole('combobox', { name: 'Version' }))
  await userEvent.click(within(screen.getByRole('listbox', { name: 'Versions' })).getByRole('option', { name: label }))
}

describe('versions in the viewer', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.reject(new Error('Storybook is not running')))
    )
  })

  it('shows no version picker and no chips for a prototype without versions', () => {
    window.location.hash = '#/p/patient-booking/home'
    render(<PrototypeLabApp prototypes={prototypes} />)

    expect(screen.queryByRole('combobox', { name: 'Version' })).not.toBeInTheDocument()
    expect(window.location.hash).toBe('#/p/patient-booking/home')
  })

  it('lists the versions in order, then All, with All picked', async () => {
    window.location.hash = '#/p/billing/invoice-list/invoices'
    render(<PrototypeLabApp prototypes={prototypes} />)

    const picker = screen.getByRole('combobox', { name: 'Version' })
    expect(picker).toHaveTextContent('All')
    await userEvent.click(picker)

    expect(
      within(screen.getByRole('listbox', { name: 'Versions' }))
        .getAllByRole('option')
        .map(option => option.textContent)
    ).toEqual(['V1: Find an invoice', 'V2: Take payments', 'All'])
  })

  it('opens the list from the keyboard and picks with the arrows', async () => {
    window.location.hash = '#/p/billing/invoice-list/invoices'
    render(<PrototypeLabApp prototypes={prototypes} />)

    screen.getByRole('combobox', { name: 'Version' }).focus()
    await userEvent.keyboard('{Enter}')
    // The list opens on All, the last option; Home goes to V1.
    await userEvent.keyboard('{Home}{Enter}')

    expect(window.location.hash).toBe('#/p/billing/invoice-list/invoices?v=v1')
  })

  it('shows chips in All on the states that are not in every version', async () => {
    window.location.hash = '#/p/billing/invoice-list/invoice'
    render(<PrototypeLabApp prototypes={prototypes} />)

    const states = within(screenList())
    expect(states.getByRole('button', { name: 'Paid V2' })).toBeInTheDocument()
    expect(states.getByRole('button', { name: 'Default' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Record a payment' })).toBeInTheDocument()
  })

  it('shows only V1 states and parts with V1 picked, and keeps V1 as the screens change', async () => {
    window.location.hash = '#/p/billing/invoice-list/invoice'
    render(<PrototypeLabApp prototypes={prototypes} />)

    await pickVersion('V1: Find an invoice')

    expect(window.location.hash).toBe('#/p/billing/invoice-list/invoice?v=v1')
    expect(within(screenList()).queryByRole('button', { name: /Paid/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Record a payment' })).not.toBeInTheDocument()

    await userEvent.click(within(screenList()).getByRole('button', { name: /^Invoices/ }))
    expect(window.location.hash).toBe('#/p/billing/invoice-list/invoices?v=v1')
  })

  it('keeps a link to a later state from opening and says which version has it', async () => {
    window.location.hash = '#/p/billing/invoice-list/invoices?v=v1'
    render(<PrototypeLabApp prototypes={prototypes} />)

    await userEvent.click(screen.getByRole('button', { name: /Lee Moreau/ }))

    expect(screen.getByRole('status')).toHaveTextContent('This screen arrives in V2. Switch to V2 or All to open it.')
    expect(window.location.hash).toBe('#/p/billing/invoice-list/invoices?v=v1')
  })

  it('opens a deep link to a later state on a placeholder that switches versions', async () => {
    window.location.hash = '#/p/billing/invoice-list/invoice/paid?v=v1'
    render(<PrototypeLabApp prototypes={prototypes} />)

    expect(screen.getByText('Invoice · Paid arrives in V2')).toBeInTheDocument()
    expect(screen.queryByText('Card payment, Sep 30')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Switch to V2' }))

    expect(screen.getByText('Card payment, Sep 30')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/p/billing/invoice-list/invoice/paid?v=v2')
  })

  it('shows only the notes of the picked version, with chips in All', async () => {
    window.location.hash = '#/p/billing/invoice-list/invoice?v=v1'
    render(<PrototypeLabApp prototypes={prototypes} />)
    await userEvent.click(screen.getByRole('button', { name: 'Show the doc panel' }))
    await userEvent.click(screen.getByRole('tab', { name: /Comments/ }))

    expect(screen.queryByText('A recorded payment sends the patient a receipt')).not.toBeInTheDocument()

    await pickVersion('All')
    const note = (await screen.findByText('A recorded payment sends the patient a receipt')).closest('li')
    expect(note).not.toBeNull()
    expect(within(note as HTMLElement).getByText('V2')).toBeInTheDocument()
  })

  it('reports no problems for the versioned example', () => {
    const invoiceList = prototypes.find(prototype => prototype.slug === 'billing/invoice-list')

    expect(invoiceList?.issues).toEqual([])
  })
})
