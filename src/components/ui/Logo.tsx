import { IconDeviceTv } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

export function Logo({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="relative grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-white shadow-lg shadow-brand-500/20">
        <IconDeviceTv size={20} stroke={2.2} />
      </div>
      {!compact && (
        <span className="text-lg font-extrabold tracking-tight">
          Anime<span className="text-brand-500">Q</span>
        </span>
      )}
    </div>
  )
}
