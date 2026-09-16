import { Fragment, type CSSProperties } from 'react';
import { cx } from '../lib/cx';

/**
 * Placeholders shaped like the view they stand in for: the chrome that doesn't
 * depend on data (column heads, rail titles) is drawn for real, and everything
 * a run would fill in becomes a shimmering bar of roughly the right size.
 */

const rows = (n: number) => Array.from({ length: n }, (_, i) => i);

/** Varied widths, so a column of placeholders doesn't read as a solid block. */
const TASK_WIDTHS = ['82%', '54%', '71%', '46%', '63%', '88%', '58%', '75%'];
const TEXT_WIDTHS = ['96%', '88%', '57%'];
const GRAPH_DEPTHS = [0, 1, 1, 2, 1, 2, 3];
const DIFF_WIDTHS = ['78%', '52%', '91%', '64%', '83%', '47%', '72%', '88%', '59%', '76%'];
const MAP_WIDTHS = ['62%', '40%', '40%', '80%', '62%', '40%', '55%', '40%', '80%', '62%', '40%', '40%'];

/** Staggers a row's shimmer so a list ripples instead of blinking all at once. */
const delay = (i: number) => ({ '--sk-delay': `${(i % 8) * 0.08}s` }) as CSSProperties;

interface BarProps {
  w?: number | string;
  h?: number | string;
  className?: string;
}

function Bar({ w = '100%', h = 11, className }: BarProps) {
  return <span className={cx('sk-bar', className)} style={{ width: w, height: h }} />;
}

function Chips({ widths }: { widths: number[] }) {
  return (
    <div className="chip-group">
      {widths.map((w, i) => (
        <Bar key={i} className="sk-bar--chip" w={w} h={21} />
      ))}
    </div>
  );
}

/** A meta strip's worth of key/value placeholders. */
function MetaBars({ count, className }: { count: number; className?: string }) {
  return (
    <div className={cx('meta-strip', className)}>
      {rows(count).map((i) => (
        <div key={i} className="meta-strip__item sk-stack" style={delay(i)}>
          <Bar w={46} h={9} />
          <Bar w={68} />
        </div>
      ))}
    </div>
  );
}

export function RunListSkeleton() {
  return (
    <div className="page page--runs" role="status" aria-label="Loading runs" aria-busy="true">
      <div className="runs-toolbar">
        <div className="search">
          <span className="search__icon" aria-hidden="true">⌕</span>
          <Bar w={180} />
        </div>
        <div className="spacer" />
        <Bar w={96} h={10} />
      </div>

      <div className="runs-toolbar">
        <span className="label">STATUS</span>
        <Chips widths={[34, 62, 58, 60, 78]} />
        <span className="label runs-toolbar__tags-label">TAGS</span>
        <Chips widths={[34, 56, 68, 48]} />
      </div>

      <div className="compare-bar">
        <span className="compare-bar__label">COMPARE</span>
        <Bar className="sk-bar--slot" w={132} h={22} />
        <Bar className="sk-bar--slot" w={132} h={22} />
        <div className="spacer" />
        <Bar className="sk-bar--btn" w={96} h={23} />
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
        {rows(8).map((i) => (
          <div key={i} className="runs-grid sk-row" style={delay(i)}>
            <Bar w={18} h={18} />
            <Bar w={62} />
            <Bar className="sk-bar--dot" w={9} h={9} />
            <Bar w={TASK_WIDTHS[i]} />
            <Bar w="84%" />
            <Bar className="sk-bar--end" w={20} h={10} />
            <Bar className="sk-bar--end" w={28} h={10} />
            <Bar className="sk-bar--end" w={38} h={10} />
            <Bar className="sk-bar--end" w={40} h={10} />
            <div className="run-row__tags">
              <Bar className="sk-bar--tag" w={56} h={15} />
              <Bar className="sk-bar--tag" w={44} h={15} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function TimelineSkeleton() {
  return (
    <div className="timeline" role="status" aria-label="Loading trajectory" aria-busy="true">
      <div className="timeline__main">
        <section className="run-head">
          <div className="run-head__title-row">
            <Bar className="sk-bar--badge" w={74} h={19} />
            <Bar w={300} h={15} />
          </div>
          <MetaBars count={7} className="run-head__meta" />
        </section>

        <div className="timeline-toolbar">
          <span className="label">FILTER</span>
          <Chips widths={[46, 86, 74, 72, 62]} />
        </div>

        <div className="steps">
          {rows(4).map((i) => (
            <Fragment key={i}>
              <div className="model-turn" style={delay(i * 2)}>
                <div className="model-turn__gutter sk-stack">
                  <Bar className="sk-bar--end" w={30} h={10} />
                  <Bar className="sk-bar--end" w={40} h={10} />
                </div>
                <div className="model-turn__body">
                  <div className="model-turn__head">
                    <Bar className="sk-bar--badge" w={72} h={9} />
                    <Bar w={64} h={9} />
                    <div className="rule" />
                    <Bar w={38} h={9} />
                  </div>
                  <div className="sk-stack">
                    {TEXT_WIDTHS.map((w, j) => (
                      <Bar key={j} w={w} h={12} />
                    ))}
                  </div>
                </div>
              </div>

              <div className="tool-card" style={delay(i * 2 + 1)}>
                <div className="step-row sk-static">
                  <Bar w={26} h={10} />
                  <Bar w={11} h={11} />
                  <div className="step-row__body">
                    <Bar w={104} h={12} />
                    <Bar w="46%" h={10} />
                  </div>
                  <Bar w={40} h={10} />
                </div>
                <div className="step-row tool-card__result sk-static">
                  <Bar w={26} h={10} />
                  <Bar w={11} h={11} />
                  <div className="step-row__body">
                    <Bar w={56} h={10} />
                    <Bar w="34%" h={10} />
                  </div>
                  <Bar w={40} h={10} />
                </div>
              </div>
            </Fragment>
          ))}
        </div>
      </div>

      <aside className="step-map">
        <div className="step-map__title">STEP MAP</div>
        <div className="step-map__list">
          {MAP_WIDTHS.map((w, i) => (
            <div key={i} className="step-map__item sk-static" style={delay(i)}>
              <Bar w={14} h={8} />
              <Bar w={w} h={5} />
            </div>
          ))}
        </div>
      </aside>
    </div>
  );
}

export function CallGraphSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading call graph" aria-busy="true">
      <MetaBars count={5} className="graph-stats" />

      <div className="legend graph-legend">
        {[92, 78, 60, 132].map((w, i) => (
          <Bar key={i} w={w} h={10} />
        ))}
      </div>

      <div className="graph-grid graph-head">
        <span />
        <span>D</span>
        <span />
        <span>NODE</span>
        <span>WORK</span>
        <span className="align-right">COST</span>
        <span />
        <span className="align-right">DUR</span>
      </div>

      <div className="graph-body">
        {GRAPH_DEPTHS.map((depth, i) => (
          <div key={i} className="graph-grid sk-row sk-row--graph" style={delay(i)}>
            <span />
            <Bar w={16} h={9} />
            <div className="graph-row__tree" style={{ paddingLeft: depth === 0 ? 0 : 22 + (depth - 1) * 30 }}>
              <Bar w={depth === 0 ? 11 : 16} h={11} />
            </div>
            <div className="graph-row__node">
              <Bar className="sk-bar--badge" w={44} h={13} />
              <Bar w={96 + depth * 10} h={12} />
              <Bar w="34%" h={11} />
            </div>
            <Bar w={62} h={10} />
            <Bar className="sk-bar--end" w={34} h={10} />
            <div className="span-track">
              <span
                className="sk-bar span-bar"
                style={{ left: `${depth * 12}%`, width: `${70 - depth * 14}%` }}
              />
            </div>
            <Bar className="sk-bar--end" w={36} h={10} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function RunDiffSkeleton() {
  return (
    <div className="page" role="status" aria-label="Loading comparison" aria-busy="true">
      <div className="diff-grid diff-heads">
        <div className="diff-heads__aside">
          <span>ALIGNED</span>
          <Bar w={54} h={20} />
        </div>
        {rows(2).map((i) => (
          <div key={i} className="diff-head" style={delay(i)}>
            <div className="diff-head__row">
              <Bar w={64} h={11} />
              <Bar w={54} h={10} />
              <div className="spacer" />
              <Bar w={168} h={10} />
            </div>
            <div className="diff-head__model">
              <Bar w={124} h={10} />
            </div>
          </div>
        ))}
      </div>

      <div className="legend diff-legend">
        {[72, 116, 66, 148].map((w, i) => (
          <Bar key={i} w={w} h={10} />
        ))}
      </div>

      <div className="diff-rows">
        {DIFF_WIDTHS.map((w, i) => (
          <div key={i} className="diff-grid" style={delay(i)}>
            <div className="diff-row__n">
              <Bar w={22} h={10} />
            </div>
            {[w, DIFF_WIDTHS[(i + 3) % DIFF_WIDTHS.length]].map((cell, side) => (
              <div key={side} className="diff-cell sk-stack">
                <Bar w={58} h={9} />
                <Bar w={cell} h={11} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
