import type { Run } from '../schema';
import { inputGist, pad2, preview, statusWord } from './format';
import type { RunIndex } from './runs';
import {
  buildTimeline, itemHasError, itemIndex, subagentStatus, toolInput, toolName, toolOutput, type TimelineItem,
} from './timeline';

export type DiffState = 'same' | 'diff' | 'err' | 'gap';

export interface DiffSide {
  kind: string;
  text: string;
  state: DiffState;
}

export interface DiffRow {
  key: string;
  n: string;
  left: DiffSide;
  right: DiffSide;
}

export interface RunDiff {
  rows: DiffRow[];
  summary: string;
}

/** Items align when they are the same kind of action (same tool, for tool calls). */
const signature = (item: TimelineItem) => (item.kind === 'tool' ? `tool:${toolName(item)}` : item.kind);

const kindLabel = (item: TimelineItem) =>
  item.kind === 'model' ? 'MODEL' : item.kind === 'tool' ? toolName(item) : item.kind === 'agent' ? 'SUBAGENT' : 'ERROR';

/** Last meaningful line of tool output, which is usually the verdict ("2 passed", "[read 118 lines]"). */
function outcomeLine(output: string): string {
  const lines = output.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('exit_code'));
  return lines[lines.length - 1] ?? '';
}

function describe(item: TimelineItem): string {
  switch (item.kind) {
    case 'model':
      return item.step.modelTurn?.text ?? item.step.modelTurn?.reasoning ?? '';
    case 'tool': {
      const outcome = outcomeLine(toolOutput(item));
      return `${preview(inputGist(item.call?.toolCall?.input), 70)}${outcome ? ` → ${outcome}` : ''}`;
    }
    case 'agent':
      return `${item.step.subagentCall?.task ?? ''} → ${statusWord(subagentStatus(item))}`;
    case 'error':
      return 'error';
  }
}

/** Full comparable content, so identical-looking previews with different payloads still count as diverged. */
function content(item: TimelineItem): string {
  switch (item.kind) {
    case 'model': return JSON.stringify([item.step.modelTurn?.text, item.step.modelTurn?.reasoning]);
    case 'tool': return JSON.stringify([toolName(item), toolInput(item), toolOutput(item)]);
    case 'agent': return JSON.stringify([item.step.subagentCall?.task, subagentStatus(item)]);
    case 'error': return 'error';
  }
}

/** Longest-common-subsequence alignment on item signatures. */
function align(a: TimelineItem[], b: TimelineItem[]): [TimelineItem | undefined, TimelineItem | undefined][] {
  const ka = a.map(signature);
  const kb = b.map(signature);
  const lcs = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lcs[i][j] = ka[i] === kb[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }

  const pairs: [TimelineItem | undefined, TimelineItem | undefined][] = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (ka[i] === kb[j]) pairs.push([a[i++], b[j++]]);
    else if (lcs[i + 1][j] >= lcs[i][j + 1]) pairs.push([a[i++], undefined]);
    else pairs.push([undefined, b[j++]]);
  }
  while (i < a.length) pairs.push([a[i++], undefined]);
  while (j < b.length) pairs.push([undefined, b[j++]]);
  return pairs;
}

const GAP: DiffSide = { kind: '', text: '', state: 'gap' };

function side(item: TimelineItem | undefined, identical: boolean): DiffSide {
  if (!item) return GAP;
  const state: DiffState = itemHasError(item) ? 'err' : identical ? 'same' : 'diff';
  return { kind: kindLabel(item), text: describe(item), state };
}

const outcomeSide = (run: Run, same: boolean): DiffSide => ({
  kind: 'OUTCOME',
  text: `${statusWord(run.status)} · ${run.steps.length} steps`,
  state: same ? 'same' : 'diff',
});

export function diffRuns(left: Run, right: Run, index: RunIndex): RunDiff {
  const rows: DiffRow[] = align(buildTimeline(left, index), buildTimeline(right, index)).map(([l, r]) => {
    const identical = !!l && !!r && content(l) === content(r);
    return {
      key: `${l?.key ?? '-'}:${r?.key ?? '-'}`,
      n: `#${pad2(itemIndex((l ?? r)!))}`,
      left: side(l, identical),
      right: side(r, identical),
    };
  });

  const sameOutcome = left.status === right.status;
  rows.push({ key: 'outcome', n: 'END', left: outcomeSide(left, sameOutcome), right: outcomeSide(right, sameOutcome) });

  const firstDivergence = rows.find((row) => row.left.state !== 'same' || row.right.state !== 'same');
  const diverged = rows.filter((row) => row.left.state === 'diff' || row.right.state === 'diff').length;
  const withErrors = rows.filter((row) => row.left.state === 'err' || row.right.state === 'err').length;
  const unmatched = rows.filter((row) => row.left.state === 'gap' || row.right.state === 'gap').length;

  const summary = firstDivergence
    ? `first divergence at ${firstDivergence.n} · ${diverged} diverged · ${withErrors} with errors · ${unmatched} unmatched`
    : 'identical step for step';

  return { rows, summary };
}
