import { useEffect, useRef, useState } from 'react';
import { Header } from './components/Header';
import { scrollToStep } from './lib/dom';
import { shortId } from './lib/format';
import { defaultComparison, type RunIndex } from './lib/runs';
import type { Run } from './schema';
import type { View } from './types';
import { CallGraph } from './views/CallGraph';
import { RunDiff } from './views/RunDiff';
import { INITIAL_RUN_FILTERS, RunList, type RunFilters } from './views/RunList';
import type { OpenState } from './views/timeline/disclosure';
import { Timeline, type StepFilter } from './views/timeline/Timeline';

export interface InspectorOptions {
  /** Tab shown on first load. */
  initialView?: View;
  /** Open every tool call and result payload by default (errors always start open). */
  expandToolPayloads?: boolean;
  /** Show captured model reasoning above each turn's visible text. */
  showReasoning?: boolean;
}

export function Inspector({ index, initialView = 'runs', expandToolPayloads = false, showReasoning = true }: InspectorOptions & { index: RunIndex }) {
  const [view, setView] = useState<View>(initialView);
  const [activeRunId, setActiveRunId] = useState(() => index.roots[0].id);
  // Per-view state lives here so it survives switching tabs.
  const [stepFilter, setStepFilter] = useState<StepFilter>('all');
  const [open, setOpen] = useState<OpenState>({});
  const [runFilters, setRunFilters] = useState<RunFilters>(INITIAL_RUN_FILTERS);
  const [selection, setSelection] = useState<string[]>(() => defaultComparison(index));
  const pendingJump = useRef<string | null>(null);

  // A step requested from another view can only be scrolled to once the timeline has rendered.
  useEffect(() => {
    if (view !== 'timeline' || pendingJump.current === null) return;
    scrollToStep(pendingJump.current);
    pendingJump.current = null;
  }, [view]);

  const activeRun = index.byId.get(activeRunId) ?? index.roots[0];
  const selectedRuns = selection.map((id) => index.byId.get(id)).filter((r): r is Run => r !== undefined);

  // Picking a third run drops the older of the two.
  const togglePick = (id: string) =>
    setSelection((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length < 2) return [...cur, id];
      return [cur[1], id];
    });

  const goTo = (next: View) => {
    setView(next);
    window.scrollTo({ top: 0 });
  };

  const openRun = (id: string) => {
    setActiveRunId(id);
    goTo('timeline');
  };

  const openStep = (stepId: string) => {
    pendingJump.current = stepId;
    setView('timeline');
  };

  const runLabel =
    view !== 'diff'
      ? shortId(activeRun.id)
      : selectedRuns.length === 2
        ? `${shortId(selectedRuns[0].id)} ↔ ${shortId(selectedRuns[1].id)}`
        : 'pick two runs to diff';

  return (
    <div className="app">
      <Header view={view} onViewChange={setView} runLabel={runLabel} project="agent-eval / payments-flake" />

      {view === 'timeline' && (
        <Timeline
          run={activeRun}
          index={index}
          filter={stepFilter}
          onFilterChange={setStepFilter}
          open={open}
          onOpenChange={setOpen}
          expandToolPayloads={expandToolPayloads}
          showReasoning={showReasoning}
        />
      )}

      {view === 'graph' && <CallGraph run={activeRun} index={index} onOpenStep={openStep} />}

      {view === 'runs' && (
        <RunList
          index={index}
          filters={runFilters}
          onFiltersChange={setRunFilters}
          selection={selection}
          selectedRuns={selectedRuns}
          onTogglePick={togglePick}
          onOpenRun={openRun}
          onDiff={() => goTo('diff')}
        />
      )}

      {view === 'diff' && <RunDiff index={index} selectedRuns={selectedRuns} onBack={() => goTo('runs')} />}
    </div>
  );
}
