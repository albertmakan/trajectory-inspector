import { stepElementId } from '../../lib/dom';
import { formatClock, formatStepDuration, formatTokens, pad2 } from '../../lib/format';
import { stepOffsetMs } from '../../lib/runs';
import type { ModelItem } from '../../lib/timeline';
import type { Run } from '../../schema';

interface ModelTurnProps {
  item: ModelItem;
  run: Run;
  showReasoning: boolean;
}

export function ModelTurn({ item, run, showReasoning }: ModelTurnProps) {
  const { step } = item;
  const turn = step.modelTurn;
  const reasoning = showReasoning ? turn?.reasoning : undefined;
  const toolCalls = turn?.toolCalls ?? [];

  return (
    <div id={stepElementId(item.key)} className="model-turn">
      <div className="model-turn__gutter">
        <div className="model-turn__num">#{pad2(step.index)}</div>
        <div>{formatClock(stepOffsetMs(run, step))}</div>
      </div>
      <div className="model-turn__body">
        <div className="model-turn__head">
          <span className="model-turn__label">MODEL TURN</span>
          {turn && <span className="model-turn__tokens">{formatTokens(turn.tokens)}</span>}
          <div className="rule" />
          <span className="model-turn__dur">{formatStepDuration(step.durationMs)}</span>
        </div>
        {reasoning && <div className="model-turn__reasoning">{reasoning}</div>}
        {turn?.text && <div className="model-turn__text">{turn.text}</div>}
        {toolCalls.length > 0 && (
          <div className="decisions">
            <span className="decisions__label">DECIDED →</span>
            {toolCalls.map((call) => (
              <span key={call.id} className="decisions__chip">{call.toolName}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
