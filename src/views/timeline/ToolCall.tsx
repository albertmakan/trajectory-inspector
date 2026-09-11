import { Chevron } from '../../components/Chevron';
import { cx } from '../../lib/cx';
import { pressable, stepElementId } from '../../lib/dom';
import { formatStepDuration, pad2, preview } from '../../lib/format';
import { itemHasError, toolInput, toolName, toolOutput, toolStatusLabel, type ToolItem } from '../../lib/timeline';
import { disclosureKey, type Disclosure } from './disclosure';

interface ToolCallProps {
  item: ToolItem;
  disclosure: Disclosure;
  /** Open payloads by default; failed results are always open by default. */
  expandByDefault: boolean;
}

/** A tool call with its paired result, each independently expandable. */
export function ToolCall({ item, disclosure, expandByDefault }: ToolCallProps) {
  const { call, result } = item;
  const hasError = itemHasError(item);
  const callKey = disclosureKey.call(item.key);
  const resultKey = disclosureKey.result(item.key);
  const resultDefault = expandByDefault || hasError;
  const callOpen = disclosure.isOpen(callKey, expandByDefault);
  const resultOpen = disclosure.isOpen(resultKey, resultDefault);
  const input = toolInput(item);
  const output = toolOutput(item);

  return (
    <div id={stepElementId(item.key)} className="tool-card">
      {call && (
        <>
          <div
            className="step-row tool-card__call"
            aria-expanded={callOpen}
            {...pressable(() => disclosure.toggle(callKey, expandByDefault))}
          >
            <span className="step-row__num">#{pad2(call.index)}</span>
            <span className="step-row__glyph">⇢</span>
            <div className="step-row__body">
              <span className="tool-card__name">{toolName(item)}</span>
              <span className="step-row__preview">{preview(input)}</span>
            </div>
            <div className="step-row__aside">
              <span className="step-row__dur">{formatStepDuration(call.durationMs)}</span>
              <Chevron open={callOpen} />
            </div>
          </div>
          {callOpen && <pre className="payload payload--input">{input}</pre>}
        </>
      )}

      {result ? (
        <>
          <div
            className={cx('step-row tool-card__result', hasError && 'is-error')}
            aria-expanded={resultOpen}
            {...pressable(() => disclosure.toggle(resultKey, resultDefault))}
          >
            <span className="step-row__num">#{pad2(result.index)}</span>
            <span className="step-row__glyph">└</span>
            <div className="step-row__body">
              <span className="tool-card__status">{toolStatusLabel(item)}</span>
              <span className="step-row__preview">{preview(output)}</span>
            </div>
            <div className="step-row__aside">
              <span className="step-row__dur">{formatStepDuration(result.durationMs)}</span>
              <Chevron open={resultOpen} />
            </div>
          </div>
          {resultOpen && <pre className="payload payload--output">{output}</pre>}
        </>
      ) : (
        <div className="step-row tool-card__result is-pending">
          <span />
          <span className="step-row__glyph">└</span>
          <div className="step-row__body">
            <span className="tool-card__status">PENDING</span>
          </div>
          <span />
        </div>
      )}
    </div>
  );
}
