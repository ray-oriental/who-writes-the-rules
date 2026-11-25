import type { KeyboardEvent } from 'react';
import type { Id } from '../../engine/types';
import { cx, hueVars, useDelegations } from '../lib/delegations';
import './RoundTable.css';

export type SeatStatus = 'player' | 'present' | 'absent' | 'excluded' | 'walked_out' | 'unknown';

export const DEFAULT_STATUS_LABELS: Record<SeatStatus, string> = {
  player: 'Your seat',
  present: 'At the table',
  absent: 'Declined (empty chair)',
  excluded: 'Not invited',
  walked_out: 'Walked out',
  unknown: 'Invited',
};

export type SeatMark = 'yes' | 'no' | 'wavering';

const MARK_LABELS: Record<SeatMark, string> = { yes: 'yes', no: 'no', wavering: 'wavering' };

export interface RoundTableProps {
  /** Delegation ids in clockwise order from the top (scenario.seats). */
  seats: Id[];
  /** Status per seat; seats without one are 'unknown'. */
  status: Partial<Record<Id, SeatStatus>>;
  /** Seat drawn with a ring: the current speaker, or the card being hovered. */
  highlight?: Id | null;
  /** Small trust value (−3..+3) next to each chair at the table. */
  trust?: Partial<Record<Id, number>>;
  /** A check, cross or tilde on the table beside a seat's name card (vote, or how the seat leans). */
  marks?: Record<string, SeatMark>;
  /** Maximum rendered width in px; the table shrinks with its container. 260–520 looks right. */
  size?: number;
  /** Clickable seats; omitted = read-only picture. */
  onSelectSeat?: (id: Id) => void;
  /** Restrict which seats are clickable (e.g. only playable ones). */
  isSelectable?: (id: Id) => boolean;
  /** Text written on the table top, e.g. the forum, and a smaller line under it. */
  centerLabel?: string;
  centerSub?: string;
  /** Override status wording used in aria-labels and the legend. */
  statusLabels?: Partial<Record<SeatStatus, string>>;
  /** Accessible name for the whole figure. */
  label?: string;
  className?: string;
  /** Cups on the table (a brief easter egg). */
  coffee?: boolean;
  /** Click on the middle of the table top; decorative. */
  onCentreClick?: () => void;
}

// Geometry in viewBox units (440 × 440).
const VB = 440;
const C = VB / 2;
const R_TABLE = 104;
const R_CARD = 80;
const R_CHAIR = 148;
const PUSH_BACK = 26;
const PUSH_TURN = 22;

function polar(r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

function formatTrust(t: number): string {
  if (t > 0) return `+${t}`;
  if (t < 0) return `−${Math.abs(t)}`;
  return '0';
}

/** A chair seen from above, in local coordinates with the table towards +y. */
function Chair() {
  return (
    <g className="rt__chair">
      <rect className="rt__back" x={-26} y={-26} width={52} height={10} rx={4} />
      <rect className="rt__seatpad" x={-22} y={-14} width={44} height={34} rx={7} />
    </g>
  );
}

/**
 * The central image of the game: a round table seen from above with one chair per delegation.
 * Empty chair = declined. Chair pushed back = walked out. No chair, only a name = not invited.
 */
export function RoundTable({
  seats,
  status,
  highlight,
  trust,
  marks,
  size = 400,
  onSelectSeat,
  isSelectable,
  centerLabel,
  centerSub,
  statusLabels,
  label = 'Round table',
  className,
  coffee,
  onCentreClick,
}: RoundTableProps) {
  const { get } = useDelegations();
  const labels = { ...DEFAULT_STATUS_LABELS, ...statusLabels };
  const n = Math.max(seats.length, 1);

  return (
    <figure className={cx('rt', className)} style={{ maxWidth: size }}>
      <svg className="rt__svg" viewBox={`0 0 ${VB} ${VB}`} role="group" aria-label={label}>
        {/* Table top */}
        <circle className="rt__table" cx={C} cy={C} r={R_TABLE} />
        <circle className="rt__table-inlay" cx={C} cy={C} r={R_TABLE - 12} />
        {centerLabel && (
          <text className="rt__center" x={C} y={centerSub ? C - 2 : C + 5} textAnchor="middle">
            {centerLabel}
          </text>
        )}
        {centerSub && (
          <text className="rt__center-sub" x={C} y={centerLabel ? C + 18 : C + 4} textAnchor="middle">
            {centerSub}
          </text>
        )}

        {coffee && (
          <g className="rt__coffee" aria-hidden="true">
            {[0, 72, 144, 216, 288].map(deg => {
              const [cx2, cy2] = polar(R_TABLE - 40, deg + 36);
              return (
                <g key={deg} transform={`translate(${cx2} ${cy2})`}>
                  <circle r={9} />
                  <circle r={5} className="rt__coffee-in" />
                  <path d="M-2 -13 q-3 -4 0 -7 M3 -13 q-3 -4 0 -7" />
                </g>
              );
            })}
          </g>
        )}
        {onCentreClick && (
          <circle className="rt__centre-hit" cx={C} cy={C} r={48} onClick={onCentreClick} aria-hidden="true" />
        )}

        {seats.map((id, i) => {
          const s: SeatStatus = status[id] ?? 'unknown';
          const d = get(id);
          const deg = (360 / n) * i;
          const walked = s === 'walked_out';
          const r = walked ? R_CHAIR + PUSH_BACK : R_CHAIR;
          const [x, y] = polar(r, deg);
          const turn = walked ? PUSH_TURN : 0;
          const [px, py] = polar(R_CARD, deg);
          const [ux, uy] = polar(R_CHAIR + 50, deg);
          // Trust marker: beside the chair, clockwise side.
          const [tx, ty] = polar(R_CHAIR + 6, deg + 15);
          const selectable = !!onSelectSeat && (isSelectable ? isSelectable(id) : true);
          const t = trust?.[id];
          const showTrust = t !== undefined && (s === 'present' || s === 'walked_out');
          const mark = marks?.[id];
          const [mx, my] = polar(R_CARD - 36, deg);
          const ariaLabel = `${d.name}: ${labels[s]}${showTrust ? `, trust ${formatTrust(t!)}` : ''}${mark ? `, mark: ${MARK_LABELS[mark]}` : ''}${highlight === id ? ', highlighted' : ''}`;

          const onKey = (e: KeyboardEvent<SVGGElement>) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onSelectSeat?.(id);
            }
          };

          return (
            <g
              key={id}
              className={cx(
                'rt__seat',
                `rt__seat--${s}`,
                highlight === id && 'rt__seat--hl',
                selectable && 'rt__seat--selectable',
              )}
              style={hueVars(d.hue)}
              role={selectable ? 'button' : 'img'}
              tabIndex={selectable ? 0 : undefined}
              aria-label={ariaLabel}
              onClick={selectable ? () => onSelectSeat!(id) : undefined}
              onKeyDown={selectable ? onKey : undefined}
            >
              <title>{ariaLabel}</title>
              {/* Ring for highlight and keyboard focus */}
              <circle className="rt__ring" cx={x} cy={y} r={36} />
              <circle className="rt__focus" cx={x} cy={y} r={38} />

              {s === 'excluded' ? (
                <circle className="rt__ghost" cx={x} cy={y} r={20} />
              ) : (
                <g
                  className="rt__chair-pos"
                  style={{ transform: `translate(${x}px, ${y}px) rotate(${deg + turn}deg)` }}
                >
                  <Chair />
                </g>
              )}

              {/* Place card on the table edge (none for the uninvited) */}
              {s === 'excluded' ? (
                <text className="rt__card-text rt__card-text--loose" x={px} y={py + 5} textAnchor="middle">
                  {d.short}
                </text>
              ) : (
                <g className="rt__card">
                  <rect className="rt__card-bg" x={px - 23} y={py - 12} width={46} height={24} rx={3} />
                  <text className="rt__card-text" x={px} y={py + 5} textAnchor="middle">
                    {d.short}
                  </text>
                </g>
              )}

              {s === 'player' && (
                <text className="rt__you" x={ux} y={uy + 4} textAnchor="middle">
                  YOU
                </text>
              )}

              {mark && (
                <g className={cx('rt__mark', `rt__mark--${mark}`)} transform={`translate(${mx} ${my})`}>
                  <circle r={11} />
                  <path
                    d={mark === 'yes' ? 'M-5 0.5 L-1.5 4 L5.5 -4' : mark === 'no' ? 'M-4.5 -4.5 L4.5 4.5 M4.5 -4.5 L-4.5 4.5' : 'M-6 1 C-3.5 -4 -1.5 -4 0 -0.5 S3.5 3.5 6 -1.5'}
                  />
                </g>
              )}

              {showTrust && (
                <g className={cx('rt__trust', t! > 0 && 'rt__trust--pos', t! < 0 && 'rt__trust--neg')}>
                  <circle cx={tx} cy={ty} r={12} />
                  <text x={tx} y={ty + 4.5} textAnchor="middle">
                    {formatTrust(t!)}
                  </text>
                </g>
              )}
            </g>
          );
        })}
      </svg>
    </figure>
  );
}

/** Key to the chair states. Pass only the states that can appear on the current screen. */
export function RoundTableLegend({
  items,
  labels,
}: {
  items: SeatStatus[];
  labels?: Partial<Record<SeatStatus, string>>;
}) {
  const all = { ...DEFAULT_STATUS_LABELS, ...labels };
  return (
    <ul className="rt-legend" aria-label="Key">
      {items.map((s) => (
        <li key={s} className={cx('rt-legend__item', 'rt__seat', `rt__seat--${s}`)} style={hueVars(8)}>
          <svg viewBox="-30 -30 60 60" width="18" height="18" aria-hidden="true">
            {s === 'excluded' ? (
              <circle className="rt__ghost" cx={0} cy={0} r={20} />
            ) : (
              <g transform={s === 'walked_out' ? 'rotate(22)' : undefined}>
                <Chair />
              </g>
            )}
          </svg>
          <span>{all[s]}</span>
        </li>
      ))}
    </ul>
  );
}
