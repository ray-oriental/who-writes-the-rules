import { useMemo, type CSSProperties } from 'react';
import type { DelegationConfig, Id } from '../../engine/types';
import { useConfig } from '../../game/context';

/** Join class names, skipping falsy values. */
export function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

export const PALETTE_SIZE = 8;

export interface DelegationInfo {
  id: Id;
  name: string;
  short: string;
  /** 1-based palette slot, assigned by seat order. */
  hue: number;
  config?: DelegationConfig;
}

/**
 * Seat-ordered delegation lookup. Colour comes from the seat position, so the palette never
 * encodes identity. Unknown ids get a neutral entry rather than throwing.
 */
export function useDelegations() {
  const { config } = useConfig();
  return useMemo(() => {
    const byId = new Map<Id, DelegationInfo>();
    const seats = config.scenario.seats;
    const order = [...seats, ...config.delegations.map((d) => d.id).filter((id) => !seats.includes(id))];
    order.forEach((id, i) => {
      const d = config.delegations.find((x) => x.id === id);
      byId.set(id, {
        id,
        name: d?.name ?? id,
        short: d?.short ?? id.slice(0, 3).toUpperCase(),
        hue: (i % PALETTE_SIZE) + 1,
        config: d,
      });
    });
    const get = (id: Id): DelegationInfo =>
      byId.get(id) ?? { id, name: id, short: id.slice(0, 3).toUpperCase(), hue: PALETTE_SIZE };
    return { seats, get, all: order.map((id) => byId.get(id)!) };
  }, [config]);
}

/** CSS custom properties for a delegation's hue, for use in style={...}. */
export function hueVars(hue: number): CSSProperties {
  return {
    ['--d' as string]: `var(--deleg-${hue})`,
    ['--d-tint' as string]: `var(--deleg-${hue}-tint)`,
  } as CSSProperties;
}

/** "CN, US and EU" */
export function listNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}
