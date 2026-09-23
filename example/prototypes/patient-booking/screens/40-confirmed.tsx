import { CalendarPlus, CheckCircle2 } from 'lucide-react'
import { anchor, ScreenLink, type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'
import { Badge, Button, Card, CardContent } from '../../../ui'

export const screen: Partial<ScreenMeta> = { title: 'Confirmed', viewport: 'mobile' }

const FACTS = [
  { label: 'Provider', value: 'Dr. Amara Okafor' },
  { label: 'Time', value: 'Tue, Sep 23 · 9:30 AM' },
  { label: 'Place', value: 'Video visit' },
]

export default function ConfirmedScreen() {
  const { goToScreen } = useScreenNavigation()

  return (
    <div className='flex h-full flex-col gap-4 bg-muted p-4'>
      <div className='flex flex-col items-center gap-2 pt-6 text-center'>
        <CheckCircle2 className='size-10 text-success' />
        <h1 className='font-semibold text-xl'>You're booked</h1>
        <p className='text-muted-foreground text-sm'>We sent the details to dana@example.com.</p>
      </div>

      <Card {...anchor('appointment-card')}>
        <CardContent className='flex flex-col gap-3 pt-6'>
          {FACTS.map(fact => (
            <div key={fact.label} className='flex justify-between gap-4'>
              <span className='text-muted-foreground text-sm'>{fact.label}</span>
              <span className='text-right font-medium text-sm'>{fact.value}</span>
            </div>
          ))}
          <Badge variant='success' className='w-fit'>
            Replaces your open follow-up
          </Badge>
        </CardContent>
      </Card>

      <Button variant='outline' width='full'>
        <CalendarPlus />
        Add to calendar
      </Button>

      <Button variant='ghost' width='full' onClick={() => goToScreen('choose-time')} {...anchor('reschedule-link')}>
        Reschedule
      </Button>

      {/* Plain text rather than a Button, so ScreenLink's own button is the only control here. */}
      <ScreenLink to='home' className='mx-auto text-link text-sm underline underline-offset-2'>
        Back to home
      </ScreenLink>
    </div>
  )
}
