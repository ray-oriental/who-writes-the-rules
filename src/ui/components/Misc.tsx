import type { ReactNode } from 'react';
import { cx } from '../lib/delegations';
import { IconButton } from './Button';
import { Icon, type IconName } from './Icon';
import './Misc.css';

// ─────────────────────────────── Section ───────────────────────────────

export interface SectionProps {
  /** Optional ordinal shown before the title ("1", "2"...) for step-by-step forms. */
  number?: string | number;
  title: ReactNode;
  /** Right-aligned element in the heading row (a count, a quiet button). */
  aside?: ReactNode;
  /** h2 by default; use 3 inside another section. */
  level?: 2 | 3;
  children: ReactNode;
  className?: string;
  id?: string;
}

/** A titled region separated by a hairline above its heading. Not a box. */
export function Section({ number, title, aside, level = 2, children, className, id }: SectionProps) {
  const H = level === 2 ? 'h2' : 'h3';
  const headingId = id ? `${id}-title` : undefined;
  return (
    <section className={cx('section', `section--h${level}`, className)} id={id} aria-labelledby={headingId}>
      <div className="section__head">
        <H className="section__title" id={headingId}>
          {number !== undefined && <span className="section__number">{number}</span>}
          {title}
        </H>
        {aside && <div className="section__aside">{aside}</div>}
      </div>
      {children}
    </section>
  );
}

// ──────────────────────────────── Chip ────────────────────────────────

export type ChipTone = 'neutral' | 'ok' | 'warn' | 'danger' | 'info' | 'accent';

/** Small status label: outcome type, "offline fallback", "Track 2", tag hits. Never put one inside a button. */
export function Chip({ tone = 'neutral', icon, children }: { tone?: ChipTone; icon?: IconName; children: ReactNode }) {
  return (
    <span className={cx('chip', `chip--${tone}`)}>
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  );
}

// ─────────────────────────────── Banner ───────────────────────────────

export interface BannerProps {
  tone?: 'error' | 'warn' | 'info';
  title?: ReactNode;
  children?: ReactNode;
  onDismiss?: () => void;
  /** Extra actions (buttons) placed at the end. */
  actions?: ReactNode;
}

/** Full-width message strip. error: recoverable game errors. warn: "offline fallback" and degraded modes. */
export function Banner({ tone = 'info', title, children, onDismiss, actions }: BannerProps) {
  const icon: IconName = tone === 'error' ? 'alert' : tone === 'warn' ? 'offline' : 'info';
  return (
    <div className={cx('banner', `banner--${tone}`)} role={tone === 'error' ? 'alert' : 'status'}>
      <Icon name={icon} className="banner__icon" />
      <div className="banner__body">
        {title && <p className="banner__title">{title}</p>}
        {children && <div className="banner__text">{children}</div>}
      </div>
      {actions && <div className="banner__actions">{actions}</div>}
      {onDismiss && <IconButton icon="close" label="Dismiss" onClick={onDismiss} />}
    </div>
  );
}

// ───────────────────────────── TypingDots ─────────────────────────────

/** Three pulsing dots. `label` is read by screen readers ("China is typing"). */
export function TypingDots({ label = 'Typing' }: { label?: string }) {
  return (
    <span className="typing" role="status" aria-label={label}>
      <span className="typing__dot" />
      <span className="typing__dot" />
      <span className="typing__dot" />
    </span>
  );
}

// ───────────────────────────── EmptyState ─────────────────────────────

/** For lists with nothing in them yet. One sentence, optionally one action. */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <p className="empty__title">{title}</p>
      {children && <p className="empty__text">{children}</p>}
      {action && <div className="empty__action">{action}</div>}
    </div>
  );
}

// ───────────────────────────── Stat line ─────────────────────────────

/** A big number with a caption: "4 of 6 / at the table". Used in summaries. */
export function Figure({
  value,
  label,
  tone,
}: {
  value: ReactNode;
  label: ReactNode;
  tone?: 'ok' | 'danger' | 'accent';
}) {
  return (
    <div className={cx('figure', tone && `figure--${tone}`)}>
      <span className="figure__value t-num">{value}</span>
      <span className="figure__label">{label}</span>
    </div>
  );
}

// ───────────────────────────── ScreenHead ─────────────────────────────

/** Top of every screen: small-caps eyebrow, serif title, optional lead paragraph and right-side slot. */
export function ScreenHead({
  eyebrow,
  title,
  lead,
  aside,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <header className="screen-head">
      <div className="screen-head__row">
        <div className="l-stack l-stack--sm">
          {eyebrow && <p className="t-eyebrow">{eyebrow}</p>}
          <h1 className="t-title">{title}</h1>
        </div>
        {aside && <div className="screen-head__aside">{aside}</div>}
      </div>
      {lead && <p className="t-lead">{lead}</p>}
    </header>
  );
}
