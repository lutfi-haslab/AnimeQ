import { IconBrandYoutube, IconX } from '@tabler/icons-react'

export function TrailerPlayer({
  youtubeId,
  title,
  onClose,
}: {
  youtubeId: string
  title: string
  onClose: () => void
}) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur animate-fade-in"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-5xl overflow-hidden rounded-xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="aspect-video w-full">
          <iframe
            className="h-full w-full"
            src={`https://www.youtube-nocookie.com/embed/${youtubeId}?autoplay=1&rel=0&modestbranding=1`}
            title={`${title} trailer`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        </div>
        <button
          onClick={onClose}
          className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
          aria-label="Close trailer"
        >
          <IconX size={18} />
        </button>
        <div className="flex items-center gap-2 bg-black px-4 py-2 text-xs text-white/70">
          <IconBrandYoutube size={14} className="text-red-500" />
          Trailer via YouTube
        </div>
      </div>
    </div>
  )
}
