import { ChevronLeft } from 'lucide-react'
import { anchor, type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'
import { Button, Card, CardContent, Separator } from '../../../ui'

export const screen: Partial<ScreenMeta> = { title: 'Review', viewport: 'mobile' }

const FACTS = [
  { label: 'Provider', value: 'Dr. Amara Okafor' },
  { label: 'Time', value: 'Tue, Sep 23 · 9:30 AM' },
  { label: 'Place', value: 'Video visit' },
]

export default function ReviewScreen() {
  const { goToScreen, back } = useScreenNavigation()

  return (
    <div className='flex h-full flex-col bg-background'>
      <header className='flex items-center gap-2 border-border border-b p-4'>
        <Button variant='ghost' size='icon-sm' aria-label='Back' onClick={back}>
          <ChevronLeft />
        </Button>
        <h1 className='font-semibold text-base'>Review</h1>
      </header>

      <div className='flex flex-1 flex-col gap-4 p-4'>
        <Card {...anchor('review-summary')}>
          <CardContent className='flex flex-col gap-3 pt-6'>
            {FACTS.map((fact, index) => (
              <div key={fact.label} className='flex flex-col gap-3'>
                <div className='flex justify-between gap-4'>
                  <span className='text-muted-foreground text-sm'>{fact.label}</span>
                  <span className='text-right font-medium text-sm'>{fact.value}</span>
                </div>
                {index < FACTS.length - 1 && <Separator />}
              </div>
            ))}
          </CardContent>
        </Card>

        <p className='text-muted-foreground text-sm'>
          To change the time, go back. Booking replaces any follow-up you already hold.
        </p>

        <div className='mt-auto flex flex-col gap-2'>
          <Button width='full' onClick={() => goToScreen('confirmed')} {...anchor('confirm-booking')}>
            Confirm booking
          </Button>
          <Button variant='ghost' width='full' onClick={back}>
            Pick another time
          </Button>
        </div>
      </div>
    </div>
  )
}
