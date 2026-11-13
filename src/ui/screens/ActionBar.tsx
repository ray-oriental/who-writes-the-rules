import type { ReactNode } from 'react';

/** Bar fixed to the bottom of the viewport. The page above it needs the `has-action-bar` class. */
export function ActionBar({ note, children, label }: { note?: ReactNode; children: ReactNode; label: string }) {
  return (
    <div className="action-bar" role="region" aria-label={label}>
      <div className="action-bar__inner">
        {note && <p className="action-bar__note">{note}</p>}
        <div className="action-bar__actions">{children}</div>
      </div>
    </div>
  );
}
