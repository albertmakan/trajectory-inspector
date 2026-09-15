import { useMemo } from 'react';
import { Chevron } from '../../components/Chevron';
import { cx } from '../../lib/cx';
import { pressable, stepElementId } from '../../lib/dom';
import { formatCost, formatStepDuration, formatTokens, pad2, preview, shortId } from '../../lib/format';
import { isFailedStatus, type RunIndex, type RunStatus } from '../../lib/runs';
import {
  buildTimeline, itemHasError, subagentReturn, subagentStatus, toolInput, toolName, toolOutput, toolStatusLabel,
  type AgentItem, type ModelItem, type ToolItem,
} from '../../lib/timeline';
import { disclosureKey, type Disclosure } from './disclosure';

const RETURN_LABEL: Record<RunStatus, string> = {
  success: 'RETURNED TO PARENT',
  failure: 'SUBAGENT FAILED',
  timeout: 'SUBAGENT TIMED OUT',
  in_progress: 'SUBAGENT RUNNING',
};

interface SubagentCallProps {
  item: AgentItem;
  index: RunIndex;
  disclosure: Disclosure;
  /** Step number of the enclosing subagent call ("4", "4.2"); absent at the top level. */
  numberPrefix?: string;
}

/**
 * A subagent spawn: a collapsible nested run followed by what it returned to the parent.
 * Renders itself recursively for sub-sub-agents.
 */
export function SubagentCall({ item, index, disclosure, numberPrefix }: SubagentCallProps) {
  const { run, step } = item;
  const key = disclosureKey.agent(item.key);
  const open = disclosure.isOpen(key, false);
  const status = subagentStatus(item);
  const children = useMemo(() => (run ? buildTimeline(run, index) : []), [run, index]);

  const nested = numberPrefix !== undefined;
  const number = nested ? `${numberPrefix}.${step.index}` : `#${pad2(step.index)}`;
  const childPrefix = nested ? `${numberPrefix}.${step.index}` : String(step.index);

  return (
    <div id={nested ? undefined : stepElementId(item.key)} className={cx('agent-card', nested && 'agent-card--nested')}>
      <div className="step-row agent-card__head" aria-expanded={open} {...pressable(() => disclosure.toggle(key, false))}>
        <span className="step-row__num">{number}</span>
        <span className="step-row__glyph">⤷</span>
        <div className="step-row__body">
          <span className="agent-card__label">SUBAGENT</span>
          {run && <span className="agent-card__name">{shortId(run.id)}</span>}
          <span className="agent-card__task">{step.subagentCall?.task ?? run?.task}</span>
        </div>
        <div className="step-row__aside">
          {run && <span className="agent-card__stat">{run.steps.length} nested steps</span>}
          {run && <span className="agent-card__stat">{formatCost(run.totalCost)}</span>}
          <span className="agent-card__dur">{formatStepDuration(step.durationMs)}</span>
          <Chevron open={open} />
        </div>
      </div>

      {open && (
        <div className="nested-run">
          <div className="nested-run__title">
            NESTED RUN · {run ? formatTokens(run.totalTokens) : 'sub-run not found'}
          </div>
          {children.map((child) => {
            switch (child.kind) {
              case 'model':
                return <NestedModel key={child.key} item={child} number={`${childPrefix}.${child.step.index}`} />;
              case 'tool':
                return <NestedTool key={child.key} item={child} prefix={childPrefix} disclosure={disclosure} />;
              case 'agent':
                return <SubagentCall key={child.key} item={child} index={index} disclosure={disclosure} numberPrefix={childPrefix} />;
              case 'error':
                return (
                  <div key={child.key} className="nested-model">
                    <span className="nested-num">{childPrefix}.{child.step.index}</span>
                    <div><span className="nested-tool__err">ERROR</span></div>
                  </div>
                );
            }
          })}
        </div>
      )}

      <div className={cx('agent-return', isFailedStatus(status) && 'is-error')}>
        <div className="agent-return__label">{RETURN_LABEL[status]}</div>
        <pre className="agent-return__body">{subagentReturn(item)}</pre>
      </div>
    </div>
  );
}

function NestedModel({ item, number }: { item: ModelItem; number: string }) {
  const turn = item.step.modelTurn;
  return (
    <div className="nested-model">
      <span className="nested-num">{number}</span>
      <div className="nested-model__body">
        <div className="nested-model__head">
          <span className="nested-model__label">MODEL TURN</span>
          {turn && <span className="nested-model__tokens">{formatTokens(turn.tokens)}</span>}
          <div className="rule rule--violet" />
          <span className="nested-model__dur">{formatStepDuration(item.step.durationMs)}</span>
        </div>
        <div className="nested-model__text">{turn?.text ?? turn?.reasoning}</div>
      </div>
    </div>
  );
}

function NestedTool({ item, prefix, disclosure }: { item: ToolItem; prefix: string; disclosure: Disclosure }) {
  const key = disclosureKey.nested(item.key);
  const open = disclosure.isOpen(key, false);
  const first = (item.call ?? item.result)!;
  const output = toolOutput(item);
  const label = toolStatusLabel(item);

  return (
    <div className="nested-tool" aria-expanded={open} {...pressable(() => disclosure.toggle(key, false))}>
      <div className="nested-tool__row">
        <span className="nested-num">{prefix}.{first.index}</span>
        <span className="nested-tool__glyph">⇢</span>
        <div className="step-row__body">
          <span className="nested-tool__name">{toolName(item)}</span>
          {itemHasError(item) ? (
            <span className="nested-tool__err">{label}</span>
          ) : (
            <span className="nested-tool__ok">{label}</span>
          )}
          <span className="nested-tool__preview">{preview(output)}</span>
        </div>
        <div className="nested-tool__aside">
          <span className="nested-tool__dur">{formatStepDuration((item.result ?? first).durationMs)}</span>
          <Chevron open={open} />
        </div>
      </div>
      {open && (
        <div className="nested-tool__payloads">
          <pre className="nested-payload nested-payload--input">{toolInput(item)}</pre>
          <pre className="nested-payload nested-payload--output">{output}</pre>
        </div>
      )}
    </div>
  );
}
