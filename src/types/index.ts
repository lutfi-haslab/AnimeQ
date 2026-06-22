// ---- Jikan / MyAnimeList types (subset used by the app) ----

export interface MalImage {
  jpg: { image_url: string; small_image_url: string; large_image_url: string }
  webp: { image_url: string; small_image_url: string; large_image_url: string }
}

export interface MalTitles {
  type: string
  title: string
}

export interface MalGenre {
  mal_id: number
  type: string
  name: string
  url: string
}

export interface MalAired {
  from: string | null
  to: string | null
  prop: {
    from: { day: number | null; month: number | null; year: number | null }
    to: { day: number | null; month: number | null; year: number | null }
  }
}

export interface Anime {
  mal_id: number
  url: string
  images: MalImage
  trailer?: {
    youtube_id: string | null
    url: string | null
    embed_url: string | null
    images?: Record<string, { image_url: string }>
  }
  title: string
  title_english: string | null
  title_japanese: string | null
  titles: MalTitles[]
  type: string | null
  source: string | null
  episodes: number | null
  status: string | null
  airing: boolean
  aired: MalAired
  broadcast?: { string?: string | null; day?: string | null; time?: string | null; timezone?: string | null } | null
  duration: string | null
  rating: string | null
  score: number | null
  scored_by: number | null
  rank: number | null
  popularity: number | null
  members: number | null
  favorites: number | null
  synopsis: string | null
  background: string | null
  season: string | null
  year: number | null
  studios: MalGenre[]
  producers: MalGenre[]
  licensors: MalGenre[]
  genres: MalGenre[]
  themes: MalGenre[]
  demographics: MalGenre[]
  relations?: Relation[]
  theme?: { openings?: string[]; endings?: string[] }
  external?: { name: string; url: string }[]
  streaming?: { name: string; url: string }[]
}

export interface Relation {
  relation: string
  entry: { mal_id: number; type: string; name: string; url: string }[]
}

export interface Paginated<T> {
  data: T[]
  pagination: {
    last_visible_page: number
    has_next_page: boolean
    current_page: number
    items: { count: number; total: number; per_page: number }
  }
}

// ---- animeschedule.net types ----

export interface ScheduleAnime {
  id: number
  malId: number | null
  title: string
  episode: number
  airingTime: string
  airingAt: string
  episodeName: string | null
  image_url?: string
  colour?: string | null
  statuses?: { premiering?: boolean; finale?: boolean }[]
  platforms?: { title: string; region: string }[]
}

export type Weekday =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday'

// ---- Video sources ----

export type SourceProvider = 'animeonsen' | 'animex' | 'kickassanime'

export interface VideoSource {
  provider: SourceProvider
  label: string
  quality: string
  /** Direct playable URL (resolved) or embed URL */
  url: string
  /** Whether the URL is an embed requiring a player/iframe */
  embed: boolean
  /** Extra HTTP request headers needed to play the stream */
  headers?: Record<string, string>
}

// ---- App local types ----

export interface HistoryEntry {
  malId: number
  title: string
  image: string
  episode: number
  progress: number // seconds
  duration: number // seconds
  updatedAt: number
}

export interface LibraryEntry {
  malId: number
  title: string
  image: string
  addedAt: number
  status: 'planning' | 'watching' | 'completed' | 'on_hold' | 'dropped'
}

export interface OfflineEntry {
  malId: number
  title: string
  image: string
  episode: number
  blobKey: string
  size: number
  addedAt: number
}
