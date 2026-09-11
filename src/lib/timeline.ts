import type { Run, Step } from '../schema';
import { errorLabel, formatPayload } from './format';
import { isFailedStatus, sortedSteps, type RunIndex, type RunStatus } from './runs';

export interface ModelItem { kind: 'model'; key: string; step: Step }
/** A tool call with its result. Either side can be missing: a call still running, or an orphaned result. */
export interface ToolItem { kind: 'tool'; key: string; call?: Step; result?: Step }
export interface AgentItem { kind: 'agent'; key: string; step: Step; run?: Run }
export interface ErrorItem { kind: 'error'; key: string; step: Step }
export type TimelineItem = ModelItem | ToolItem | AgentItem | ErrorItem;

/** Groups a run's steps into renderable items, pairing each tool_call with its tool_result. */
export function buildTimeline(run: Run, index: RunIndex): TimelineItem[] {
  const resultByCallId = new Map<string, Step>();
  const callIds = new Set<string>();
  for (const step of run.steps) {
    if (step.type === 'tool_result' && step.toolResult) resultByCallId.set(step.toolResult.toolCallId, step);
    if (step.type === 'tool_call') callIds.add(step.id);
  }

  const items: TimelineItem[] = [];
  for (const step of sortedSteps(run)) {
    switch (step.type) {
      case 'model_turn':
        items.push({ kind: 'model', key: step.id, step });
        break;
      case 'tool_call':
        items.push({ kind: 'tool', key: step.id, call: step, result: resultByCallId.get(step.id) });
        break;
      case 'tool_result':
        if (!step.toolResult || !callIds.has(step.toolResult.toolCallId)) {
          items.push({ kind: 'tool', key: step.id, result: step });
        }
        break;
      case 'subagent_call':
        items.push({
          kind: 'agent', key: step.id, step,
          run: step.subagentCall ? index.byId.get(step.subagentCall.subRunId) : undefined,
        });
        break;
      case 'error':
        items.push({ kind: 'error', key: step.id, step });
        break;
    }
  }
  return items;
}

export const itemSteps = (item: TimelineItem): Step[] =>
  item.kind === 'tool' ? [item.call, item.result].filter((s): s is Step => s !== undefined) : [item.step];

export const itemIndex = (item: TimelineItem) => itemSteps(item)[0].index;

export const itemHasError = (item: TimelineItem) => itemSteps(item).some((s) => s.status === 'error');

// ── tool items ───────────────────────────────────────────────────

export const toolName = (item: ToolItem) => item.call?.toolCall?.toolName ?? 'tool';

export const toolInput = (item: ToolItem) => formatPayload(item.call?.toolCall?.input);

export const toolError = (item: ToolItem) => item.result?.toolResult?.error;

/** What to show for the result row: the error if there is one, otherwise the output. */
export const toolOutput = (item: ToolItem) => toolError(item) ?? formatPayload(item.result?.toolResult?.output);

export function toolStatusLabel(item: ToolItem): string {
  const error = toolError(item);
  if (error) return errorLabel(error);
  if (item.result?.status === 'error') return 'ERROR';
  return item.result ? 'OK' : 'PENDING';
}

// ── subagent items ───────────────────────────────────────────────

export function subagentStatus(item: AgentItem): RunStatus {
  return item.step.subagentCall?.status ?? item.run?.status ?? 'in_progress';
}

/**
 * What the subagent handed back: its final model output when it succeeded,
 * otherwise the last error it hit.
 */
export function subagentReturn(item: AgentItem): string {
  const steps = item.run ? [...sortedSteps(item.run)].reverse() : [];
  const lastText = steps.find((s) => s.modelTurn?.text)?.modelTurn?.text;
  const lastError = steps.find((s) => s.toolResult?.error)?.toolResult?.error;
  const text = isFailedStatus(subagentStatus(item)) ? lastError ?? lastText : lastText;
  return text ?? 'no output captured';
}
