import { useEffect, type ReactNode } from 'react';
import { useConfig, useGame, useSettings } from '../../game/context';
import { Button } from '../components/Button';
import { DelegationBadge } from '../components/DelegationBadge';
import { Icon } from '../components/Icon';
import { Chip, ScreenHead, type ChipTone } from '../components/Misc';
import { listNames, useDelegations } from '../lib/delegations';
import { outcomeLabels, tableStatus } from '../lib/play';
import { href } from '../router';
import { ActionBar } from './ActionBar';
import type { Id, SoftenEvent } from '../../engine/types';
import './ActionBar.css';
import './Debrief.css';

const TAKEAWAYS: [string, string][] = [
  ['The text decides the vote.', 'Each threshold, verifier and access level you chose made someone’s yes possible or impossible.'],
  ['A good test is not enough.', 'If the others cannot check the result without handing over what they guard, they will not sign.'],
  ['The room is decided before the talking starts.', 'The venue, the agenda and the guest list fixed who could agree to anything.'],
];

const STATUS: Record<string, { label: string; tone: ChipTone }> = {
  present: { label: 'Attended', tone: 'ok' },
  player: { label: 'Attended', tone: 'ok' },
  absent: { label: 'Declined', tone: 'warn' },
  excluded: { label: 'Not invited', tone: 'neutral' },
  walked_out: { label: 'Walked out', tone: 'danger' },
  unknown: { label: 'Not invited', tone: 'neutral' },
};

function tagLabel(tag: string): string {
  return tag.replace(/_/g, ' ');
}

function phaseLabel(phase: string): string {
  if (phase === 'prequiz') return 'Opening questions';
  if (phase === 'postquiz') return 'Follow-up questions';
  return phase[0].toUpperCase() + phase.slice(1);
}

function Fold({ title, children, open }: { title: ReactNode; children: ReactNode; open?: boolean }) {
  return <details className="debrief__fold" open={open}>
    <summary>{title}</summary>
    <div className="l-stack">{children}</div>
  </details>;
}

export function DebriefScreen() {
  const { config } = useConfig();
  const { view: { state, derived }, actions } = useGame();
  const { settings } = useSettings();
  const { get } = useDelegations();
  const played = state.phase === 'done';
  const kiosk = settings.kiosk;
  const forumName = (id?: string) => config.forums.find(forum => forum.id === id)?.name ?? id;
  const agenda = config.convene.agenda_scopes.find(scope => scope.id === state.choices?.agenda_scope);
  const table = tableStatus(config.scenario.seats, state);
  const templateLabel = (id: Id) => config.catalog.find(item => item.id === id)?.label ?? id;

  useEffect(() => {
    if (played) window.scrollTo(0, 0);
  }, [played]);

  // Group softened positions by the player's message; the sentence is quoted once.
  const grouped = new Map<string, SoftenEvent[]>();
  for (const event of state.soften_log) grouped.set(event.message_id, [...(grouped.get(event.message_id) ?? []), event]);
  const argumentsMoved = Array.from(grouped.entries()).map(([id, events]) => ({
    id,
    text: state.messages.find(message => message.id === id)?.text,
    tags: Array.from(new Set(events.map(event => event.tag))),
    effects: events.reduce<{ delegation: Id; must_have: Id }[]>((all, event) =>
      all.some(item => item.delegation === event.delegation && item.must_have === event.must_have)
        ? all : [...all, { delegation: event.delegation, must_have: event.must_have }], []),
  })).filter(item => item.text);

  // A clause counts as changed only if its wording differs from the first version that was tabled.
  const reworded = (clause: (typeof state.clauses)[number]) =>
    clause.history.length > 0 && clause.history[0].text !== clause.text;
  const changed = state.clauses.filter(reworded);
  const unchanged = state.clauses.filter(clause => !reworded(clause));

  const seats = config.scenario.seats.length;
  const absentNames = (state.outcome?.absent_major ?? []).map(id => get(id).name);
  const attendedLine = derived.present.length + ' of ' + seats + ' delegations attended'
    + (absentNames.length ? '; ' + listNames(absentNames) + ' stayed away.' : '.');
  const lastVote = state.votes.at(-1);
  const voteLine = lastVote
    ? 'The last vote ' + (lastVote.passed ? 'passed' : 'failed') + ' with ' + lastVote.yes + ' yes and ' + lastVote.no + ' no (' + lastVote.needed + ' needed).'
    : 'No vote was held.';
  const argumentLine = argumentsMoved.length
    ? argumentsMoved.length + (argumentsMoved.length === 1 ? ' of your statements' : ' of your statements') + ' softened a position, and ' + changed.length + (changed.length === 1 ? ' clause was' : ' clauses were') + ' reworded along the way.'
    : 'None of your statements shifted a position.';

  return <div className="l-page l-page--narrow debrief has-action-bar">
    {played && <p className="debrief__thanks" role="status">Thank you. Your answers are saved.</p>}
    <ScreenHead title="Summit debrief" eyebrow="What happened, and why"
      aside={state.outcome && <Chip tone="accent">{outcomeLabels[state.outcome.type]}</Chip>} />

    <section className="debrief__decided" aria-labelledby="debrief-decided">
      <h2 className="debrief__decided-title" id="debrief-decided">What decided this game</h2>
      <ul className="debrief__bullets">
        <li>{attendedLine}</li>
        <li>{voteLine}</li>
        <li>{argumentLine}</li>
      </ul>
      {derived.counterfactuals.length > 0 && <div className="debrief__callouts">
        {derived.counterfactuals.map((item, index) => <p key={index} className="debrief__callout">
          <Icon name="info" size={16} /><span>{item.description}</span>
        </p>)}
      </div>}
    </section>

    <p className="t-eyebrow debrief__more-label">More detail</p>
    <Fold title="Who came, and why">
      {state.choices && <p className="t-meta">{forumName(state.choices.forum)}{agenda ? ' · ' + agenda.label : ''}</p>}
      <ul className="debrief__rows">{state.attendance.filter(item => item.delegation !== state.seat).map(item => {
        const walkout = state.walkouts.find(entry => entry.delegation === item.delegation);
        const status = STATUS[table[item.delegation] ?? 'unknown'];
        const reason = item.reasons[0]?.say;
        return <li key={item.delegation} className="debrief__row">
          <DelegationBadge id={item.delegation} withName />
          <div className="debrief__row-body">
            <Chip tone={status.tone}>{status.label}</Chip>
            {reason && <p>{reason}</p>}
            {walkout && <p>{walkout.say}</p>}
          </div>
        </li>;
      })}</ul>
      <details className="debrief__more">
        <summary>Show the numbers</summary>
        <table className="debrief__table">
          <thead><tr><th scope="col">Delegation</th><th scope="col">Willingness</th><th scope="col">Needed to attend</th></tr></thead>
          <tbody>{state.attendance.map(item => <tr key={item.delegation}>
            <th scope="row">{get(item.delegation).name}</th><td className="t-num">{item.score}</td><td className="t-num">{item.threshold}</td>
          </tr>)}</tbody>
        </table>
      </details>
    </Fold>

    <Fold title="What the text cost">
      {state.votes.length === 0 && <p className="t-meta">No vote was held.</p>}
      <ul className="debrief__rows">{state.votes.map(vote => <li key={vote.track + '-' + vote.cycle} className="debrief__vote">
        <span>{vote.track === 1 ? 'Official summit' : 'Expert channel'}, cycle {vote.cycle}</span>
        <span className="t-meta">{vote.yes} yes, {vote.no} no, {vote.needed} needed</span>
        <Chip tone={vote.passed ? 'ok' : 'danger'}>{vote.passed ? 'Passed' : 'Failed'}</Chip>
      </li>)}</ul>
      {changed.length > 0 && <ul className="debrief__changes" aria-label="Clauses that changed">
        {changed.map(clause => <li key={clause.id}>
          <p className="t-eyebrow">{templateLabel(clause.template)}</p>
          <p className="debrief__before">{clause.history[0].text}</p>
          <p className="debrief__after"><Icon name="arrow-right" size={14} /> {clause.text}</p>
        </li>)}
      </ul>}
      {changed.length === 0 && state.clauses.length > 0 && <p className="t-meta">No clause was reworded after it was first tabled.</p>}
      {unchanged.length > 0 && <details className="debrief__more">
        <summary>{unchanged.length} {unchanged.length === 1 ? 'clause' : 'clauses'} stayed as first proposed</summary>
        <ul className="debrief__plain">{unchanged.map(clause => <li key={clause.id}><b>{templateLabel(clause.template)}.</b> {clause.text}</li>)}</ul>
      </details>}
    </Fold>

    <Fold title="Which of your arguments moved someone">
      {argumentsMoved.length === 0
        ? <p>None of your arguments shifted a position. Arguments about how results can be verified tend to.</p>
        : <ul className="debrief__rows">{argumentsMoved.map(item => <li key={item.id} className="debrief__arg">
          <blockquote className="debrief__quote">{item.text}</blockquote>
          <div className="l-cluster">{item.tags.map(tag => <Chip key={tag} tone="info">{config.tags.find(item => item.id === tag)?.label ?? tagLabel(tag)}</Chip>)}</div>
          <ul className="debrief__moved">{item.effects.map(effect => {
            const label = get(effect.delegation).config?.must_haves.find(entry => entry.id === effect.must_have)?.label ?? effect.must_have;
            return <li key={effect.delegation + effect.must_have}>
              <DelegationBadge id={effect.delegation} size="sm" />
              <span>softened <i>{label}</i></span>
            </li>;
          })}</ul>
        </li>)}</ul>}
    </Fold>

    <Fold title="What each delegation would never accept">
      <div className="debrief__lines">{config.delegations.map(delegation => <div key={delegation.id} className="debrief__line">
        <DelegationBadge id={delegation.id} withName size="sm" />
        <ul>{delegation.red_lines.map(line => <li key={line.id}><b>{line.label}.</b> {line.say}</li>)}</ul>
      </div>)}</div>
    </Fold>

    <Fold title="Three things to take away">
      <ol className="debrief__takeaways">{TAKEAWAYS.map(([head, body]) => <li key={head}><b>{head}</b> {body}</li>)}</ol>
    </Fold>

    {state.previous && <Fold title="Comparison with your previous summit">
      <p>Previous: {forumName(state.previous.choices.forum)}, {outcomeLabels[state.previous.outcome]}, {state.previous.attended.length} attended, {state.previous.yes} in favour.</p>
      {state.outcome && <p>Current: {forumName(state.choices?.forum)}, {outcomeLabels[state.outcome.type]}, {derived.present.length} attended, {state.outcome.final_vote?.yes ?? 0} in favour.</p>}
    </Fold>}

    <Fold title="Session timeline">
      <ol className="debrief__plain">{state.timeline.map((step, index) => <li key={index}>
        {phaseLabel(step.phase)}
        <span className="t-meta">{' · Track ' + step.track + ' · ' + Math.max(0, Math.round((step.at - state.started_at) / 1000)) + 's elapsed'}</span>
      </li>)}</ol>
    </Fold>

    <ActionBar label="Debrief actions">
      {played ? <>
        <a className="debrief__gallery" href={href('gallery')}>See the Gallery</a>
        {kiosk
          ? <>
            <Button onClick={actions.replay}>Replay with different convening</Button>
            <Button variant="primary" size="lg" onClick={actions.newGame}>Next player</Button>
          </>
          : <>
            <Button variant="secondary" onClick={actions.newGame}>New game</Button>
            <Button variant="primary" onClick={actions.replay}>Replay with different convening</Button>
          </>}
      </> : <Button variant="primary" icon="arrow-right" onClick={actions.finishDebrief}>
        {config.quiz.enabled ? 'Continue to follow-up questions' : 'Finish game'}
      </Button>}
    </ActionBar>
  </div>;
}
