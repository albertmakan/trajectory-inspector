import type { CSSProperties, ReactNode } from 'react';
import { cx } from '../lib/cx';

export interface LegendItem {
  label: string;
  swatch: CSSProperties;
}

export function Legend({ items, className, children }: { items: LegendItem[]; className?: string; children?: ReactNode }) {
  return (
    <div className={cx('legend', className)}>
      {items.map((item) => (
        <span key={item.label} className="legend__item">
          <span className="legend__swatch" style={item.swatch} />
          {item.label}
        </span>
      ))}
      {children}
    </div>
  );
}
