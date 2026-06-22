import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { IconCompass, IconChevronDown } from '@tabler/icons-react'
import {
  FilterBar,
  DEFAULT_FILTERS,
  type FilterValues,
} from '@/components/filters/FilterBar'
import { AnimeGrid } from '@/components/anime/AnimeCard'
import { ErrorState, SkeletonGrid } from '@/components/ui/Feedback'
import { fetchFiltered } from '@/lib/filterQuery'
import { GENRES } from '@/lib/constants'
import type { Anime } from '@/types'

export function BrowsePage() {
  const [searchParams] = useSearchParams()
  const [filters, setFilters] = useState<FilterValues>({
    ...DEFAULT_FILTERS,
    genres: searchParams.get('genres')
      ? searchParams.get('genres')!.split(',').map(Number).filter(Boolean)
      : [],
    type: searchParams.get('type') || '',
  })
  const [results, setResults] = useState<Anime[]>([])
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  const patch = useCallback((p: Partial<FilterValues>) => {
    setFilters((f) => ({ ...f, ...p }))
  }, [])

  // Reset pagination whenever filters change.
  useEffect(() => {
    setPage(1)
  }, [filters])

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchFiltered(filters, 1, controller.signal)
      .then((res) => {
        setResults(res.data)
        setHasNext(res.hasNext)
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== 'AbortError') setError(e)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [filters])

  function loadMore() {
    if (loadingMore || !hasNext) return
    const next = page + 1
    const controller = new AbortController()
    setLoadingMore(true)
    fetchFiltered(filters, next, controller.signal)
      .then((res) => {
        setResults((prev) => [...prev, ...res.data])
        setHasNext(res.hasNext)
        setPage(next)
      })
      .catch(() => {})
      .finally(() => setLoadingMore(false))
  }

  return (
    <div className="container-app py-6">
      <div className="mb-5 flex items-center gap-3">
        <IconCompass size={24} className="text-brand-500" />
        <div>
          <h1 className="text-xl font-bold">Browse Anime</h1>
          <p className="text-xs text-slate-500">
            Discover by genre, season, year and type. Premium catalog, ad-free.
          </p>
        </div>
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        {GENRES.slice(0, 10).map((g) => {
          const active = filters.genres.includes(g.id)
          return (
            <button
              key={g.id}
              onClick={() =>
                patch({
                  genres: active
                    ? filters.genres.filter((x) => x !== g.id)
                    : [...filters.genres, g.id],
                })
              }
              className={`chip ${active ? 'chip-active' : ''}`}
            >
              {g.name}
            </button>
          )
        })}
      </div>

      <FilterBar values={filters} onChange={patch} />

      {loading ? (
        <SkeletonGrid count={18} />
      ) : error ? (
        <ErrorState message="Failed to load catalog. The data provider may be busy." onRetry={() => patch({})} />
      ) : results.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-2 text-center text-slate-500">
          <p className="text-sm">No titles match these filters.</p>
          <button className="btn-secondary text-sm" onClick={() => patch({ ...DEFAULT_FILTERS })}>
            Reset filters
          </button>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-500">{results.length} titles</p>
          <AnimeGrid items={results} />
          {hasNext && (
            <div className="mt-8 flex justify-center">
              <button onClick={loadMore} disabled={loadingMore} className="btn-secondary">
                {loadingMore ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                    Loading…
                  </>
                ) : (
                  <>
                    Load more <IconChevronDown size={16} />
                  </>
                )}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
