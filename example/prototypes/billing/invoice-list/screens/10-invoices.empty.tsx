import { ReceiptText } from 'lucide-react'
import { anchor, type ScreenMeta } from 'vinta-prototype-lab'
import { Card, CardContent } from '../../../../ui'

export const screen: Partial<ScreenMeta> = { title: 'Invoices', variantLabel: 'Empty', viewport: 'desktop' }

export default function InvoicesEmptyScreen() {
  return (
    <div className='flex h-full flex-col gap-6 bg-muted p-8'>
      <h1 className='font-semibold text-2xl'>Invoices</h1>

      <Card {...anchor('empty-invoices')}>
        <CardContent className='flex flex-col items-center gap-2 py-12 text-center'>
          <ReceiptText className='size-8 text-muted-foreground' />
          <p className='font-medium'>No invoices yet</p>
          <p className='text-muted-foreground text-sm'>An invoice appears here once a visit is checked out.</p>
        </CardContent>
      </Card>
    </div>
  )
}
