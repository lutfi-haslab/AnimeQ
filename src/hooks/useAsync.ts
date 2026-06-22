import { useCallback, useEffect, useRef, useState } from 'react'

interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  error: Error | undefined
}

/**
 * Generic async data hook with abort + dependency refetch.
 * Returns memoized `refetch` so callers can retry.
 */
export function useAsync<T>(
  factory: (signal: AbortSignal) => Promise<T>,
  deps: unknown[],
): AsyncState<T> & { refetch: () => void } {
  const [state, setState] = useState<AsyncState<T>>({
    data: undefined,
    loading: true,
    error: undefined,
  })
  const [nonce, setNonce] = useState(0)
  const factoryRef = useRef(factory)
  factoryRef.current = factory

  useEffect(() => {
    const controller = new AbortController()
    let active = true
    setState((s) => ({ ...s, loading: true, error: undefined }))
    factoryRef
      .current(controller.signal)
      .then((data) => {
        if (active) setState({ data, loading: false, error: undefined })
      })
      .catch((err: unknown) => {
        if (active && err instanceof Error && err.name !== 'AbortError') {
          setState({ data: undefined, loading: false, error: err })
        }
      })
    return () => {
      active = false
      controller.abort()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce])

  const refetch = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, refetch }
}
