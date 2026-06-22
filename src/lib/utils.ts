import type { Anime } from '@/types'

/** Format a Jikan/MyAnimeList score into a friendly string. */
export function formatScore(score: number | null | undefined): string {
  if (!score) return 'N/A'
  return score.toFixed(2)
}

export function formatMembers(n: number | null | undefined): string {
  if (!n) return '0'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

export function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

export function clamp(n: number, min: number, max: number): number {
  return Math.min(Math.max(n, min), max)
}

export function secondsToClock(total: number): string {
  if (!isFinite(total) || total < 0) return '0:00'
  const s = Math.floor(total % 60)
  const m = Math.floor((total / 60) % 60)
  const h = Math.floor(total / 3600)
  const pad = (x: number) => String(x).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

export function relativeTime(ts: number): string {
  const diff = Date.now() - ts
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day}d ago`
  return new Date(ts).toLocaleDateString()
}

export function bestTitle(a: Pick<Anime, 'title' | 'title_english'>): string {
  return a.title_english || a.title
}

export function cn(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ')
}

/** Debounce a function. Returns the debounced fn + a cancel() attached. */
export function debounce<A extends unknown[]>(
  fn: (...args: A) => void,
  ms: number,
): ((...args: A) => void) & { cancel: () => void } {
  let t: ReturnType<typeof setTimeout> | undefined
  const wrapped = (...args: A) => {
    if (t) clearTimeout(t)
    t = setTimeout(() => fn(...args), ms)
  }
  wrapped.cancel = () => {
    if (t) clearTimeout(t)
  }
  return wrapped
}

/**
 * Serial rate-limited task queue. Tasks run one-at-a-time and the queue waits
 * for each task to fully settle (including its own retries) before starting
 * the next, then enforces a minimum gap between request *starts*. This
 * guarantees no bursts even when callers retry internally.
 */
export function createRateLimiter(minIntervalMs: number) {
  const queue: {
    task: () => Promise<unknown>
    resolve: (v: unknown) => void
    reject: (e: unknown) => void
  }[] = []
  let lastStart = 0
  let processing = false
  const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

  async function pump() {
    if (processing) return
    processing = true
    try {
      while (queue.length) {
        const job = queue.shift()!
        const gap = minIntervalMs - (Date.now() - lastStart)
        if (gap > 0) await sleep(gap)
        lastStart = Date.now()
        try {
          const result = await job.task()
          job.resolve(result)
        } catch (e) {
          job.reject(e)
        }
      }
    } finally {
      processing = false
    }
  }

  return <T>(task: () => Promise<T>): Promise<T> =>
    new Promise<T>((resolve, reject) => {
      queue.push({ task, resolve: resolve as (v: unknown) => void, reject })
      void pump()
    })
}

export function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
