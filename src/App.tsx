import { useMemo } from 'react';
import { RUNS_URL, useRuns } from './hooks/useRuns';
import { cx } from './lib/cx';
import { indexRuns } from './lib/runs';
import { Inspector, type InspectorOptions } from './Inspector';

export type AppProps = InspectorOptions;

/** Loads runs.json, then hands the indexed runs to the inspector. */
export default function App(props: AppProps) {
  const state = useRuns();
  const index = useMemo(() => (state.status === 'ready' ? indexRuns(state.runs) : null), [state]);

  if (state.status === 'error') {
    return <StatusScreen title="COULD NOT LOAD RUNS" detail={`${RUNS_URL} — ${state.message}`} error />;
  }
  if (!index) {
    return <StatusScreen title="LOADING RUNS" detail={RUNS_URL} />;
  }
  if (index.roots.length === 0) {
    return <StatusScreen title="NO RUNS" detail={`${RUNS_URL} contains no top-level runs`} />;
  }
  return <Inspector index={index} {...props} />;
}

function StatusScreen({ title, detail, error = false }: { title: string; detail: string; error?: boolean }) {
  return (
    <div className="app">
      <div className={cx('status-screen', error && 'is-error')} role={error ? 'alert' : 'status'}>
        <span className="status-screen__title">{title}</span>
        <span className="status-screen__detail">{detail}</span>
      </div>
    </div>
  );
}
