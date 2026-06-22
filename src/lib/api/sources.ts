import type { SourceProvider, VideoSource } from '@/types'
import { proxiedMediaUrl } from '@/lib/api/proxy'

export { proxiedMediaUrl }

/** Group sources by provider for the UI selector. */
export function groupByProvider(
  sources: VideoSource[],
): Record<SourceProvider, VideoSource[]> {
  const out = {} as Record<SourceProvider, VideoSource[]>
  for (const s of sources) {
    ;(out[s.provider] ||= []).push(s)
  }
  return out
}

export const PROVIDER_LABELS: Record<SourceProvider, string> = {
  animeonsen: 'AnimeOnsen',
  animex: 'Animex',
  kickassanime: 'KickAssAnime',
}
