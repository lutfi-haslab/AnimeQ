import { useState } from 'react'
import { IconX, IconFilter } from '@tabler/icons-react'
import { GENRES, SEASONS, SEASON_LABELS, ANIME_TYPES } from '@/lib/constants'
import type { Season } from '@/lib/constants'
import { cn } from '@/lib/utils'

export interface FilterValues {
  q?: string
  genres: number[]
  excludeGenres: number[]
  type: string
  season: Season | ''
  year: number | ''
  status: string
  minScore: number
  sortBy: string
  sortDir: 'asc' | 'desc'
}

export const DEFAULT_FILTERS: FilterValues = {
  genres: [],
  excludeGenres: [],
  type: '',
  season: '',
  year: '',
  status: '',
  minScore: 0,
  sortBy: 'score',
  sortDir: 'desc',
}

const CURRENT_YEAR = new Date().getFullYear()
const YEARS = Array.from({ length: 25 }, (_, i) => CURRENT_YEAR - i)
const SORT_OPTIONS = [
  { value: 'score', label: 'Score' },
  { value: 'popularity', label: 'Popularity' },
  { value: 'rank', label: 'Rank' },
  { value: 'title', label: 'Title' },
  { value: 'start_date', label: 'Release Date' },
  { value: 'members', label: 'Members' },
  { value: 'favorites', label: 'Favorites' },
]

export function FilterBar({
  values,
  onChange,
}: {
  values: FilterValues
  onChange: (patch: Partial<FilterValues>) => void
}) {
  const [open, setOpen] = useState(false)
  const activeCount =
    values.genres.length +
    values.excludeGenres.length +
    (values.type ? 1 : 0) +
    (values.season ? 1 : 0) +
    (values.year ? 1 : 0) +
    (values.status ? 1 : 0) +
    (values.minScore > 0 ? 1 : 0)

  function toggleGenre(id: number, exclude = false) {
    const key = exclude ? 'excludeGenres' : 'genres'
    const list = values[key]
    const next = list.includes(id) ? list.filter((g) => g !== id) : [...list, id]
    onChange({ [key]: next } as Partial<FilterValues>)
  }

  return (
    <div className="mb-6 space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {/* Type */}
        <select
          value={values.type}
          onChange={(e) => onChange({ type: e.target.value })}
          className="input w-auto py-1.5 text-sm"
        >
          <option value="">All Types</option>
          {ANIME_TYPES.map((t) => (
            <option key={t} value={t} className="capitalize">
              {t.toUpperCase()}
            </option>
          ))}
        </select>

        {/* Season */}
        <select
          value={values.season}
          onChange={(e) => onChange({ season: e.target.value as Season | '' })}
          className="input w-auto py-1.5 text-sm"
        >
          <option value="">All Seasons</option>
          {SEASONS.map((s) => (
            <option key={s} value={s}>
              {SEASON_LABELS[s]}
            </option>
          ))}
        </select>

        {/* Year */}
        <select
          value={values.year}
          onChange={(e) => onChange({ year: e.target.value ? Number(e.target.value) : '' })}
          className="input w-auto py-1.5 text-sm"
        >
          <option value="">Any Year</option>
          {YEARS.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        {/* Status */}
        <select
          value={values.status}
          onChange={(e) => onChange({ status: e.target.value })}
          className="input w-auto py-1.5 text-sm"
        >
          <option value="">Any Status</option>
          <option value="airing">Airing</option>
          <option value="complete">Complete</option>
          <option value="upcoming">Upcoming</option>
        </select>

        <div className="ml-auto flex items-center gap-2">
          <select
            value={values.sortBy}
            onChange={(e) => onChange({ sortBy: e.target.value })}
            className="input w-auto py-1.5 text-sm"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Sort: {o.label}
              </option>
            ))}
          </select>
          <button
            className="btn-secondary px-2 py-1.5"
            onClick={() => onChange({ sortDir: values.sortDir === 'desc' ? 'asc' : 'desc' })}
            title="Toggle direction"
          >
            {values.sortDir === 'desc' ? '↓' : '↑'}
          </button>
          <button
            className={cn('btn px-3 py-1.5', activeCount > 0 ? 'btn-primary' : 'btn-secondary')}
            onClick={() => setOpen((o) => !o)}
          >
            <IconFilter size={16} />
            Genres
            {activeCount > 0 && (
              <span className="ml-1 rounded-full bg-white/20 px-1.5 text-[10px]">
                {activeCount}
              </span>
            )}
          </button>
          {(activeCount > 0 || values.sortBy !== 'score') && (
            <button
              className="btn-ghost px-2 py-1.5"
              onClick={() => onChange({ ...DEFAULT_FILTERS, sortBy: values.sortBy })}
              title="Reset filters"
            >
              <IconX size={16} />
            </button>
          )}
        </div>
      </div>

      {open && (
        <div className="card animate-slide-up space-y-4 p-4">
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Genres (include)
            </p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.id)}
                  className={cn('chip', values.genres.includes(g.id) && 'chip-active')}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-2 text-xs font-bold uppercase tracking-wide text-slate-400">
              Genres (exclude)
            </p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map((g) => (
                <button
                  key={g.id}
                  onClick={() => toggleGenre(g.id, true)}
                  className={cn(
                    'chip border-red-300 text-red-600 dark:border-red-500/40 dark:text-red-400',
                    values.excludeGenres.includes(g.id) &&
                      'border-red-500 bg-red-500 text-white hover:border-red-500 hover:text-white',
                  )}
                >
                  {g.name}
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-400">
              Min Score
            </label>
            <input
              type="range"
              min={0}
              max={10}
              step={0.5}
              value={values.minScore}
              onChange={(e) => onChange({ minScore: Number(e.target.value) })}
              className="flex-1 accent-brand-500"
            />
            <span className="w-8 text-sm tabular-nums">{values.minScore}</span>
          </div>
        </div>
      )}
    </div>
  )
}
