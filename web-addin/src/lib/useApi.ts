import { useCallback, useEffect, useState } from "react";
import { apiGet, ApiError } from "./api";

export type UseApiResult<T> = {
  data: T | null;
  error: string | null;
  loading: boolean;
  refetch: () => void;
};

/**
 * Fetch wrapper hook for the addin dashboard.
 *
 * - `data` reflects the most recent successful response; it persists across
 *   refetches until a new success arrives.
 * - `error` reflects the most recent failed response; cleared at the start
 *   of every fetch attempt and only set on failure.
 * - `loading` is true only between mount and the first response (success
 *   or failure). Subsequent refetches do NOT toggle `loading` — `data`
 *   stays populated so consumers can render stale-while-revalidating UX.
 * - `refetch()` re-runs the fetch with the same path; useful for action
 *   responses (e.g. capture/dismiss) that should refresh the panel.
 *
 * Re-fetches automatically when `path` changes (e.g. AuditTab updates
 * `?actor=` or `?limit=`). Use `refetch()` for manual triggers.
 */
export function useApi<T>(path: string): UseApiResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refetch = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    // Reset error so a successful refetch clears a previous failure,
    // but DO NOT reset `data` or `loading`: a refetch should keep
    // showing the previous data until the new response arrives.
    setError(null);
    apiGet<T>(path)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError ? e.message : String(e));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  return { data, error, loading, refetch };
}
