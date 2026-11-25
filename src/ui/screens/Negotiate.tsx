import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { ArgumentTag, Id } from '../../engine/types';
import { useConfig, useGame } from '../../game/context';
import { Button } from '../components/Button';
import { ClauseBuilder } from '../components/ClauseBuilder';
import { DelegationBadge } from '../components/DelegationBadge';
import { Field, RadioCards, Select, TextArea } from '../components/Forms';
import { Icon } from '../components/Icon';
import { Banner, Chip, EmptyState, TypingDots } from '../components/Misc';
import { Dialog } from '../components/Overlay';
import { RoundTable } from '../components/RoundTable';
import { cx, listNames, useDelegations } from '../lib/delegations';
import { tableStatus } from '../lib/play';
import './Summit.css';
import './Negotiate.css';

const LEAN_LABEL = { yes: 'For', no: 'Against', wavering: 'Wavering' } as const;
const AWAY_LABEL = { absent: 'Declined', excluded: 'Not invited', walked_out: 'Walked out' } as const;
const STANCE_TEXT = { support: 'supports', oppose: 'opposes', neutral: 'has no position on' } as const;

type Lean = 'yes' | 'no' | 'wavering';
type Leanings = Record<Id, Lean>;
interface Move { id: Id; from: Lean; to: Lean }
type EffectKind = 'statement' | 'text' | 'offer';
interface RoomEffect { id: number; kind: EffectKind; scope: string; moves: Move[] }

const LEAN_NOW = { yes: 'for', no: 'against', wavering: 'wavering' } as const;
const EFFECT_SUBJECT = {
  statement: 'Your last statement',
  text: 'That change to the text',
  offer: 'That offer',
} as const;

function diffLeanings(before: Leanings, after: Leanings, ids: Id[]): Move[] {
  return ids.flatMap(id => {
    const from = before[id];
    const to = after[id];
    return from && to && from !== to ? [{ id, from, to }] : [];
  });
}

/**
 * A first-person sentence the player can send as is. It contains the tag's first trigger phrase, so the
 * offline tagger recognises it; the rest comes from the tag's description. Both live in the config.
 */
function starterFor(tag: ArgumentTag): string {
  const phrase = tag.examples.map(item => item.trim()).find(Boolean) ?? tag.label.toLowerCase();
  const aim = tag.description.trim().replace(/[.\u3002\s]+$/, '');
  const lead = /^[A-Z][a-z]/.test(aim) ? aim.charAt(0).toLowerCase() + aim.slice(1) : aim;
  return lead ? `We would like to ${lead}, which is why we ask for ${phrase}.` : `We ask for ${phrase}.`;
}

function isAtTranscriptEnd(list: HTMLOListElement) {
  return list.scrollHeight - list.scrollTop - list.clientHeight < 24;
}

/** Cycles through the busy delegations so the table ring visits each one (RoundTable draws a single ring). */
function useRotatingHighlight(who: Id[] | undefined) {
  const [tick, setTick] = useState(0);
  const key = who?.join('|') ?? '';
  useEffect(() => {
    setTick(0);
    if (!who || who.length < 2) return;
    const timer = window.setInterval(() => setTick(value => value + 1), 1200);
    return () => window.clearInterval(timer);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  return who?.length ? who[tick % who.length] : undefined;
}

export function NegotiateScreen() {
  const { config } = useConfig();
  const { view: { state, derived, busy }, actions } = useGame();
  const { get } = useDelegations();
  const [text, setText] = useState('');
  const [address, setAddress] = useState('');
  const [builder, setBuilder] = useState<{ template?: Id } | null>(null);
  const [offer, setOffer] = useState<{ to: Id; payment: string } | null>(null);
  const [idea, setIdea] = useState<Id | null>(null);
  const [effect, setEffect] = useState<RoomEffect | null>(null);
  const ideas = useRef<HTMLDivElement>(null);
  const pending = useRef<{ leanings: Leanings; messages: number; at: number; sawBusy: boolean } | null>(null);
  const stable = useRef<{ leanSig: string; clauseSig: string; payments: number; scope: string; leanings: Leanings } | null>(null);
  const effectSeq = useRef(0);
  const root = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLFormElement>(null);
  const transcript = useRef<HTMLOListElement>(null);
  const previousMessageCount = useRef(0);
  const followingTranscript = useRef(true);
  const lastStarter = useRef('');
  const wasBusy = useRef(false);
  const [canJumpToLatest, setCanJumpToLatest] = useState(false);
  const messages = state.messages.filter(item => item.track === state.track && item.cycle === state.cycle);
  const lastPlayerMessage = messages.filter(message => message.from_player && message.kind === 'speech').at(-1)?.id;
  const delegates = derived.present.filter(id => id !== state.seat);
  const away = config.scenario.seats.filter(id => id !== state.seat && !derived.present.includes(id));
  const templates = config.catalog.filter(item => derived.allowed_templates.includes(item.id));
  const available = templates.filter(item => !state.clauses.some(clause => clause.template === item.id));
  const missingClauses = Math.max(0, config.rules.min_clauses_to_vote - state.clauses.length);
  const reportReady = derived.can_request_report && missingClauses === 0 && derived.quorum_met;
  const complete = Math.min(state.round - 1, derived.rounds_in_cycle);
  const table = tableStatus(config.scenario.seats, state);
  const typing = busy?.who ?? [];
  const ringSeat = useRotatingHighlight(busy?.who)
    ?? messages.filter(item => item.kind === 'speech').at(-1)?.speaker;
  const leanings = derived.leanings;
  const leanCount = (lean: 'yes' | 'no' | 'wavering') => delegates.filter(id => leanings[id] === lean).length;
  const readTheRoom = delegates.some(id => leanings[id]);
  const voteLine = readTheRoom
    ? `${leanCount('yes')} for · ${leanCount('wavering')} wavering · ${leanCount('no')} against`
    : '';
  const likelyYes = leanCount('yes') + (derived.voters.includes(state.seat) ? 1 : 0);
  const offered = (to: Id, payment: string) => state.side_payments.some(item => item.track === state.track
    && item.cycle === state.cycle && item.delegation === to && item.payment === payment);

  useEffect(() => setText(''), [lastPlayerMessage]);

  // Read the room before and after: what did the last statement, clause or offer do to the leanings?
  const scope = `${state.track}:${state.cycle}`;
  const leanSig = JSON.stringify(leanings);
  const clauseSig = state.clauses.map(clause => `${clause.id}:${clause.version}`).join('|');
  const paymentCount = state.side_payments.length;
  const messageCount = state.messages.length;
  useEffect(() => {
    const snapshot = stable.current;
    const here = { leanSig, clauseSig, payments: paymentCount, scope, leanings };
    const wait = pending.current;
    if (busy) {
      if (wait) wait.sawBusy = true;
      return;
    }
    if (wait && (wait.sawBusy || messageCount > wait.messages)) {
      pending.current = null;
      stable.current = here;
      if (Object.keys(wait.leanings).length) {
        setEffect({ id: ++effectSeq.current, kind: 'statement', scope, moves: diffLeanings(wait.leanings, leanings, delegates) });
      }
      return;
    }
    if (wait && Date.now() - wait.at > 3000) pending.current = null; // the send never went through
    stable.current = here;
    if (wait || !snapshot) return;
    if (snapshot.scope !== scope) { setEffect(null); return; }
    if (!Object.keys(snapshot.leanings).length) return;
    const textChanged = snapshot.clauseSig !== clauseSig;
    // A change that moved nobody still replaces the line, so it never describes an earlier change.
    if (snapshot.leanSig === leanSig && !textChanged && snapshot.payments === paymentCount) return;
    const kind: EffectKind = textChanged ? 'text' : 'offer';
    setEffect({ id: ++effectSeq.current, kind, scope, moves: diffLeanings(snapshot.leanings, leanings, delegates) });
  }, [busy, leanSig, clauseSig, paymentCount, messageCount, scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const shownEffect = readTheRoom && effect?.scope === scope ? effect : null;
  const movedTo = (id: Id) => {
    const move = shownEffect?.moves.find(item => item.id === id);
    return move && leanings[id] === move.to ? move : undefined;
  };
  // An argument can ease a delegation's demand without yet changing how it would vote. Say so, instead of "moved nobody".
  const eased = shownEffect?.kind === 'statement' && lastPlayerMessage
    ? delegates.filter(id => state.soften_log.some(event => event.message_id === lastPlayerMessage && event.delegation === id))
    : [];
  const effectLine = shownEffect
    ? shownEffect.moves.length
      ? `${EFFECT_SUBJECT[shownEffect.kind]} moved ${shownEffect.moves.length} ${shownEffect.moves.length === 1 ? 'delegation' : 'delegations'}: `
        + shownEffect.moves.map(move => `${get(move.id).short} is now ${LEAN_NOW[move.to]}`).join(', ') + '.'
      : eased.length
        ? `Your last statement landed with ${listNames(eased.map(id => get(id).short))}, but nobody has changed sides yet.`
        : `${EFFECT_SUBJECT[shownEffect.kind]} moved nobody.`
    : '';
  const showIdeas = () => {
    const group = ideas.current;
    if (!group) return;
    group.scrollIntoView({ block: 'nearest' });
    (group.querySelector<HTMLElement>('button:not(:disabled)') ?? group).focus();
  };

  // Fill the viewport below the shell's header and phase bar; the page itself never scrolls.
  useLayoutEffect(() => {
    const fit = () => {
      const el = root.current;
      if (!el) return;
      const top = el.getBoundingClientRect().top + window.scrollY;
      el.style.setProperty('--neg-h', Math.max(560, window.innerHeight - top) + 'px');
    };
    fit();
    window.addEventListener('resize', fit);
    const observer = new ResizeObserver(fit);
    observer.observe(document.body);
    return () => { window.removeEventListener('resize', fit); observer.disconnect(); };
  }, []);

  useEffect(() => {
    const list = transcript.current;
    if (!list) return;
    const firstNewMessage = previousMessageCount.current
      ? list.children.item(previousMessageCount.current) as HTMLElement | null
      : null;
    if (followingTranscript.current) {
      list.scrollTop = firstNewMessage?.offsetTop ?? list.scrollHeight;
    }
    previousMessageCount.current = messages.length;
    followingTranscript.current = isAtTranscriptEnd(list);
    setCanJumpToLatest(!followingTranscript.current);
  }, [messages.length]);

  // Keep the typing dots in view while the player is following the conversation.
  useEffect(() => {
    const list = transcript.current;
    if (list && typing.length && followingTranscript.current) list.scrollTop = list.scrollHeight;
  }, [typing.length]);

  // After replies arrive, hand the keyboard back to the statement box.
  useEffect(() => {
    if (busy) { wasBusy.current = true; return; }
    if (!wasBusy.current) return;
    wasBusy.current = false;
    composer.current?.querySelector('textarea')?.focus({ preventScroll: true });
  }, [busy]);

  const pickIdea = (id: Id) => {
    const tag = config.tags.find(item => item.id === id);
    if (!tag) return;
    setIdea(id);
    const starter = starterFor(tag);
    const next = !text.trim() || text === lastStarter.current ? starter : text.replace(/\s*$/, ' ') + starter;
    lastStarter.current = next;
    setText(next);
    const area = composer.current?.querySelector('textarea');
    window.setTimeout(() => {
      area?.focus({ preventScroll: true });
      area?.setSelectionRange(next.length, next.length);
    }, 0);
  };

  return <div ref={root} className="l-page l-page--wide summit-screen summit-screen--negotiate neg">
    <h1 className="u-visually-hidden">Negotiating the text</h1>
    <div className="summit-room neg__grid">
      <section className="neg__discussion" aria-label="Negotiation transcript">
        <header className="neg__head">
          <div>
            <h2 className="neg__title">Discussion</h2>
            <p className="t-meta t-num">{state.cycle > 1 && <>Cycle {state.cycle}{' · '}</>}
              <span>{complete} of {derived.rounds_in_cycle} rounds complete</span></p>
          </div>
          <div className="l-cluster">
            {canJumpToLatest && <Button size="sm" variant="quiet" onClick={() => {
              const list = transcript.current;
              if (list) {
                list.focus({ preventScroll: true });
                list.scrollTop = list.scrollHeight;
              }
            }}>Jump to latest</Button>}
            <Chip tone="info">{state.track === 2 ? 'Expert channel' : 'Official negotiation'}</Chip>
          </div>
        </header>
        <ol className="summit-transcript neg__transcript" ref={transcript} aria-label="Messages this cycle" tabIndex={0}
          onScroll={event => {
            followingTranscript.current = isAtTranscriptEnd(event.currentTarget);
            setCanJumpToLatest(!followingTranscript.current);
          }}>
          {messages.map(message => {
            const isChair = message.kind === 'chair' || message.kind === 'system';
            const voice = message.voice
              ? get(message.speaker).config?.voices.find(item => item.id === message.voice)?.label : undefined;
            return <li key={message.id} className={cx('summit-message', isChair && 'summit-message--chair',
              message.from_player && 'neg-msg--you')}>
              {config.scenario.seats.includes(message.speaker) &&
                <div className="l-cluster neg-msg__who"><DelegationBadge id={message.speaker} withName size="sm"
                  tone={message.from_player ? 'solid' : 'tint'} />
                  {message.from_player && <span className="t-meta">You</span>}
                  {voice && <span className="t-meta">{voice}</span>}
                  {message.addressed_to && <span className="t-meta">To {get(message.addressed_to).short}</span>}
                  {message.fallback && <Chip tone="warn" icon="offline">Offline fallback</Chip>}
                </div>}
              <p>{message.text}</p>
              {message.from_player && message.kind === 'speech' && ((message.tags ?? []).length
                ? (message.tags ?? []).map(tag => {
                  const affected = Array.from(new Set(state.soften_log.filter(event =>
                    event.message_id === message.id && event.tag === tag.tag).map(event => event.delegation)));
                  return <span className="summit-tag neg-hit" key={tag.tag}>
                    <Chip tone="info">{config.tags.find(item => item.id === tag.tag)?.label ?? tag.tag}</Chip>
                    {affected.length > 0
                      ? <><span className="t-meta">landed with</span>
                        {affected.map(id => <DelegationBadge key={id} id={id} size="sm" />)}</>
                      : <span className="t-meta">no one needed convincing</span>}
                  </span>;
                })
                : <p className="neg-hit__none t-meta">No delegation changed its position. Try{' '}
                  <button type="button" className="neg-hit__link" onClick={showIdeas}>an argument idea</button>.</p>)}
            </li>;
          })}
          {typing.map(id => <li key={'typing-' + id} className="summit-message neg-msg--typing">
            <div className="l-cluster"><DelegationBadge id={id} withName size="sm" />
              <TypingDots label={get(id).name + ' is typing'} /></div>
          </li>)}
        </ol>
        {derived.quorum_met && <div className="neg__next">
          <ul className="neg__checks" aria-label="Progress">
            <li><Chip tone={missingClauses === 0 ? 'ok' : 'neutral'}>Clauses {state.clauses.length}/{config.rules.min_clauses_to_vote}</Chip></li>
            {readTheRoom && <li><Chip tone={likelyYes >= derived.votes_needed ? 'ok' : 'neutral'}>
              Votes likely {likelyYes}/{derived.votes_needed}</Chip></li>}
          </ul>
        </div>}
        <p className="neg__effect" aria-live="polite" aria-atomic="true">{effectLine}</p>
        {derived.quorum_met ? <form ref={composer} className="neg__composer summit-composer" onSubmit={async event => {
          event.preventDefault();
          if (!text.trim() || busy || !derived.can_speak) return;
          pending.current = { leanings: { ...leanings }, messages: state.messages.length, at: Date.now(), sawBusy: false };
          setEffect(null);
          await actions.speak(text, delegates.includes(address) ? address : undefined);
        }}>
          <div className="neg__ideas" role="group" aria-label="Argument ideas" ref={ideas} tabIndex={-1}>
            <span className="neg__ideas-label">Argument ideas</span>
            {config.tags.map(tag => <button type="button" key={tag.id} aria-pressed={idea === tag.id} title={tag.description}
              className={cx('neg-idea', idea === tag.id && 'neg-idea--on')} disabled={!!busy || !derived.can_speak}
              onClick={() => pickIdea(tag.id)}>{tag.label}</button>)}
          </div>
          <Field label="Your statement" className="neg__statement">{id => <TextArea id={id} value={text} rows={3} maxLength={4000}
            placeholder={derived.can_speak ? 'Make your case to the table. Enter sends.'
              : 'The rounds are over.'}
            onChange={event => setText(event.target.value)} disabled={!!busy || !derived.can_speak}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                composer.current?.requestSubmit();
              }
            }} />}</Field>
          <div className="summit-composer__actions neg__send">
            <details className="neg__addr" open={!!address || undefined}>
              <summary>{delegates.includes(address) ? 'To ' + get(address).short : 'To the whole table'}</summary>
              <Field label="Address">{id => <Select id={id} value={delegates.includes(address) ? address : ''}
                onChange={setAddress} disabled={!!busy || !derived.can_speak} placeholder="The whole table"
                options={delegates.map(item => ({ value: item, label: get(item).name }))} />}</Field>
            </details>
            <Button type="submit" variant="primary" disabled={!!busy || !derived.can_speak || !text.trim()}>Send statement</Button>
          </div>
        </form> : <Banner tone="warn" title="The table lost quorum">
          {config.rules.quorum} delegations must remain for a vote.
        </Banner>}
        <footer className="neg__foot">
          {derived.quorum_met ? <>
            <Button variant={reportReady ? 'primary' : 'secondary'} icon="arrow-right" disabled={!reportReady || !!busy}
              onClick={() => void actions.requestReport()}>Request report</Button>
          </> : <>
            {derived.can_start_track2 && <Button disabled={!!busy} onClick={() => void actions.startTrack2()}>Open expert channel</Button>}
            <Button variant="primary" disabled={!!busy} onClick={actions.concede}>End this summit</Button>
          </>}
        </footer>
      </section>

      <aside className="neg__draft" aria-label="Draft text">
        <header className="neg__head">
          <h2 className="neg__title">Draft text <span className="t-meta t-num">{state.clauses.length}
            {state.clauses.length === 1 ? ' clause' : ' clauses'}</span></h2>
          <Button size="sm" variant={missingClauses > 0 ? 'primary' : 'secondary'} iconBefore="plus" disabled={!!busy || !derived.quorum_met || !available.length}
            onClick={() => setBuilder({})}>Propose clause</Button>
        </header>
        <div className="neg__draft-body">
          {state.suggestions.length > 0 && <ul className="neg__suggest" aria-label="Amendments proposed to you">
            {state.suggestions.map(suggestion => {
              const replaces = state.clauses.findIndex(clause => clause.id === suggestion.replaces);
              return <li key={suggestion.id}>
                <p className="t-eyebrow neg__suggest-from">{get(suggestion.from).short} proposes
                  {replaces >= 0 && <span> · replaces clause {replaces + 1}</span>}</p>
                <p className="neg-clause__text">{suggestion.text}</p>
                {suggestion.note && <p className="t-meta">{suggestion.note}</p>}
                <div className="l-cluster">
                  <Button size="sm" disabled={!!busy || !derived.quorum_met}
                    onClick={() => actions.acceptSuggestion(suggestion.id)}>Accept</Button>
                  <Button size="sm" variant="quiet" disabled={!!busy}
                    onClick={() => actions.dismissSuggestion(suggestion.id)}>Dismiss</Button>
                </div>
              </li>;
            })}
          </ul>}
          {state.clauses.length === 0 && <EmptyState title="No clauses yet">Propose a test or a safeguard.</EmptyState>}
          <ol className="neg__clauses">{state.clauses.map(clause => <li key={clause.id} className="neg-clause">
            <p className="neg-clause__text">{clause.text}</p>
            <p className="neg-clause__meta t-meta">
              <span>{config.catalog.find(item => item.id === clause.template)?.label ?? clause.template}</span>
              {clause.from_annex && <span className="neg-clause__annex">From the annex</span>}
            </p>
            <details className="neg__fold"><summary>Who supports it</summary>
            <ul className="neg-stances" aria-label="Where the delegations stand on this clause">
              {delegates.map(id => {
                const stance = derived.stances[clause.id]?.[id] ?? 'neutral';
                return <li key={id} className={'neg-stance neg-stance--' + stance}>
                  <DelegationBadge id={id} size="sm" />
                  <span className="neg-stance__mark" role="img" aria-label={`${get(id).name} ${STANCE_TEXT[stance]} this clause`}>
                    {stance === 'support' && <Icon name="check" size={12} />}
                    {stance === 'oppose' && <Icon name="close" size={12} />}
                  </span>
                </li>;
              })}
            </ul></details>
            <div className="l-cluster">
              <Button size="sm" variant="quiet" onClick={() => setBuilder({ template: clause.template })}
                disabled={!!busy || !derived.quorum_met}>Revise</Button>
              <Button size="sm" variant="quiet" disabled={!!busy || !derived.quorum_met}
                onClick={() => actions.withdrawClause(clause.id)}>Withdraw</Button>
            </div>
          </li>)}</ol>
        </div>
      </aside>

      <aside className="neg__room" aria-label="The room">
        <h2 className="neg__title">The room</h2>
        <div className="neg__table">
          <RoundTable seats={config.scenario.seats} status={table} marks={leanings} highlight={ringSeat}
            size={260} centerLabel={state.track === 1 ? 'Summit' : 'Expert table'}
            label="Round table: who is at the negotiation" />
        </div>
        <ul className="neg__lean" aria-label="How each delegation leans on the draft">
          {delegates.map(id => {
            const lean = leanings[id];
            const moved = movedTo(id);
            return <li key={id + (moved && shownEffect ? ':' + shownEffect.id : '')}
              className={cx('neg__lean-row', typing.includes(id) && 'neg__lean-row--typing', moved && 'neg__lean-row--moved')}>
              <DelegationBadge id={id} withName size="sm" />
              {typing.includes(id) ? <TypingDots label={get(id).name + ' is typing'} />
                : <span className={cx('neg__lean-word', lean && `neg__lean-word--${lean}`)}>
                  {moved ? `${LEAN_LABEL[moved.from]} → ${LEAN_LABEL[moved.to]}` : lean ? LEAN_LABEL[lean] : '—'}</span>}
            </li>;
          })}
        </ul>
        {readTheRoom && <p className="neg__tally t-num">{voteLine}</p>}
        {away.length > 0 && <details className="neg__away neg__fold"><summary>Not at the table ({away.length})</summary>
          <ul>{away.map(id => <li key={id}><DelegationBadge id={id} withName size="sm" tone="muted" />
            <span className="t-meta">{AWAY_LABEL[table[id] as keyof typeof AWAY_LABEL] ?? 'Declined'}</span></li>)}</ul>
        </details>}
        {config.side_payments.length > 0 && <div className="neg__offer">
          <Button size="sm" variant="quiet"
            disabled={!!busy || !derived.quorum_met || derived.side_payments_left <= 0 || !delegates.length}
            onClick={() => setOffer({ to: delegates[0] ?? '', payment: '' })}>Offer something ({derived.side_payments_left})</Button>
        </div>}
      </aside>
    </div>

    {builder && <ClauseBuilder templates={templates} clauses={state.clauses}
      initialTemplate={builder.template} onClose={() => setBuilder(null)} />}
    <Dialog open={!!offer} size="sm" onClose={() => setOffer(null)} title="Offer something" footer={<>
      <Button onClick={() => setOffer(null)}>Cancel</Button>
      <Button variant="primary" disabled={!offer?.to || !offer.payment || !!busy} onClick={() => {
        if (!offer) return;
        actions.offerSidePayment(offer.to, offer.payment);
        setOffer(null);
      }}>Make offer</Button>
    </>}>
      {offer && <div className="l-stack">
        <p className="t-meta">{derived.side_payments_left} {derived.side_payments_left === 1 ? 'offer' : 'offers'} left this cycle.</p>
        <Field label="Offer to">{id => <Select id={id} value={offer.to}
          options={delegates.map(item => ({ value: item, label: get(item).name }))}
          onChange={value => setOffer({ to: value, payment: '' })} />}</Field>
        <RadioCards legend="Concession" columns={1} value={offer.payment || null}
          onChange={payment => setOffer({ ...offer, payment })}
          options={config.side_payments.map(item => ({
            value: item.id, title: item.label, description: item.description,
            disabled: offered(offer.to, item.id), disabledReason: 'Already offered this cycle',
          }))} />
      </div>}
    </Dialog>
  </div>;
}
