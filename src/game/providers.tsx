import { useRef, useState, type ReactNode } from 'react';
import { z } from 'zod';
import * as engine from '../engine';
import type { ConfigIssue, GameConfig, GameState } from '../engine/types';
import { createLlmRoles, DEFAULT_LLM_SETTINGS, LLM_PRESETS, testConnection } from '../llm';
import type { AppSettings, Busy, DataApi, GameActions, PlatformApi, SettingsApi } from './api';
import { ConfigContext, ConfigEditContext, DataContext, GameContext, PlatformContext, SettingsContext } from './context';
import { createConfigEdit } from './configEdit';
import { claimsCsv, gamesCsv, summarizeGame } from './exports';
import { emptyGallery, gallerySchema, mergeGallery, publication, rank, validScores, type Gallery } from './platform';
import { gameSchema, loadGame, read, save } from './storage';
import { exchange, holdVote, writeDeclineLetters, writeReport } from './turns';

const settingsSchema = z.object({
  kiosk: z.boolean(),
  llm: z.object({
    mode: z.enum(['mock', 'direct', 'proxy']), preset: z.string(), base_url: z.string(), model: z.string(),
    api_key: z.string(), json_mode: z.boolean(), proxy_url: z.string(), timeout_ms: z.number().positive(),
  }),
});
const defaults: AppSettings = { kiosk: false, llm: DEFAULT_LLM_SETTINGS };

function newId() {
  return Array.from(crypto.getRandomValues(new Uint32Array(4)), value => value.toString(16).padStart(8, '0')).join('');
}

export function GameProviders({ config, warnings, children }: { config: GameConfig; warnings: ConfigIssue[]; children: ReactNode }) {
  const [configEdit] = useState(() => createConfigEdit(config));
  const fresh = () => engine.createGame(config, {
    id: newId(), seed: crypto.getRandomValues(new Uint32Array(1))[0], now: Date.now(),
  });
  const [state, setState] = useState(() => loadGame(config, fresh()));
  const [settings, setSettings] = useState(() => read('settings', settingsSchema, defaults));
  const [gallery, setGallery] = useState(() => read('gallery', gallerySchema, emptyGallery));
  const [archive, setArchive] = useState(() => read('archive', z.array(gameSchema), []));
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy | null>(null);
  const current = useRef(state);
  const currentSettings = useRef(settings);
  const currentGallery = useRef(gallery);
  const currentArchive = useRef(archive);
  const pending = useRef(false);
  const questionCount = config.rules.leaderboard.questions.length;

  function persist(key: string, value: unknown) {
    if (!save(key, value)) setError('Browser storage is unavailable or full. Export your data before closing this page.');
  }

  function updateGallery(value: Gallery) {
    currentGallery.current = value;
    setGallery(value);
    persist('gallery', value);
  }

  function updateArchive(value: GameState[]) {
    currentArchive.current = value;
    setArchive(value);
    persist('archive', value);
  }

  function commit(next: GameState) {
    const previous = current.current;
    if (next === previous) return;
    const proposal = publication(config, previous, next);
    if (proposal && !currentGallery.current.proposals.some(item => item.id === proposal.id)) {
      updateGallery({ ...currentGallery.current, proposals: [...currentGallery.current.proposals, proposal] });
    }
    current.current = next;
    setState(next);
    persist('game', next);
    if (next.outcome) updateArchive([...currentArchive.current.filter(game => game.id !== next.id), next]);
  }

  function change(update: (state: GameState) => GameState) {
    if (!pending.current) commit(update(current.current));
  }

  async function run(
    kind: Busy['kind'], next: GameState, turn: (roles: ReturnType<typeof createLlmRoles>, state: GameState) =>
      Promise<{ state: GameState; fallback: boolean }>, who: string[] = [],
  ) {
    if (pending.current) return;
    pending.current = true;
    setBusy({ kind, who });
    setError(null);
    try {
      const activeSettings = currentSettings.current.llm;
      const result = await turn(createLlmRoles(config, () => activeSettings), next);
      if (result.fallback) setError('The model was unavailable. Offline responses kept the game moving.');
      commit(result.state);
    } catch {
      setError('This step could not be completed. Your game is still at the previous step. Try again.');
    } finally {
      pending.current = false;
      setBusy(null);
    }
  }

  const actions: GameActions = {
    newGame: () => change(fresh),
    chooseSeat: seat => change(game => engine.chooseSeat(config, game, seat, Date.now())),
    leaveRoleCard: () => change(game => engine.leaveRoleCard(config, game, Date.now())),
    submitQuiz: (kind, answers) => change(game => engine.submitQuiz(game, kind,
      config.quiz.questions.map((_, index) => answers[index]?.trim().slice(0, 4000) ?? ''), Date.now())),
    async convene(choices) {
      const game = current.current;
      const next = engine.convene(config, game, choices, Date.now());
      if (next !== game) await run('convening', next, (roles, game) => writeDeclineLetters(config, roles, game));
    },
    enterRoom: () => change(game => engine.enterRoom(config, game, Date.now())),
    reconvene: () => change(game => engine.reconvene(config, game, Date.now())),
    async startTrack2() {
      const game = current.current;
      const next = engine.startTrack2(config, game, Date.now());
      if (next !== game) await run('convening', next, (roles, game) => writeDeclineLetters(config, roles, game));
    },
    concede: () => change(game => engine.concede(config, game, Date.now())),
    proposeClause: (template, params) => change(game => engine.proposeClause(config, game, template, params)),
    editClause: (id, params) => change(game => engine.editClause(config, game, id, params)),
    withdrawClause: id => change(game => engine.withdrawClause(config, game, id)),
    acceptSuggestion: id => change(game => engine.acceptSuggestion(config, game, id)),
    dismissSuggestion: id => change(game => engine.dismissSuggestion(game, id)),
    async speak(text, addressee) {
      const game = current.current;
      const trimmed = text.trim().slice(0, 4000);
      if (!trimmed || !engine.canSpeak(config, game)) return;
      const target = engine.present(config, game).includes(addressee ?? '') ? addressee : undefined;
      await run('responding', game, (roles, game) => exchange(config, roles, game, trimmed, target),
        engine.pickResponders(config, game, target));
    },
    offerSidePayment: (delegation, payment) => change(game => engine.offerSidePayment(config, game, delegation, payment)),
    async requestReport() {
      const game = current.current;
      if (!engine.quorumMet(config, game) || game.clauses.length < config.rules.min_clauses_to_vote) return;
      const next = engine.startReport(config, game, Date.now());
      if (next !== game) await run('reporting', next, (roles, game) => writeReport(config, roles, game));
    },
    async objectToReport(text) {
      const game = current.current;
      const report = game.reports.find(item => item.track === game.track && item.cycle === game.cycle);
      const objection = text.trim().slice(0, 4000);
      if (game.phase !== 'report' || !report || report.revised || report.objection || !objection) return;
      await run('reporting', engine.objectToReport(game, objection), (roles, game) => writeReport(config, roles, game));
    },
    async callVote() {
      const game = current.current;
      if (engine.derive(config, game).can_call_vote) await run('voting', game, (roles, game) => holdVote(config, roles, game));
    },
    continueAfterVote: () => change(game => engine.continueAfterVote(config, game, Date.now())),
    openDebrief: () => change(game => engine.openDebrief(game, Date.now())),
    finishDebrief: () => change(game => engine.finishDebrief(config, game, Date.now())),
    replay: () => change(game => game.outcome ? engine.replay(config, game, { id: newId(), now: Date.now() }) : game),
    dismissError: () => setError(null),
  };

  const platform: PlatformApi = {
    proposals: rank(gallery, questionCount, config.rules.leaderboard.prior_votes),
    ratingsFor: proposalId => gallery.ratings.filter(rating => rating.proposal_id === proposalId),
    rate(proposalId, scores, comment) {
      const data = currentGallery.current;
      if (!validScores(scores, questionCount) || !data.proposals.some(item => item.id === proposalId)) return;
      const rating = { id: newId(), proposal_id: proposalId, scores, comment: comment?.trim().slice(0, 500), at: Date.now() };
      updateGallery({ ...data, ratings: [...data.ratings, rating] });
    },
    removeProposal(proposalId) {
      const data = currentGallery.current;
      updateGallery({ ...data, proposals: data.proposals.filter(item => item.id !== proposalId),
        ratings: data.ratings.filter(item => item.proposal_id !== proposalId) });
    },
    removeRating(id) {
      const data = currentGallery.current;
      updateGallery({ ...data, ratings: data.ratings.filter(item => item.id !== id) });
    },
    exportJson: () => JSON.stringify(currentGallery.current, null, 2),
    importJson(text) {
      const result = mergeGallery(currentGallery.current, text, questionCount);
      if (!result.error) updateGallery(result.data);
      return { added: result.added, error: result.error };
    },
  };

  function updateSettings(patch: Partial<AppSettings>) {
    const next = { ...currentSettings.current, ...patch };
    currentSettings.current = next;
    setSettings(next);
    persist('settings', next);
  }

  const settingsApi: SettingsApi = {
    settings, presets: LLM_PRESETS, update: updateSettings,
    updateLlm: patch => updateSettings({ llm: { ...currentSettings.current.llm, ...patch } }),
    testConnection: () => testConnection(currentSettings.current.llm),
  };
  const data: DataApi = {
    games: archive.map(summarizeGame),
    exportGamesCsv: () => gamesCsv(currentArchive.current),
    exportGamesJson: () => JSON.stringify(currentArchive.current, null, 2),
    exportClaimsCsv: () => claimsCsv(config),
    clearAll() {
      if (pending.current) return;
      commit(fresh());
      updateArchive([]);
      updateGallery(emptyGallery);
    },
  };

  return <ConfigContext.Provider value={{ config, warnings }}>
    <SettingsContext.Provider value={settingsApi}>
      <DataContext.Provider value={data}>
        <PlatformContext.Provider value={platform}>
          <GameContext.Provider value={{ view: { state, derived: engine.derive(config, state), busy, error }, actions }}>
            <ConfigEditContext.Provider value={configEdit}>{children}</ConfigEditContext.Provider>
          </GameContext.Provider>
        </PlatformContext.Provider>
      </DataContext.Provider>
    </SettingsContext.Provider>
  </ConfigContext.Provider>;
}
