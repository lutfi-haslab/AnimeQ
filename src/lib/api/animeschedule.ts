import { jikan } from '@/lib/api/jikan'
import type { Anime, ScheduleAnime, Weekday } from '@/types'

/**
 * Airing schedule — powered by Jikan `/schedules` (MyAnimeList broadcast data).
 * Reliable, CORS-enabled, cached and rate-limited. Throws when the provider is
 * unavailable so the UI can show a retry state (vs. a genuine "nothing airing").
 */
function fromJikan(a: Anime): ScheduleAnime {
  const broadcast = a.broadcast
  const status = (a.status || '').toLowerCase()
  return {
    id: a.mal_id,
    malId: a.mal_id,
    title: a.title_english || a.title,
    episode: 0,
    airingTime: broadcast?.time || '',
    airingAt: broadcast?.time || '',
    episodeName: null,
    image_url: a.images?.jpg?.image_url,
    colour: null,
    statuses: [
      {
        premiering: status.includes('airing') && !status.includes('final'),
        finale: status.includes('final'),
      },
    ],
  }
}

export const animeschedule = {
  /** Schedule for a specific weekday. Throws on provider failure. */
  async byDay(day: Weekday, signal?: AbortSignal): Promise<ScheduleAnime[]> {
    const res = await jikan.schedules(day, 1, 50, signal)
    return res.data.map(fromJikan)
  },

  /** Today's schedule (resolves today's weekday). */
  async today(signal?: AbortSignal): Promise<ScheduleAnime[]> {
    const days: Weekday[] = [
      'sunday',
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
    ]
    const today = days[new Date().getDay()] as Weekday
    return this.byDay(today, signal)
  },
}
