import { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import {
  IconSearch,
  IconChevronLeft,
  IconChevronRight,
  IconFilterOff,
} from '@tabler/icons-react'
import {
  FilterBar,
  DEFAULT_FILTERS,
  type FilterValues,
} from '@/components/filters/FilterBar'
import { AnimeGrid } from '@/components/anime/AnimeCard'
import { ErrorState, SkeletonGrid } from '@/components/ui/Feedback'
import { fetchFiltered } from '@/lib/filterQuery'
import type { Anime } from '@/types'

export function SearchPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [filters, setFilters] = useState<FilterValues>({
    ...DEFAULT_FILTERS,
    q: searchParams.get('q') || '',
  })
  const [results, setResults] = useState<Anime[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)
  const [page, setPage] = useState(1)
  const [hasNext, setHasNext] = useState(false)

  // Keep the q input synced with the URL.
  useEffect(() => {
    const q = searchParams.get('q') || ''
    setFilters((f) => ({ ...f, q }))
  }, [searchParams])

  const patch = useCallback(
    (p: Partial<FilterValues>) => {
      setFilters((f) => {
        const next = { ...f, ...p }
        if ('q' in p) {
          setSearchParams(p.q ? { q: p.q } : {}, { replace: true })
        }
        return next
      })
    },
    [setSearchParams],
  )

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError(null)
    fetchFiltered(filters, page, controller.signal)
      .then((res) => {
        setResults(res.data)
        setHasNext(res.hasNext)
      })
      .catch((e: unknown) => {
        if (e instanceof Error && e.name !== 'AbortError') setError(e)
      })
      .finally(() => setLoading(false))
    return () => controller.abort()
  }, [filters, page])

  useEffect(() => {
    setPage(1)
  }, [filters])

  return (
    <div className="container-app py-6">
      <div className="mb-5 flex items-center gap-3">
        <IconSearch size={24} className="text-brand-500" />
        <div>
          <h1 className="text-xl font-bold">Search & Filter</h1>
          <p className="text-xs text-slate-500">
            Find anime by title, genre, season, year, type and more.
          </p>
        </div>
      </div>

      <div className="relative mb-4">
        <IconSearch
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
        />
        <input
          value={filters.q}
          onChange={(e) => patch({ q: e.target.value })}
          placeholder="Search by title, e.g. Frieren, Demon Slayer…"
          className="input pl-10"
          autoFocus
        />
      </div>

      <FilterBar values={filters} onChange={patch} />

      {loading ? (
        <SkeletonGrid count={18} />
      ) : error ? (
        <ErrorState message="Search failed. Please retry." onRetry={() => patch({})} />
      ) : results.length === 0 ? (
        <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center text-slate-500">
          <IconFilterOff size={40} className="text-slate-300" />
          <p className="text-sm">No results match your filters.</p>
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs text-slate-500">
            {results.length} result{results.length === 1 ? '' : 's'}
          </p>
          <AnimeGrid items={results} />
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              className="btn-secondary"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <IconChevronLeft size={18} /> Prev
            </button>
            <span className="text-sm text-slate-500">Page {page}</span>
            <button
              className="btn-secondary"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
            >
              Next <IconChevronRight size={18} />
            </button>
          </div>
        </>
      )}
    </div>
  )
}
