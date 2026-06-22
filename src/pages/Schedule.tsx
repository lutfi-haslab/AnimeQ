import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { IconCalendarTime, IconClock, IconRefresh } from '@tabler/icons-react'
import { animeschedule } from '@/lib/api/animeschedule'
import { WEEKDAYS, WEEKDAY_LABELS } from '@/lib/constants'
import { LoadingScreen } from '@/components/ui/Feedback'
import { cn } from '@/lib/utils'
import type { ScheduleAnime, Weekday } from '@/types'

export function SchedulePage() {
  const todayIdx = (new Date().getDay() + 6) % 7 // monday=0
  const [day, setDay] = useState<Weekday>(WEEKDAYS[todayIdx])
  const [schedule, setSchedule] = useState<ScheduleAnime[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    animeschedule
      .byDay(day, controller.signal)
      .then((data) => setSchedule(data))
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== 'AbortError') setError(e)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [day, nonce])

  const grouped = useMemo(() => {
    const map = new Map<string, ScheduleAnime[]>()
    for (const a of schedule) {
      const key = a.airingAt ? new Date(`1970-01-01T${a.airingAt}`).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'
      ;(map.get(key) || map.set(key, []).get(key)!)!.push(a)
    }
    return Array.from(map.entries()).sort(([a], [b]) => (a === '—' ? 1 : b === '—' ? -1 : a.localeCompare(b)))
  }, [schedule])

  return (
    <div className="container-app py-6 animate-fade-in">
      <div className="mb-5 flex items-center gap-3">
        <IconCalendarTime size={24} className="text-brand-500" />
        <div>
          <h1 className="text-xl font-bold">Airing Schedule</h1>
          <p className="text-xs text-slate-500">
            Currently airing anime by day — powered by MyAnimeList.
          </p>
        </div>
      </div>

      {/* Day tabs */}
      <div className="no-scrollbar mb-6 flex gap-2 overflow-x-auto">
        {WEEKDAYS.map((d, i) => (
          <button
            key={d}
            onClick={() => setDay(d)}
            className={cn(
              'shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors',
              d === day
                ? 'bg-brand-600 text-white'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-surface-card dark:text-slate-300',
              i === todayIdx && d !== day && 'ring-1 ring-brand-400',
            )}
          >
            {i === todayIdx ? 'Today' : WEEKDAY_LABELS[d].slice(0, 3)}
          </button>
        ))}
      </div>

      {loading ? (
        <LoadingScreen label="Loading schedule…" />
      ) : error ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center">
          <p className="text-sm text-slate-500">
            The schedule provider is temporarily unavailable.
          </p>
          <button className="btn-primary text-sm" onClick={() => setNonce((n) => n + 1)}>
            <IconRefresh size={16} /> Retry
          </button>
        </div>
      ) : schedule.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-500">
          No episodes airing on {WEEKDAY_LABELS[day]}.
        </p>
      ) : (
        <div className="space-y-2">
          {grouped.map(([time, items]) => (
            <div key={time}>
              <div className="sticky top-16 z-10 flex items-center gap-2 bg-surface-light/90 py-1 backdrop-blur dark:bg-surface/90">
                <IconClock size={14} className="text-brand-500" />
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">
                  {time} {time !== '—' && '(JST)'}
                </span>
              </div>
              <div className="divide-y divide-black/5 dark:divide-surface-border">
                {items.map((a) => (
                  <ScheduleRow key={`${a.id}-${a.episode}`} anime={a} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ScheduleRow({ anime }: { anime: ScheduleAnime }) {
  const img = anime.image_url
  const premiere = anime.statuses?.some((s) => s.premiering)
  const finale = anime.statuses?.some((s) => s.finale)
  return (
    <Link
      to={anime.malId ? `/anime/${anime.malId}` : '#'}
      className="flex items-center gap-3 py-2 transition-colors hover:bg-slate-50 dark:hover:bg-surface-card/60"
    >
      {img ? (
        <img
          src={img}
          alt={anime.title}
          className="h-14 w-10 shrink-0 rounded bg-slate-200 object-cover dark:bg-surface"
          loading="lazy"
        />
      ) : (
        <div className="h-14 w-10 shrink-0 rounded bg-slate-200 dark:bg-surface" />
      )}
      <div className="min-w-0 flex-1">
        <p className="line-clamp-1 text-sm font-semibold">{anime.title}</p>
        <p className="text-xs text-slate-500">
          {anime.episode ? `Episode ${anime.episode}` : 'Airing'}
          {anime.episodeName ? ` · ${anime.episodeName}` : ''}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        {premiere && (
          <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-bold text-emerald-500">
            PREMIERE
          </span>
        )}
        {finale && (
          <span className="rounded bg-red-500/15 px-1.5 py-0.5 text-[10px] font-bold text-red-500">
            FINALE
          </span>
        )}
      </div>
    </Link>
  )
}
