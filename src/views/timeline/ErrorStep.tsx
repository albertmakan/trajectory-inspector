import { stepElementId } from '../../lib/dom';
import { formatStepDuration, pad2 } from '../../lib/format';
import type { ErrorItem } from '../../lib/timeline';

/** A bare `error` step; the schema carries no payload for it beyond timing. */
export function ErrorStep({ item }: { item: ErrorItem }) {
  return (
    <div id={stepElementId(item.key)} className="error-step">
      <span className="step-row__num">#{pad2(item.step.index)}</span>
      <span className="error-step__label">ERROR</span>
      <div className="spacer" />
      <span className="step-row__dur">{formatStepDuration(item.step.durationMs)}</span>
    </div>
  );
}
