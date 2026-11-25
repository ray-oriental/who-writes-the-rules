import { useEffect, useMemo, useState } from 'react';
import type { AttendanceResult, Id } from '../../engine/types';
import { useConfig, useGame } from '../../game/context';
import { Button } from '../components/Button';
import { DelegationBadge } from '../components/DelegationBadge';
import { DocPara, DocSection, Document } from '../components/Document';
import { Chip, Figure, ScreenHead } from '../components/Misc';
import { RoundTable, RoundTableLegend, type SeatStatus } from '../components/RoundTable';
import { listNames, useDelegations } from '../lib/delegations';
import './Attendance.css';

const STEP_MS = 450;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '0';
}

function Letter({ result, forumName }: { result: AttendanceResult; forumName: string }) {
  const { get } = useDelegations();
  const d = get(result.delegation);
  const excluded = result.status === 'excluded';
  const parallel = result.reasons.some((r) => r.action === 'consider_parallel_forum');
  return (
    <Document
      as="article"
      size="compact"
      className="attendance__letter"
      kicker={excluded ? 'Note · not invited' : 'Note verbale · regrets'}
      seal={<DelegationBadge id={d.id} />}
      title={`Delegation of ${d.name}`}
      titleAs="h3"
      meta={[['Re', `Invitation to the ${forumName}`]]}
      aria-label={`${excluded ? 'Note from' : 'Letter of regret from'} ${d.name}`}
    >
      {result.letter && <DocPara>{result.letter}</DocPara>}
      {(result.reasons.length > 0 || !excluded) && (
        <DocSection title="Reasons recorded">
          {result.reasons.map((r, i) => (
            <DocPara
              key={r.id}
              n={`${i + 1}.`}
              aside={
                r.action === 'refuse'
                  ? 'Refuses regardless of score'
                  : r.action === 'consider_parallel_forum'
                    ? 'May convene a parallel forum'
                    : r.modifier !== undefined
                      ? `Willingness ${signed(r.modifier)}`
                      : undefined
              }
            >
              {r.say}
            </DocPara>
          ))}
          {!excluded && (
            <DocPara n={`${result.reasons.length + 1}.`}>
              Willingness {result.score} against a threshold of {result.threshold}.
            </DocPara>
          )}
        </DocSection>
      )}
      {parallel && (
        <div className="attendance__flag">
          <Chip tone="warn" icon="alert">
            Parallel forum likely
          </Chip>
        </div>
      )}
    </Document>
  );
}

export function AttendanceScreen() {
  const { config } = useConfig();
  const { view, actions } = useGame();
  const { state, derived, busy } = view;
  const { get } = useDelegations();
  const seats = config.scenario.seats;
  const rules = config.rules;
  const forum = config.forums.find((f) => f.id === state.choices?.forum);
  const forumName = forum?.name ?? 'meeting';

  // Invited delegations are revealed one at a time, in seat order.
  const order = useMemo(
    () => seats.filter((id) => state.attendance.find((a) => a.delegation === id && a.status !== 'excluded')),
    [seats, state.attendance],
  );
  const [revealed, setRevealed] = useState(() => (prefersReducedMotion() ? order.length : 0));
  useEffect(() => {
    if (prefersReducedMotion()) {
      setRevealed(order.length);
      return;
    }
    setRevealed(0);
    let i = 0;
    const t = window.setInterval(() => {
      i += 1;
      setRevealed(i);
      if (i >= order.length) window.clearInterval(t);
    }, STEP_MS);
    return () => window.clearInterval(t);
  }, [order, state.convene_attempts]);
  const done = revealed >= order.length;
  const shown = new Set(order.slice(0, revealed));

  const walked = new Set(state.walkouts.map((w) => w.delegation));
  const status: Record<Id, SeatStatus> = {};
  for (const id of seats) {
    if (id === state.seat) {
      status[id] = 'player';
      continue;
    }
    const a = state.attendance.find((x) => x.delegation === id);
    if (!a || a.status === 'excluded') status[id] = 'excluded';
    else if (!shown.has(id)) status[id] = 'unknown';
    else if (walked.has(id)) status[id] = 'walked_out';
    else status[id] = a.status === 'attend' ? 'present' : 'absent';
  }

  const letters = seats
    .map((id) => state.attendance.find((a) => a.delegation === id))
    .filter((a): a is AttendanceResult => !!a && a.status !== 'attend')
    .filter((a) => a.status === 'excluded' || shown.has(a.delegation));

  const present = derived.present;
  const absentMajors = rules.major_powers.filter((id) => id !== state.seat && !present.includes(id));
  const attemptsLeft = Math.max(0, rules.reconvene_attempts - (state.convene_attempts - 1));
  const quorum = derived.quorum_met;
  const disabled = !!busy || !done;

  return (
    <div className="l-page attendance">
      <ScreenHead
        eyebrow={`${forumName}${state.track === 2 ? ' · Expert dialogue' : ''}`}
        title={!done ? 'Replies are coming in' : quorum ? 'The session can open' : 'Not enough delegations came'}
      />

      <div className="attendance__grid">
        <section className="l-sticky attendance__table" aria-label="Seating">
          <RoundTable
            seats={seats}
            status={status}
            highlight={!done ? (order[revealed] ?? null) : null}
            size={420}
            centerLabel={done ? `${present.length} of ${seats.length}` : '…'}
            centerSub={done ? 'at the table' : 'awaiting replies'}
            label="Attendance"
          />
          <RoundTableLegend items={['player', 'present', 'absent', 'excluded']} />
        </section>

        <div className="attendance__side">
          <section className="attendance__decision" aria-labelledby="attendance-summary-title">
            <h2 id="attendance-summary-title" className="u-visually-hidden">
              Summary
            </h2>
            <div className="attendance__summary" id="attendance-summary" aria-live="polite">
              {done ? (
                <>
                  <div className="attendance__figures">
                    <Figure value={`${present.length} of ${seats.length}`} label="at the table" />
                    <Figure
                      value={quorum ? 'Met' : 'Not met'}
                      label={`quorum of ${rules.quorum}`}
                      tone={quorum ? 'ok' : 'danger'}
                    />
                  </div>
                  <p className="attendance__line">
                    <span className="t-meta">At the table</span>
                    <span className="attendance__badges">
                      {present.map((id) => (
                        <DelegationBadge key={id} id={id} size="sm" tone={id === state.seat ? 'solid' : 'tint'} />
                      ))}
                    </span>
                  </p>
                  {absentMajors.length > 0 && (
                    <p className="attendance__note">
                      {listNames(absentMajors.map((id) => get(id).name))} {absentMajors.length === 1 ? 'is' : 'are'} not
                      at the table. Anything agreed here will not bind {absentMajors.length === 1 ? 'it' : 'them'}.
                    </p>
                  )}
                </>
              ) : (
                <p className="t-meta">
                  {revealed} of {order.length} replies received
                </p>
              )}
            </div>

            <div className="attendance__actions">
              {!done && (
                <Button variant="quiet" onClick={() => setRevealed(order.length)}>
                  Show all replies
                </Button>
              )}
              {done && quorum && (
                <Button variant="primary" size="lg" icon="arrow-right" disabled={disabled} onClick={actions.enterRoom}>
                  Enter the room
                </Button>
              )}
              {done && derived.can_reconvene && (
                <Button
                  variant={quorum ? 'secondary' : 'primary'}
                  size={quorum ? 'md' : 'lg'}
                  iconBefore="refresh"
                  disabled={disabled}
                  onClick={actions.reconvene}
                >
                  {state.track === 2 ? 'Return to the official summit' : 'Reconvene (' + attemptsLeft + ' left)'}
                </Button>
              )}
              {done && derived.can_start_track2 && (
                <Button variant="secondary" disabled={disabled} onClick={() => void actions.startTrack2()}>
                  Open the expert channel
                </Button>
              )}
              {done && !quorum && (
                <Button variant="danger" disabled={disabled} onClick={actions.concede}>
                  Concede
                </Button>
              )}
            </div>
          </section>

          {letters.length > 0 && (
            <details className="attendance__letters">
              <summary className="attendance__letters-title">
                Why some did not come
                <span className="t-meta t-num">{letters.length}</span>
              </summary>
              <ol className="attendance__list">
                {letters.map((a) => (
                  <li key={a.delegation} className="attendance__item">
                    <details className="attendance__entry">
                      <summary>
                        <DelegationBadge id={a.delegation} size="sm" />
                        <span>{get(a.delegation).name}</span>
                        <span className="t-meta">{a.status === 'excluded' ? 'not invited' : 'declined'}</span>
                      </summary>
                      <Letter result={a} forumName={forumName} />
                    </details>
                  </li>
                ))}
              </ol>
            </details>
          )}
        </div>
      </div>
    </div>
  );
}
