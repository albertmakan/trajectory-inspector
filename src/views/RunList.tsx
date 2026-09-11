import { useMemo, type Dispatch, type SetStateAction } from 'react';
import { Chip } from '../components/Chip';
import { cx } from '../lib/cx';
import { pressable } from '../lib/dom';
import { formatCost, formatRunDuration, shortId, statusWord, subagentSummary } from '../lib/format';
import { RUN_STATUSES, runDurationMs, subagentCounts, type RunIndex, type RunStatus } from '../lib/runs';
import type { Run } from '../schema';

export interface RunFilters {
  query: string;
  status: RunStatus | 'all';
  tag: string;
  page: number;
  perPage: number;
}

export const INITIAL_RUN_FILTERS: RunFilters = { query: '', status: 'all', tag: 'all', page: 0, perPage: 10 };

const STATUS_OPTIONS: RunFilters['status'][] = ['all', ...RUN_STATUSES];
const PER_PAGE_OPTIONS = [10, 25, 50];
const VISIBLE_TAGS = 2;

function matches(run: Run, filters: RunFilters, query: string): boolean {
  if (filters.status !== 'all' && run.status !== filters.status) return false;
  if (filters.tag !== 'all' && !run.tags.includes(filters.tag)) return false;
  return !query || [run.task, run.id, run.model, ...run.tags].join(' ').toLowerCase().includes(query);
}

interface RunListProps {
  index: RunIndex;
  filters: RunFilters;
  onFiltersChange: Dispatch<SetStateAction<RunFilters>>;
  selection: string[];
  selectedRuns: Run[];
  onTogglePick: (id: string) => void;
  onOpenRun: (id: string) => void;
  onDiff: () => void;
}

export function RunList({ index, filters, onFiltersChange, selection, selectedRuns, onTogglePick, onOpenRun, onDiff }: RunListProps) {
  const runs = index.roots;
  const tagOptions = useMemo(() => ['all', ...new Set(runs.flatMap((r) => r.tags))], [runs]);
  const update = (patch: Partial<RunFilters>) => onFiltersChange((prev) => ({ ...prev, ...patch }));

  const query = filters.query.trim();
  const matched = runs.filter((run) => matches(run, filters, query.toLowerCase()));

  const { perPage } = filters;
  const pageCount = Math.max(1, Math.ceil(matched.length / perPage));
  const page = Math.min(filters.page, pageCount - 1);
  const start = page * perPage;
  const pageRuns = matched.slice(start, start + perPage);

  const canCompare = selectedRuns.length === 2;
  const compareHint = canCompare ? '' : selectedRuns.length === 1 ? 'pick one more run' : 'pick two runs to align step by step';

  return (
    <div className="page page--runs">
      <div className="runs-toolbar">
        <div className="search">
          <span className="search__icon" aria-hidden="true">⌕</span>
          <input
            className="search__input"
            value={filters.query}
            onChange={(e) => update({ query: e.target.value, page: 0 })}
            placeholder="search task, run id, model, tag…"
            aria-label="Search runs"
          />
          {filters.query.length > 0 && (
            <button type="button" className="search__clear" aria-label="Clear search" onClick={() => update({ query: '', page: 0 })}>
              ✕
            </button>
          )}
        </div>
        <div className="spacer" />
        <span className="runs-count">{matched.length} of {runs.length} runs</span>
      </div>

      <div className="runs-toolbar">
        <span className="label">STATUS</span>
        <div className="chip-group">
          {STATUS_OPTIONS.map((status) => (
            <Chip key={status} active={filters.status === status} onClick={() => update({ status, page: 0 })}>
              {status.replace('_', ' ')}
            </Chip>
          ))}
        </div>
        <span className="label runs-toolbar__tags-label">TAGS</span>
        <div className="chip-group chip-group--wrap">
          {tagOptions.map((tag) => (
            <Chip key={tag} variant="tag" active={filters.tag === tag} onClick={() => update({ tag, page: 0 })}>
              {tag}
            </Chip>
          ))}
        </div>
      </div>

      <div className="compare-bar">
        <span className="compare-bar__label">COMPARE</span>
        {[0, 1].map((i) => {
          const run = selectedRuns[i];
          const letter = i === 0 ? 'A' : 'B';
          return run ? (
            <div key={letter} className="slot">
              <span className="slot__letter">{letter}</span>
              <span className="slot__id">{shortId(run.id)}</span>
              <span className="slot__status">{statusWord(run.status)}</span>
              <button
                type="button"
                className="slot__remove"
                aria-label={`Remove ${shortId(run.id)} from comparison`}
                onClick={() => onTogglePick(run.id)}
              >
                ✕
              </button>
            </div>
          ) : (
            <div key={letter} className="slot slot--empty">
              <span className="slot__letter">{letter}</span>
              <span>pick a run</span>
            </div>
          );
        })}
        {compareHint && <span className="compare-bar__hint">{compareHint}</span>}
        <div className="spacer" />
        <button type="button" className="primary-btn" disabled={!canCompare} onClick={onDiff}>
          DIFF PAIR →
        </button>
      </div>

      <div className="runs-table">
        <div className="runs-grid runs-table__head">
          <span />
          <span>RUN</span>
          <span />
          <span>TASK</span>
          <span>MODEL</span>
          <span className="align-right">STEP</span>
          <span className="align-right">SUB</span>
          <span className="align-right">DUR</span>
          <span className="align-right">COST</span>
          <span>TAGS</span>
        </div>
        {pageRuns.map((run) => (
          <RunRow
            key={run.id}
            run={run}
            slot={selection.indexOf(run.id)}
            onTogglePick={() => onTogglePick(run.id)}
            onOpen={() => onOpenRun(run.id)}
          />
        ))}
        {matched.length === 0 && (
          <div className="runs-empty">no runs match {query ? `“${query}”` : 'these filters'}</div>
        )}
      </div>

      <div className="pagination">
        <span className="pagination__range">
          {matched.length === 0
            ? 'no results'
            : `showing ${start + 1}–${Math.min(start + perPage, matched.length)} of ${matched.length}`}
        </span>
        <div className="spacer" />
        <span className="label">PER PAGE</span>
        <div className="chip-group">
          {PER_PAGE_OPTIONS.map((n) => (
            <Chip key={n} variant="compact" active={perPage === n} onClick={() => update({ perPage: n, page: 0 })}>
              {n}
            </Chip>
          ))}
        </div>
        <div className="pagination__gap" />
        <button type="button" className="pager-btn" disabled={page === 0} onClick={() => update({ page: page - 1 })}>
          ◂ prev
        </button>
        <div className="chip-group chip-group--tight">
          {Array.from({ length: pageCount }, (_, i) => (
            <Chip key={i} variant="page" active={i === page} onClick={() => update({ page: i })}>
              {i + 1}
            </Chip>
          ))}
        </div>
        <button
          type="button"
          className="pager-btn"
          disabled={page >= pageCount - 1}
          onClick={() => update({ page: page + 1 })}
        >
          next ▸
        </button>
      </div>
    </div>
  );
}

interface RunRowProps {
  run: Run;
  /** Index in the comparison selection, or -1 when not picked. */
  slot: number;
  onTogglePick: () => void;
  onOpen: () => void;
}

function RunRow({ run, slot, onTogglePick, onOpen }: RunRowProps) {
  const picked = slot >= 0;
  const subagents = subagentCounts(run);
  const hiddenTags = run.tags.length - VISIBLE_TAGS;

  return (
    <div className={cx('runs-grid run-row', picked && 'is-picked')} {...pressable(onOpen)}>
      <button
        type="button"
        className={cx('pick-btn', picked && 'is-picked')}
        title={picked ? 'remove from comparison' : 'add to comparison'}
        aria-pressed={picked}
        onClick={(e) => {
          e.stopPropagation();
          onTogglePick();
        }}
      >
        {picked ? (slot === 0 ? 'A' : 'B') : '+'}
      </button>
      <span className="run-row__id" title={run.id}>{shortId(run.id)}</span>
      <span className={cx('status-dot', `status-dot--${run.status}`)} title={run.status.replace('_', ' ')} />
      <span className="run-row__task">{run.task}</span>
      <span className="run-row__model">{run.model}</span>
      <span className="run-row__num">{run.steps.length}</span>
      <span className={cx('run-row__sub', subagents.failed > 0 && 'has-failures')}>{subagentSummary(subagents)}</span>
      <span className="run-row__num">{formatRunDuration(runDurationMs(run))}</span>
      <span className="run-row__num">{formatCost(run.totalCost)}</span>
      <div className="run-row__tags">
        {run.tags.slice(0, VISIBLE_TAGS).map((tag) => (
          <span key={tag} className="tag">{tag}</span>
        ))}
        {hiddenTags > 0 && (
          <span className="run-row__more" title={run.tags.slice(VISIBLE_TAGS).join(', ')}>+{hiddenTags}</span>
        )}
      </div>
    </div>
  );
}
