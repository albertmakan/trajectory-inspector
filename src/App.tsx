import { useMatch } from 'react-router';
import { Header } from './components/Header';
import { CallGraphSkeleton, RunDiffSkeleton, RunListSkeleton, TimelineSkeleton } from './components/Skeleton';
import { StatusScreen } from './components/StatusScreen';
import { SOURCE_LABEL, useRunMeta } from './hooks/useRuns';
import { Inspector, type InspectorOptions } from './Inspector';
import { ROUTES } from './lib/routes';
import { EMPTY_RUN_INDEX } from './lib/runs';
import { RUNS_PROJECT } from './lib/supabase';

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
    return <AppSkeleton />;
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

/** The chrome plus the skeleton of whichever view the URL asks for, before any run is known. */
function AppSkeleton() {
  const onTimeline = useMatch(ROUTES.timeline) !== null;
  const onGraph = useMatch(ROUTES.graph) !== null;
  const onDiff = useMatch(ROUTES.diff) !== null;

  return (
    <div className="app">
      {/* No metadata yet, so there are no tabs to restore and nothing to name them with.
          The project is a build-time constant rather than loaded data, so it shows
          immediately and doesn't shift when the runs arrive. */}
      <Header index={EMPTY_RUN_INDEX} tabs={[]} activeKey={undefined} onClose={() => {}} project={RUNS_PROJECT} />
      {onGraph ? (
        <CallGraphSkeleton />
      ) : onTimeline ? (
        <TimelineSkeleton />
      ) : onDiff ? (
        <RunDiffSkeleton />
      ) : (
        <RunListSkeleton />
      )}
    </div>
  );
}
