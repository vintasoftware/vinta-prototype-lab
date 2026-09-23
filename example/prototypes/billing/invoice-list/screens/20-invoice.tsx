import { ChevronLeft } from 'lucide-react'
import { anchor, type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Separator } from '../../../../ui'

export const screen: Partial<ScreenMeta> = { title: 'Invoice', viewport: 'desktop' }

const LINES = [
  { label: 'Follow-up visit', amount: '$180.00' },
  { label: 'Lab panel', amount: '$60.00' },
]

export default function InvoiceScreen() {
  const { back } = useScreenNavigation()

  return (
    <div className='flex h-full flex-col items-center gap-6 bg-muted p-8'>
      <header className='flex w-full max-w-xl items-center gap-2'>
        <Button variant='ghost' size='icon-sm' aria-label='Back' onClick={back}>
          <ChevronLeft />
        </Button>
        <h1 className='font-semibold text-2xl'>INV-1042</h1>
        <Badge variant='info'>Open</Badge>
      </header>

      <Card className='w-full max-w-xl'>
        <CardHeader>
          <CardTitle>Dana Reyes · Sep 18</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          {LINES.map(line => (
            <div key={line.label} className='flex justify-between text-sm'>
              <span>{line.label}</span>
              <span>{line.amount}</span>
            </div>
          ))}
          <Separator />
          <div className='flex justify-between text-muted-foreground text-sm'>
            <span>Paid at check-in</span>
            <span>−$0.00</span>
          </div>
          <div className='flex justify-between font-semibold' {...anchor('invoice-balance')}>
            <span>Balance</span>
            <span>$240.00</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
