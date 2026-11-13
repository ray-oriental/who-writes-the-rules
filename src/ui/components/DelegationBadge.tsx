import type { Id } from '../../engine/types';
import { cx, hueVars, useDelegations } from '../lib/delegations';
import './DelegationBadge.css';

export interface DelegationBadgeProps {
  id: Id;
  /** Show the full name after the letters. */
  withName?: boolean;
  size?: 'sm' | 'md' | 'lg';
  /** solid: filled with the hue (the player's own seat, the active speaker). */
  tone?: 'tint' | 'solid' | 'muted';
  className?: string;
}

/**
 * Neutral letter badge for a delegation (CN, US, EU, LAB...). Never a flag.
 * Colour comes from the seat order via the --deleg-N palette.
 */
export function DelegationBadge({ id, withName, size = 'md', tone = 'tint', className }: DelegationBadgeProps) {
  const { get } = useDelegations();
  const d = get(id);
  return (
    <span className={cx('badge', `badge--${size}`, `badge--${tone}`, className)} style={hueVars(d.hue)}>
      <abbr className="badge__mark" title={d.name} aria-label={withName ? undefined : d.name}>
        <span aria-hidden={withName ? undefined : true}>{d.short}</span>
      </abbr>
      {withName && <span className="badge__name">{d.name}</span>}
    </span>
  );
}
