import { ScreenLink } from 'vinta-prototype-lab'

export default function Done() {
  return (
    <div className='p-6'>
      <p className='text-lg'>Done.</p>
      <ScreenLink to='start'>Back to start</ScreenLink>
    </div>
  )
}
