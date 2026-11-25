import { useEffect, useState } from 'react';
import type { Phase } from '../engine/types';
import type { Busy, GameView } from '../game/api';
import { useConfig, useGame, useSettings } from '../game/context';
import { Button } from './components/Button';
import { Banner, TypingDots } from './components/Misc';
import { PhaseBar } from './components/PhaseBar';
import { DevScreen } from './dev/DevScreen';
import { cx } from './lib/delegations';
import { href, useRoute, type Route } from './router';
import { AttendanceScreen } from './screens/Attendance';
import { ConveneScreen } from './screens/Convene';
import { QuizScreen } from './screens/Quiz';
import { RoleCardScreen } from './screens/RoleCard';
import { SeatScreen } from './screens/Seat';
import { DebriefScreen } from './screens/Debrief';
import { NegotiateScreen } from './screens/Negotiate';
import { AdminScreen, GalleryScreen } from './screens/Platform';
import { PrintCardsScreen } from './screens/PrintCards';
import { DelegationEditorScreen } from './screens/DelegationEditor';
import { DelegationsScreen, NewDelegationScreen } from './screens/Delegations';
import { ResearchScreen } from './screens/Research';
import { OutcomeScreen, ReportScreen, VoteScreen } from './screens/Resolution';
import { SettingsScreen } from './screens/Settings';
import { NotFoundScreen } from './screens/stubs';
import './styles/tokens.css';
import './styles/base.css';
import './App.css';

const BUSY_TEXT: Record<Busy['kind'], string> = {
  convening: 'Sending invitations',
  responding: 'Delegations are responding',
  reporting: 'The rapporteur is drafting',
  voting: 'Delegations are voting',
};

function PlayScreen({ phase }: { phase: Phase }) {
  switch (phase) {
    case 'seat':
      return <SeatScreen />;
    case 'rolecard':
      return <RoleCardScreen />;
    case 'prequiz':
      return <QuizScreen kind="pre" />;
    case 'postquiz':
      return <QuizScreen kind="post" />;
    case 'convene':
      return <ConveneScreen />;
    case 'attendance':
      return <AttendanceScreen />;
    case 'negotiate':
      return <NegotiateScreen />;
    case 'report':
      return <ReportScreen />;
    case 'vote':
      return <VoteScreen />;
    case 'outcome':
      return <OutcomeScreen />;
    case 'debrief':
    case 'done':
      return <DebriefScreen />;
  }
}

function Wordmark() {
  return (
    <a className="app-header__mark" href={href()} aria-label="Who Writes the Rules for AI? Home">
      <svg viewBox="0 0 28 28" width="28" height="28" aria-hidden="true">
        <circle cx="14" cy="14" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
        {[0, 60, 120, 180, 240, 300].map((a) => (
          <rect
            key={a}
            x="12"
            y="1.5"
            width="4"
            height="3.5"
            rx="1"
            fill={a === 240 ? 'none' : 'currentColor'}
            stroke="currentColor"
            strokeWidth="1"
            transform={`rotate(${a} 14 14)`}
          />
        ))}
      </svg>
      <span className="app-header__title">Who Writes the Rules for AI?</span>
    </a>
  );
}

function NavLinks({ items, label, team }: { items: { label: string; to: string; active: boolean }[]; label: string; team?: boolean }) {
  return (
    <ul className={cx('app-nav__list', team && 'app-nav__list--team')} aria-label={label}>
      {items.map((it) => (
        <li key={it.label}>
          <a
            className={cx('app-nav__link', it.active && 'app-nav__link--active')}
            href={it.to}
            aria-current={it.active ? 'page' : undefined}
          >
            {it.label}
          </a>
        </li>
      ))}
    </ul>
  );
}

function Nav({ route }: { route: Route }) {
  const { settings } = useSettings();
  const main = [
    { label: 'Play', to: href(), active: route.name === 'play' },
    { label: 'Gallery', to: href('gallery'), active: route.name === 'gallery' },
  ];
  // Team pages are for the students who maintain the content. Kiosk mode hides them;
  // #/settings stays reachable by typing it.
  const team = [
    { label: 'Research', to: href('research'), active: route.name === 'research' },
    { label: 'Delegations', to: href('delegations'), active: route.name === 'delegations' },
    { label: 'Settings', to: href('settings'), active: route.name === 'settings' },
    { label: 'Admin', to: href('admin'), active: route.name === 'admin' },
  ];
  return (
    <nav className="app-nav" aria-label="Main">
      <NavLinks items={main} label="Visitors" />
      {!settings.kiosk && <NavLinks items={team} label="Team" team />}
    </nav>
  );
}

const PLAYING: Phase[] = ['convene', 'attendance', 'negotiate', 'report', 'vote', 'outcome'];

/** One plain sentence telling the player what to do on the current screen. */
function taskFor(view: GameView, minClauses: number): string {
  const { state, derived } = view;
  switch (state.phase) {
    case 'seat':
      return 'Choose the delegation you will lead.';
    case 'rolecard':
      return 'Read your goals and limits, then go to the summit.';
    case 'prequiz':
      return 'Answer if you like, then continue to the summit.';
    case 'convene':
      return 'Pick a venue and an agenda, tick whom to invite, then convene.';
    case 'attendance':
      return derived.quorum_met
        ? 'See who came and who stayed away, then enter the room.'
        : 'Too few delegations came. Change your invitation, try the expert channel, or end here.';
    case 'negotiate': {
      const tabled = state.clauses.length;
      if (tabled < minClauses) return `Propose at least ${minClauses} clauses for the text (${tabled} so far).`;
      if (derived.can_request_report) return 'Argue for your text to win votes, then ask for the report.';
      return 'Make your case to the delegates. Name one to address them directly.';
    }
    case 'report':
      return 'Check the draft. Object once if it misstates you, or call the vote.';
    case 'vote':
      return 'See how each delegation voted and why, then continue.';
    case 'outcome':
      return 'See what the summit produced, then open the debrief.';
    case 'debrief':
      return 'See what changed minds and what would have changed the room, then play again or finish.';
    case 'postquiz':
      return 'A few optional questions. Skip any you like, then finish.';
    case 'done':
      return 'Game over. Start a new game when you are ready.';
  }
}

/** Abandons the current game after a second click; disabled while the model is answering. */
function RestartButton({ onRestart, disabled }: { onRestart: () => void; disabled: boolean }) {
  const [confirming, setConfirming] = useState(false);
  useEffect(() => {
    if (!confirming) return;
    const timer = window.setTimeout(() => setConfirming(false), 6000);
    return () => window.clearTimeout(timer);
  }, [confirming]);
  if (!confirming) {
    return (
      <Button size="sm" variant="quiet" disabled={disabled} onClick={() => setConfirming(true)}>
        Restart
      </Button>
    );
  }
  return (
    <span className="app-restart" role="group" aria-label="Restart the game">
      <span className="app-restart__ask">Lose this game?</span>
      <Button size="sm" variant="primary" onClick={() => { setConfirming(false); onRestart(); }}>
        Yes, restart
      </Button>
      <Button size="sm" variant="quiet" onClick={() => setConfirming(false)}>
        Cancel
      </Button>
    </span>
  );
}

function formatElapsed(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/** Quiet mm:ss since the game started; turns brass past the expo time limit. Never blocks anything. */
function ElapsedClock({ startedAt, limitMinutes }: { startedAt: number; limitMinutes: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [startedAt]);
  const elapsed = now - startedAt;
  const over = limitMinutes > 0 && elapsed > limitMinutes * 60_000;
  return (
    <span
      className={cx('app-clock', over && 'app-clock--over')}
      title={over ? `Past the ${limitMinutes}-minute expo limit` : `Expo limit ${limitMinutes} minutes`}
    >
      <span className="u-visually-hidden">Elapsed time </span>
      <time className="t-num">{formatElapsed(elapsed)}</time>
    </span>
  );
}

export function App() {
  const route = useRoute();
  const { view, actions } = useGame();
  const { config } = useConfig();
  const { state, busy, error } = view;
  const inCycle = state.phase === 'negotiate' || state.phase === 'report' || state.phase === 'vote';
  const detail = inCycle && state.track === 1 ? `Cycle ${state.cycle} of ${config.rules.max_cycles}` : undefined;

  // Open every new screen at the top: on a route change, or when the game moves to another phase,
  // track or cycle. Not on every state change. A record permalink scrolls itself into view.
  const routeKey =
    route.name === 'research'
      ? 'research/' + (route.delegation ?? '')
      : route.name === 'delegations'
        ? 'delegations/' + (route.isNew ? 'new' : (route.id ?? ''))
        : route.name;
  const hasRecord = route.name === 'research' && !!route.recordId;
  useEffect(() => {
    if (hasRecord) return;
    window.scrollTo(0, 0);
  }, [routeKey, hasRecord, state.phase, state.track, state.cycle]);

  let screen;
  switch (route.name) {
    case 'play':
      screen = <PlayScreen phase={state.phase} />;
      break;
    case 'gallery':
      screen = <GalleryScreen />;
      break;
    case 'research':
      screen = <ResearchScreen key={href('research', route.delegation ?? '', route.recordId ?? '')}
        delegation={route.delegation} recordId={route.recordId} />;
      break;
    case 'delegations':
      screen = route.isNew ? <NewDelegationScreen key="new" /> : route.id ? <DelegationEditorScreen key={route.id} id={route.id} /> : <DelegationsScreen />;
      break;
    case 'print':
      screen = <PrintCardsScreen />;
      break;
    case 'settings':
      screen = <SettingsScreen />;
      break;
    case 'admin':
      screen = <AdminScreen />;
      break;
    case 'dev':
      screen = import.meta.env.DEV ? <DevScreen /> : <NotFoundScreen path="/dev" />;
      break;
    default:
      screen = <NotFoundScreen path={route.path} />;
  }

  return (
    <div className={cx('app', route.name === 'print' && 'app--print-cards')} aria-busy={busy ? true : undefined}>
      <a className="app-skip" href="#main" onClick={event => {
        event.preventDefault();
        document.getElementById('main')?.focus();
      }}>
        Skip to content
      </a>
      <header className="app-header">
        <div className="app-header__inner">
          <Wordmark />
          <Nav route={route} />
        </div>
      </header>
      {route.name === 'play' && (
        <div className="app-progress">
          <div className="app-progress__inner">
            <PhaseBar phase={state.phase} track={state.track} detail={detail} />
            <div className="app-progress__aside">
              {PLAYING.includes(state.phase) && (
                <ElapsedClock startedAt={state.started_at} limitMinutes={config.rules.expo.time_limit_minutes} />
              )}
              <p className={cx('app-busy', busy && 'app-busy--on')} aria-live="polite">
                {busy && (
                  <>
                    <TypingDots label="" />
                    <span>{BUSY_TEXT[busy.kind]}</span>
                  </>
                )}
              </p>
              {state.phase !== 'seat' && <RestartButton onRestart={actions.newGame} disabled={!!busy} />}
            </div>
          </div>
          <div className="app-task">
            <p className="app-task__inner" aria-live="polite">
              <span className="app-task__label">Your task</span>
              <span className="app-task__text">{taskFor(view, config.rules.min_clauses_to_vote)}</span>
            </p>
          </div>
          <div className={cx('app-progress__bar', busy && 'app-progress__bar--on')} aria-hidden="true" />
        </div>
      )}
      {error && (
        <div className="app-banner">
          <Banner tone="error" title="Something went wrong" onDismiss={actions.dismissError}>
            {error}
          </Banner>
        </div>
      )}
      <main id="main" className="app-main" tabIndex={-1}>
        {screen}
      </main>
    </div>
  );
}
