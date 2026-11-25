/**
 * Feeds all five contexts from fixtures so the UI can be clicked through without the engine.
 * Actions update local React state with crude stand-in logic. Replaced by src/game/providers.tsx
 * by the real providers in the normal entry point. The dev-only fixture route still uses this file.
 */
import { createContext, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { ConfigIssue, DelegationConfig, GameConfig, GameState, Message } from '../../engine/types';
import type {
  AppSettings,
  Busy,
  ConfigEditApi,
  DataApi,
  GameActions,
  PlatformApi,
  RankedProposal,
  Rating,
  SettingsApi,
} from '../../game/api';
import {
  ConfigContext,
  ConfigEditContext,
  DataContext,
  GameContext,
  PlatformContext,
  SettingsContext,
} from '../../game/context';
import type { LlmPreset } from '../../llm/types';
import {
  cannedReplies,
  fixtureAttendance,
  fixtureConfig,
  fixtureDerived,
  fixtureGames,
  fixtureProposals,
  fixtureRatings,
  fixtureStates,
  freshState,
} from './fixtures';

export interface FixtureControls {
  load(key: string): void;
  setError(error: string | null): void;
  setBusy(busy: Busy | null): void;
  current: string;
}

/** Only present under FixtureProviders; the #/dev screen uses it to jump between fixtures. */
export const FixtureDevContext = createContext<FixtureControls | null>(null);

const presets: LlmPreset[] = [
  {
    id: 'deepseek',
    label: 'DeepSeek',
    base_url: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    json_mode: true,
  },
  {
    id: 'ollama',
    label: 'Ollama (local)',
    base_url: 'http://127.0.0.1:11434/v1',
    model: 'qwen3:8b',
    json_mode: false,
    note: 'Runs on this computer.',
  },
  { id: 'custom', label: 'Custom', base_url: '', model: '', json_mode: false },
];

const defaultSettings: AppSettings = {
  llm: {
    mode: 'mock',
    preset: 'deepseek',
    base_url: '',
    model: '',
    api_key: '',
    json_mode: true,
    proxy_url: 'http://127.0.0.1:8787/v1',
    timeout_ms: 30_000,
  },
  kiosk: false,
};

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
let uid = 1000;
const nextId = (p: string) => `${p}${++uid}`;

function rank(
  proposals: typeof fixtureProposals,
  ratings: Rating[],
  questions: number,
  prior: number,
): RankedProposal[] {
  const all = ratings.map((r) => r.scores.reduce((a, b) => a + b, 0) / r.scores.length);
  const m = all.length ? all.reduce((a, b) => a + b, 0) / all.length : 3;
  return proposals
    .map((p) => {
      const rs = ratings.filter((r) => r.proposal_id === p.id);
      const means = rs.length
        ? Array.from({ length: questions }, (_, q) => rs.reduce((s, r) => s + r.scores[q], 0) / rs.length)
        : [];
      const sum = rs.reduce((s, r) => s + r.scores.reduce((a, b) => a + b, 0) / r.scores.length, 0);
      return { ...p, n_ratings: rs.length, means, score: (prior * m + sum) / (prior + rs.length), rank: 0 };
    })
    .sort((a, b) => b.score - a.score)
    .map((p, i) => ({ ...p, rank: i + 1 }));
}

export function FixtureProviders({ children }: { children: ReactNode }) {
  const config = fixtureConfig;
  // `/?fixtures=vote#/` opens that phase fixture directly (used for screenshots); plain `?fixtures` starts at the seat.
  const requested = new URLSearchParams(window.location.search).get('fixtures') ?? '';
  const initial = requested in fixtureStates ? requested : 'seat';
  const [current, setCurrent] = useState(initial);
  const [state, setState] = useState<GameState>((fixtureStates as Record<string, GameState>)[initial]);
  const [busy, setBusy] = useState<Busy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const go = useCallback((patch: Partial<GameState>) => {
    setState((s) => {
      const next = { ...s, ...patch };
      if (patch.phase && patch.phase !== s.phase)
        next.timeline = [...s.timeline, { phase: patch.phase, track: next.track, at: Date.now() }];
      return next;
    });
  }, []);

  const load = useCallback((key: string) => {
    const s = fixtureStates[key];
    if (!s) return;
    setCurrent(key);
    setBusy(null);
    setError(null);
    setState(s);
  }, []);

  const actions: GameActions = useMemo(
    () => ({
      newGame: () => {
        setCurrent('seat');
        setState(freshState());
      },
      chooseSeat: (seat) => {
        const s = freshState(seat);
        setState({
          ...s,
          phase: 'rolecard',
          timeline: [...s.timeline, { phase: 'rolecard', track: 1, at: Date.now() }],
        });
      },
      leaveRoleCard: () => go({ phase: 'convene' }),
      submitQuiz: (kind, answers) => {
        const s = stateRef.current;
        go(
          kind === 'pre'
            ? { phase: 'convene', quiz: { ...s.quiz, pre: answers } }
            : { phase: 'done', quiz: { ...s.quiz, post: answers } },
        );
      },
      convene: async (choices) => {
        setBusy({ kind: 'convening', who: choices.invited });
        await wait(900);
        const s = stateRef.current;
        const attendance = fixtureAttendance(s.seat, choices, s.trust, !!s.track2.annex);
        setBusy(null);
        go({
          phase: 'attendance',
          choices,
          attendance,
          convene_attempts: s.convene_attempts + 1,
          track: choices.format === 'track2' ? 2 : 1,
        });
      },
      enterRoom: () =>
        go({
          phase: 'negotiate',
          round: 0,
          messages: [
            {
              id: nextId('m'),
              track: stateRef.current.track,
              cycle: 1,
              round: 1,
              speaker: 'chair',
              kind: 'chair',
              text: 'The Chair opens the session. The floor is yours.',
            },
          ],
        }),
      reconvene: () => go({ phase: 'convene' }),
      startTrack2: async () => {
        setBusy({ kind: 'convening', who: [] });
        await wait(700);
        setBusy(null);
        const s = stateRef.current;
        go({
          phase: 'negotiate',
          track: 2,
          cycle: 1,
          round: 0,
          track2: { ...s.track2, used: s.track2.used + 1, return_to: 'convene' },
        });
      },
      concede: () =>
        go({
          phase: 'outcome',
          outcome: { type: 'no_agreement', passed: false, absent_major: [], opposing_major: [] },
        }),
      proposeClause: (template, params) => {
        const s = stateRef.current;
        const t = config.catalog.find((c) => c.id === template);
        go({
          clauses: [
            ...s.clauses,
            {
              id: nextId('cl'),
              template,
              params,
              text: t?.label ?? template,
              version: 1,
              proposed_by: s.seat,
              history: [],
            },
          ],
        });
      },
      editClause: (clauseId, params) => {
        const s = stateRef.current;
        go({
          clauses: s.clauses.map((c) =>
            c.id === clauseId
              ? {
                  ...c,
                  params,
                  version: c.version + 1,
                  history: [
                    ...c.history,
                    { version: c.version, params: c.params, text: c.text, cycle: s.cycle, round: s.round },
                  ],
                }
              : c,
          ),
        });
      },
      withdrawClause: (clauseId) => go({ clauses: stateRef.current.clauses.filter((c) => c.id !== clauseId) }),
      acceptSuggestion: (id) => {
        const s = stateRef.current;
        const sg = s.suggestions.find((x) => x.id === id);
        if (!sg) return;
        const kept = sg.replaces ? s.clauses.filter((c) => c.id !== sg.replaces) : s.clauses;
        go({
          suggestions: s.suggestions.filter((x) => x.id !== id),
          clauses: [
            ...kept,
            {
              id: nextId('cl'),
              template: sg.template,
              params: sg.params,
              text: sg.text,
              version: 1,
              proposed_by: sg.from,
              history: [],
            },
          ],
        });
      },
      dismissSuggestion: (id) => go({ suggestions: stateRef.current.suggestions.filter((x) => x.id !== id) }),
      speak: async (text, addressee) => {
        const s = stateRef.current;
        const round = s.round + 1;
        const base = { track: s.track, cycle: s.cycle, round } as const;
        const mine: Message = {
          ...base,
          id: nextId('m'),
          speaker: s.seat,
          from_player: true,
          text,
          kind: 'speech',
          addressed_to: addressee,
          tags: [],
        };
        const present = fixtureDerived(s, config).present.filter((id) => id !== s.seat);
        const who = addressee
          ? [addressee, ...present.filter((p) => p !== addressee)].slice(0, 2)
          : present.slice(round % 2, (round % 2) + 2);
        go({ messages: [...s.messages, mine] });
        setBusy({ kind: 'responding', who });
        await wait(1200);
        const replies: Message[] = who.map((id, i) => ({
          ...base,
          id: nextId('m'),
          speaker: id,
          text: (cannedReplies[id] ?? ['We take note.'])[(round + i) % (cannedReplies[id]?.length ?? 1)],
          kind: 'speech',
        }));
        setBusy(null);
        setState((cur) => ({ ...cur, round, messages: [...cur.messages, ...replies] }));
      },
      offerSidePayment: (delegation, payment) => {
        const s = stateRef.current;
        go({ side_payments: [...s.side_payments, { track: s.track, cycle: s.cycle, delegation, payment }] });
      },
      requestReport: async () => {
        setBusy({ kind: 'reporting', who: ['rapporteur'] });
        await wait(900);
        setBusy(null);
        const s = stateRef.current;
        go({ phase: 'report', reports: s.reports.length ? s.reports : fixtureStates.report.reports });
      },
      objectToReport: async () => {
        setBusy({ kind: 'reporting', who: ['rapporteur'] });
        await wait(900);
        setBusy(null);
        const s = stateRef.current;
        go({ reports: s.reports.map((r, i) => (i === s.reports.length - 1 ? { ...r, revised: true } : r)) });
      },
      callVote: async () => {
        setBusy({ kind: 'voting', who: [] });
        await wait(900);
        setBusy(null);
        go({ phase: 'vote', votes: fixtureStates.vote.votes });
      },
      continueAfterVote: () => go({ phase: 'outcome', outcome: fixtureStates.outcome.outcome }),
      openDebrief: () => go({ phase: 'debrief' }),
      finishDebrief: () => go({ phase: config.quiz.enabled ? 'postquiz' : 'done' }),
      replay: () => {
        const s = stateRef.current;
        const fresh = freshState(s.seat);
        setState({
          ...fresh,
          phase: 'convene',
          previous:
            s.choices && s.outcome
              ? {
                  choices: s.choices,
                  outcome: s.outcome.type,
                  attended: s.attendance.filter((a) => a.status === 'attend').map((a) => a.delegation),
                  yes: s.outcome.final_vote?.yes ?? 0,
                  no: s.outcome.final_vote?.no ?? 0,
                }
              : undefined,
        });
      },
      dismissError: () => setError(null),
    }),
    [config, go],
  );

  const derived = useMemo(() => fixtureDerived(state, config), [state, config]);
  const game = useMemo(
    () => ({ view: { state, derived, busy, error }, actions }),
    [state, derived, busy, error, actions],
  );

  // Settings
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const settingsApi: SettingsApi = useMemo(
    () => ({
      settings,
      presets,
      update: (patch) => setSettings((s) => ({ ...s, ...patch })),
      updateLlm: (patch) => setSettings((s) => ({ ...s, llm: { ...s.llm, ...patch } })),
      testConnection: async () => {
        await wait(600);
        return settings.llm.mode === 'mock'
          ? { ok: true, message: 'Mock mode needs no connection.' }
          : { ok: false, message: 'Fixture: no network in development fixtures.' };
      },
    }),
    [settings],
  );

  // Platform
  const [proposals, setProposals] = useState(fixtureProposals);
  const [ratings, setRatings] = useState<Rating[]>(fixtureRatings);
  const platform: PlatformApi = useMemo(() => {
    const q = config.rules.leaderboard.questions.length;
    return {
      proposals: rank(proposals, ratings, q, config.rules.leaderboard.prior_votes),
      ratingsFor: (id) => ratings.filter((r) => r.proposal_id === id),
      rate: (proposal_id, scores, comment) =>
        setRatings((rs) => [...rs, { id: nextId('r'), proposal_id, scores, comment, at: Date.now() }]),
      removeProposal: (id) => setProposals((ps) => ps.filter((p) => p.id !== id)),
      removeRating: (id) => setRatings((rs) => rs.filter((r) => r.id !== id)),
      exportJson: () => JSON.stringify({ proposals, ratings }, null, 2),
      importJson: () => ({ added: 0, error: 'Import is not available with fixtures.' }),
    };
  }, [proposals, ratings, config]);

  // Data
  const [games, setGames] = useState(fixtureGames);
  const data: DataApi = useMemo(
    () => ({
      games,
      exportGamesCsv: () =>
        [
          'id,started_at,seat,outcome,duration_s,cycles',
          ...games.map((g) => [g.id, g.started_at, g.seat, g.outcome ?? '', g.duration_s, g.cycles].join(',')),
        ].join('\n'),
      exportGamesJson: () => JSON.stringify(games, null, 2),
      exportClaimsCsv: () => 'id,claim,used_in,source,confidence,notes\n',
      clearAll: () => setGames([]),
    }),
    [games],
  );

  // Config editing: saved drafts stay in React state and are layered over the fixture config.
  const [saved, setSaved] = useState<Record<string, DelegationConfig>>({});
  const editedConfig: GameConfig = useMemo(() => {
    const ids = Object.keys(saved);
    if (ids.length === 0) return config;
    const known = new Set(config.delegations.map((d) => d.id));
    const delegations = [
      ...config.delegations.map((d) => saved[d.id] ?? d),
      ...ids.filter((id) => !known.has(id)).map((id) => saved[id]),
    ];
    const seats = [...config.scenario.seats, ...ids.filter((id) => !known.has(id))];
    return { ...config, scenario: { ...config.scenario, seats }, delegations };
  }, [config, saved]);
  const configApi = useMemo(() => ({ config: editedConfig, warnings: [] }), [editedConfig]);
  const configEdit: ConfigEditApi = useMemo(() => {
    const bundled = new Set(config.delegations.map((d) => d.id));
    return {
      status: Object.fromEntries(
        editedConfig.delegations.map((d) => [d.id, !bundled.has(d.id) ? 'new' : saved[d.id] ? 'edited' : 'bundled']),
      ),
      dirty: Object.keys(saved).length > 0,
      blank: (id, name, short) => ({
        id,
        name,
        short,
        type: 'state',
        playable: false,
        difficulty: 'medium',
        owner: '',
        summary: '',
        mandate: '',
        facts: [],
        relations: {},
        voices: [],
        internal_resolution: 'veto_by_any',
        attendance: {
          attend_threshold: 3,
          base_willingness: Object.fromEntries(config.forums.map((f) => [f.id, 3])),
          conditions: [],
          parallel_forum_propensity: 0,
          track2_willingness: 3,
        },
        red_lines: [],
        must_haves: [],
        vote_threshold: 0,
        side_payment_values: Object.fromEntries(config.side_payments.map((s) => [s.id, 0])),
        trust_initial: 0,
        walkout_triggers: [],
        brief: '',
        style: '',
        claims: [],
        research: [],
      }),
      validate: (draft) => {
        const errors: ConfigIssue[] = [];
        if (!draft.name.trim()) errors.push({ file: `config/delegations/${draft.id}.yaml`, path: 'name', message: 'The name cannot be empty.' });
        return { errors, warnings: [] };
      },
      save: (draft) => {
        setSaved((s) => ({ ...s, [draft.id]: JSON.parse(JSON.stringify(draft)) as DelegationConfig }));
        return { ok: true, errors: [] };
      },
      revert: (id) =>
        setSaved((s) => {
          const { [id]: _drop, ...rest } = s;
          return rest;
        }),
      revertAll: () => setSaved({}),
      toYaml: (draft) => JSON.stringify(draft, null, 2),
      filePath: (id) => `config/delegations/${id}.yaml`,
      exportPack: () => JSON.stringify({ fixture: true, delegations: saved }, null, 2),
      importPack: () => ({ applied: 0, error: 'Import is not available with fixtures.' }),
    };
  }, [config, editedConfig, saved]);
  const controls: FixtureControls = useMemo(() => ({ load, setError, setBusy, current }), [load, current]);

  return (
    <FixtureDevContext.Provider value={controls}>
      <ConfigContext.Provider value={configApi}>
        <ConfigEditContext.Provider value={configEdit}>
          <SettingsContext.Provider value={settingsApi}>
            <DataContext.Provider value={data}>
              <PlatformContext.Provider value={platform}>
                <GameContext.Provider value={game}>{children}</GameContext.Provider>
              </PlatformContext.Provider>
            </DataContext.Provider>
          </SettingsContext.Provider>
        </ConfigEditContext.Provider>
      </ConfigContext.Provider>
    </FixtureDevContext.Provider>
  );
}
