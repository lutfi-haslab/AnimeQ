import { useState } from 'react'
import { useParams, Link } from 'react-router'
import {
  IconPlayerPlayFilled,
  IconBrandYoutube,
  IconStarFilled,
  IconUsers,
  IconBookmark,
  IconBookmarkFilled,
  IconCalendar,
  IconClock,
  IconDownload,
  IconChevronRight,
} from '@tabler/icons-react'
import { jikan } from '@/lib/api/jikan'
import { useAsync } from '@/hooks/useAsync'
import { ErrorState } from '@/components/ui/Feedback'
import { DetailSkeleton } from '@/components/ui/Skeletons'
import { PremiumBadge } from '@/components/ui/PremiumBadge'
import { TrailerPlayer } from '@/components/player/TrailerPlayer'
import { AnimeGrid } from '@/components/anime/AnimeCard'
import { useLibrary } from '@/lib/store'
import { bestTitle, cn, formatMembers, formatScore } from '@/lib/utils'

export function AnimeDetailPage() {
  const { id } = useParams<{ id: string }>()
  const malId = Number(id)
  const { data, loading, error, refetch } = useAsync(
    (s) => jikan.byIdSafe(malId, s),
    [malId],
  )
  const { data: recs } = useAsync((s) => jikan.recommendations(malId, s), [malId])
  const [showTrailer, setShowTrailer] = useState(false)

  const library = useLibrary()
  const entry = library.get(malId)
  const inLibrary = !!entry

  if (loading) return <DetailSkeleton />
  if (error || !data)
    return (
      <ErrorState
        message="Could not load this title. The data provider may be busy — please retry."
        onRetry={refetch}
      />
    )

  const anime = data
  const title = bestTitle(anime)
  const image = anime.images.webp.large_image_url
  const youtubeId = anime.trailer?.youtube_id

  return (
    <div className="animate-fade-in">
      {/* Backdrop */}
      <div className="relative h-72 w-full overflow-hidden sm:h-80">
        <img src={image} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-xl" />
        <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/80 to-surface/30 dark:from-surface dark:via-surface/85" />
      </div>

      <div className="container-app -mt-40 relative">
        <div className="flex flex-col gap-6 sm:flex-row">
          {/* Poster */}
          <div className="mx-auto w-44 shrink-0 sm:mx-0 sm:w-56">
            <img
              src={image}
              alt={title}
              className="w-full rounded-xl border-4 border-white shadow-2xl dark:border-surface-card"
            />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Link
                to={`/watch/${anime.mal_id}/1`}
                className="btn-primary col-span-2 py-2.5 text-sm"
              >
                <IconPlayerPlayFilled size={16} /> Watch
              </Link>
              {youtubeId && (
                <button
                  onClick={() => setShowTrailer(true)}
                  className="btn-secondary py-2.5 text-sm"
                >
                  <IconBrandYoutube size={16} className="text-red-500" /> Trailer
                </button>
              )}
              <button
                onClick={() =>
                  library.toggle({ malId: anime.mal_id, title, image })
                }
                className={cn('py-2.5 text-sm', inLibrary ? 'btn-primary' : 'btn-secondary')}
              >
                {inLibrary ? <IconBookmarkFilled size={16} /> : <IconBookmark size={16} />}
                {inLibrary ? 'Saved' : 'Save'}
              </button>
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 pt-8 sm:pt-20">
            <h1 className="mb-2 text-2xl font-extrabold tracking-tight sm:text-4xl">
              {title}
            </h1>
            {anime.title_japanese && (
              <p className="mb-3 text-sm text-slate-500">{anime.title_japanese}</p>
            )}

            <div className="mb-4 flex flex-wrap items-center gap-2">
              {anime.score && (
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-400 px-2.5 py-1 text-sm font-bold text-black">
                  <IconStarFilled size={14} /> {formatScore(anime.score)}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-2.5 py-1 text-sm font-semibold text-slate-700 dark:bg-surface-card dark:text-slate-200">
                <IconUsers size={14} /> {formatMembers(anime.members)}
              </span>
              {anime.airing && (
                <span className="rounded-lg bg-red-500/90 px-2.5 py-1 text-sm font-bold text-white">
                  Airing
                </span>
              )}
              <PremiumBadge />
            </div>

            {/* Genres */}
            <div className="mb-5 flex flex-wrap gap-2">
              {anime.genres.map((g) => (
                <Link
                  key={g.mal_id}
                  to={`/browse?genres=${g.mal_id}`}
                  className="chip"
                >
                  {g.name}
                </Link>
              ))}
              {anime.themes.map((g) => (
                <span key={g.mal_id} className="chip opacity-70">{g.name}</span>
              ))}
            </div>

            {/* Meta grid */}
            <div className="mb-6 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <Meta label="Type" value={anime.type || '—'} />
              <Meta label="Episodes" value={anime.episodes ? String(anime.episodes) : '—'} />
              <Meta label="Status" value={anime.status || '—'} />
              <Meta
                label="Aired"
                value={
                  anime.aired?.from
                    ? new Date(anime.aired.from).getFullYear() + ''
                    : anime.year?.toString() || '—'
                }
                icon={<IconCalendar size={14} />}
              />
              <Meta label="Season" value={anime.season ? `${anime.season} ${anime.year || ''}` : '—'} />
              <Meta label="Duration" value={anime.duration || '—'} icon={<IconClock size={14} />} />
              <Meta label="Rating" value={anime.rating || '—'} />
              <Meta label="Studio" value={anime.studios.map((s) => s.name).join(', ') || '—'} />
            </div>

            {/* Synopsis */}
            {anime.synopsis && (
              <div className="mb-6">
                <h3 className="mb-2 font-bold">Synopsis</h3>
                <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {anime.synopsis}
                </p>
              </div>
            )}

            {anime.background && (
              <div className="mb-6 rounded-lg border border-amber-300/40 bg-amber-50 p-3 text-xs text-amber-800 dark:bg-amber-500/5 dark:text-amber-200">
                {anime.background}
              </div>
            )}

            {/* Episodes quick links */}
            {anime.episodes && anime.episodes > 0 && (
              <div className="mb-6">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="font-bold">Episodes</h3>
                  <Link to={`/watch/${anime.mal_id}/1`} className="text-sm text-brand-500 hover:underline">
                    Start watching <IconChevronRight size={14} className="inline" />
                  </Link>
                </div>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 md:grid-cols-12">
                  {Array.from({ length: Math.min(anime.episodes, 24) }).map((_, i) => (
                    <Link
                      key={i}
                      to={`/watch/${anime.mal_id}/${i + 1}`}
                      className="grid h-9 place-items-center rounded-lg border border-slate-200 text-sm font-semibold hover:border-brand-500 hover:bg-brand-50 hover:text-brand-600 dark:border-surface-border dark:hover:bg-brand-500/10"
                    >
                      {i + 1}
                    </Link>
                  ))}
                </div>
                {anime.episodes > 24 && (
                  <p className="mt-2 text-xs text-slate-500">
                    + {anime.episodes - 24} more episodes
                  </p>
                )}
              </div>
            )}

            {/* External links */}
            {anime.streaming && anime.streaming.length > 0 && (
              <div className="mb-6 flex flex-wrap gap-2">
                {anime.streaming.map((s) => (
                  <a
                    key={s.url}
                    href={s.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn-secondary text-xs"
                  >
                    {s.name} <IconChevronRight size={14} />
                  </a>
                ))}
              </div>
            )}

            {/* Offline note */}
            <div className="mb-6 flex items-start gap-2 rounded-lg border border-brand-200 bg-brand-50 p-3 text-xs text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200">
              <IconDownload size={16} className="mt-0.5 shrink-0" />
              <p>
                Premium members can download episodes for offline viewing from
                the watch page. Offline files are stored locally on this device
                via IndexedDB.
              </p>
            </div>
          </div>
        </div>

        {/* Recommendations */}
        {recs?.data?.length ? (
          <section className="mt-10">
            <h2 className="section-title mb-3">Recommended for you</h2>
            <p className="mb-3 text-xs text-slate-500">
              Personalized based on this title and your watch history.
            </p>
            <AnimeGrid items={recs.data.slice(0, 18).map((r) => r.entry)} />
          </section>
        ) : null}
      </div>

      {showTrailer && youtubeId && (
        <TrailerPlayer
          youtubeId={youtubeId}
          title={title}
          onClose={() => setShowTrailer(false)}
        />
      )}
    </div>
  )
}

function Meta({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-black/5 bg-white/60 p-2.5 dark:border-surface-border dark:bg-surface-card/60">
      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 flex items-center gap-1 line-clamp-1 text-sm font-semibold capitalize">
        {icon}
        {value}
      </p>
    </div>
  )
}
