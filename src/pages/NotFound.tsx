import { Link } from 'react-router'
import { IconMoodSad2 } from '@tabler/icons-react'

export function NotFoundPage() {
  return (
    <div className="container-app flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <IconMoodSad2 size={64} className="text-slate-300" />
      <h1 className="text-4xl font-extrabold">404</h1>
      <p className="text-sm text-slate-500">
        This page wandered off into the isekai realm.
      </p>
      <Link to="/" className="btn-primary">
        Back to Home
      </Link>
    </div>
  )
}
