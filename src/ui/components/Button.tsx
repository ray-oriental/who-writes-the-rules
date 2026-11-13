import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { cx } from '../lib/delegations';
import { Icon, type IconName } from './Icon';
import './Button.css';

export type ButtonVariant = 'primary' | 'secondary' | 'quiet' | 'danger' | 'decision';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /**
   * primary: the one way forward on a step (ink fill). secondary: alternatives (outline).
   * quiet: low-emphasis text button. danger: destructive. decision: voting / final commitments only (accent).
   */
  variant?: ButtonVariant;
  size?: 'md' | 'lg' | 'sm';
  /** Trailing icon, e.g. 'arrow-right' on a "continue" action. */
  icon?: IconName;
  /** Leading icon. */
  iconBefore?: IconName;
  children: ReactNode;
}

export function Button({
  variant = 'secondary',
  size = 'md',
  icon,
  iconBefore,
  className,
  children,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={cx('button', `button--${variant}`, `button--${size}`, className)} {...rest}>
      {iconBefore && <Icon name={iconBefore} className="button__icon" />}
      <span className="button__label">{children}</span>
      {icon && <Icon name={icon} className="button__icon" />}
    </button>
  );
}

/** Square icon-only button. `label` is required and becomes the aria-label and tooltip. */
export function IconButton({
  icon,
  label,
  className,
  type = 'button',
  ...rest
}: Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: IconName; label: string }) {
  return (
    <button type={type} className={cx('icon-button', className)} aria-label={label} title={label} {...rest}>
      <Icon name={icon} />
    </button>
  );
}
