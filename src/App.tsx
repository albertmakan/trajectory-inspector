import { StatusScreen } from './components/StatusScreen';
import { SOURCE_LABEL, useRunMeta } from './hooks/useRuns';
import { Inspector, type InspectorOptions } from './Inspector';

export type AppProps = InspectorOptions;

/** Loads run metadata, then hands the index to the inspector. */
export default function App(props: AppProps) {
  const state = useRunMeta();

  if (state.status === 'error') {
    return (
      <div className="app">
        <StatusScreen title="COULD NOT LOAD RUNS" detail={`${SOURCE_LABEL} — ${state.message}`} error />
      </div>
    );
  }
  if (state.status === 'loading') {
    return (
      <div className="app">
        <StatusScreen title="LOADING RUNS" detail={SOURCE_LABEL} />
      </div>
    );
  }
  if (state.index.roots.length === 0) {
    return (
      <div className="app">
        <StatusScreen title="NO RUNS" detail={`${SOURCE_LABEL} contains no top-level runs`} />
      </div>
    );
  }
  return <Inspector index={state.index} {...props} />;
}
