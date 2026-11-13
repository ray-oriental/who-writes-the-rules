import { useEffect, useRef, useState } from 'react';
import { useConfig, useGame } from '../../game/context';
import { Button } from '../components/Button';
import { DelegationBadge } from '../components/DelegationBadge';
import { DocPara, DocSection, Document } from '../components/Document';
import { Field, TextArea } from '../components/Forms';
import { Chip, ScreenHead } from '../components/Misc';
import { Dialog } from '../components/Overlay';
import { RoundTable, RoundTableLegend, type SeatMark } from '../components/RoundTable';
import { listNames, useDelegations } from '../lib/delegations';
import { outcomeLabels, tableStatus } from '../lib/play';
import { href } from '../router';
import { ActionBar } from './ActionBar';
import type { GameState, Id, Outcome, RulesConfig, VoteResult } from '../../engine/types';
import './ActionBar.css';
import './Resolution.css';

export function ReportScreen() {
  const { view: { state, derived, busy }, actions } = useGame();
  const { get } = useDelegations();
  const [objectionOpen, setObjectionOpen] = useState(false);
  const [objection, setObjection] = useState('');
  const report = state.reports.find(item => item.track === state.track && item.cycle === state.cycle);
  if (!report) return null;
  const electorate = derived.voters.length || derived.present.length;

  return <div className="l-page l-page--narrow res-screen has-action-bar">
    <Document kicker={state.track === 1 ? 'Draft resolution' : 'Draft technical annex'} title="Report of the rapporteur"
      titleAs="h1" meta={[[ 'Cycle', state.cycle ], [ 'Voting threshold', derived.votes_needed + ' affirmative votes' ]]}>
      {report.fallback && <Chip tone="warn">Offline fallback</Chip>}
      <DocSection n="1." title="Record of deliberation"><p>{report.summary}</p></DocSection>
      <DocSection n="2." title="Text before the table">
        {report.clauses.map((clause, index) => <DocPara key={clause.id} n={'2.' + (index + 1)}>{clause.text}</DocPara>)}
      </DocSection>
      {report.positions.length > 0 && <DocSection n="3." title="Positions">
        {report.positions.map(item => <DocPara key={item.delegation} lead={get(item.delegation).name + '.'}>{item.text}</DocPara>)}
      </DocSection>}
      {report.open_issues.length > 0 && <DocSection n="4." title="Open issues">
        {report.open_issues.map((issue, index) => <DocPara key={index}>{issue}</DocPara>)}
      </DocSection>}
      {report.objection && <DocSection title="Objection on the record"><p>{report.objection}</p></DocSection>}
    </Document>
    <ActionBar label="Report actions" note={derived.votes_needed + ' of ' + electorate + ' votes needed'}>
      {!report.objection && <Button variant="quiet" disabled={!!busy} onClick={() => setObjectionOpen(true)}>Object to summary</Button>}
      <Button variant="decision" disabled={!!busy || !derived.can_call_vote} onClick={() => void actions.callVote()}>Call vote</Button>
    </ActionBar>
    <Dialog open={objectionOpen} onClose={() => setObjectionOpen(false)} title="Object to the summary" footer={
      <Button variant="primary" type="submit" form="report-objection" disabled={!!busy || !objection.trim()}>Request revision</Button>
    }>
      <form id="report-objection" onSubmit={event => {
        event.preventDefault();
        setObjectionOpen(false);
        void actions.objectToReport(objection);
      }}>
        <Field label="What did the report misstate?">{id => <TextArea id={id} rows={4} maxLength={4000}
          value={objection} onChange={event => setObjection(event.target.value)} />}</Field>
      </form>
    </Dialog>
  </div>;
}

function voteSummary(vote: VoteResult, passRule: RulesConfig['pass_rule']): string {
  const votesCast = vote.yes + vote.no;
  if (!votesCast) return 'No eligible delegation cast a vote.';
  const count = vote.yes + ' of ' + votesCast + ' votes were in favour.';
  if (vote.yes < vote.needed) {
    return count + ' The draft needed ' + vote.needed + ' to pass.';
  }
  if (passRule.type === 'iso_double' && vote.no / votesCast > passRule.negative_cap) {
    return count + ' The share of votes against exceeded the ' + new Intl.NumberFormat('en', { style: 'percent' }).format(passRule.negative_cap) + ' limit.';
  }
  return count + ' The threshold was ' + vote.needed + '.';
}

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

const REVEAL_FIRST_MS = 500;
const REVEAL_STEP_MS = 700;

export function VoteScreen() {
  const { state } = useGame().view;
  const vote = state.votes.at(-1);
  if (!vote) return null;
  return <VoteReveal key={vote.track + '-' + vote.cycle} vote={vote} />;
}

function VoteReveal({ vote }: { vote: VoteResult }) {
  const { config } = useConfig();
  const { view: { state, derived, busy }, actions } = useGame();
  const voters = vote.details.filter(detail => detail.eligible)
    .sort((a, b) => Number(b.delegation === state.seat) - Number(a.delegation === state.seat));
  const observers = vote.details.filter(detail => !detail.eligible);
  const total = voters.length;
  const [revealed, setRevealed] = useState(() => prefersReducedMotion() ? total : 0);
  const done = revealed >= total;
  const actionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (done) return;
    const timer = window.setTimeout(() => setRevealed(count => count + 1), revealed === 0 ? REVEAL_FIRST_MS : REVEAL_STEP_MS);
    return () => window.clearTimeout(timer);
  }, [revealed, done]);

  useEffect(() => {
    if (!done || revealed === 0) return;
    actionsRef.current?.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }, [done, revealed]);

  const shown = voters.slice(0, revealed);
  const yes = shown.filter(detail => detail.vote === 'yes').length;
  const no = shown.length - yes;
  const marks: Record<Id, SeatMark> = Object.fromEntries(shown.map(detail => [detail.delegation, detail.vote]));
  const status = Object.fromEntries(vote.details.map(detail => [detail.delegation, detail.delegation === state.seat ? 'player' as const : 'present' as const]));
  const final = state.track === 1 && (vote.passed || state.cycle >= config.rules.max_cycles);
  const cyclesLeft = Math.max(0, config.rules.max_cycles - state.cycle);
  const neededPct = total ? (Math.min(vote.needed, total) / total) * 100 : 0;
  const continueNote = final ? 'The summit closes and the result is read out.'
    : state.track === 2 ? 'Back to the official room, with the experts’ work on record.'
      : 'Back to the room with the same delegations. ' + cyclesLeft + (cyclesLeft === 1 ? ' cycle' : ' cycles') + ' left.';

  return <div className="l-page res-screen">
    <ScreenHead eyebrow={state.track === 1 ? 'Official vote' : 'Expert vote'}
      title={done ? (vote.passed ? 'The text was adopted' : 'The text did not pass') : 'The delegations vote'}
      lead={done ? voteSummary(vote, config.rules.pass_rule) : 'Each delegation states its position in turn.'}
      aside={done ? <Chip tone={vote.passed ? 'ok' : 'danger'}>{vote.passed ? 'Passed' : 'Failed'}</Chip> : undefined} />
    <div className="res-vote">
      <div className="res-vote__table l-stack">
        <RoundTable seats={config.scenario.seats} status={status} marks={marks} size={420}
          label="Round table with votes" />
        <div className="res-tally" role="group" aria-label="Vote tally">
          <div className="res-tally__numbers">
            <span className="res-tally__num res-tally__num--yes"><b className="t-num">{yes}</b> yes</span>
            <span className="res-tally__num res-tally__num--no"><b className="t-num">{no}</b> no</span>
            <span className="res-tally__need">{vote.needed} needed</span>
          </div>
          <div className="res-tally__bar" aria-hidden="true">
            {voters.map((detail, index) => <span key={detail.delegation}
              className={'res-tally__seg' + (index < revealed ? ' res-tally__seg--' + detail.vote : '')} />)}
            <span className="res-tally__mark" style={{ left: neededPct + '%' }} />
          </div>
        </div>
        {!done && <div><Button variant="quiet" size="sm" onClick={() => setRevealed(total)}>Skip</Button></div>}
      </div>
      <div className="res-vote__side l-stack l-stack--lg">
        <ol className="res-statements" aria-live="polite" aria-label="Statements">
          {shown.map(detail => <li key={detail.delegation} className="res-statement">
            <div className="res-statement__head">
              <DelegationBadge id={detail.delegation} withName tone={detail.delegation === state.seat ? 'solid' : 'tint'} />
              <div className="l-cluster">
                {detail.fallback && <Chip tone="warn">Offline fallback</Chip>}
                <Chip tone={detail.vote === 'yes' ? 'ok' : 'danger'} icon={detail.vote === 'yes' ? 'check' : 'close'}>{detail.vote === 'yes' ? 'YES' : 'NO'}</Chip>
              </div>
            </div>
            {detail.statement && <p className="res-statement__text">{detail.statement}</p>}
          </li>)}
          {done && observers.map(detail => <li key={detail.delegation} className="res-statement res-statement--observer">
            <div className="res-statement__head">
              <DelegationBadge id={detail.delegation} withName tone="muted" />
              <Chip>Observer, no vote</Chip>
            </div>
            {detail.statement && <p className="res-statement__text">{detail.statement}</p>}
          </li>)}
        </ol>
        {done && <div className="res-next" ref={actionsRef}>
          <ul className="res-next__list">
            {derived.can_start_track2 && <li>
              <Button disabled={!!busy} onClick={() => void actions.startTrack2()}>Open expert channel</Button>
              <p>Experts agree a technical annex first. It carries weight when you return.</p>
            </li>}
            <li>
              <Button variant="primary" icon="arrow-right" disabled={!!busy} onClick={actions.continueAfterVote}>
                {final ? 'See outcome' : state.track === 2 ? 'Return to the official summit' : 'Open next cycle'}
              </Button>
              <p>{continueNote}</p>
            </li>
          </ul>
        </div>}
      </div>
    </div>
  </div>;
}

const SOMEONE = 'a major power';

function outcomeParagraph(outcome: Outcome, nameOf: (id: Id) => string): string {
  const names = (ids: Id[]) => ids.length ? listNames(ids.map(nameOf)) : SOMEONE;
  switch (outcome.type) {
    case 'full_agreement':
      return 'Every major power was in the room and voted yes. This is rare. Look at what you had to give up to get here.';
    case 'club_standard':
      return 'The text passed, but ' + names(outcome.absent_major) + ' never sat down. It binds the club that wrote it and nobody else.';
    case 'paper_standard':
      return 'Adopted in the room and opposed by ' + names(outcome.opposing_major) + '. Passing a vote is not the same as being carried out.';
    case 'split_standards':
      return 'Your text passed while ' + names(outcome.parallel?.convened_by ?? []) + ' wrote a second standard elsewhere. Engineers now have two rule-books to satisfy.';
    case 'expert_consensus':
      return 'No official text, but the experts agreed a technical annex. Weak, not nothing: the next round starts from it.';
    default:
      return 'No text. This is how most such meetings end.';
  }
}

/** The clause sentences of the official draft that was last put to the vote (or the last one tabled). */
function lastDraft(state: GameState, outcome: Outcome): string[] {
  const reports = state.reports.filter(report => report.track === 1);
  const report = reports.find(item => item.cycle === outcome.final_vote?.cycle) ?? reports.at(-1);
  if (report) return report.clauses.map(clause => clause.text);
  return state.clauses.filter(clause => !clause.from_annex).map(clause => clause.text);
}

export function OutcomeScreen() {
  const { config } = useConfig();
  const { view: { state, derived }, actions } = useGame();
  const { get } = useDelegations();
  const outcome = state.outcome;
  if (!outcome) return null;
  const table = tableStatus(config.scenario.seats, state);
  const marks: Record<Id, SeatMark> = Object.fromEntries((outcome.final_vote?.details ?? [])
    .filter(detail => detail.eligible).map(detail => [detail.delegation, detail.vote]));
  const nameOf = (id: Id) => get(id).name;
  const adopted = outcome.passed && outcome.type !== 'expert_consensus' && outcome.type !== 'no_agreement';
  const published = adopted || !!outcome.annex;
  const key = Array.from(new Set(Object.values(table)));
  const main = adopted
    ? { title: 'Adopted text', kicker: 'Resolution', texts: lastDraft(state, outcome) }
    : outcome.type === 'expert_consensus' && outcome.annex
      ? { title: 'Technical annex', kicker: 'Expert dialogue', texts: outcome.annex.map(clause => clause.text) }
      : { title: 'Last draft', kicker: 'Not adopted', texts: lastDraft(state, outcome) };

  return <div className="l-page res-screen has-action-bar">
    <header className="res-communique">
      <p className="t-eyebrow">Summit outcome</p>
      <h1 className="res-communique__title">{outcomeLabels[outcome.type]}</h1>
      <p className="res-communique__lead">{outcomeParagraph(outcome, nameOf)}</p>
      <div className="res-communique__facts t-meta">
        {outcome.final_vote
          ? <p>{voteSummary(outcome.final_vote, config.rules.pass_rule)}{outcome.opposing_major.length > 0 && ' Major powers voting against: ' + listNames(outcome.opposing_major.map(nameOf)) + '.'}</p>
          : <>
            <p>The official summit ended before a vote was held.</p>
            {state.track === 1 && !derived.quorum_met && <p>
              {derived.present.length} delegations were at the table. {config.rules.quorum} were needed to hold a vote.
            </p>}
          </>}
        {outcome.absent_major.length > 0 && <p>Absent major powers: {listNames(outcome.absent_major.map(nameOf))}.</p>}
      </div>
    </header>
    <div className="res-outcome">
      <aside className="res-outcome__table l-stack">
        <RoundTable seats={config.scenario.seats} status={table} marks={marks} size={340} centerLabel="Summit"
          label="Round table at the close of the summit" />
        <RoundTableLegend items={key} />
        {Object.keys(marks).length > 0 && <p className="t-meta res-outcome__key">A check marks a yes vote, a cross a no.</p>}
      </aside>
      <div className={'res-outcome__docs' + (outcome.parallel && main.texts.length > 0 ? ' res-outcome__docs--pair' : '')}>
        {main.texts.length > 0
          ? <Document size="compact" kicker={main.kicker} title={main.title}>
            {main.texts.map((text, index) => <DocPara key={index} n={(index + 1) + '.'}>{text}</DocPara>)}
          </Document>
          : <p className="t-meta">No clauses reached the table.</p>}
        {outcome.parallel && <Document size="compact" kicker={'Convened by ' + listNames(outcome.parallel.convened_by.map(nameOf))} title="The other standard">
          {outcome.parallel.clauses.map((clause, index) => <DocPara key={index} n={(index + 1) + '.'}>{clause.text}</DocPara>)}
        </Document>}
        {published && <p className="res-outcome__gallery">
          {adopted ? 'This text' : 'This annex'} is now in the <a href={href('gallery')}>Gallery</a>, where other visitors can read and rate it.
        </p>}
      </div>
    </div>
    <ActionBar label="Outcome actions" note="Next: what shaped this result.">
      <Button variant="primary" icon="arrow-right" onClick={actions.openDebrief}>Open debrief</Button>
    </ActionBar>
  </div>;
}
