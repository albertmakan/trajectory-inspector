import { startTransition, useEffect, useMemo, useState } from "react";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useMatch,
  useNavigate,
} from "react-router";
import { Header } from "./components/Header";
import { scrollToElement } from "./lib/dom";
import {
  diffPath,
  hashTarget,
  ROUTES,
  timelinePath,
  viewPath,
} from "./lib/routes";
import { defaultComparison, type RunIndex } from "./lib/runs";
import { openTab, tabKey, tabPath, type OpenTab } from "./lib/tabs";
import type { Run } from "./schema";
import type { View } from "./types";
import { CallGraph } from "./views/CallGraph";
import { RunDiff } from "./views/RunDiff";
import { INITIAL_RUN_FILTERS, RunList, type RunFilters } from "./views/RunList";
import type { OpenState } from "./views/timeline/disclosure";
import { Timeline, type StepFilter } from "./views/timeline/Timeline";

export interface InspectorOptions {
  /** View that `/` redirects to. */
  initialView?: View;
  /** Open every tool call and result payload by default (errors always start open). */
  expandToolPayloads?: boolean;
  /** Show captured model reasoning above each turn's visible text. */
  showReasoning?: boolean;
}

export function Inspector({
  index,
  initialView = "runs",
  expandToolPayloads = false,
  showReasoning = true,
}: InspectorOptions & { index: RunIndex }) {
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const timelineMatch = useMatch(ROUTES.timeline);
  const graphMatch = useMatch(ROUTES.graph);
  const diffMatch = useMatch(ROUTES.diff);

  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [selection, setSelection] = useState<string[]>(() =>
    defaultComparison(index),
  );
  // Per-view state lives here so it survives route changes.
  const [stepFilter, setStepFilter] = useState<StepFilter>("all");
  const [open, setOpen] = useState<OpenState>({});
  const [runFilters, setRunFilters] = useState<RunFilters>(INITIAL_RUN_FILTERS);

  const runsFor = (ids: string[]) =>
    ids
      .map((id) => index.byId.get(id))
      .filter((r): r is Run => r !== undefined);

  const routeRunId = (timelineMatch ?? graphMatch)?.params.runId;
  const routeRun =
    routeRunId === undefined ? undefined : index.byId.get(routeRunId);
  const onGraph = graphMatch !== null;

  const onDiff = diffMatch !== null;
  const diffLeft = diffMatch?.params.left;
  const diffRight = diffMatch?.params.right;
  const diffRuns = runsFor(
    [diffLeft, diffRight].filter((id): id is string => !!id),
  );

  // The current route's tab: a run, or a diff of two known runs.
  const routeTab = useMemo((): OpenTab | undefined => {
    if (routeRun) {
      return {
        kind: "run",
        runId: routeRun.id,
        view: onGraph ? "graph" : "timeline",
      };
    }
    if (
      diffLeft &&
      diffRight &&
      index.byId.has(diffLeft) &&
      index.byId.has(diffRight)
    ) {
      return { kind: "diff", left: diffLeft, right: diffRight };
    }
    return undefined;
  }, [routeRun, onGraph, diffLeft, diffRight, index]);

  // Visiting a run or diff opens its tab: shown from this render, kept in state by the effect.
  const openTabs = routeTab ? openTab(tabs, routeTab) : tabs;
  const activeKey = routeTab && tabKey(routeTab);

  useEffect(() => {
    if (routeTab) setTabs((cur) => openTab(cur, routeTab));
  }, [routeTab]);

  // A diff reached by URL or history becomes the run list's picks, so "back to pair" shows it.
  useEffect(() => {
    if (onDiff)
      setSelection(
        [diffLeft, diffRight].filter(
          (id): id is string => !!id && index.byId.has(id),
        ),
      );
  }, [onDiff, diffLeft, diffRight, index]);

  // New routes start at the top, unless the hash targets a step, which only exists once the timeline has rendered.
  useEffect(() => {
    const target = hashTarget(hash);
    if (target) scrollToElement(target);
    else window.scrollTo({ top: 0 });
  }, [pathname, hash]);

  // Picking a third run drops the older of the two.
  const togglePick = (id: string) =>
    setSelection((cur) => {
      if (cur.includes(id)) return cur.filter((x) => x !== id);
      if (cur.length < 2) return [...cur, id];
      return [cur[1], id];
    });

  // Like reopening a file, a run that is already open returns to the view its tab shows.
  const openRun = (id: string) => {
    const tab = openTabs.find((t) => t.kind === "run" && t.runId === id);
    navigate(tab ? tabPath(tab) : timelinePath(id));
  };

  // Closing the current tab moves to its right-hand neighbor, else its left, else the run list.
  const closeTab = (tab: OpenTab) => {
    const key = tabKey(tab);
    const i = openTabs.findIndex((t) => tabKey(t) === key);
    if (key === activeKey) {
      const next = openTabs[i + 1] ?? openTabs[i - 1];
      navigate(next ? tabPath(next) : ROUTES.runs);
    }
    // The router changes location inside a transition. Closing in the same one keeps
    // the tab from being re-opened for a frame by the route it is leaving.
    startTransition(() => setTabs(openTabs.filter((t) => tabKey(t) !== key)));
  };

  const home = (
    <Navigate
      to={viewPath(initialView, index.roots[0].id, defaultComparison(index))}
      replace
    />
  );
  const unknownRun = <Navigate to={ROUTES.runs} replace />;

  return (
    <div className="app">
      <Header
        index={index}
        tabs={openTabs}
        activeKey={activeKey}
        onClose={closeTab}
        project=""
      />

      <Routes>
        <Route path="/" element={home} />

        <Route
          path={ROUTES.timeline}
          element={
            routeRun ? (
              <Timeline
                run={routeRun}
                index={index}
                filter={stepFilter}
                onFilterChange={setStepFilter}
                open={open}
                onOpenChange={setOpen}
                expandToolPayloads={expandToolPayloads}
                showReasoning={showReasoning}
              />
            ) : (
              unknownRun
            )
          }
        />

        <Route
          path={ROUTES.graph}
          element={
            routeRun ? (
              <CallGraph
                run={routeRun}
                index={index}
                onOpenStep={(stepId) =>
                  navigate(timelinePath(routeRun.id, stepId))
                }
              />
            ) : (
              unknownRun
            )
          }
        />

        <Route
          path={ROUTES.runs}
          element={
            <RunList
              index={index}
              filters={runFilters}
              onFiltersChange={setRunFilters}
              selection={selection}
              selectedRuns={runsFor(selection)}
              onTogglePick={togglePick}
              onOpenRun={openRun}
              onDiff={() => navigate(diffPath(selection))}
            />
          }
        />

        <Route
          path={ROUTES.diff}
          element={
            <RunDiff
              index={index}
              selectedRuns={diffRuns}
              onBack={() => navigate(ROUTES.runs)}
            />
          }
        />

        <Route path="*" element={home} />
      </Routes>
    </div>
  );
}
