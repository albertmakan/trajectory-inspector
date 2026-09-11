import type { View } from '../types';
import { stepElementId } from './dom';

/** Route patterns matched in Inspector.tsx. Build URLs with the helpers below rather than by hand. */
export const ROUTES = {
  runs: '/runs',
  timeline: '/runs/:runId',
  graph: '/runs/:runId/graph',
  diff: '/diff/:left?/:right?',
} as const;

const runSegment = (runId: string) => `/runs/${encodeURIComponent(runId)}`;

/** A run's timeline, optionally scrolled to one of its steps. */
export const timelinePath = (runId: string, stepAnchor?: string) =>
  runSegment(runId) + (stepAnchor ? `#${encodeURIComponent(stepElementId(stepAnchor))}` : '');

export const graphPath = (runId: string) => `${runSegment(runId)}/graph`;

/** Fewer than two runs lands on the diff view's "pick two runs" state. */
export const diffPath = (runIds: string[]) => ['/diff', ...runIds.map(encodeURIComponent)].join('/');

export function viewPath(view: View, runId: string, pair: string[]): string {
  switch (view) {
    case 'timeline': return timelinePath(runId);
    case 'graph': return graphPath(runId);
    case 'runs': return ROUTES.runs;
    case 'diff': return diffPath(pair);
  }
}

/** The element id a location hash points at; empty when there is none. */
export function hashTarget(hash: string): string {
  const raw = hash.replace(/^#/, '');
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
