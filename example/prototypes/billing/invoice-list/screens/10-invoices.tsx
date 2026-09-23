import { anchor, ScreenLink, type ScreenMeta } from 'vinta-prototype-lab'
import { Badge, Card, CardContent, CardHeader, CardTitle } from '../../../../ui'

export const screen: Partial<ScreenMeta> = { title: 'Invoices', viewport: 'desktop' }

const INVOICES = [
  { number: 'INV-1042', patient: 'Dana Reyes', date: 'Sep 18', amount: '$240.00', status: 'Open' },
  { number: 'INV-1038', patient: 'Sam Ito', date: 'Sep 02', amount: '$85.00', status: 'Overdue' },
  { number: 'INV-1031', patient: 'Lee Moreau', date: 'Aug 21', amount: '$410.00', status: 'Paid' },
]

const BADGE = { Open: 'info', Overdue: 'warning', Paid: 'success' } as const

export default function InvoicesScreen() {
  return (
    <div className='flex h-full flex-col gap-6 bg-muted p-8'>
      <header className='flex items-end justify-between'>
        <h1 className='font-semibold text-2xl'>Invoices</h1>
        <div className='text-right' {...anchor('balance-owed')}>
          <p className='text-muted-foreground text-sm'>Still owed</p>
          <p className='font-semibold text-xl'>$325.00</p>
        </div>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>This month and last</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col' {...anchor('invoice-table')}>
          {INVOICES.map(invoice => (
            <ScreenLink
              key={invoice.number}
              to='invoice'
              className='grid grid-cols-[1fr_auto_auto] items-center gap-4 border-border border-t py-3 text-left text-sm hover:bg-muted'
            >
              <span className='flex flex-col'>
                <span className='font-medium'>{invoice.patient}</span>
                <span className='text-muted-foreground'>
                  {invoice.number} · {invoice.date}
                </span>
              </span>
              <span className='text-right'>{invoice.amount}</span>
              <Badge variant={BADGE[invoice.status as keyof typeof BADGE]}>{invoice.status}</Badge>
            </ScreenLink>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
