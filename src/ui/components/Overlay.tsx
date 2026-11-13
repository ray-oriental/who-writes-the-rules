import { useEffect, useId, useRef, type ReactNode } from 'react';
import { cx } from '../lib/delegations';
import { IconButton } from './Button';
import './Overlay.css';

interface OverlayProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  children: ReactNode;
  /** Buttons at the bottom; put the primary action last. */
  footer?: ReactNode;
}

/**
 * Both overlays use the native <dialog> in modal mode, which gives focus trapping, Esc to close
 * and an inert background for free. Focus returns to the opener on close.
 */
function useModal(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    el.addEventListener('cancel', onCancel);
    return () => el.removeEventListener('cancel', onCancel);
  }, [onClose]);
  return ref;
}

/** Centred modal for confirmations and short forms (rating a proposal, objecting to a report). */
export function Dialog({
  open,
  onClose,
  title,
  children,
  footer,
  size = 'md',
}: OverlayProps & { size?: 'sm' | 'md' | 'lg' }) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      className={cx('overlay', 'dialog', `dialog--${size}`)}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="overlay__frame">
          <header className="overlay__head">
            <h2 className="overlay__title" id={titleId}>
              {title}
            </h2>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </header>
          <div className="overlay__body">{children}</div>
          {footer && <footer className="overlay__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** Side panel from the right for longer forms that keep the page in view (Propose clause). */
export function Drawer({ open, onClose, title, children, footer, width = 440 }: OverlayProps & { width?: number }) {
  const ref = useModal(open, onClose);
  const titleId = useId();
  return (
    <dialog
      ref={ref}
      className="overlay drawer"
      style={{ width }}
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="overlay__frame">
          <header className="overlay__head">
            <h2 className="overlay__title" id={titleId}>
              {title}
            </h2>
            <IconButton icon="close" label="Close" onClick={onClose} />
          </header>
          <div className="overlay__body">{children}</div>
          {footer && <footer className="overlay__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
