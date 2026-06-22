import { useMemo } from 'react'
import { Link } from 'react-router'
import {
  IconPlayerPlayFilled,
  IconStarFilled,
  IconFlame,
  IconCalendarEvent,
  IconBolt,
  IconSparkles,
} from '@tabler/icons-react'
import { jikan } from '@/lib/api/jikan'
import { useAsync } from '@/hooks/useAsync'
import { AnimeRow, AnimeCard } from '@/components/anime/AnimeCard'
import { SkeletonGrid, ErrorState } from '@/components/ui/Feedback'
import { PremiumBadge } from '@/components/ui/PremiumBadge'
import { useHistory } from '@/lib/store'
import { bestTitle, formatScore } from '@/lib/utils'
import type { Anime } from '@/types'

export function HomePage() {
  const { data: topData, loading: topLoading, error: topError, refetch } = useAsync(
    (s) => jikan.topAnime('bypopularity', 1, 18, s),
    [],
  )
  const { data: airingData, loading: airingLoading } = useAsync(
    (s) => jikan.topAnime('airing', 1, 18, s),
    [],
  )
  const { data: upcomingData, loading: upcomingLoading } = useAsync(
    (s) => jikan.topAnime('upcoming', 1, 12, s),
    [],
  )
  const { data: seasonData, loading: seasonLoading } = useAsync(
    (s) => jikan.seasonNow(s),
    [],
  )
  const history = useHistory((s) => s.items)

  const hero = useMemo(() => topData?.data?.[0], [topData])

  return (
    <div className="animate-fade-in">
      {hero ? <Hero anime={hero} /> : topLoading ? <HeroSkeleton /> : null}

      <div className="container-app space-y-10 py-8">
        {history.length > 0 && (
          <Section
            icon={<IconBolt size={20} className="text-brand-500" />}
            title="Continue Watching"
            action={<Link to="/library" className="text-sm text-brand-500 hover:underline">View all</Link>}
          >
            <HistoryRow items={history.slice(0, 12)} />
          </Section>
        )}

        {topError ? (
          <ErrorState message="Failed to load content." onRetry={refetch} />
        ) : topLoading ? (
          <SkeletonGrid count={12} />
        ) : (
          <Section
            icon={<IconFlame size={20} className="text-orange-500" />}
            title="Most Popular"
          >
            <AnimeRow items={topData?.data ?? []} />
          </Section>
        )}

        <Section
          icon={<IconStarFilled size={18} className="text-amber-500" />}
          title="Top Airing Now"
        >
          {airingLoading ? (
            <SkeletonGrid count={6} />
          ) : airingData?.data?.length ? (
            <AnimeRow items={airingData.data} />
          ) : (
            <UnavailableNote />
          )}
        </Section>

        <Section
          icon={<IconCalendarEvent size={20} className="text-emerald-500" />}
          title="This Season"
        >
          {seasonLoading ? (
            <SkeletonGrid count={6} />
          ) : seasonData?.data?.length ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {seasonData.data.slice(0, 12).map((a, i) => (
                <AnimeCard key={a.mal_id} anime={a} index={i} />
              ))}
            </div>
          ) : (
            <UnavailableNote />
          )}
        </Section>

        <Section
          icon={<IconSparkles size={20} className="text-accent-500" />}
          title="Coming Soon"
        >
          {upcomingLoading ? (
            <SkeletonGrid count={6} />
          ) : upcomingData?.data?.length ? (
            <AnimeRow items={upcomingData.data} />
          ) : (
            <UnavailableNote />
          )}
        </Section>
      </div>
    </div>
  )
}

function Section({
  icon,
  title,
  action,
  children,
}: {
  icon: React.ReactNode
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="section-title flex items-center gap-2">
          {icon}
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

function Hero({ anime }: { anime: Anime }) {
  const bg = anime.images.jpg.large_image_url
  const title = bestTitle(anime)
  return (
    <section className="relative h-[58vh] min-h-[420px] w-full overflow-hidden">
      <img src={bg} alt={title} className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-t from-surface via-surface/70 to-transparent dark:from-surface dark:via-surface/80" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
      <div className="container-app relative flex h-full flex-col justify-end pb-10">
        <div className="max-w-2xl animate-slide-up">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-brand-600 px-2.5 py-1 text-xs font-bold text-white">
              <IconFlame size={14} /> #1 Trending
            </span>
            {anime.score && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-1 text-xs font-bold text-black">
                <IconStarFilled size={12} /> {formatScore(anime.score)}
              </span>
            )}
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
              {anime.type || 'TV'} · {anime.episodes ? `${anime.episodes} eps` : anime.year}
            </span>
            <PremiumBadge />
          </div>
          <h1 className="mb-3 text-4xl font-extrabold tracking-tight text-white drop-shadow-lg sm:text-5xl">
            {title}
          </h1>
          <p className="mb-5 line-clamp-2 max-w-xl text-sm text-white/80 sm:text-base">
            {anime.synopsis}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={`/watch/${anime.mal_id}/1`}
              className="btn-primary px-5 py-2.5 text-base shadow-lg shadow-brand-600/30"
            >
              <IconPlayerPlayFilled size={18} /> Watch Now
            </Link>
            <Link
              to={`/anime/${anime.mal_id}`}
              className="btn bg-white/15 px-5 py-2.5 text-base text-white backdrop-blur hover:bg-white/25"
            >
              More Info
            </Link>
          </div>
        </div>
      </div>
    </section>
  )
}

function HeroSkeleton() {
  return <div className="skeleton h-[58vh] min-h-[420px] w-full rounded-none" />
}

function UnavailableNote() {
  return (
    <p className="rounded-lg border border-dashed border-slate-200 py-8 text-center text-xs text-slate-400 dark:border-surface-border">
      This section is temporarily unavailable. The data provider may be busy.
    </p>
  )
}

function HistoryRow({ items }: { items: { malId: number; title: string; image: string; episode: number; progress: number; duration: number }[] }) {
  return (
    <div className="no-scrollbar -mx-4 flex gap-3 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      {items.map((h) => {
        const pct = h.duration ? Math.min((h.progress / h.duration) * 100, 100) : 0
        return (
          <Link
            key={h.malId}
            to={`/watch/${h.malId}/${h.episode}`}
            className="group w-[240px] shrink-0 overflow-hidden rounded-xl border border-black/5 bg-white shadow-sm dark:border-surface-border dark:bg-surface-card"
          >
            <div className="relative aspect-video">
              <img src={h.image} alt={h.title} className="h-full w-full object-cover" loading="lazy" />
              <div className="absolute inset-0 grid place-items-center bg-black/30 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="grid h-11 w-11 place-items-center rounded-full bg-brand-600/90 text-white">
                  <IconPlayerPlayFilled size={18} />
                </div>
              </div>
              <div className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
                EP {h.episode}
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-1 bg-white/20">
                <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="p-2.5">
              <p className="line-clamp-1 text-sm font-semibold">{h.title}</p>
              <p className="mt-0.5 text-xs text-slate-500">{Math.round(pct)}% watched</p>
            </div>
          </Link>
        )
      })}
    </div>
  )
}
