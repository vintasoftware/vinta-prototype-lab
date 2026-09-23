import { CheckCircle2 } from 'lucide-react'
import { anchor, ScreenLink, type ScreenMeta } from 'vinta-prototype-lab'
import { Card, CardContent } from '../../../../../ui'

export const screen: Partial<ScreenMeta> = { title: 'Refund sent', viewport: 'desktop' }

export default function RefundSentScreen() {
  return (
    <div className='flex h-full flex-col items-center gap-6 bg-muted p-8'>
      <Card className='w-full max-w-xl' {...anchor('refund-receipt')}>
        <CardContent className='flex flex-col items-center gap-2 py-10 text-center'>
          <CheckCircle2 className='size-10 text-success' />
          <h1 className='font-semibold text-xl'>Refund sent</h1>
          <p className='text-muted-foreground text-sm'>The card ending 4242 gets it back in 5 to 10 business days.</p>
        </CardContent>
      </Card>

      <ScreenLink to='choose-lines' className='w-fit text-link text-sm underline underline-offset-2'>
        Refund another line
      </ScreenLink>
    </div>
  )
}
