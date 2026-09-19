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
import { DEMO_PROJECT, RUNS_BUCKET, RUNS_PROJECT, supabase } from '../lib/supabase';
import type { Run } from '../schema';

/** Bundled sample data, used when no Supabase project is configured. */
export const RUNS_URL = `${import.meta.env.BASE_URL}data/runs.json`;

/**
 * Where the runs on screen came from, for the loading and error screens.
 *
 * Reassigned when a Supabase read fails and the bundled file takes over, so the
 * screens name the source that actually served the data. Module exports are live
 * bindings, so importers see the new value.
 */
export let SOURCE_LABEL = supabase ? 'Supabase' : RUNS_URL;

const errorMessage = (err: unknown) => (err instanceof Error ? err.message : String(err));

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
  project: string;
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
  // RLS already restricts `anon` to the demo project; filtering here as well
  // keeps the scope visible at the call site and covers a widened policy later.
  const { data, error } = await supabase!
    .from('runs')
    .select('*')
    .eq('project', RUNS_PROJECT)
    .order('started_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data as RunRow[]).map(rowToMeta);
}

async function fetchBundled(): Promise<Run[]> {
  const res = await fetch(RUNS_URL);
  if (!res.ok) throw new Error(`${RUNS_URL}: ${res.status} ${res.statusText}`);

  const data: unknown = await res.json();
  if (!Array.isArray(data)) throw new Error(`${RUNS_URL}: expected a JSON array of runs`);

  // Scoped the same way as the Supabase path. The bundled file predates the
  // project column, so runs without one count as demo data.
  return (data as Run[]).filter((run) => (run.project ?? DEMO_PROJECT) === RUNS_PROJECT);
}

/**
 * The bundled dataset, fetched at most once and shared by every caller.
 *
 * Deliberately takes no AbortSignal: the promise is shared, so one unmounting
 * consumer must not cancel it for the rest. Callers already discard the result
 * when they've aborted.
 */
let bundled: Promise<Run[]> | null = null;

function bundledRuns(): Promise<Run[]> {
  if (!bundled) {
    bundled = fetchBundled().catch((err: unknown) => {
      bundled = null; // one failed fetch shouldn't poison every later attempt
      throw err;
    });
  }
  return bundled;
}

/** The fallback loads every trajectory at once, so no run needs fetching later. */
async function loadBundledMeta(): Promise<RunMeta[]> {
  const runs = await bundledRuns();
  for (const run of runs) blobs.set(run.id, run);
  SOURCE_LABEL = RUNS_URL;
  return runs.map(runToMeta);
}

/**
 * Supabase first, the bundled file if it fails.
 *
 * Free Supabase projects pause after a stretch of inactivity — exactly what a
 * demo link that sat idle for a week hits on the first click. Falling back keeps
 * the deployed app readable instead of dead-ending on an error screen. The warn
 * is what keeps a genuine outage diagnosable rather than silently masked.
 */
async function loadMeta(): Promise<RunMeta[]> {
  if (!supabase) return loadBundledMeta();

  try {
    return await loadMetaRows();
  } catch (err) {
    console.warn(`Supabase read failed — falling back to ${RUNS_URL}`, err);
    try {
      return await loadBundledMeta();
    } catch (fallbackErr) {
      throw new Error(
        `${errorMessage(err)} (bundled fallback also failed: ${errorMessage(fallbackErr)})`,
      );
    }
  }
}

/** Metadata for every run — one query, no trajectories. Drives the run list. */
export function useRunMeta(): MetaState {
  const [state, setState] = useState<MetaState>({ status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    loadMeta()
      .then((metas) => {
        if (controller.signal.aborted) return;
        setState({ status: 'ready', index: indexMeta(metas) });
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: 'error', message: errorMessage(err) });
      });

    return () => controller.abort();
  }, []);

  return state;
}

async function fetchBlob(meta: RunMeta): Promise<Run> {
  // storageKey is empty on metadata derived from the bundled file, which has no
  // Storage object behind it.
  if (supabase && meta.storageKey) {
    const { data, error } = await supabase.storage.from(RUNS_BUCKET).download(meta.storageKey);
    if (!error) return JSON.parse(await data.text()) as Run;

    console.warn(`${meta.storageKey}: ${error.message} — falling back to ${RUNS_URL}`);
  }

  // Storage just failed, or there is no project configured: the bundled file is
  // the only other place a trajectory can come from.
  const run = (await bundledRuns()).find((r) => r.id === meta.id);
  if (!run) throw new Error(`${meta.id} is not in ${RUNS_URL}`);

  return run;
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
          setState({ status: 'error', message: errorMessage(err) });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [ids, index]);

  return state;
}
