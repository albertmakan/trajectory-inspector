import type { Run, Step } from '../schema';
import type { MetaItem } from '../types';
import { formatCost, inputGist, pad2, preview, shortId, summaryLine } from './format';
import { childRuns, isFailedStatus, runDurationMs, sortedSteps, subagentCounts, type RunIndex } from './runs';

export interface GraphNode {
  key: string;
  parentKey?: string;
  depth: number;
  type: 'agent' | 'tool';
  name: string;
  detail: string;
  /** Offset from the root run's start. */
  startMs: number;
  durationMs: number;
  work: string;
  cost: string;
  failed: boolean;
  /** Failed, and every ancestor up to the root failed too. */
  onFailurePath: boolean;
  /** The error that best explains this node's failure. */
  error?: string;
  /** Id of the root run's step to open in the timeline. */
  jumpTo: string;
}

export interface CallGraph {
  spanMs: number;
  nodes: GraphNode[];
  stats: MetaItem[];
  axis: string[];
  /** Root-to-deepest-failure chain, if the root failed. */
  failurePath: GraphNode[];
}

const lastError = (run: Run) =>
  [...sortedSteps(run)].reverse().find((s) => s.toolResult?.error)?.toolResult?.error;

/**
 * Spawns and failures only: passing tool calls are rolled into each agent's step count.
 */
export function buildCallGraph(root: Run, index: RunIndex): CallGraph {
  const rootStart = Date.parse(root.startedAt);
  const nodes: GraphNode[] = [];

  const visit = (run: Run, parentKey: string | undefined, parentOnPath: boolean, jumpTo: string | undefined, numberPrefix: string) => {
    const steps = sortedSteps(run);
    const failed = isFailedStatus(run.status);
    const onPath = failed && parentOnPath;
    const subs = subagentCounts(run);
    const stepLabel = (step: Step) => (numberPrefix ? `#${numberPrefix}.${step.index}` : `#${pad2(step.index)}`);

    nodes.push({
      key: run.id, parentKey, depth: run.depth, type: 'agent',
      name: shortId(run.id), detail: run.task,
      startMs: Date.parse(run.startedAt) - rootStart, durationMs: runDurationMs(run),
      work: `${steps.length} steps` + (subs.count ? ` · ${subs.count} spawn${subs.count > 1 ? 's' : ''}` : ''),
      cost: formatCost(run.totalCost), failed, onFailurePath: onPath,
      error: failed ? lastError(run) : undefined,
      jumpTo: jumpTo ?? steps[0]?.id ?? '',
    });

    const callsById = new Map(steps.filter((s) => s.type === 'tool_call').map((s) => [s.id, s]));
    for (const step of steps) {
      const error = step.toolResult?.error;
      if (step.type === 'tool_result' && (error || step.status === 'error')) {
        const call = callsById.get(step.toolResult!.toolCallId);
        const start = Date.parse((call ?? step).startedAt);
        nodes.push({
          key: step.id, parentKey: run.id, depth: run.depth + 1, type: 'tool',
          name: call?.toolCall?.toolName ?? 'tool',
          detail: `${preview(inputGist(call?.toolCall?.input), 60)} → ${summaryLine(error ?? 'error')}`,
          startMs: start - rootStart, durationMs: Date.parse(step.startedAt) + step.durationMs - start,
          work: `step ${stepLabel(call ?? step)}`, cost: '—',
          failed: true, onFailurePath: onPath, error,
          jumpTo: jumpTo ?? (call ?? step).id,
        });
      }

      const child = step.subagentCall && index.byId.get(step.subagentCall.subRunId);
      if (child) {
        const prefix = numberPrefix ? `${numberPrefix}.${step.index}` : String(step.index);
        visit(child, run.id, onPath, jumpTo ?? step.id, prefix);
      }
    }
  };

  visit(root, undefined, true, undefined, '');

  const spanMs = runDurationMs(root);
  const byKey = new Map(nodes.map((n) => [n.key, n]));

  // Follow parents up from the deepest node on the failure path (latest wins ties).
  const failurePath: GraphNode[] = [];
  const deepest = nodes.filter((n) => n.onFailurePath).reduce<GraphNode | undefined>(
    (best, n) => (!best || n.depth >= best.depth ? n : best), undefined);
  for (let n = deepest; n; n = n.parentKey ? byKey.get(n.parentKey) : undefined) failurePath.unshift(n);

  const agents = nodes.filter((n) => n.type === 'agent');
  const children = childRuns(index, root);
  const childMs = children.reduce((sum, r) => sum + runDurationMs(r), 0);
  const childCost = children.reduce((sum, r) => sum + r.totalCost, 0);
  const pct = (part: number, whole: number) => (whole > 0 ? Math.round((part / whole) * 100) : 0);
  const seconds = (ms: number) => `${(ms / 1000).toFixed(1)}s`;

  const stats: MetaItem[] = [
    { k: 'AGENTS', v: `${agents.length} (1 root + ${agents.length - 1} spawned)` },
    { k: 'MAX DEPTH', v: String(Math.max(...agents.map((n) => n.depth))) },
    { k: 'FAILED SUBTREES', v: `${children.filter((r) => isFailedStatus(r.status)).length} of ${children.length}` },
    {
      k: 'DEEPEST FAILURE',
      v: deepest && failurePath.length > 1
        ? `d${deepest.depth} · ${failurePath.slice(1).map((n) => n.name).join(' ▸ ')}`
        : 'none',
    },
    { k: 'TIME IN SUBAGENTS', v: `${seconds(childMs)} of ${seconds(spanMs)} (${pct(childMs, spanMs)}%)` },
    { k: 'COST IN SUBAGENTS', v: `${formatCost(childCost)} of ${formatCost(root.totalCost)} (${pct(childCost, root.totalCost)}%)` },
  ];

  const axis = [0, 0.25, 0.5, 0.75, 1].map((f) => `${Math.round((spanMs * f) / 1000)}s`);

  return { spanMs, nodes, stats, axis, failurePath };
}
