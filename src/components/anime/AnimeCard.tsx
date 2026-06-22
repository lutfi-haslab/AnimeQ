import { Link } from 'react-router'
import { IconStarFilled, IconPlayerPlayFilled } from '@tabler/icons-react'
import type { Anime } from '@/types'
import { bestTitle, cn, formatScore } from '@/lib/utils'
import { useLibrary } from '@/lib/store'

export function AnimeCard({ anime, index }: { anime: Anime; index?: number }) {
  const inLibrary = useLibrary((s) => s.has(anime.mal_id))
  const image =
    anime.images?.webp?.large_image_url ||
    anime.images?.jpg?.large_image_url ||
    anime.images?.webp?.image_url ||
    ''
  const title = bestTitle(anime) || 'Untitled'
  const href = `/anime/${anime.mal_id}`
  const genres = Array.isArray(anime.genres) ? anime.genres.slice(0, 2) : []

  return (
    <Link
      to={href}
      className="group relative flex animate-fade-in flex-col overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm transition-all hover:-translate-y-1 hover:shadow-xl dark:border-surface-border dark:bg-surface-card"
      style={index !== undefined ? { animationDelay: `${Math.min(index * 25, 400)}ms` } : undefined}
    >
      <div className="relative aspect-[2/3] overflow-hidden">
        <img
          src={image}
          alt={title}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-black/0" />

        {/* Top badges */}
        <div className="absolute left-2 top-2 flex gap-1">
          {anime.airing && (
            <span className="rounded-md bg-red-500/90 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white shadow">
              Airing
            </span>
          )}
          {anime.type && (
            <span className="rounded-md bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white backdrop-blur">
              {anime.type}
            </span>
          )}
        </div>

        {/* Score */}
        {anime.score ? (
          <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md bg-amber-400/95 px-1.5 py-0.5 text-[11px] font-bold text-black shadow">
            <IconStarFilled size={11} />
            {formatScore(anime.score)}
          </div>
        ) : null}

        {/* Hover play */}
        <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-600/90 text-white shadow-lg backdrop-blur">
            <IconPlayerPlayFilled size={20} />
          </div>
        </div>

        {/* Bottom episode/quality info */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-between p-2">
          <span className="line-clamp-2 text-xs font-semibold text-white drop-shadow">
            {anime.episodes ? `${anime.episodes} eps` : anime.year || ''}
          </span>
          <span className="rounded bg-white/15 px-1 py-0.5 text-[10px] font-bold text-white backdrop-blur">
            HD
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-2.5">
        <h3 className="line-clamp-2 text-sm font-semibold leading-tight">{title}</h3>
        <div className="mt-auto flex flex-wrap gap-1 pt-1">
          {genres.map((g) => (
            <span
              key={g.mal_id}
              className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-surface dark:text-slate-400"
            >
              {g.name}
            </span>
          ))}
        </div>
      </div>

      {inLibrary && (
        <span className="absolute right-2 bottom-12 h-2.5 w-2.5 rounded-full bg-brand-500 ring-2 ring-white/80 dark:ring-surface-card" />
      )}
    </Link>
  )
}

export function dedupeById(items: Anime[]): Anime[] {
  const seen = new Set<number>()
  return items.filter((a) => {
    if (seen.has(a.mal_id)) return false
    seen.add(a.mal_id)
    return true
  })
}

export function AnimeGrid({ items, className }: { items: Anime[]; className?: string }) {
  const unique = dedupeById(items)
  return (
    <div
      className={cn(
        'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6',
        className,
      )}
    >
      {unique.map((a, i) => (
        <AnimeCard key={a.mal_id} anime={a} index={i} />
      ))}
    </div>
  )
}

export function AnimeRow({ items }: { items: Anime[] }) {
  const unique = dedupeById(items)
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
      {unique.map((a, i) => (
        <div key={a.mal_id} className="w-[150px] shrink-0 snap-start sm:w-[170px]">
          <AnimeCard anime={a} index={i} />
        </div>
      ))}
    </div>
  )
}
