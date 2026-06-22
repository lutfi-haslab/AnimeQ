import type { Weekday } from '@/types'

export const JIKAN_BASE = 'https://api.jikan.moe/v4'
export const SCHEDULE_BASE = 'https://api.animeschedule.net'

export const WEEKDAYS: Weekday[] = [
  'monday',
  'tuesday',
  'wednesday',
  'thursday',
  'friday',
  'saturday',
  'sunday',
]

export const WEEKDAY_LABELS: Record<Weekday, string> = {
  monday: 'Monday',
  tuesday: 'Tuesday',
  wednesday: 'Wednesday',
  thursday: 'Thursday',
  friday: 'Friday',
  saturday: 'Saturday',
  sunday: 'Sunday',
}

export const GENRES: { id: number; name: string }[] = [
  { id: 1, name: 'Action' },
  { id: 2, name: 'Adventure' },
  { id: 4, name: 'Comedy' },
  { id: 8, name: 'Drama' },
  { id: 10, name: 'Fantasy' },
  { id: 14, name: 'Horror' },
  { id: 22, name: 'Romance' },
  { id: 24, name: 'Sci-Fi' },
  { id: 36, name: 'Slice of Life' },
  { id: 30, name: 'Sports' },
  { id: 37, name: 'Supernatural' },
  { id: 41, name: 'Suspense' },
  { id: 7, name: 'Mystery' },
  { id: 18, name: 'Mecha' },
  { id: 62, name: 'Isekai' },
  { id: 19, name: 'Music' },
]

export const SEASONS = ['winter', 'spring', 'summer', 'fall'] as const
export type Season = (typeof SEASONS)[number]

export const SEASON_LABELS: Record<Season, string> = {
  winter: 'Winter',
  spring: 'Spring',
  summer: 'Summer',
  fall: 'Fall',
}

export const ANIME_TYPES = ['tv', 'movie', 'ova', 'ona', 'special'] as const

export const QUALITY_OPTIONS = [
  { value: 'auto', label: 'Auto (Adaptive)' },
  { value: '1080p', label: '1080p — Full HD' },
  { value: '720p', label: '720p — HD' },
  { value: '480p', label: '480p — SD' },
  { value: '360p', label: '360p — Low Data' },
] as const

export const RESOLUTION_BADGES = ['4K', '1080p', '720p', '480p'] as const

/**
 * Public read-only CORS proxies used as a fallback when a video origin does not
 * expose CORS headers. Streaming from a browser requires CORS-permissive
 * responses; these proxies rewrite the access-control headers. They are tried
 * in order until one succeeds. Production deployments can replace these with a
 * self-hosted Cloudflare Worker proxy (kept optional to honour the client-only
 * deployment requirement).
 */
export const CORS_PROXIES: string[] = [
  'https://corsproxy.io/?url=',
  'https://api.allorigins.win/raw?url=',
  'https://cors-anywhere-yasinhakki.herokuapp.com/',
]
