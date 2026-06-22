export function DetailSkeleton() {
  return (
    <div className="animate-fade-in">
      {/* Backdrop */}
      <div className="skeleton h-72 w-full rounded-none sm:h-80" />
      <div className="container-app -mt-40 relative">
        <div className="flex flex-col gap-6 sm:flex-row">
          {/* Poster */}
          <div className="mx-auto w-44 shrink-0 sm:mx-0 sm:w-56">
            <div className="skeleton aspect-[2/3] w-full rounded-xl" />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="skeleton col-span-2 h-10 rounded-lg" />
              <div className="skeleton h-10 rounded-lg" />
              <div className="skeleton h-10 rounded-lg" />
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 space-y-3 pt-8 sm:pt-20">
            <div className="skeleton h-9 w-3/4 rounded-lg" />
            <div className="skeleton h-4 w-1/3 rounded" />
            <div className="flex gap-2 pt-1">
              <div className="skeleton h-7 w-20 rounded-lg" />
              <div className="skeleton h-7 w-24 rounded-lg" />
              <div className="skeleton h-7 w-28 rounded-lg" />
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="skeleton h-6 w-16 rounded-full" />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-2 sm:grid-cols-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="skeleton h-14 rounded-lg" />
              ))}
            </div>
            <div className="space-y-2 pt-2">
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-full rounded" />
              <div className="skeleton h-4 w-5/6 rounded" />
              <div className="skeleton h-4 w-2/3 rounded" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export function PlayerSkeleton() {
  return (
    <div className="container-app py-5 animate-fade-in">
      <div className="skeleton mb-3 h-4 w-48 rounded" />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <div className="skeleton aspect-video w-full rounded-xl" />
          <div className="flex items-center justify-between">
            <div className="space-y-2">
              <div className="skeleton h-5 w-48 rounded" />
              <div className="skeleton h-3 w-24 rounded" />
            </div>
            <div className="flex gap-2">
              <div className="skeleton h-9 w-24 rounded-lg" />
              <div className="skeleton h-9 w-24 rounded-lg" />
            </div>
          </div>
          <div className="skeleton h-32 w-full rounded-xl" />
        </div>
        <div className="space-y-3">
          <div className="skeleton h-64 w-full rounded-xl" />
          <div className="skeleton h-32 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
