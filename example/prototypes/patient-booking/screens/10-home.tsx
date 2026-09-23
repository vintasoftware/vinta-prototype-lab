import { CalendarDays, ClipboardList, Pill } from 'lucide-react'
import { anchor, type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from '../../../ui'

export const screen: Partial<ScreenMeta> = { title: 'Home', viewport: 'mobile' }

export default function HomeScreen() {
  const { goToScreen } = useScreenNavigation()

  return (
    <div className='flex h-full flex-col gap-4 bg-muted p-4'>
      <header className='flex items-center justify-between'>
        <div>
          <p className='text-muted-foreground text-sm'>Good morning</p>
          <h1 className='font-semibold text-xl'>Dana</h1>
        </div>
        <Badge variant='neutral' {...anchor('task-count')}>
          2 tasks
        </Badge>
      </header>

      <Card {...anchor('follow-up-card')}>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <CalendarDays className='size-4' />
            Follow-up visit
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <p className='text-muted-foreground text-sm'>
            Dr. Okafor asked to see you two weeks after your last visit. Booking is open through October.
          </p>
          <Button width='full' onClick={() => goToScreen('choose-time')} {...anchor('book-follow-up')}>
            Book a visit
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <Pill className='size-4' />
            Refill: Lisinopril
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <p className='text-muted-foreground text-sm'>Two refills left. Your pharmacy has the request.</p>
          <Button variant='ghost' width='full'>
            View medication
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className='flex items-center gap-2'>
            <ClipboardList className='size-4' />
            Intake questions
          </CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <p className='text-muted-foreground text-sm'>Four questions left from your last visit.</p>
          <Button variant='ghost' width='full'>
            Continue
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
