import type { View } from '../types';
import { shortId } from './format';
import { diffPath, graphPath, timelinePath } from './routes';
import type { RunIndex } from './runs';

export type RunView = Extract<View, 'timeline' | 'graph'>;

/** A run or diff open in the header, like a file tab in an editor. The run list is always open, so it isn't one. */
export type OpenTab =
  | {
      kind: 'run';
      runId: string;
      /** The view the tab last showed, and returns to when clicked. */
      view: RunView;
    }
  | { kind: 'diff'; left: string; right: string };

/** One tab per run (whichever view it shows) and one per ordered pair. */
export const tabKey = (tab: OpenTab) => (tab.kind === 'run' ? `run:${tab.runId}` : `diff:${tab.left}:${tab.right}`);

export function tabPath(tab: OpenTab): string {
  if (tab.kind === 'diff') return diffPath([tab.left, tab.right]);
  return tab.view === 'graph' ? graphPath(tab.runId) : timelinePath(tab.runId);
}

export const tabLabel = (tab: OpenTab) =>
  tab.kind === 'run' ? shortId(tab.runId) : `${shortId(tab.left)} ↔ ${shortId(tab.right)}`;

/** Full ids and tasks, for the tab's tooltip. */
export function tabTitle(tab: OpenTab, index: RunIndex): string {
  const ids = tab.kind === 'run' ? [tab.runId] : [tab.left, tab.right];
  return ids.map((id) => `${id} — ${index.byId.get(id)?.task ?? 'unknown run'}`).join('\n');
}

/** Appends the tab, or updates the already-open tab for the same run or pair in place. */
export function openTab(tabs: OpenTab[], tab: OpenTab): OpenTab[] {
  const i = tabs.findIndex((t) => tabKey(t) === tabKey(tab));
  if (i === -1) return [...tabs, tab];
  if (tabPath(tabs[i]) === tabPath(tab)) return tabs;
  return tabs.map((t, j) => (j === i ? tab : t));
}
