import { useEffect, useState } from 'react'
import {
  IconSun,
  IconMoon,
  IconDeviceDesktop,
  IconPlayerPlay,
  IconBolt,
  IconServer,
  IconCloudUpload,
  IconCloudDownload,
  IconShieldCheck,
  IconCheck,
  IconTrash,
} from '@tabler/icons-react'
import { useSettings } from '@/lib/store'
import { setProxyBase } from '@/lib/api/proxy'
import { QUALITY_OPTIONS } from '@/lib/constants'
import { offlineStore } from '@/lib/db'
import { cn } from '@/lib/utils'

export function SettingsPage() {
  const settings = useSettings()
  const [storageUsed, setStorageUsed] = useState(0)
  const [exported, setExported] = useState(false)

  useEffect(() => {
    offlineStore.totalSize().then(setStorageUsed)
  }, [])

  function exportData() {
    const payload = {
      settings: useSettings.getState(),
      history: localStorage.getItem('animeq:history'),
      library: localStorage.getItem('animeq:library'),
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `animeq-backup-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
    setExported(true)
    setTimeout(() => setExported(false), 2000)
  }

  function importData(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result))
        if (data.history) localStorage.setItem('animeq:history', data.history)
        if (data.library) localStorage.setItem('animeq:library', data.library)
        window.location.reload()
      } catch {
        alert('Invalid backup file.')
      }
    }
    reader.readAsText(file)
  }

  const themes = [
    { value: 'light', label: 'Light', icon: IconSun },
    { value: 'dark', label: 'Dark', icon: IconMoon },
    { value: 'system', label: 'System', icon: IconDeviceDesktop },
  ] as const

  const providers = [
    { value: 'animeonsen', label: 'AnimeOnsen' },
    { value: 'animex', label: 'Animex' },
    { value: 'kickassanime', label: 'KickAssAnime' },
  ] as const

  return (
    <div className="container-app max-w-3xl py-6 animate-fade-in">
      <div className="mb-6 flex items-center gap-3">
        <IconShieldCheck size={24} className="text-brand-500" />
        <div>
          <h1 className="text-xl font-bold">Settings</h1>
          <p className="text-xs text-slate-500">
            Personalize playback, appearance and cross-device sync.
          </p>
        </div>
      </div>

      <Card title="Appearance">
        <p className="mb-3 text-xs text-slate-500">Choose how AnimeQ looks.</p>
        <div className="grid grid-cols-3 gap-2">
          {themes.map((t) => (
            <button
              key={t.value}
              onClick={() => settings.setTheme(t.value)}
              className={cn(
                'flex flex-col items-center gap-2 rounded-xl border p-4 text-sm font-semibold transition-all',
                settings.theme === t.value
                  ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10'
                  : 'border-slate-200 dark:border-surface-border',
              )}
            >
              <t.icon size={22} />
              {t.label}
            </button>
          ))}
        </div>
      </Card>

      <Card title="Playback">
        <Row label="Default quality" desc="Preferred resolution for new streams.">
          <select
            value={settings.quality}
            onChange={(e) => settings.setQuality(e.target.value as typeof settings.quality)}
            className="input w-auto"
          >
            {QUALITY_OPTIONS.map((q) => (
              <option key={q.value} value={q.value}>
                {q.label}
              </option>
            ))}
          </select>
        </Row>
        <Toggle
          label="Autoplay"
          desc="Start playback automatically when opening a video."
          icon={<IconPlayerPlay size={18} />}
          value={settings.autoplay}
          onChange={(v) => settings.set({ autoplay: v })}
        />
        <Toggle
          label="Autoplay next episode"
          desc="Automatically play the next episode when one ends."
          icon={<IconPlayerPlay size={18} />}
          value={settings.autoplayNext}
          onChange={(v) => settings.set({ autoplayNext: v })}
        />
        <Toggle
          label="Low-latency mode"
          desc="Optimize HLS for near-live playback and global accessibility."
          icon={<IconBolt size={18} />}
          value={settings.lowLatency}
          onChange={(v) => settings.set({ lowLatency: v })}
        />
      </Card>

      <Card title="Streaming Source">
        <Row
          label="CORS proxy URL"
          desc="Optional self-hosted Cloudflare Worker proxy (forwards headers). Leave empty to use public proxies."
        >
          <input
            defaultValue={typeof window !== 'undefined' ? window.localStorage.getItem('animeq:proxyBase') || '' : ''}
            placeholder="https://your-proxy.workers.dev/"
            className="input w-64"
            onChange={(e) => setProxyBase(e.target.value.trim() || null)}
          />
        </Row>
        <Row label="Preferred provider" desc="Default source used on the watch page.">
          <select
            value={settings.preferredProvider}
            onChange={(e) => settings.set({ preferredProvider: e.target.value })}
            className="input w-auto"
          >
            {providers.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Row>
        <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-surface-card">
          <IconServer size={16} className="mt-0.5 shrink-0" />
          <p>
            Sources: AnimeOnsen, Animex, KickAssAnime. All providers resolve
            direct HLS/MP4 streams played via hls.js (no iframe). Streams are
            routed through a CORS proxy that injects each provider's required
            Referer/Origin headers. For best reliability, deploy a small
            Cloudflare Worker proxy and set its URL above.
          </p>
        </div>
      </Card>

      <Card title="Premium Membership">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 text-black">
              <IconShieldCheck size={22} />
            </div>
            <div>
              <p className="font-bold">Premium · Ad-Free</p>
              <p className="text-xs text-slate-500">
                HD streaming, offline downloads, low-latency playback.
              </p>
            </div>
          </div>
          {settings.premium && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-xs font-bold text-emerald-500">
              <IconCheck size={14} /> Active
            </span>
          )}
        </div>
      </Card>

      <Card title="Cross-Device Sync">
        <Row label="Sync ID" desc="Use the same ID across devices to share your library & history.">
          <input
            value={settings.syncId || ''}
            onChange={(e) => settings.set({ syncId: e.target.value || null })}
            placeholder="e.g. your-email"
            className="input w-auto"
          />
        </Row>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={exportData} className="btn-secondary text-sm">
            <IconCloudUpload size={16} /> {exported ? 'Exported!' : 'Export data'}
          </button>
          <label className="btn-secondary cursor-pointer text-sm">
            <IconCloudDownload size={16} /> Import data
            <input type="file" accept="application/json" onChange={importData} className="hidden" />
          </label>
        </div>
      </Card>

      <Card title="Storage">
        <Row label="Offline downloads" desc={`${(storageUsed / 1048576).toFixed(1)} MB used`}>
          <button
            className="btn-secondary text-sm text-red-500"
            onClick={async () => {
              const all = await offlineStore.list()
              await Promise.all(all.map((o) => offlineStore.remove(o.blobKey)))
              setStorageUsed(0)
            }}
          >
            <IconTrash size={16} /> Clear all
          </button>
        </Row>
      </Card>

      <p className="mt-6 text-center text-xs text-slate-400">
        AnimeQ · Data from Jikan (MyAnimeList) &amp; animeschedule.net · Trailers via YouTube
      </p>
    </div>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card mb-4 p-5">
      <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-400">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  )
}

function Row({ label, desc, children }: { label: string; desc?: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {desc && <p className="text-xs text-slate-500">{desc}</p>}
      </div>
      {children}
    </div>
  )
}

function Toggle({
  label,
  desc,
  icon,
  value,
  onChange,
}: {
  label: string
  desc?: string
  icon?: React.ReactNode
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2">
        {icon && <span className="text-slate-400">{icon}</span>}
        <div>
          <p className="text-sm font-semibold">{label}</p>
          {desc && <p className="text-xs text-slate-500">{desc}</p>}
        </div>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={cn(
          'relative h-6 w-11 rounded-full transition-colors',
          value ? 'bg-brand-600' : 'bg-slate-300 dark:bg-surface-border',
        )}
        role="switch"
        aria-checked={value}
      >
        <span
          className={cn(
            'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform',
            value ? 'translate-x-[22px]' : 'translate-x-0.5',
          )}
        />
      </button>
    </div>
  )
}
