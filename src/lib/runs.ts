import type { Run, Step } from '../schema';

export type RunStatus = Run['status'];

export const RUN_STATUSES: RunStatus[] = ['success', 'failure', 'timeout', 'in_progress'];

/**
 * One `runs` row: everything the run list filters, sorts and shows, without the
 * steps. A run's full trajectory lives in Storage and is fetched only when the
 * run is opened.
 */
export interface RunMeta {
  id: string;
  parentRunId?: string;
  parentStepId?: string;
  depth: number;
  task: string;
  model: string;
  status: RunStatus;
  startedAt: string;
  /** Empty while the run is still in progress, as on `Run`. */
  endedAt: string;
  totalTokens: { input: number; output: number };
  totalCost: number;
  tags: string[];
  stepCount: number;
  hasError: boolean;
  /** Path to this run's trajectory blob in the runs bucket. */
  storageKey: string;
}

export interface RunIndex {
  byId: Map<string, Run>;
  /** Top-level runs (no parent), newest first. These are what the run list shows. */
  roots: Run[];
}

/** The same index over metadata only, plus the parent → children edges. */
export interface MetaIndex {
  byId: Map<string, RunMeta>;
  roots: RunMeta[];
  childrenByParent: Map<string, RunMeta[]>;
}

/** For views that render before anything is hydrated, such as the empty diff. */
export const EMPTY_RUN_INDEX: RunIndex = { byId: new Map(), roots: [] };

const newestFirst = <T extends { startedAt: string }>(a: T, b: T) =>
  Date.parse(b.startedAt) - Date.parse(a.startedAt);

export function indexRuns(runs: Run[]): RunIndex {
  const byId = new Map(runs.map((run) => [run.id, run]));
  const roots = runs.filter((run) => !run.parentRunId).sort(newestFirst);
  return { byId, roots };
}

export function indexMeta(metas: RunMeta[]): MetaIndex {
  const byId = new Map(metas.map((meta) => [meta.id, meta]));
  const roots = metas.filter((meta) => !meta.parentRunId).sort(newestFirst);

  const childrenByParent = new Map<string, RunMeta[]>();
  for (const meta of metas) {
    if (!meta.parentRunId) continue;
    const siblings = childrenByParent.get(meta.parentRunId);
    if (siblings) siblings.push(meta);
    else childrenByParent.set(meta.parentRunId, [meta]);
  }

  return { byId, roots, childrenByParent };
}

/**
 * The given runs plus every run below them. Rendering a timeline, call graph or
 * diff walks into sub-runs, so opening one run needs its whole subtree.
 */
export function subtreeIds(index: MetaIndex, rootIds: string[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  const queue = [...rootIds];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (seen.has(id) || !index.byId.has(id)) continue;
    seen.add(id);
    ids.push(id);
    for (const child of index.childrenByParent.get(id) ?? []) queue.push(child.id);
  }

  return ids;
}

export const isFailedStatus = (status: RunStatus) => status === 'failure' || status === 'timeout';

/** In-progress runs may not have a parseable endedAt yet; measure them up to now. */
export function runDurationMs(run: { startedAt: string; endedAt: string }): number {
  const end = Date.parse(run.endedAt);
  return (Number.isNaN(end) ? Date.now() : end) - Date.parse(run.startedAt);
}

export const stepOffsetMs = (run: Run, step: Step) => Date.parse(step.startedAt) - Date.parse(run.startedAt);

export const sortedSteps = (run: Run) => [...run.steps].sort((a, b) => a.index - b.index);

export const errorCount = (run: Run) => run.steps.filter((s) => s.status === 'error').length;

/** Direct subagents spawned by this run. */
export function subagentCounts(run: Run): { count: number; failed: number } {
  const calls = run.steps.filter((s) => s.type === 'subagent_call' && s.subagentCall);
  return {
    count: calls.length,
    failed: calls.filter((s) => isFailedStatus(s.subagentCall!.status)).length,
  };
}

/** The same counts without the steps: every spawned run is a child row. */
export function metaSubagentCounts(index: MetaIndex, run: RunMeta): { count: number; failed: number } {
  const children = index.childrenByParent.get(run.id) ?? [];
  return {
    count: children.length,
    failed: children.filter((child) => isFailedStatus(child.status)).length,
  };
}

export const childRuns = (index: RunIndex, run: Run): Run[] =>
  sortedSteps(run)
    .map((s) => (s.subagentCall ? index.byId.get(s.subagentCall.subRunId) : undefined))
    .filter((r): r is Run => r !== undefined);

/** The newest run plus, when there is one, an earlier attempt at the same task. */
export function defaultComparison(index: MetaIndex): string[] {
  const [latest] = index.roots;
  if (!latest) return [];
  const previous = index.roots.find((r) => r.id !== latest.id && r.task === latest.task);
  return previous ? [latest.id, previous.id] : [latest.id];
}
