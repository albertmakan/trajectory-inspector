import { useEffect, useMemo, useState } from 'react';
import {
  indexMeta,
  indexRuns,
  subtreeIds,
  type MetaIndex,
  type RunIndex,
  type RunMeta,
  type RunStatus,
} from '../lib/runs';
import { RUNS_BUCKET, supabase } from '../lib/supabase';
import type { Run } from '../schema';

/** Bundled sample data, used when no Supabase project is configured. */
export const RUNS_URL = `${import.meta.env.BASE_URL}data/runs.json`;

/** Where the runs on screen came from, for the loading and error screens. */
export const SOURCE_LABEL = supabase ? 'Supabase' : RUNS_URL;

export type MetaState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; index: MetaIndex };

export type SubtreeState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; index: RunIndex };

/** Trajectories already fetched, by run id. Runs are immutable, so this never goes stale. */
const blobs = new Map<string, Run>();

/** A `runs` row as Postgres returns it. */
interface RunRow {
  id: string;
  parent_run_id: string | null;
  parent_step_id: string | null;
  depth: number;
  task: string;
  model: string;
  status: RunStatus;
  started_at: string;
  ended_at: string | null;
  total_tokens_input: number | null;
  total_tokens_output: number | null;
  total_cost: number | null;
  tags: string[] | null;
  step_count: number | null;
  has_error: boolean;
  storage_key: string;
}

const rowToMeta = (row: RunRow): RunMeta => ({
  id: row.id,
  parentRunId: row.parent_run_id ?? undefined,
  parentStepId: row.parent_step_id ?? undefined,
  depth: row.depth,
  task: row.task,
  model: row.model,
  status: row.status,
  startedAt: row.started_at,
  endedAt: row.ended_at ?? '',
  totalTokens: { input: row.total_tokens_input ?? 0, output: row.total_tokens_output ?? 0 },
  totalCost: row.total_cost ?? 0,
  tags: row.tags ?? [],
  stepCount: row.step_count ?? 0,
  hasError: row.has_error,
  storageKey: row.storage_key,
});

/** The same metadata derived from a full trajectory, for the bundled-file fallback. */
const runToMeta = ({ steps, ...rest }: Run): RunMeta => ({
  ...rest,
  stepCount: steps.length,
  hasError: steps.some((s) => s.status === 'error' || s.type === 'error'),
  storageKey: '',
});

async function loadMetaRows(): Promise<RunMeta[]> {
  const { data, error } = await supabase!
    .from('runs')
    .select('*')
    .order('started_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as RunRow[]).map(rowToMeta);
}

/** The fallback loads every trajectory at once, so no run needs fetching later. */
async function loadBundledRuns(signal: AbortSignal): Promise<RunMeta[]> {
  const res = await fetch(RUNS_URL, { signal });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);

  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error('expected a JSON array of runs');

  const runs = data as Run[];
  for (const run of runs) blobs.set(run.id, run);
  return runs.map(runToMeta);
}

/** Metadata for every run — one query, no trajectories. Drives the run list. */
export function useRunMeta(): MetaState {
  const [state, setState] = useState<MetaState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    (supabase ? loadMetaRows() : loadBundledRuns(controller.signal))
      .then((metas) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', index: indexMeta(metas) });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
      });

    return () => controller.abort();
  }, []);

  return state;
}

async function fetchBlob(meta: RunMeta): Promise<Run> {
  if (!supabase) throw new Error(`${meta.id} is not available offline`);

  const { data, error } = await supabase.storage.from(RUNS_BUCKET).download(meta.storageKey);
  if (error) throw new Error(`${meta.storageKey}: ${error.message}`);

  return JSON.parse(await data.text()) as Run;
}

/**
 * Hydrates the given runs and everything they spawned, returning the same
 * `RunIndex` the timeline, call graph and diff already take.
 */
export function useRunSubtree(index: MetaIndex, rootIds: string[]): SubtreeState {
  const key = rootIds.join(',');
  const ids = useMemo(() => subtreeIds(index, key ? key.split(',') : []), [index, key]);
  const [state, setState] = useState<SubtreeState>({ status: 'loading' });

  useEffect(() => {
    const hydrated = () =>
      indexRuns(ids.map((id) => blobs.get(id)).filter((run): run is Run => run !== undefined));

    const missing = ids.filter((id) => !blobs.has(id));
    if (missing.length === 0) {
      setState({ status: 'ready', index: hydrated() });
      return;
    }

    let cancelled = false;
    setState({ status: 'loading' });

    Promise.all(missing.map((id) => fetchBlob(index.byId.get(id)!)))
      .then((runs) => {
        for (const run of runs) blobs.set(run.id, run);
        if (!cancelled) setState({ status: 'ready', index: hydrated() });
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setState({ status: 'error', message: err instanceof Error ? err.message : String(err) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ids, index]);

  return state;
}
