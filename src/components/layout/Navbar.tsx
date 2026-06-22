import { useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router'
import {
  IconHome,
  IconCompass,
  IconSearch,
  IconCalendar,
  IconBookmark,
  IconSettings,
  IconMenu2,
  IconX,
  IconSun,
  IconMoon,
} from '@tabler/icons-react'
import { Logo } from '@/components/ui/Logo'
import { useSettings } from '@/lib/store'
import { cn } from '@/lib/utils'

const NAV = [
  { to: '/', label: 'Home', icon: IconHome, end: true },
  { to: '/browse', label: 'Browse', icon: IconCompass },
  { to: '/schedule', label: 'Schedule', icon: IconCalendar },
  { to: '/library', label: 'My Library', icon: IconBookmark },
  { to: '/settings', label: 'Settings', icon: IconSettings },
]

export function Navbar() {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const navigate = useNavigate()
  const location = useLocation()
  const theme = useSettings((s) => s.theme)
  const toggleTheme = useSettings((s) => s.toggleTheme)

  function submitSearch(e: React.FormEvent) {
    e.preventDefault()
    const term = q.trim()
    if (term) {
      navigate(`/search?q=${encodeURIComponent(term)}`)
      setOpen(false)
    }
  }

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-xl dark:border-surface-border dark:bg-surface/80">
      <div className="container-app flex h-16 items-center gap-3">
        {/* Mobile menu */}
        <button
          className="btn-ghost -ml-2 px-2 lg:hidden"
          aria-label="Menu"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <IconX size={22} /> : <IconMenu2 size={22} />}
        </button>

        <Link to="/" className="shrink-0">
          <Logo />
        </Link>

        {/* Desktop nav */}
        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-surface-card',
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Search */}
        <form onSubmit={submitSearch} className="relative ml-auto hidden max-w-sm flex-1 sm:block">
          <IconSearch
            size={18}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search anime, genres…"
            className="input pl-10"
            type="search"
          />
        </form>

        <div className="flex items-center gap-1">
          <button
            onClick={toggleTheme}
            className="btn-ghost px-2"
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === 'dark' ? <IconSun size={20} /> : <IconMoon size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <div className="border-t border-black/5 bg-white px-4 py-3 dark:border-surface-border dark:bg-surface lg:hidden">
          <form onSubmit={submitSearch} className="relative mb-3">
            <IconSearch
              size={18}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search anime…"
              className="input pl-10"
              type="search"
              autoFocus
            />
          </form>
          <nav className="grid gap-1" onClick={() => setOpen(false)}>
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium',
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400'
                      : 'text-slate-700 dark:text-slate-200',
                  )
                }
              >
                <item.icon size={20} />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
      <input type="hidden" value={location.pathname} readOnly />
    </header>
  )
}
