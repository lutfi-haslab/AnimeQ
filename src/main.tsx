import { StrictMode, lazy, Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider, createBrowserRouter } from 'react-router'
import { RootLayout } from '@/components/layout/RootLayout'
import { LoadingScreen } from '@/components/ui/Feedback'
import './index.css'

const HomePage = lazy(() =>
  import('@/pages/Home').then((m) => ({ default: m.HomePage })),
)
const BrowsePage = lazy(() =>
  import('@/pages/Browse').then((m) => ({ default: m.BrowsePage })),
)
const SearchPage = lazy(() =>
  import('@/pages/Search').then((m) => ({ default: m.SearchPage })),
)
const AnimeDetailPage = lazy(() =>
  import('@/pages/AnimeDetail').then((m) => ({ default: m.AnimeDetailPage })),
)
const WatchPage = lazy(() =>
  import('@/pages/Watch').then((m) => ({ default: m.WatchPage })),
)
const SchedulePage = lazy(() =>
  import('@/pages/Schedule').then((m) => ({ default: m.SchedulePage })),
)
const LibraryPage = lazy(() =>
  import('@/pages/Library').then((m) => ({ default: m.LibraryPage })),
)
const SettingsPage = lazy(() =>
  import('@/pages/Settings').then((m) => ({ default: m.SettingsPage })),
)
const NotFoundPage = lazy(() =>
  import('@/pages/NotFound').then((m) => ({ default: m.NotFoundPage })),
)

const withSuspense = (node: React.ReactNode) => (
  <Suspense fallback={<LoadingScreen label="Loading…" />}>{node}</Suspense>
)

const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <RootLayout />,
    children: [
      { index: true, element: withSuspense(<HomePage />) },
      { path: 'browse', element: withSuspense(<BrowsePage />) },
      { path: 'search', element: withSuspense(<SearchPage />) },
      { path: 'anime/:id', element: withSuspense(<AnimeDetailPage />) },
      { path: 'watch/:id', element: withSuspense(<WatchPage />) },
      { path: 'watch/:id/:episode', element: withSuspense(<WatchPage />) },
      { path: 'schedule', element: withSuspense(<SchedulePage />) },
      { path: 'library', element: withSuspense(<LibraryPage />) },
      { path: 'settings', element: withSuspense(<SettingsPage />) },
      { path: '*', element: withSuspense(<NotFoundPage />) },
    ],
  },
])

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
)
