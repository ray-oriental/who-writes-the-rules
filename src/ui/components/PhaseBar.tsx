import type { Phase, Track } from '../../engine/types';
import { cx } from '../lib/delegations';
import './PhaseBar.css';

export const PHASE_STEPS = ['Seat', 'Convene', 'Negotiate', 'Vote', 'Outcome', 'Debrief'] as const;

/** Which of the six steps a game phase belongs to. */
export function stepOf(phase: Phase): number {
  switch (phase) {
    case 'seat':
    case 'rolecard':
    case 'prequiz':
      return 0;
    case 'convene':
    case 'attendance':
      return 1;
    case 'negotiate':
    case 'report':
      return 2;
    case 'vote':
      return 3;
    case 'outcome':
      return 4;
    default:
      return 5;
  }
}

export interface PhaseBarProps {
  phase: Phase;
  track?: Track;
  /** e.g. "Cycle 1 of 3" shown after the steps. */
  detail?: string;
}

/** Where the player is in the game. Read-only: navigation happens through each screen's actions. */
export function PhaseBar({ phase, track = 1, detail }: PhaseBarProps) {
  const current = stepOf(phase);
  return (
    <nav className="phasebar" aria-label="Game progress">
      <ol className="phasebar__list">
        {PHASE_STEPS.map((label, i) => {
          const state = i < current ? 'done' : i === current ? 'current' : 'todo';
          return (
            <li
              key={label}
              className={cx('phasebar__step', `phasebar__step--${state}`)}
              aria-current={state === 'current' ? 'step' : undefined}
            >
              <span className="phasebar__index t-num" aria-hidden="true">
                {i + 1}
              </span>
              <span className="phasebar__label">{label}</span>
              {state === 'done' && <span className="u-visually-hidden"> (done)</span>}
            </li>
          );
        })}
      </ol>
      {(track === 2 || detail) && (
        <p className="phasebar__detail">
          {track === 2 && <span className="phasebar__track">Track 2 · Expert channel</span>}
          {detail && <span>{detail}</span>}
        </p>
      )}
    </nav>
  );
}
