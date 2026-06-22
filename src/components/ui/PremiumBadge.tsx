import { IconSparkles } from '@tabler/icons-react'
import { cn } from '@/lib/utils'

export function PremiumBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-400 to-yellow-500 px-2.5 py-1 text-xs font-bold text-black',
        className,
      )}
    >
      <IconSparkles size={12} /> Premium · Ad-Free
    </span>
  )
}
