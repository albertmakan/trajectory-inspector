import { cx } from '../lib/cx';

interface StatusScreenProps {
  title: string;
  detail: string;
  error?: boolean;
}

/** The whole-page message shown while runs load, or when they can't be loaded. */
export function StatusScreen({ title, detail, error = false }: StatusScreenProps) {
  return (
    <div className={cx('status-screen', error && 'is-error')} role={error ? 'alert' : 'status'}>
      <span className="status-screen__title">{title}</span>
      <span className="status-screen__detail">{detail}</span>
    </div>
  );
}
