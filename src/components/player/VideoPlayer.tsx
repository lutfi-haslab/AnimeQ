import { useCallback, useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'
import {
  IconPlayerPauseFilled,
  IconPlayerPlayFilled,
  IconVolume,
  IconVolumeOff,
  IconMaximize,
  IconSettings2,
  IconRewindBackward10,
  IconRewindForward10,
  IconAlertTriangle,
} from '@tabler/icons-react'
import { proxiedMediaUrl } from '@/lib/api/sources'
import { useSettings } from '@/lib/store'
import { clamp, cn, secondsToClock } from '@/lib/utils'
import type { VideoSource } from '@/types'

type DashPlayer = {
  extend: (name: string, instance: object, override: boolean) => void
  attachView: (el: HTMLElement | null) => void
  initialize: (el: HTMLMediaElement, url: string, autoPlay: boolean) => void
  updateSettings: (s: { streaming: { abr: { autoSwitchBitrate: { video: boolean } } } }) => void
  setRepresentationForTypeByIdx?: (type: string, idx: number, force: boolean) => void
  getRepresentationsByType?: (type: string) => Array<{ id: number; height: number }>
  setCurrentRepresentationForType?: (type: string, rep: { id: number }) => void
  destroy: () => void
  on: (event: string, cb: (e: unknown) => void) => void
}

interface PlayerPropsDef {
  source: VideoSource
  title: string
  startAt?: number
  onProgress?: (current: number, duration: number) => void
  onEnded?: () => void
}

/**
 * Adaptive video player. Detects the stream format and uses the right engine:
 *   .m3u8 -> hls.js (Animex, KickAssAnime)
 *   .mpd  -> dash.js (AnimeOnsen)
 *   .mp4  -> native <video>
 * All streams are routed through the same-origin relay so the provider's
 * required Referer/Origin headers are injected on every segment request.
 */
export function VideoPlayer({ source, title, startAt = 0, onProgress, onEnded }: PlayerPropsDef) {
  const containerRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const hlsRef = useRef<Hls | null>(null)
  const dashRef = useRef<DashPlayer | null>(null)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [current, setCurrent] = useState(0)
  const [duration, setDuration] = useState(0)
  const [levels, setLevels] = useState<{ height: number; index: number }[]>([])
  const [currentLevel, setCurrentLevel] = useState(-1)
  const [showSettings, setShowSettings] = useState(false)
  const [buffering, setBuffering] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const settings = useSettings()

  const isHls = /\.m3u8(\?|$)/i.test(source.url)
  const isDash = /\.mpd(\?|$)/i.test(source.url)

  // Configure source — pick engine based on manifest type.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let cancelled = false
    setError(null)
    setBuffering(true)
    setLevels([])
    hlsRef.current = null
    dashRef.current = null

    // Route through the same-origin relay so segments carry the provider's
    // required Referer/Origin headers (native media can't set custom headers).
    const playableUrl = proxiedMediaUrl(source.url, source.headers)

    // --- HLS ---
    if (isHls && Hls.isSupported()) {
      const hls = new Hls({
        lowLatencyMode: settings.lowLatency,
        enableWorker: true,
        backBufferLength: 60,
      })
      hlsRef.current = hls
      hls.loadSource(playableUrl)
      hls.attachMedia(video)
      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        if (cancelled) return
        const lvls = hls.levels.map((l, index) => ({ height: l.height, index }))
        setLevels(lvls)
        applyHlsQuality(hls, settings.quality)
        if (startAt) video.currentTime = startAt
      })
      hls.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setError('This stream could not be loaded. Try another provider.')
      })
      return () => hls.destroy()
    }

    // --- DASH (AnimeOnsen) ---
    // Pass the ORIGINAL manifest URL; dash.js resolves segments against it, then
    // the RequestModifier routes every request through the same-origin relay so
    // each segment carries the required Referer/Origin headers.
    if (isDash) {
      let destroyed = false
      import('dashjs')
        .then((mod) => {
          if (cancelled || destroyed) return
          const dashjs = mod.default as unknown as {
            MediaPlayer: () => { create: () => DashPlayer }
          }
          const dp = dashjs.MediaPlayer().create()
          dashRef.current = dp
          dp.extend(
            'RequestModifier',
            () => ({
              modifyRequestURL: (url: string) => proxiedMediaUrl(url, source.headers),
              modifyRequestHeader: (req: Request) => req,
            }),
            true,
          )
          dp.updateSettings({
            streaming: {
              abr: { autoSwitchBitrate: { video: settings.quality === 'auto' } },
            },
          })
          dp.initialize(video, source.url, settings.autoplay)
          dp.on('streamInitialized', () => {
            if (cancelled) return
            const reps = dp.getRepresentationsByType?.('video') || []
            setLevels(reps.map((r, index) => ({ height: r.height, index })))
            if (startAt) video.currentTime = startAt
          })
          dp.on('error', (e) => {
            console.error('DashJS error:', e)
            setError('This stream could not be loaded. Try another provider. (DashJS error: ' + JSON.stringify(e) + ')')
          })
        })
        .catch((err) => {
          console.error('Failed to load DASH engine:', err)
          setError('Failed to load the DASH engine: ' + String(err))
        })
      return () => {
        destroyed = true
        dashRef.current?.destroy()
      }
    }

    // --- Native (Safari HLS, direct MP4) ---
    video.src = playableUrl
    if (startAt) video.currentTime = startAt
    return () => {
      video.removeAttribute('src')
      video.load()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source.url])

  function applyHlsQuality(hls: Hls, q: string) {
    if (q === 'auto') {
      hls.currentLevel = -1
      setCurrentLevel(-1)
      return
    }
    const target = parseInt(q, 10)
    const match = hls.levels.findIndex((l) => l.height === target)
    if (match >= 0) {
      hls.currentLevel = match
      setCurrentLevel(match)
    }
  }

  // Media element events
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onTime = () => {
      setCurrent(video.currentTime)
      onProgress?.(video.currentTime, video.duration)
    }
    const onDur = () => setDuration(video.duration || 0)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onWait = () => setBuffering(true)
    const onCanPlay = () => setBuffering(false)
    const onErr = () => setError('Playback error. Try another source.')
    const onEnd = () => onEnded?.()

    video.addEventListener('timeupdate', onTime)
    video.addEventListener('durationchange', onDur)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('waiting', onWait)
    video.addEventListener('canplay', onCanPlay)
    video.addEventListener('ended', onEnd)
    video.addEventListener('error', onErr)
    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('durationchange', onDur)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('waiting', onWait)
      video.removeEventListener('canplay', onCanPlay)
      video.removeEventListener('ended', onEnd)
      video.removeEventListener('error', onErr)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onProgress, onEnded])

  const togglePlay = useCallback(() => {
    const v = videoRef.current
    if (!v) return
    if (v.paused) v.play()
    else v.pause()
  }, [])

  const skip = useCallback((delta: number) => {
    const v = videoRef.current
    if (v) v.currentTime = clamp(v.currentTime + delta, 0, v.duration || 0)
  }, [])

  const seek = useCallback((value: number) => {
    const v = videoRef.current
    if (v) v.currentTime = value
  }, [])

  const toggleFullscreen = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    if (document.fullscreenElement) document.exitFullscreen()
    else el.requestFullscreen?.()
  }, [])

  function handleQuality(value: string) {
    setShowSettings(false)
    if (hlsRef.current) {
      applyHlsQuality(hlsRef.current, value)
    } else if (dashRef.current) {
      const dp = dashRef.current
      if (value === 'auto') {
        dp.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: true } } } })
        setCurrentLevel(-1)
      } else {
        const target = parseInt(value, 10)
        const reps = dp.getRepresentationsByType?.('video') || []
        const idx = reps.findIndex((r) => r.height === target)
        if (idx >= 0) {
          dp.updateSettings({ streaming: { abr: { autoSwitchBitrate: { video: false } } } })
          dp.setCurrentRepresentationForType?.('video', { id: reps[idx].id })
          setCurrentLevel(idx)
        }
      }
    }
    settings.setQuality(value as typeof settings.quality)
  }

  return (
    <div
      ref={containerRef}
      className="group relative aspect-video w-full overflow-hidden rounded-xl bg-black"
    >
      <video
        ref={videoRef}
        className="h-full w-full"
        playsInline
        autoPlay={settings.autoplay}
        onClick={togglePlay}
      />

      {/* Buffering / error overlays */}
      {buffering && !error && (
        <div className="absolute inset-0 grid place-items-center bg-black/40">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}
      {error && (
        <div className="absolute inset-0 grid place-items-center bg-black/80 p-6 text-center">
          <div>
            <IconAlertTriangle size={36} className="mx-auto mb-3 text-amber-400" />
            <p className="mb-1 text-sm font-semibold text-white">{error}</p>
            <p className="text-xs text-white/60">
              Streaming providers require permissive CORS. Switch providers below
              or enable a proxy.
            </p>
          </div>
        </div>
      )}

      {/* Title overlay */}
      <div className="pointer-events-none absolute left-0 right-0 top-0 bg-gradient-to-b from-black/70 to-transparent p-4 opacity-0 transition-opacity group-hover:opacity-100">
        <p className="line-clamp-1 text-sm font-semibold text-white">{title}</p>
        <p className="text-xs text-white/60">
          {source.label} · {source.quality} {source.embed ? '(embed)' : ''}
        </p>
      </div>

      {/* Controls */}
      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100 data-[show]:opacity-100">
        {/* Seek bar */}
        <input
          type="range"
          min={0}
          max={duration || 0}
          step={0.1}
          value={current}
          onChange={(e) => seek(Number(e.target.value))}
          className="mb-2 h-1.5 w-full cursor-pointer appearance-none rounded-full bg-white/30 accent-brand-500"
          style={{
            background: `linear-gradient(to right, #3b82f6 ${
              duration ? (current / duration) * 100 : 0
            }%, rgba(255,255,255,0.25) 0)`,
          }}
        />
        <div className="flex items-center gap-2 text-white">
          <button onClick={togglePlay} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
            {playing ? <IconPlayerPauseFilled size={18} /> : <IconPlayerPlayFilled size={18} />}
          </button>
          <button onClick={() => skip(-10)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label="Back 10s">
            <IconRewindBackward10 size={18} />
          </button>
          <button onClick={() => skip(10)} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label="Forward 10s">
            <IconRewindForward10 size={18} />
          </button>
          <button onClick={() => { const v = videoRef.current; if (v) { v.muted = !v.muted; setMuted(v.muted) } }} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15">
            {muted ? <IconVolumeOff size={18} /> : <IconVolume size={18} />}
          </button>
          <span className="ml-1 text-xs tabular-nums text-white/80">
            {secondsToClock(current)} / {secondsToClock(duration)}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <div className="relative">
              <button
                onClick={() => setShowSettings((s) => !s)}
                className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15"
                aria-label="Quality"
                title="Resolution"
              >
                <IconSettings2 size={18} />
              </button>
              {showSettings && (
                <div className="absolute bottom-11 right-0 w-44 overflow-hidden rounded-lg bg-black/90 py-1 text-sm shadow-xl">
                  <p className="px-3 py-1 text-[10px] uppercase tracking-wide text-white/40">
                    Resolution {levels.length === 0 && '(loading…)'}
                  </p>
                  <button
                    onClick={() => handleQuality('auto')}
                    className={cn('block w-full px-3 py-1.5 text-left hover:bg-white/10', currentLevel === -1 && 'text-brand-400')}
                  >
                    Auto (Adaptive)
                  </button>
                  {levels.map((l) => (
                    <button
                      key={l.index}
                      onClick={() => handleQuality(String(l.height))}
                      className={cn('block w-full px-3 py-1.5 text-left hover:bg-white/10', currentLevel === l.index && 'text-brand-400')}
                    >
                      {l.height}p {l.height >= 1080 ? '· FHD' : l.height >= 720 ? '· HD' : ''}
                    </button>
                  ))}
                  </div>
                )}
              </div>
            <button onClick={toggleFullscreen} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/15" aria-label="Fullscreen">
              <IconMaximize size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
