import { ChevronLeft, ChevronRight } from 'lucide-react'
import { anchor, Hotspot, type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'
import { Badge, Button, cn } from '../../../ui'

export const screen: Partial<ScreenMeta> = { title: 'Choose time', viewport: 'mobile' }

const DAYS = [
  { label: 'Mon', date: '22', slots: 0 },
  { label: 'Tue', date: '23', slots: 6 },
  { label: 'Wed', date: '24', slots: 3 },
  { label: 'Thu', date: '25', slots: 0 },
  { label: 'Fri', date: '26', slots: 4 },
]

const SLOTS = ['9:00 AM', '9:30 AM', '10:15 AM', '11:00 AM', '1:30 PM', '2:45 PM']

export default function ChooseTimeScreen() {
  const { goToScreen, back } = useScreenNavigation()

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

        <div className='flex items-stretch gap-2' {...anchor('day-strip')}>
          {DAYS.map(day => (
            <button
              key={day.date}
              type='button'
              disabled={day.slots === 0}
              className={cn(
                'flex min-w-14 flex-col items-center rounded-md border px-2 py-2 text-sm',
                day.date === '23' ? 'border-primary bg-primary-subtle text-primary' : 'border-border',
                day.slots === 0 && 'opacity-40'
              )}
            >
              <span className='text-xs'>{day.label}</span>
              <span className='font-semibold'>{day.date}</span>
            </button>
          ))}

          {/* The week stepper is a placeholder for the real calendar's control, so it is a glyph
              rather than a button. The hotspot fills this box, so it stays on the arrow at every
              viewport. */}
          <div className='relative flex w-8 shrink-0 items-center justify-center text-muted-foreground'>
            <ChevronRight className='size-4' />
            <Hotspot to='choose-time' variant='no-slots' label='Next week' />
          </div>
        </div>

        <div className='grid grid-cols-3 gap-2' {...anchor('slot-grid')}>
          {SLOTS.map(slot => (
            <Button key={slot} variant='outline' className='h-11' onClick={() => goToScreen('review')}>
              {slot}
            </Button>
          ))}
        </div>

        <Badge variant='neutral' className='w-fit'>
          Times shown in America/Sao_Paulo
        </Badge>
      </div>
    </div>
  )
}
