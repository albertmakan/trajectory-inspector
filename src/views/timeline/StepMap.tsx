import { cx } from '../../lib/cx';
import { pressable, scrollToStep } from '../../lib/dom';
import { pad2 } from '../../lib/format';
import { itemHasError, itemIndex, toolName, toolStatusLabel, type TimelineItem } from '../../lib/timeline';

function itemTitle(item: TimelineItem): string {
  switch (item.kind) {
    case 'model': return 'model turn';
    case 'agent': return `subagent · ${item.step.subagentCall?.task ?? ''}`;
    case 'tool': return `${toolName(item)} · ${toolStatusLabel(item).toLowerCase()}`;
    case 'error': return 'error';
  }
}

/** Sticky rail with one bar per timeline item; click to scroll the timeline to it. */
export function StepMap({ items }: { items: TimelineItem[] }) {
  return (
    <aside className="step-map">
      <div className="step-map__title">STEP MAP</div>
      <div className="step-map__list">
        {items.map((item) => (
          <div
            key={item.key}
            className={cx('step-map__item', `step-map__item--${itemHasError(item) || item.kind === 'error' ? 'err' : item.kind}`)}
            title={itemTitle(item)}
            {...pressable(() => scrollToStep(item.key))}
          >
            <span className="step-map__num">{pad2(itemIndex(item))}</span>
            <div className="step-map__bar" />
          </div>
        ))}
      </div>
    </aside>
  );
}
