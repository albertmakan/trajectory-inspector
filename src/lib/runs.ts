import type { Run, Step } from '../schema';

export type RunStatus = Run['status'];

export const RUN_STATUSES: RunStatus[] = ['success', 'failure', 'timeout', 'in_progress'];

export interface RunIndex {
  byId: Map<string, Run>;
  /** Top-level runs (no parent), newest first. These are what the run list shows. */
  roots: Run[];
}

export function indexRuns(runs: Run[]): RunIndex {
  const byId = new Map(runs.map((run) => [run.id, run]));
  const roots = runs
    .filter((run) => !run.parentRunId)
    .sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt));
  return { byId, roots };
}

export const isFailedStatus = (status: RunStatus) => status === 'failure' || status === 'timeout';

/** In-progress runs may not have a parseable endedAt yet; measure them up to now. */
export function runDurationMs(run: Run): number {
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

export const childRuns = (index: RunIndex, run: Run): Run[] =>
  sortedSteps(run)
    .map((s) => (s.subagentCall ? index.byId.get(s.subagentCall.subRunId) : undefined))
    .filter((r): r is Run => r !== undefined);

/** The newest run plus, when there is one, an earlier attempt at the same task. */
export function defaultComparison(index: RunIndex): string[] {
  const [latest] = index.roots;
  if (!latest) return [];
  const previous = index.roots.find((r) => r.id !== latest.id && r.task === latest.task);
  return previous ? [latest.id, previous.id] : [latest.id];
}
