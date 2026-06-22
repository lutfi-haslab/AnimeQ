import { IconBrandGithub, IconHeart } from '@tabler/icons-react'
import { Link } from 'react-router'
import { GENRES } from '@/lib/constants'

export function Footer() {
  return (
    <footer className="mt-16 border-t border-black/5 bg-white/50 dark:border-surface-border dark:bg-surface/40">
      <div className="container-app grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <h4 className="mb-3 text-sm font-bold">AnimeQ</h4>
          <p className="text-xs leading-relaxed text-slate-500">
            A premium, ad-free anime streaming experience with offline viewing,
            HD playback and low-latency global streaming for premium members.
          </p>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold">Explore</h4>
          <ul className="space-y-2 text-sm text-slate-500">
            <li><Link to="/browse" className="hover:text-brand-500">Browse</Link></li>
            <li><Link to="/schedule" className="hover:text-brand-500">Airing Schedule</Link></li>
            <li><Link to="/search" className="hover:text-brand-500">Search</Link></li>
            <li><Link to="/library" className="hover:text-brand-500">My Library</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold">Top Genres</h4>
          <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-500">
            {GENRES.slice(0, 8).map((g) => (
              <li key={g.id}>
                <Link to={`/browse?genres=${g.id}`} className="hover:text-brand-500">
                  {g.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-bold">Data</h4>
          <ul className="space-y-2 text-xs text-slate-500">
            <li>MyAnimeList (Jikan API)</li>
            <li>animeschedule.net</li>
            <li>YouTube (Trailers)</li>
            <li>
              <span className="inline-flex items-center gap-1">
                Built with <IconHeart size={12} className="text-red-500" fill="currentColor" />
              </span>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-black/5 py-4 dark:border-surface-border">
        <div className="container-app flex flex-col items-center justify-between gap-2 text-xs text-slate-500 sm:flex-row">
          <p>© {new Date().getFullYear()} AnimeQ. For educational use.</p>
          <a
            href="https://github.com"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 hover:text-brand-500"
          >
            <IconBrandGithub size={14} /> Source
          </a>
        </div>
      </div>
    </footer>
  )
}
