import { describe, expect, it } from 'vitest';
import * as engine from '../src/engine';
import type { GameState, Params } from '../src/engine/types';
import { createLlmRoles, DEFAULT_LLM_SETTINGS } from '../src/llm';
import { exchange, holdVote, writeDeclineLetters, writeReport } from '../src/game/turns';

const loaded = engine.loadConfig();
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { config } = loaded;
const roles = createLlmRoles(config, () => DEFAULT_LLM_SETTINGS);

type Package = [string, Params][];

async function begin(seat: string) {
  let state = engine.createGame(config, { id: 'labeval', seed: 7, now: 10 });
  state = engine.chooseSeat(config, state, seat, 20);
  state = engine.leaveRoleCard(config, state, 30);
  state = engine.submitQuiz(state, 'pre', ['Governments, labs, and auditors must balance secrecy and verification.'], 40);
  const invited = config.scenario.seats.filter(id => id !== seat);
  state = engine.convene(config, state, { forum: 'un_multilateral', agenda_scope: 'tests_verification', format: 'track1', invited }, 50);
  return engine.enterRoom(config, (await writeDeclineLetters(config, roles, state)).state, 60);
}

/** Tables the package, makes the given speeches, and returns the AI votes of the lab and the evaluator. */
async function play(seat: string, pack: Package, speeches: string[] = []) {
  const talk = [...speeches, 'We table this draft.', 'We table this draft.', 'We table this draft.'].slice(0, Math.max(3, speeches.length));
  let state: GameState = pack.reduce((game, [id, params]) => engine.proposeClause(config, game, id, params), await begin(seat));
  for (const text of talk) state = (await exchange(config, roles, state, text)).state;
  state = engine.startReport(config, state, 100);
  state = (await writeReport(config, roles, state)).state;
  state = (await holdVote(config, roles, state)).state;
  const details = state.votes.at(-1)!.details;
  const pick = (id: string) => details.find(d => d.delegation === id)!;
  return { lab: pick('frontier_lab'), eval: pick('evaluator'), details };
}

const nationalExecution: Package = [
  ['verifier', { who: 'national_institute' }], ['model_access', { level: 'structured_access' }],
  ['mutual_recognition', { mode: 'multilateral' }], ['jailbreak_rate', { threshold_pct: 5, test_set: 'shared' }],
  ['dangerous_capability_eval', {}], ['compute_threshold', {}], ['measurement_uncertainty', {}],
];
const thirdParty: Package = [
  ['verifier', { who: 'third_party' }], ['model_access', { level: 'structured_access' }],
  ['dangerous_capability_eval', { domains: ['cyber', 'bio'], protocol: 'shared' }], ['compute_threshold', {}],
];
const independentChecks: Package = [...thirdParty, ['incident_reporting', { deadline_days: 14, recipient: 'joint_registry' }]];
const inclusive: Package = [
  ['capacity_building', {}], ['mutual_recognition', { mode: 'multilateral' }], ['jailbreak_rate', { threshold_pct: 5, test_set: 'shared' }],
  ['verifier', { who: 'third_party' }], ['model_access', { level: 'structured_access' }], ['compute_threshold', {}],
  ['dangerous_capability_eval', {}],
];

const without = (pack: Package, ...ids: string[]): Package => pack.filter(([id]) => !ids.includes(id));
const withParam = (pack: Package, template: string, params: Params): Package => pack.map(([id, p]) => [id, id === template ? params : p]);

// The lab and the evaluator are AI-only but they vote. "Has their votes" below means both vote yes.
describe('frontier lab and evaluator votes on each playable seat package', () => {
  it('China: national execution with recognition, structured access and reported uncertainty has both votes', async () => {
    const r = await play('china', nationalExecution);
    expect(r.lab).toMatchObject({ vote: 'yes', red_lines_hit: [] });
    expect(r.eval).toMatchObject({ vote: 'yes', red_lines_hit: [] });
    // The evaluator accepts national execution only because the access and uncertainty items pay for it.
    expect(r.eval.missing).toEqual(['eval_independent_verification']);
  });

  it('China: dropping the uncertainty clause loses the evaluator but not the lab', async () => {
    const bare = without(nationalExecution, 'measurement_uncertainty');
    expect((await play('china', bare)).eval.vote).toBe('no');
    expect((await play('china', bare)).lab.vote).toBe('yes');
  });

  it('US: independent verification, cyber evaluation and structured access has both votes', async () => {
    const r = await play('us', thirdParty);
    expect(r.lab.vote).toBe('yes');
    expect(r.eval.vote).toBe('yes');
  });

  it('US: omitting the compute trigger loses the lab', async () => {
    const r = await play('us', without(thirdParty, 'compute_threshold'));
    expect(r.lab.vote).toBe('no');
    expect(r.lab.missing).toContain('lab_predictable_scope');
  });

  it('EU: independent checks with incident reporting has both votes', async () => {
    const r = await play('eu', independentChecks);
    expect(r.lab.vote).toBe('yes');
    expect(r.eval.vote).toBe('yes');
  });

  it('Global South: capacity building with an inclusive shared protocol has both votes', async () => {
    const r = await play('global_south', inclusive);
    expect(r.lab.vote).toBe('yes');
    expect(r.eval.vote).toBe('yes');
  });

  it('naive packages: weights transfer loses the lab, self-report loses the evaluator, API-only loses the evaluator', async () => {
    const weights = await play('eu', withParam(independentChecks, 'model_access', { level: 'weights' }));
    expect(weights.lab).toMatchObject({ vote: 'no', red_lines_hit: ['lab_no_weights_transfer'] });

    const selfReport = await play('china', withParam(nationalExecution, 'verifier', { who: 'self_report' }));
    expect(selfReport.eval).toMatchObject({ vote: 'no', red_lines_hit: ['eval_no_self_report_only'] });
    expect(selfReport.lab.vote).toBe('yes');

    const apiOnly = await play('china', withParam(without(nationalExecution, 'measurement_uncertainty'), 'model_access', { level: 'api_only' }));
    expect(apiOnly.eval.vote).toBe('no');
    expect(apiOnly.lab.vote).toBe('yes');
  });

  it('naive packages: an empty draft gets no vote from either', async () => {
    const r = await play('china', []);
    expect(r.lab.vote).toBe('no');
    expect(r.eval.vote).toBe('no');
  });
});
