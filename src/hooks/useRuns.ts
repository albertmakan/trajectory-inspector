import { useEffect, useState } from 'react';
import type { Run } from '../schema';

export type RunsState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; runs: Run[] };

/** Flat list of every run, sub-runs included; the single source of truth for all views. */
export const RUNS_URL = `${import.meta.env.BASE_URL}data/runs.json`;

export function useRuns(url = RUNS_URL): RunsState {
  const [state, setState] = useState<RunsState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    fetch(url, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error('expected a JSON array of runs');
        setState({ status: 'ready', runs: data as Run[] });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });
    return () => controller.abort();
  }, [url]);

  return state;
}
