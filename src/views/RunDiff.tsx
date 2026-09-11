import { useMemo } from "react";
import { Legend, type LegendItem } from "../components/Legend";
import { diffRuns, type DiffSide } from "../lib/diff";
import {
  formatCost,
  formatRunDuration,
  shortId,
  statusWord,
  subagentSummary,
} from "../lib/format";
import { runDurationMs, subagentCounts, type RunIndex } from "../lib/runs";
import type { Run } from "../schema";
import { NavLink } from "react-router";
import { timelinePath } from "../lib/routes";

const LEGEND: LegendItem[] = [
  {
    label: "diverged",
    swatch: {
      width: 10,
      height: 10,
      background: "oklch(0.3 0.06 80)",
      border: "1px solid oklch(0.45 0.09 80)",
    },
  },
  {
    label: "error on one side",
    swatch: {
      width: 10,
      height: 10,
      background: "oklch(0.26 0.055 25)",
      border: "1px solid oklch(0.42 0.1 25)",
    },
  },
  {
    label: "identical",
    swatch: {
      width: 10,
      height: 10,
      background: "oklch(0.205 0.008 264)",
      border: "1px solid oklch(0.28 0.01 264)",
    },
  },
];

interface RunDiffProps {
  index: RunIndex;
  selectedRuns: Run[];
  onBack: () => void;
}

export function RunDiff({ index, selectedRuns, onBack }: RunDiffProps) {
  const [left, right] = selectedRuns;
  const diff = useMemo(
    () => (left && right ? diffRuns(left, right, index) : null),
    [left, right, index],
  );

  return (
    <div className="page">
      <div className="diff-grid diff-heads">
        <div className="diff-heads__aside">
          <span>ALIGNED</span>
          <button type="button" className="back-btn" onClick={onBack}>
            ◂ pair
          </button>
        </div>
        {selectedRuns.map((run) => (
          <div key={run.id} className="diff-head">
            <div className="diff-head__row">
              <NavLink
                className="diff-head__id"
                title={run.id}
                to={timelinePath(run.id)}
              >
                {shortId(run.id)}
              </NavLink>
              <span className="diff-head__status">
                {statusWord(run.status)}
              </span>
              <div className="spacer" />
              <span className="diff-head__summary">
                {run.steps.length} steps ·{" "}
                {subagentSummary(subagentCounts(run), "no subagents")} ·{" "}
                {formatRunDuration(runDurationMs(run)).replace(/ /g, "")} ·{" "}
                {formatCost(run.totalCost)}
              </span>
            </div>
            <div className="diff-head__model">{run.model}</div>
          </div>
        ))}
      </div>

      {diff ? (
        <>
          <Legend items={LEGEND} className="diff-legend">
            <span>{diff.summary}</span>
          </Legend>
          <div className="diff-rows">
            {diff.rows.map((row) => (
              <div key={row.key} className="diff-grid">
                <div className="diff-row__n">{row.n}</div>
                <DiffCell side={row.left} />
                <DiffCell side={row.right} />
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="no-alignment">
          <span className="no-alignment__title">PICK TWO RUNS</span>
          <span className="no-alignment__text">
            Select two runs in the run list to align their steps side by side.
          </span>
          <div className="no-alignment__actions">
            <button
              type="button"
              className="primary-btn primary-btn--lg"
              onClick={onBack}
            >
              GO TO RUN LIST
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DiffCell({ side }: { side: DiffSide }) {
  if (side.state === "gap") {
    return <div className="diff-gap">— no corresponding step —</div>;
  }
  return (
    <div className={`diff-cell diff-cell--${side.state}`}>
      <div className="diff-cell__kind">{side.kind}</div>
      <div className="diff-cell__text" title={side.text}>
        {side.text}
      </div>
    </div>
  );
}
