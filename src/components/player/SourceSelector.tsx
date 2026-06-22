import { IconServer, IconCheck, IconLoader2 } from '@tabler/icons-react'
import type { SourceProvider, VideoSource } from '@/types'
import { cn } from '@/lib/utils'
import { PROVIDER_LABELS, PROVIDER_ORDER } from '@/lib/api/resolvers'

export type ProviderStatus = 'idle' | 'resolving' | 'ready' | 'error' | 'none'

function formatOf(url: string): string {
  if (/\.mpd(\?|$)/i.test(url)) return 'DASH'
  if (/\.m3u8(\?|$)/i.test(url)) return 'HLS'
  if (/\.mp4(\?|$)/i.test(url)) return 'MP4'
  return 'AUTO'
}

export function SourceSelector({
  selected,
  statuses,
  sources,
  active,
  onSelectProvider,
  onSelectSource,
}: {
  selected: SourceProvider
  statuses: Record<SourceProvider, ProviderStatus>
  sources: VideoSource[]
  active: VideoSource | null
  onSelectProvider: (p: SourceProvider) => void
  onSelectSource: (s: VideoSource) => void
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300">
          <IconServer size={18} />
          Provider
        </div>
        {active && (
          <span className="text-xs text-slate-400">
            Playing <span className="font-semibold text-slate-600 dark:text-slate-200">{active.label}</span> · {formatOf(active.url)}
          </span>
        )}
      </div>

      {/* Provider buttons — Animex first (recommended), others optional */}
      <div className="flex flex-wrap gap-2">
        {PROVIDER_ORDER.map((p, i) => {
          const isActive = p === selected
          const status = statuses[p]
          return (
            <button
              key={p}
              onClick={() => onSelectProvider(p)}
              className={cn(
                'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all',
                isActive
                  ? 'border-brand-500 bg-brand-600 text-white shadow'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-brand-400 hover:text-brand-600 dark:border-surface-border dark:bg-surface-card dark:text-slate-300',
              )}
            >
              {isActive && <IconCheck size={14} />}
              <span>{PROVIDER_LABELS[p]}</span>
              {i === 0 && (
                <span className={cn('rounded px-1 py-0.5 text-[9px] font-bold', isActive ? 'bg-white/20' : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400')}>
                  RECOMMENDED
                </span>
              )}
              {status === 'resolving' && <IconLoader2 size={12} className="animate-spin" />}
              {status === 'error' && <span className="text-[10px]">!</span>}
              {status === 'none' && <span className="text-[10px] opacity-50">—</span>}
            </button>
          )
        })}
      </div>

      {/* Quality options within the selected provider */}
      {sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pl-1">
          <span className="text-[10px] uppercase tracking-wide text-slate-400">
            {sources.length > 1 ? 'Servers / quality:' : 'Source:'}
          </span>
          {sources.map((s) => {
            const isActive = !!active && s.url === active.url
            // Multiple servers (e.g. mimi, lunafly) share "auto" quality, so
            // show the server name from the label for distinguishability.
            const shortLabel =
              sources.length > 1
                ? s.label.replace(/^Animex\s*/i, '')
                : `${s.quality} · ${formatOf(s.url)}`
            return (
              <button
                key={s.url}
                onClick={() => onSelectSource(s)}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                  isActive
                    ? 'bg-brand-600 text-white'
                    : 'bg-slate-100 text-slate-500 hover:text-brand-600 dark:bg-surface dark:text-slate-400',
                )}
              >
                {shortLabel}
              </button>
            )
          })}
        </div>
      )}

      <p className="text-[11px] leading-relaxed text-slate-400">
        Animex is the default (most reliable, HLS). AnimeOnsen (DASH) and
        KickAssAnime (HLS) are optional — click to switch, the selected provider
        is resolved on demand.
      </p>
    </div>
  )
}
