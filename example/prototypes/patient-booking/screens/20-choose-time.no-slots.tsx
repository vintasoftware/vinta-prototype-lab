import { ChevronLeft, Phone } from 'lucide-react'
import { anchor, type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'
import { Button, cn } from '../../../ui'

export const screen: Partial<ScreenMeta> = {
  title: 'Choose time',
  variantLabel: 'No availability',
  viewport: 'mobile',
}

const DAYS = [
  { label: 'Mon', date: '22' },
  { label: 'Tue', date: '23' },
  { label: 'Wed', date: '24' },
  { label: 'Thu', date: '25' },
  { label: 'Fri', date: '26' },
]

export default function ChooseTimeEmptyScreen() {
  const { back } = useScreenNavigation()

  return (
    <div className='flex h-full flex-col bg-background'>
      <header className='flex items-center gap-2 border-border border-b p-4'>
        <Button variant='ghost' size='icon-sm' aria-label='Back' onClick={back}>
          <ChevronLeft />
        </Button>
        <h1 className='font-semibold text-base'>Choose a time</h1>
      </header>

      <div className='flex flex-col gap-4 p-4'>
        <p className='text-muted-foreground text-sm'>Dr. Okafor · 20 minutes · Video visit</p>

        <div className='flex gap-2 overflow-x-auto' {...anchor('day-strip')}>
          {DAYS.map(day => (
            <button
              key={day.date}
              type='button'
              disabled
              className={cn(
                'flex min-w-16 flex-col items-center rounded-md border border-border px-3 py-2 text-sm opacity-40'
              )}
            >
              <span className='text-xs'>{day.label}</span>
              <span className='font-semibold'>{day.date}</span>
            </button>
          ))}
        </div>

        <div className='rounded-md border border-border p-4 text-center' {...anchor('no-slots-help')}>
          <p className='font-medium text-sm'>No openings this week</p>
          <p className='mt-1 text-muted-foreground text-sm'>
            Dr. Okafor's next opening is in three weeks. The clinic can fit you in sooner by phone.
          </p>
          <Button variant='outline' className='mt-3'>
            <Phone />
            Call the clinic
          </Button>
        </div>
      </div>
    </div>
  )
}
