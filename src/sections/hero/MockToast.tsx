import { CircleCheck } from 'lucide-react'
import { cn } from '#/lib/utils'
import { TOAST_TEXT } from './mock-data'

export function MockToast({ visible }: { visible: boolean }): JSX.Element {
  return (
    <div
      aria-hidden
      style={{ backgroundColor: 'var(--m-popover)', borderColor: 'var(--m-border)', color: 'var(--m-fg)' }}
      className={cn(
        'absolute bottom-4 right-4 z-40 flex max-w-[320px] items-center gap-2 rounded-lg border px-3 py-2 text-[13px] shadow-lg transition-all duration-300',
        visible ? 'opacity-100 translate-y-0' : 'pointer-events-none opacity-0 translate-y-2',
      )}
    >
      <CircleCheck size={16} className="shrink-0" style={{ color: '#22a06b' }} />
      <span>{TOAST_TEXT}</span>
    </div>
  )
}
