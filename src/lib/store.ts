import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { HistoryEntry, LibraryEntry } from '@/types'

type ThemeMode = 'light' | 'dark' | 'system'
type Quality = 'auto' | '1080p' | '720p' | '480p' | '360p'

interface SettingsState {
  theme: ThemeMode
  quality: Quality
  autoplay: boolean
  autoplayNext: boolean
  preferredProvider: string
  /** Cross-device sync token (user-defined) used to namespace localStorage. */
  syncId: string | null
  premium: boolean
  lowLatency: boolean

  setTheme: (t: ThemeMode) => void
  toggleTheme: () => void
  setQuality: (q: Quality) => void
  set: (patch: Partial<Omit<SettingsState, 'setTheme' | 'toggleTheme' | 'setQuality' | 'set'>>) => void
}

export const useSettings = create<SettingsState>()(
  persist(
    (set, get) => ({
      theme: 'dark',
      quality: 'auto',
      autoplay: true,
      autoplayNext: true,
      preferredProvider: 'animeonsen',
      syncId: null,
      premium: true,
      lowLatency: true,

      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set({ theme: get().theme === 'dark' ? 'light' : 'dark' }),
      setQuality: (quality) => set({ quality }),
      set: (patch) => set(patch),
    }),
    {
      name: 'animeq:settings',
      // Allow cross-device sync namespace override.
      partialize: (s) => ({ ...s }),
    },
  ),
)

interface HistoryState {
  items: HistoryEntry[]
  upsert: (entry: HistoryEntry) => void
  remove: (malId: number) => void
  clear: () => void
  get: (malId: number) => HistoryEntry | undefined
}

export const useHistory = create<HistoryState>()(
  persist(
    (set, get) => ({
      items: [],
      upsert: (entry) =>
        set((s) => ({
          items: [
            entry,
            ...s.items.filter((i) => i.malId !== entry.malId),
          ].slice(0, 200),
        })),
      remove: (malId) =>
        set((s) => ({ items: s.items.filter((i) => i.malId !== malId) })),
      clear: () => set({ items: [] }),
      get: (malId) => get().items.find((i) => i.malId === malId),
    }),
    { name: 'animeq:history' },
  ),
)

type LibraryStatus = LibraryEntry['status']

interface LibraryState {
  items: LibraryEntry[]
  toggle: (entry: Omit<LibraryEntry, 'addedAt' | 'status'>, status?: LibraryStatus) => void
  setStatus: (malId: number, status: LibraryStatus) => void
  remove: (malId: number) => void
  has: (malId: number) => boolean
  get: (malId: number) => LibraryEntry | undefined
}

export const useLibrary = create<LibraryState>()(
  persist(
    (set, get) => ({
      items: [],
      toggle: (entry, status = 'planning') =>
        set((s) => {
          const exists = s.items.some((i) => i.malId === entry.malId)
          return {
            items: exists
              ? s.items.filter((i) => i.malId !== entry.malId)
              : [{ ...entry, addedAt: Date.now(), status }, ...s.items],
          }
        }),
      setStatus: (malId, status) =>
        set((s) => ({
          items: s.items.map((i) => (i.malId === malId ? { ...i, status } : i)),
        })),
      remove: (malId) =>
        set((s) => ({ items: s.items.filter((i) => i.malId !== malId) })),
      has: (malId) => get().items.some((i) => i.malId === malId),
      get: (malId) => get().items.find((i) => i.malId === malId),
    }),
    { name: 'animeq:library' },
  ),
)
