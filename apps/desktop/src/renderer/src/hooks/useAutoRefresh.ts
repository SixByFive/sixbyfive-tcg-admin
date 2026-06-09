import { useEffect, useRef } from 'react'

/**
 * Calls `callback` on a fixed interval while the component is mounted.
 * The callback ref is kept up-to-date so stale closures are never a problem.
 *
 * @param callback  Function to call — must be stable (useCallback) or the ref handles it.
 * @param intervalMs  Polling interval in milliseconds (default 30 s).
 */
export function useAutoRefresh(callback: () => void, intervalMs = 30_000): void {
  const ref = useRef(callback)
  ref.current = callback

  useEffect(() => {
    const timer = setInterval(() => ref.current(), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
}
