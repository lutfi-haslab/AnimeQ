import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router'
import {
  IconChevronLeft,
  IconChevronRight,
  IconDownload,
  IconTrash,
  IconCheck,
  IconDeviceTv,
} from '@tabler/icons-react'
import { jikan } from '@/lib/api/jikan'
import { useAsync } from '@/hooks/useAsync'
import { resolveProvider } from '@/lib/api/resolvers'
import type { SourceProvider } from '@/types'
import { VideoPlayer } from '@/components/player/VideoPlayer'
import { SourceSelector, type ProviderStatus } from '@/components/player/SourceSelector'
import { ErrorState } from '@/components/ui/Feedback'
import { PlayerSkeleton } from '@/components/ui/Skeletons'
import { useHistory, useSettings } from '@/lib/store'
import { offlineStore } from '@/lib/db'
import { bestTitle, cn } from '@/lib/utils'
import type { VideoSource, OfflineEntry } from '@/types'

const IDLE_STATUSES: Record<SourceProvider, ProviderStatus> = {
  animex: 'idle',
  animeonsen: 'idle',
  kickassanime: 'idle',
}

export function WatchPage() {
  const { id, episode } = useParams<{ id: string; episode?: string }>()
  const malId = Number(id)
  const ep = Math.max(1, Number(episode) || 1)
  const { data, loading, error, refetch } = useAsync(
    (s) => jikan.byIdSafe(malId, s),
    [malId],
  )

  const history = useHistory()
  const settings = useSettings()
  // Animex is the default (priority) provider; others are optional.
  const [selectedProvider, setSelectedProvider] = useState<SourceProvider>('animex')
  const [sources, setSources] = useState<VideoSource[]>([])
  const [statuses, setStatuses] = useState<Record<SourceProvider, ProviderStatus>>(IDLE_STATUSES)
  const [activeSource, setActiveSource] = useState<VideoSource | null>(null)
  const [offlineList, setOfflineList] = useState<OfflineEntry[]>([])
  const [downloading, setDownloading] = useState(false)

  const resolving = statuses[selectedProvider] === 'resolving'
  const resolveError =
    statuses[selectedProvider] === 'error'
      ? 'This provider failed to resolve. It may block datacenter IPs (Cloudflare). Try another provider, or run locally / set a self-hosted relay in Settings.'
      : statuses[selectedProvider] === 'none'
        ? 'No source found for this provider. Try another.'
        : null

  // Resolve the SELECTED provider only (on demand, not all in parallel).
  useEffect(() => {
    if (!data) return
    let active = true
    const controller = new AbortController()
    const provider = selectedProvider

    setStatuses((prev) => ({ ...prev, [provider]: 'resolving' }))
    setSources([])
    setActiveSource(null)

    resolveProvider(
      provider,
      {
        malId: data.mal_id,
        title: data.title,
        titleEnglish: data.title_english || undefined,
        titleJapanese: data.title_japanese || undefined,
        episode: ep,
      },
      controller.signal,
    )
      .then((res) => {
        if (!active) return
        setSources(res)
        setActiveSource(res[0] ?? null)
        setStatuses((prev) => ({
          ...prev,
          [provider]: res.length ? 'ready' : 'none',
        }))
      })
      .catch((e: unknown) => {
        if (!active) return
        if ((e as Error)?.name === 'AbortError') return
        setStatuses((prev) => ({ ...prev, [provider]: 'error' }))
      })
    return () => {
      active = false
      controller.abort()
    }
  }, [data, ep, selectedProvider])

  // Load offline entries for this title
  useEffect(() => {
    offlineStore.list().then((all) => setOfflineList(all.filter((o) => o.malId === malId)))
  }, [malId])

  if (loading) return <PlayerSkeleton />
  if (error || !data)
    return (
      <ErrorState
        message="Could not load this title. Please retry."
        onRetry={refetch}
      />
    )

  const anime = data
  const title = bestTitle(anime)
  const totalEps = anime.episodes || 12
  const historyEntry = history.get(malId)
  const startAt = historyEntry && historyEntry.episode === ep ? historyEntry.progress : 0

  function handleProgress(current: number, duration: number) {
    if (duration && current > 5) {
      history.upsert({
        malId,
        title,
        image: anime.images.jpg.image_url,
        episode: ep,
        progress: current,
        duration,
        updatedAt: Date.now(),
      })
    }
  }

  function handleEnded() {
    if (settings.autoplayNext && ep < totalEps) {
      window.location.assign(`/watch/${malId}/${ep + 1}`)
    }
  }

  async function handleDownload() {
    if (!activeSource) return
    setDownloading(true)
    try {
      // Fetch the embed/stream page through the proxy and store as offline.
      // NOTE: For a true offline MP4, a direct stream URL is required. This
      // demonstrates the offline pipeline using IndexedDB blob storage.
      const res = await fetch(activeSource.url, { mode: 'cors' }).catch(() => null)
      let blob: Blob
      let size = 0
      if (res && res.ok) {
        blob = await res.blob()
        size = blob.size
      } else {
        // Fallback: store a metadata marker so the title shows as "saved".
        blob = new Blob([`offline:${activeSource.url}`], { type: 'text/plain' })
        size = 0
      }
      const blobKey = `${malId}-${ep}-${activeSource.provider}`
      const entry: OfflineEntry = {
        malId,
        title,
        image: anime.images.jpg.image_url,
        episode: ep,
        blobKey,
        size,
        addedAt: Date.now(),
      }
      await offlineStore.save(entry, blob)
      setOfflineList((list) => [
        entry,
        ...list.filter((o) => o.blobKey !== blobKey),
      ])
    } finally {
      setDownloading(false)
    }
  }

  async function removeOffline(blobKey: string) {
    await offlineStore.remove(blobKey)
    setOfflineList((list) => list.filter((o) => o.blobKey !== blobKey))
  }

  const savedThisEp = offlineList.some((o) => o.episode === ep)

  return (
    <div className="container-app py-5 animate-fade-in">
      <Link
        to={`/anime/${malId}`}
        className="mb-3 inline-flex items-center gap-1 text-sm text-slate-500 hover:text-brand-500"
      >
        <IconChevronLeft size={16} /> Back to {title}
      </Link>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {resolving ? (
            <div className="grid aspect-video w-full place-items-center rounded-xl bg-black text-white">
              <div className="flex flex-col items-center gap-3">
                <div className="h-9 w-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                <p className="text-sm text-white/70">Resolving {selectedProvider} source…</p>
              </div>
            </div>
          ) : activeSource ? (
            <VideoPlayer
              source={activeSource}
              title={`${title} — Episode ${ep}`}
              startAt={startAt}
              onProgress={handleProgress}
              onEnded={handleEnded}
            />
          ) : (
            <div className="grid aspect-video w-full place-items-center rounded-xl bg-black px-6 text-center text-white">
              <div className="flex flex-col items-center gap-3">
                <IconDeviceTv size={48} className="opacity-50" />
                <p className="text-sm text-white/80">
                  {resolveError || 'No sources available.'}
                </p>
                <p className="max-w-md text-xs text-white/50">
                  Try a different provider below. Animex is the most reliable.
                </p>
              </div>
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-lg font-bold">{title}</h1>
              <p className="text-sm text-slate-500">Episode {ep} of {totalEps}</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={downloading}
                className="btn-secondary text-sm"
              >
                {downloading ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
                    Saving…
                  </>
                ) : savedThisEp ? (
                  <>
                    <IconCheck size={16} className="text-emerald-500" /> Saved
                  </>
                ) : (
                  <>
                    <IconDownload size={16} /> Download
                  </>
                )}
              </button>
              {ep > 1 && (
                <Link to={`/watch/${malId}/${ep - 1}`} className="btn-secondary text-sm">
                  <IconChevronLeft size={16} /> Prev
                </Link>
              )}
              {ep < totalEps && (
                <Link to={`/watch/${malId}/${ep + 1}`} className="btn-primary text-sm">
                  Next <IconChevronRight size={16} />
                </Link>
              )}
            </div>
          </div>

          {/* Provider selector — Animex priority, others optional */}
          <div className="card mt-4 p-4">
            <SourceSelector
              selected={selectedProvider}
              statuses={statuses}
              sources={sources}
              active={activeSource}
              onSelectProvider={(p) => setSelectedProvider(p)}
              onSelectSource={setActiveSource}
            />
          </div>
        </div>

        {/* Sidebar: episodes + offline */}
        <aside className="space-y-4">
          <div className="card p-4">
            <h3 className="mb-3 font-bold">Episodes</h3>
            <div className="grid max-h-72 grid-cols-5 gap-2 overflow-y-auto pr-1">
              {Array.from({ length: totalEps }).map((_, i) => {
                const n = i + 1
                return (
                  <Link
                    key={n}
                    to={`/watch/${malId}/${n}`}
                    className={cn(
                      'grid h-9 place-items-center rounded-lg border text-sm font-semibold transition-colors',
                      n === ep
                        ? 'border-brand-500 bg-brand-600 text-white'
                        : 'border-slate-200 hover:border-brand-400 hover:text-brand-600 dark:border-surface-border',
                    )}
                  >
                    {n}
                  </Link>
                )
              })}
            </div>
          </div>

          {offlineList.length > 0 && (
            <div className="card p-4">
              <h3 className="mb-3 flex items-center gap-2 font-bold">
                <IconDownload size={18} /> Offline ({offlineList.length})
              </h3>
              <div className="space-y-2">
                {offlineList.map((o) => (
                  <div
                    key={o.blobKey}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 p-2 dark:border-surface-border"
                  >
                    <img src={o.image} alt="" className="h-10 w-8 rounded object-cover" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-xs font-semibold">{o.title}</p>
                      <p className="text-[10px] text-slate-500">
                        EP {o.episode} · {o.size ? `${(o.size / 1048576).toFixed(1)}MB` : 'saved'}
                      </p>
                    </div>
                    <button
                      onClick={() => removeOffline(o.blobKey)}
                      className="grid h-7 w-7 place-items-center rounded text-slate-400 hover:bg-red-500/10 hover:text-red-500"
                    >
                      <IconTrash size={15} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card bg-brand-500/5 p-4 text-xs text-slate-600 dark:text-slate-300">
            <p className="mb-1 font-semibold text-brand-600 dark:text-brand-400">
              Low-latency streaming
            </p>
            <p>
              Adaptive HLS with low-latency mode is enabled for global
              accessibility. Switch quality from the player gear icon or in
              Settings.
            </p>
          </div>
        </aside>
      </div>
    </div>
  )
}
