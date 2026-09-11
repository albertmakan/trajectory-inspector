import type { ReactNode } from 'react';
import { cx } from '../lib/cx';

interface ChipProps {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  variant?: 'tag' | 'compact' | 'page';
}

/** Toggle-style filter button used for step filters, status/tag filters and pagination. */
export function Chip({ active, onClick, children, variant }: ChipProps) {
  return (
    <button
      type="button"
      className={cx('chip', variant && `chip--${variant}`, active && 'is-active')}
      aria-pressed={active}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
