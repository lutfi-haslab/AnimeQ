import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import {
  IconBookmark,
  IconHistory,
  IconTrash,
  IconDownload,
  IconFilter,
} from '@tabler/icons-react'
import { useHistory, useLibrary } from '@/lib/store'
import type { LibraryEntry } from '@/types'
import { offlineStore } from '@/lib/db'
import { AnimeGrid } from '@/components/anime/AnimeCard'
import { LoadingScreen } from '@/components/ui/Feedback'
import { jikan } from '@/lib/api/jikan'
import type { Anime, OfflineEntry } from '@/types'

type Tab = 'library' | 'history' | 'offline'

export function LibraryPage() {
  const [tab, setTab] = useState<Tab>('library')
  const library = useLibrary()
  const history = useHistory()
  const [offline, setOffline] = useState<OfflineEntry[]>([])

  useEffect(() => {
    offlineStore.list().then(setOffline)
  }, [tab])

  return (
    <div className="container-app py-6 animate-fade-in">
      <div className="mb-5 flex items-center gap-3">
        <IconBookmark size={24} className="text-brand-500" />
        <div>
          <h1 className="text-xl font-bold">My Library</h1>
          <p className="text-xs text-slate-500">
            Your saved titles, watch history and offline downloads — synced
            across devices with your sync ID.
          </p>
        </div>
      </div>

      <div className="mb-6 flex gap-2">
        {([
          ['library', 'Saved', library.items.length],
          ['history', 'History', history.items.length],
          ['offline', 'Offline', offline.length],
        ] as const).map(([key, label, count]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`btn text-sm ${tab === key ? 'btn-primary' : 'btn-secondary'}`}
          >
            {label}
            <span className="rounded-full bg-black/10 px-1.5 text-[10px] dark:bg-white/10">
              {count}
            </span>
          </button>
        ))}
      </div>

      {tab === 'library' && <LibraryTab library={library} />}
      {tab === 'history' && <HistoryTab />}
      {tab === 'offline' && <OfflineTab offline={offline} setOffline={setOffline} />}
    </div>
  )
}

function LibraryTab({
  library,
}: {
  library: { items: LibraryEntry[] }
}) {
  const [animeMap, setAnimeMap] = useState<Record<number, Anime>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    Promise.all(library.items.map((i) => jikan.byIdSafe(i.malId).then((a) => a ?? null)))
      .then((all) => {
        if (!active) return
        const map: Record<number, Anime> = {}
        for (const a of all) if (a) map[a.mal_id] = a
        setAnimeMap(map)
      })
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [library.items])

  if (library.items.length === 0)
    return <EmptyState icon={<IconBookmark size={40} />} text="No saved titles yet." />
  if (loading) return <LoadingScreen />
  return <AnimeGrid items={library.items.map((i) => animeMap[i.malId]).filter(Boolean) as Anime[]} />
}

function HistoryTab() {
  const history = useHistory()
  if (history.items.length === 0)
    return <EmptyState icon={<IconHistory size={40} />} text="No watch history yet." />
  return (
    <div className="space-y-2">
      {history.items.map((h) => {
        const pct = h.duration ? Math.min((h.progress / h.duration) * 100, 100) : 0
        return (
          <div
            key={h.malId}
            className="flex items-center gap-3 rounded-xl border border-black/5 bg-white p-2 dark:border-surface-border dark:bg-surface-card"
          >
            <Link to={`/watch/${h.malId}/${h.episode}`} className="shrink-0">
              <img src={h.image} alt="" className="h-16 w-28 rounded-lg object-cover" />
            </Link>
            <div className="min-w-0 flex-1">
              <Link to={`/anime/${h.malId}`} className="line-clamp-1 text-sm font-semibold hover:text-brand-500">
                {h.title}
              </Link>
              <p className="text-xs text-slate-500">Episode {h.episode} · {Math.round(pct)}%</p>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-surface">
                <div className="h-full bg-brand-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <button
              onClick={() => history.remove(h.malId)}
              className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-red-500/10 hover:text-red-500"
            >
              <IconTrash size={16} />
            </button>
          </div>
        )
      })}
      <button onClick={history.clear} className="btn-ghost text-sm text-red-500">
        Clear all history
      </button>
    </div>
  )
}

function OfflineTab({
  offline,
  setOffline,
}: {
  offline: OfflineEntry[]
  setOffline: (fn: (o: OfflineEntry[]) => OfflineEntry[]) => void
}) {
  if (offline.length === 0)
    return <EmptyState icon={<IconDownload size={40} />} text="No offline downloads. Download episodes from the watch page." />
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {offline.map((o) => (
        <div
          key={o.blobKey}
          className="card overflow-hidden"
        >
          <div className="relative aspect-video">
            <img src={o.image} alt="" className="h-full w-full object-cover" />
            <span className="absolute right-2 top-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-bold text-white">
              EP {o.episode}
            </span>
          </div>
          <div className="p-3">
            <p className="line-clamp-1 text-sm font-semibold">{o.title}</p>
            <p className="text-xs text-slate-500">
              {o.size ? `${(o.size / 1048576).toFixed(1)} MB` : 'Metadata only'}
            </p>
            <button
              onClick={async () => {
                await offlineStore.remove(o.blobKey)
                setOffline((list) => list.filter((x) => x.blobKey !== o.blobKey))
              }}
              className="btn-secondary mt-2 w-full py-1.5 text-xs"
            >
              <IconTrash size={14} /> Remove
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

function EmptyState({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex min-h-[30vh] flex-col items-center justify-center gap-3 text-center text-slate-400">
      {icon}
      <p className="text-sm">{text}</p>
      <Link to="/browse" className="btn-primary text-sm">
        <IconFilter size={16} /> Browse anime
      </Link>
    </div>
  )
}
