import { useMemo } from 'react';
import { Legend, type LegendItem } from '../components/Legend';
import { MetaStrip } from '../components/MetaStrip';
import { cx } from '../lib/cx';
import { pressable } from '../lib/dom';
import { formatStepDuration, summaryLine } from '../lib/format';
import { buildCallGraph, type GraphNode } from '../lib/graph';
import type { RunIndex } from '../lib/runs';
import type { Run } from '../schema';

const LEGEND: LegendItem[] = [
  { label: 'agent span', swatch: { width: 10, height: 6, background: 'oklch(0.6 0.14 300)' } },
  { label: 'tool span', swatch: { width: 10, height: 6, background: 'oklch(0.55 0.07 190)' } },
  { label: 'failed', swatch: { width: 10, height: 6, background: 'oklch(0.62 0.19 25)' } },
  { label: 'failure path to root', swatch: { width: 3, height: 12, background: 'oklch(0.62 0.19 25)' } },
];

interface CallGraphProps {
  run: Run;
  index: RunIndex;
  onOpenStep: (stepId: string) => void;
}

export function CallGraph({ run, index, onOpenStep }: CallGraphProps) {
  const graph = useMemo(() => buildCallGraph(run, index), [run, index]);

  // A node draws └─ when it is the last child of its parent, ├─ otherwise.
  const lastChildren = useMemo(() => {
    const last = new Map<string, string>();
    for (const node of graph.nodes) if (node.parentKey) last.set(node.parentKey, node.key);
    return new Set(last.values());
  }, [graph]);

  const deepest = graph.failurePath[graph.failurePath.length - 1];

  return (
    <div className="page">
      <MetaStrip items={graph.stats} className="graph-stats" />

      <Legend items={LEGEND} className="graph-legend">
        <span>passing tool calls are rolled into step counts · click a node to open it in the timeline</span>
      </Legend>

      <div className="graph-grid graph-head">
        <span />
        <span>D</span>
        <span />
        <span>NODE</span>
        <span>WORK</span>
        <span className="align-right">COST</span>
        <div className="graph-head__axis">
          {graph.axis.map((t, i) => (
            <span key={i}>{t}</span>
          ))}
        </div>
        <span className="align-right">DUR</span>
      </div>

      <div className="graph-body">
        {graph.nodes.map((node) => (
          <GraphRow
            key={node.key}
            node={node}
            spanMs={graph.spanMs}
            isLastChild={lastChildren.has(node.key)}
            onOpen={() => onOpenStep(node.jumpTo)}
          />
        ))}
      </div>

      {deepest && (
        <div className="failure-note">
          <span className="failure-note__label">FAILURE PATH</span>
          <span className="failure-note__text">
            {' '}{graph.failurePath.map((n) => n.name).join(' ▸ ')}
            {deepest.error ? ` — ${summaryLine(deepest.error)}` : ''}
          </span>
        </div>
      )}
    </div>
  );
}

interface GraphRowProps {
  node: GraphNode;
  spanMs: number;
  isLastChild: boolean;
  onOpen: () => void;
}

function GraphRow({ node, spanMs, isLastChild, onOpen }: GraphRowProps) {
  const left = spanMs > 0 ? Math.min(100, (node.startMs / spanMs) * 100) : 0;
  const width = spanMs > 0 ? Math.min(100 - left, Math.max(0.6, (node.durationMs / spanMs) * 100)) : 100;

  return (
    <div className="graph-grid graph-row" {...pressable(onOpen)}>
      <span className={cx('graph-row__path', node.onFailurePath && 'is-on')} />
      <span className="graph-row__depth">d{node.depth}</span>
      <div className="graph-row__tree">
        {node.depth === 0 ? (
          <span className="graph-row__root">◆</span>
        ) : (
          <span style={{ paddingLeft: 22 + (node.depth - 1) * 30 }}>{isLastChild ? '└─' : '├─'}</span>
        )}
      </div>
      <div className="graph-row__node">
        <span className={cx('kind-badge', `kind-badge--${node.type}`)}>{node.type === 'agent' ? 'AGENT' : 'TOOL'}</span>
        <span className="graph-row__name">{node.name}</span>
        {node.failed && <span className="failure-badge">FAILURE</span>}
        <span className="graph-row__detail">{node.detail}</span>
      </div>
      <span className="graph-row__steps">{node.work}</span>
      <span className="graph-row__cost">{node.cost}</span>
      <div className="span-track">
        <span
          className={cx('span-bar', node.failed ? 'span-bar--failed' : `span-bar--${node.type}`)}
          style={{ left: `${left.toFixed(2)}%`, width: `${width.toFixed(2)}%` }}
        />
      </div>
      <span className="graph-row__dur">{formatStepDuration(node.durationMs)}</span>
    </div>
  );
}
