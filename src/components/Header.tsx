import { cx } from '../lib/cx';
import type { View } from '../types';

const TABS: { view: View; label: string }[] = [
  { view: 'timeline', label: 'RUN TIMELINE' },
  { view: 'graph', label: 'CALL GRAPH' },
  { view: 'runs', label: 'RUN LIST' },
  { view: 'diff', label: 'RUN DIFF' },
];

interface HeaderProps {
  view: View;
  onViewChange: (view: View) => void;
  runLabel: string;
  project: string;
}

export function Header({ view, onViewChange, runLabel, project }: HeaderProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand__mark" />
        <span className="brand__name">TRAJECTORY</span>
        <span className="brand__version">v0.9</span>
      </div>
      <nav className="tabs">
        {TABS.map((tab) => (
          <button
            key={tab.view}
            type="button"
            className={cx('tab', view === tab.view && 'is-active')}
            aria-current={view === tab.view ? 'page' : undefined}
            onClick={() => onViewChange(tab.view)}
          >
            {tab.label}
          </button>
        ))}
      </nav>
      <div className="spacer" />
      <span className="topbar__meta">{runLabel}</span>
      <span className="topbar__meta topbar__meta--divided">{project}</span>
    </header>
  );
}
