import { useState } from 'react'
import { anchor, type ScreenMeta, useScreenNavigation } from 'vinta-prototype-lab'
import { Button, Card, CardContent, CardHeader, CardTitle, Separator } from '../../../../../ui'

export const screen: Partial<ScreenMeta> = { title: 'Choose lines', viewport: 'desktop' }

const LINES = [
  { id: 'visit', label: 'Follow-up visit', cents: 18000 },
  { id: 'lab', label: 'Lab panel', cents: 6000 },
  { id: 'supplies', label: 'Supplies', cents: 1500 },
]

function dollars(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`
}

export default function ChooseLinesScreen() {
  const { goToScreen } = useScreenNavigation()
  const [ticked, setTicked] = useState<ReadonlySet<string>>(new Set())

  const toggle = (id: string) => {
    setTicked(current => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const total = LINES.filter(line => ticked.has(line.id)).reduce((sum, line) => sum + line.cents, 0)

  return (
    <div className='flex h-full flex-col items-center gap-6 bg-muted p-8'>
      <h1 className='w-full max-w-xl font-semibold text-2xl'>Refund INV-1031</h1>

      <Card className='w-full max-w-xl'>
        <CardHeader>
          <CardTitle>Which lines are you refunding?</CardTitle>
        </CardHeader>
        <CardContent className='flex flex-col gap-3'>
          <div className='flex flex-col gap-2' {...anchor('refund-lines')}>
            {LINES.map(line => (
              <label key={line.id} className='flex items-center gap-3 text-sm'>
                <input type='checkbox' checked={ticked.has(line.id)} onChange={() => toggle(line.id)} />
                <span className='flex-1'>{line.label}</span>
                <span>{dollars(line.cents)}</span>
              </label>
            ))}
          </div>
          <Separator />
          <div className='flex justify-between font-semibold' {...anchor('refund-total')}>
            <span>Refund</span>
            <span>{dollars(total)}</span>
          </div>
          <p className='text-muted-foreground text-sm'>Goes back to the card ending 4242.</p>
          <Button
            className='self-end'
            disabled={total === 0}
            onClick={() => goToScreen('refund-sent')}
            {...anchor('send-refund')}
          >
            Send refund
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
