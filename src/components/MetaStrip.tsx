import { cx } from '../lib/cx';
import type { MetaItem } from '../types';

export function MetaStrip({ items, className }: { items: MetaItem[]; className?: string }) {
  return (
    <div className={cx('meta-strip', className)}>
      {items.map((item) => (
        <div key={item.k} className="meta-strip__item">
          <div className="meta-strip__key">{item.k}</div>
          <div className="meta-strip__value">{item.v}</div>
        </div>
      ))}
    </div>
  );
}
