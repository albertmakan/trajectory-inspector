export function Chevron({ open }: { open: boolean }) {
  return (
    <span className="chevron" aria-hidden="true">
      {open ? '▾' : '▸'}
    </span>
  );
}
