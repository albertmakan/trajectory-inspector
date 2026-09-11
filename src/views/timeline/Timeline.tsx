import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { Chip } from '../../components/Chip';
import { MetaStrip } from '../../components/MetaStrip';
import { cx } from '../../lib/cx';
import {
  formatCost, formatRunDuration, formatTimestamp, formatTokensCompact, shortId, statusWord,
} from '../../lib/format';
import { errorCount, runDurationMs, subagentCounts, type RunIndex, type RunStatus } from '../../lib/runs';
import { buildTimeline, itemHasError, type TimelineItem } from '../../lib/timeline';
import type { Run } from '../../schema';
import type { MetaItem } from '../../types';
import { disclosureKey, type Disclosure, type OpenState } from './disclosure';
import { ErrorStep } from './ErrorStep';
import { ModelTurn } from './ModelTurn';
import { StepMap } from './StepMap';
import { SubagentCall } from './SubagentCall';
import { ToolCall } from './ToolCall';

export type StepFilter = 'all' | 'model' | 'tools' | 'agents' | 'errors';

const FILTERS: { key: StepFilter; label: string }[] = [
  { key: 'all', label: 'all' },
  { key: 'model', label: 'model turns' },
  { key: 'tools', label: 'tool calls' },
  { key: 'agents', label: 'subagents' },
  { key: 'errors', label: 'errors' },
];

const END_LABEL: Record<RunStatus, string> = {
  success: 'RUN COMPLETED',
  failure: 'RUN FAILED',
  timeout: 'RUN TIMED OUT',
  in_progress: 'RUN IN PROGRESS',
};

function filterCounts(run: Run): Record<StepFilter, number> {
  const count = (types: string[]) => run.steps.filter((s) => types.includes(s.type)).length;
  return {
    all: run.steps.length,
    model: count(['model_turn']),
    tools: count(['tool_call', 'tool_result']),
    agents: count(['subagent_call']),
    errors: errorCount(run),
  };
}

function matchesFilter(item: TimelineItem, filter: StepFilter): boolean {
  switch (filter) {
    case 'all': return true;
    case 'model': return item.kind === 'model';
    case 'tools': return item.kind === 'tool';
    case 'agents': return item.kind === 'agent';
    case 'errors': return itemHasError(item);
  }
}

/** Sets every disclosure in the run, including those inside nested sub-runs. */
function setAll(items: TimelineItem[], index: RunIndex, value: boolean, into: OpenState = {}): OpenState {
  for (const item of items) {
    if (item.kind === 'tool') {
      into[disclosureKey.call(item.key)] = value;
      into[disclosureKey.result(item.key)] = value;
      into[disclosureKey.nested(item.key)] = value;
    } else if (item.kind === 'agent') {
      into[disclosureKey.agent(item.key)] = value;
      if (item.run) setAll(buildTimeline(item.run, index), index, value, into);
    }
  }
  return into;
}

interface TimelineProps {
  run: Run;
  index: RunIndex;
  filter: StepFilter;
  onFilterChange: (filter: StepFilter) => void;
  open: OpenState;
  onOpenChange: Dispatch<SetStateAction<OpenState>>;
  expandToolPayloads: boolean;
  showReasoning: boolean;
}

export function Timeline({ run, index, filter, onFilterChange, open, onOpenChange, expandToolPayloads, showReasoning }: TimelineProps) {
  const items = useMemo(() => buildTimeline(run, index), [run, index]);
  const counts = filterCounts(run);
  const errors = counts.errors;
  const subs = subagentCounts(run);
  const durationMs = runDurationMs(run);

  const disclosure: Disclosure = {
    isOpen: (key, fallback) => open[key] ?? fallback,
    toggle: (key, fallback) => onOpenChange((prev) => ({ ...prev, [key]: !(prev[key] ?? fallback) })),
  };

  const meta: MetaItem[] = [
    { k: 'RUN', v: shortId(run.id) },
    { k: 'MODEL', v: run.model },
    { k: 'STARTED', v: formatTimestamp(run.startedAt) },
    { k: 'DURATION', v: formatRunDuration(durationMs) },
    { k: 'STEPS', v: `${run.steps.length} (${errors} errors)` },
    { k: 'SUBAGENTS', v: `${subs.count} (${subs.failed} failed)` },
    { k: 'TOKENS', v: formatTokensCompact(run.totalTokens) },
    { k: 'COST', v: formatCost(run.totalCost) },
    { k: 'TAGS', v: run.tags.join(' · ') || '—' },
  ];

  return (
    <div className="timeline">
      <div className="timeline__main">
        <section className="run-head">
          <div className="run-head__title-row">
            <span className={cx('run-head__badge', `run-head__badge--${run.status}`)}>{statusWord(run.status)}</span>
            <span className="run-head__title">{run.task}</span>
          </div>
          <MetaStrip items={meta} className="run-head__meta" />
        </section>

        <div className="timeline-toolbar">
          <span className="label">FILTER</span>
          <div className="chip-group">
            {FILTERS.map((f) => (
              <Chip key={f.key} active={filter === f.key} onClick={() => onFilterChange(f.key)}>
                {f.label} <span className="chip__count">{counts[f.key]}</span>
              </Chip>
            ))}
          </div>
          <div className="spacer" />
          <button type="button" className="ghost-btn" onClick={() => onOpenChange(setAll(items, index, true))}>
            expand all
          </button>
          <button type="button" className="ghost-btn" onClick={() => onOpenChange(setAll(items, index, false))}>
            collapse all
          </button>
        </div>

        <div className="steps">
          {items.filter((item) => matchesFilter(item, filter)).map((item) => {
            switch (item.kind) {
              case 'model':
                return <ModelTurn key={item.key} item={item} run={run} showReasoning={showReasoning} />;
              case 'tool':
                return <ToolCall key={item.key} item={item} disclosure={disclosure} expandByDefault={expandToolPayloads} />;
              case 'agent':
                return <SubagentCall key={item.key} item={item} index={index} disclosure={disclosure} />;
              case 'error':
                return <ErrorStep key={item.key} item={item} />;
            }
          })}

          <div className={cx('run-end', `run-end--${run.status}`)}>
            <span className="run-end__label">{END_LABEL[run.status]}</span>
            <span className="run-end__text">
              {formatRunDuration(durationMs)} · {run.steps.length} steps · {errors} errors
            </span>
          </div>
        </div>
      </div>

      <StepMap items={items} />
    </div>
  );
}
