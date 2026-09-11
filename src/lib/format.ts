import type { Run } from '../schema';

export const pad2 = (n: number) => String(n).padStart(2, '0');

export const shortId = (id: string) => id.slice(0, 8);

export const firstLine = (text: string) => text.split('\n')[0];

/** One-line gist of an error: its first line, unless that line only echoes the command that was run. */
export function summaryLine(text: string): string {
  const lines = text.split('\n').map((l) => l.trim()).filter((l) => l && !l.startsWith('exit_code'));
  if (lines.length === 0) return '';
  return lines[0].startsWith('$ ') ? lines[lines.length - 1] : lines[0];
}

/** The most telling argument of a tool input (shell command, path, pattern…), falling back to compact JSON. */
export function inputGist(input: Record<string, unknown> | undefined): string {
  for (const key of ['cmd', 'command', 'path', 'pattern', 'query', 'url']) {
    const value = input?.[key];
    if (typeof value === 'string') return value;
  }
  return JSON.stringify(input ?? {});
}

/** Collapses whitespace and truncates to a single-line preview. */
export function preview(text: string, max = 130): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? oneLine.slice(0, max) + '…' : oneLine;
}

/** Tool inputs/outputs are arbitrary JSON; strings are shown verbatim, everything else pretty-printed. */
export function formatPayload(value: unknown): string {
  if (value === undefined || value === null) return '';
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
}

export function statusWord(status: Run['status']): string {
  switch (status) {
    case 'failure': return 'FAILED';
    case 'success': return 'PASSED';
    case 'timeout': return 'TIMEOUT';
    case 'in_progress': return 'RUNNING';
  }
}

export const errorLabel = (error: string) => (/timeout/i.test(error) ? 'TIMEOUT' : 'ERROR');

/** Step-scale durations: "0.14s", "1.9s", "300.0s". */
export function formatStepDuration(ms: number): string {
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 1000).toFixed(2)}s`;
}

/** Run-scale durations: "11m 13s". */
export function formatRunDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}m ${pad2(total % 60)}s`;
}

/** Offset from run start: "5:07". */
export function formatClock(ms: number): string {
  const total = Math.floor(ms / 1000);
  return `${Math.floor(total / 60)}:${pad2(total % 60)}`;
}

export const formatCost = (usd: number) => `$${usd.toFixed(3)}`;

export const formatTimestamp = (iso: string) => `${iso.slice(0, 19).replace('T', ' ')}Z`;

const count = (n: number) => n.toLocaleString('en-US');
const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

export const formatTokens = ({ input, output }: { input: number; output: number }) =>
  `${count(input)} in / ${count(output)} out`;

export const formatTokensCompact = ({ input, output }: { input: number; output: number }) =>
  `${compact(input)} in / ${compact(output)} out`;

/** e.g. "3⤷ 2✕" for three subagents with two failures. */
export function subagentSummary({ count, failed }: { count: number; failed: number }, none = '—'): string {
  if (count === 0) return none;
  return `${count}⤷` + (failed > 0 ? ` ${failed}✕` : '');
}
