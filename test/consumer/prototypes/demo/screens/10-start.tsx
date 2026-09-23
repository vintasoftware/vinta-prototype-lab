import { anchor, useScreenNavigation } from 'vinta-prototype-lab'

export default function Start() {
  const { goToScreen } = useScreenNavigation()
  return (
    <div className='flex flex-col gap-4 p-6'>
      <h1 className='font-semibold text-2xl text-emerald-700'>Start</h1>
      <button
        type='button'
        className='rounded-md bg-primary px-4 py-2 text-primary-foreground'
        {...anchor('go')}
        onClick={() => goToScreen('done')}
      >
        Continue
      </button>
    </div>
  )
}
