import { describe, expect, it } from 'vitest';
import * as engine from '../src/engine';
import type { GameState, Params } from '../src/engine/types';
import { createLlmRoles, DEFAULT_LLM_SETTINGS } from '../src/llm';
import { exchange, holdVote, writeDeclineLetters, writeReport } from '../src/game/turns';

const loaded = engine.loadConfig();
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { config } = loaded;
const roles = createLlmRoles(config, () => DEFAULT_LLM_SETTINGS);

type Plan = {
  seat: string;
  forum?: string;
  scope?: string;
  invited?: string[];
  clauses: [string, Params][];
  statements?: string[];
  payment?: [string, string];
};

const base: Record<string, Params> = {
  jailbreak_rate: {}, dangerous_capability_eval: {}, compute_threshold: {}, verifier: {}, model_access: {},
  mutual_recognition: {}, incident_reporting: {}, capacity_building: {},
};
const clauses = (over: Record<string, Params>): [string, Params][] =>
  Object.entries({ ...base, ...over }).map(([id, params]) => [id, params]);

async function play(plan: Plan): Promise<GameState> {
  let state = engine.createGame(config, { id: `playable-${plan.seat}`, seed: 7, now: 10 });
  state = engine.chooseSeat(config, state, plan.seat, 20);
  state = engine.leaveRoleCard(config, state, 30);
  state = engine.submitQuiz(state, 'pre', ['Governments, labs, and auditors must balance secrecy and verification.'], 40);
  const invited = plan.invited ?? config.scenario.seats.filter(id => id !== plan.seat);
  state = engine.convene(config, state, {
    forum: plan.forum ?? 'un_multilateral', agenda_scope: plan.scope ?? 'tests_verification', format: 'track1', invited,
  }, 50);
  state = (await writeDeclineLetters(config, roles, state)).state;
  state = engine.enterRoom(config, state, 60);
  state = plan.clauses.reduce((game, [template, params]) => engine.proposeClause(config, game, template, params), state);
  if (plan.payment) state = engine.offerSidePayment(config, state, plan.payment[0], plan.payment[1]);
  for (const text of plan.statements ?? []) state = (await exchange(config, roles, state, text)).state;
  state = engine.startReport(config, state, 100);
  state = (await writeReport(config, roles, state)).state;
  return (await holdVote(config, roles, state)).state;
}

const last = (state: GameState) => state.votes.at(-1)!;
const detail = (state: GameState, id: string) => last(state).details.find(item => item.delegation === id)!;

const recognition = 'Our common test protocol supports mutual recognition and comparable national reports.';
const enclave = 'We propose structured access in a secure enclave with confidence interval reporting.';
const sovereignty = 'National institutions run the tests, and we respect national sovereignty.';
const capacity = 'We can fund evaluator training, shared compute access and multilingual test sets.';

describe('EU seat', () => {
  const winning: Plan = {
    seat: 'eu',
    clauses: clauses({ verifier: { who: 'third_party' }, model_access: { level: 'structured_access' }, incident_reporting: { deadline_days: 14, recipient: 'joint_registry' } }),
    statements: [recognition, enclave, capacity],
  };

  it('passes with independent verification, structured access and prompt incident reporting', async () => {
    const state = await play(winning);
    expect(last(state).passed).toBe(true);
    const own = detail(state, 'eu');
    expect(own.red_lines_hit).toEqual([]);
    expect(own.satisfied).toEqual(expect.arrayContaining(['eu_independent_verification', 'eu_structured_access', 'eu_incident_reporting']));
  });

  it('fails with developer self-reporting and a public summary, which cross its own red lines', async () => {
    const state = await play({ ...winning, clauses: clauses({ verifier: { who: 'self_report' }, incident_reporting: { deadline_days: 60, recipient: 'public_summary' } }) });
    expect(last(state).passed).toBe(false);
    expect(detail(state, 'eu').red_lines_hit).toEqual(expect.arrayContaining(['eu_no_self_report_only', 'eu_no_public_summary_only']));
  });

  it('fails when it demands compulsory weights access', async () => {
    const state = await play({ ...winning, clauses: clauses({ verifier: { who: 'third_party' }, model_access: { level: 'weights' } }) });
    expect(last(state).passed).toBe(false);
  });
});

describe('Global South seat', () => {
  const winning: Plan = {
    seat: 'global_south',
    clauses: clauses({ verifier: { who: 'national_institute' }, model_access: { level: 'structured_access' }, incident_reporting: { deadline_days: 14, recipient: 'joint_registry' } }),
    statements: [recognition, enclave, capacity],
    payment: ['frontier_lab', 'shared_test_set'],
  };

  it('passes with an open venue, funded capacity building and multilateral recognition', async () => {
    const state = await play(winning);
    expect(last(state).passed).toBe(true);
    const own = detail(state, 'global_south');
    expect(own.red_lines_hit).toEqual([]);
    expect(own.satisfied).toEqual(expect.arrayContaining(['gs_funded_capacity', 'gs_recognise_results', 'gs_shared_tests']));
  });

  it('is overruled by its own red line when it settles for voluntary pledges and bilateral recognition', async () => {
    const state = await play({ ...winning, clauses: clauses({ capacity_building: { support: 'voluntary' }, mutual_recognition: { mode: 'bilateral' } }) });
    expect(detail(state, 'global_south')).toMatchObject({ vote: 'no', red_lines_hit: ['gs_no_bilateral_recognition'] });
    expect(detail(state, 'global_south').satisfied).not.toContain('gs_funded_capacity');
  });

  it('fails when it pushes broad export controls: China declines, its own red line fires, and the others see no tests', async () => {
    const state = await play({
      ...winning, scope: 'tests_export_controls', payment: undefined, statements: [recognition, sovereignty, capacity],
      clauses: [['capacity_building', { support: 'funded' }], ['export_controls', { scope: 'broad', coverage: 'both' }], ['mutual_recognition', { mode: 'multilateral' }]],
    });
    expect(state.attendance.find(item => item.delegation === 'china')?.status).toBe('decline');
    expect(detail(state, 'global_south').red_lines_hit).toContain('gs_no_broad_restrictions');
    expect(last(state).passed).toBe(false);
  });

  it('cannot even open the room when it convenes a closed club for only two partners', async () => {
    const state = await play({ ...winning, forum: 'likeminded_club', invited: ['us', 'eu'] });
    expect(engine.quorumMet(config, state)).toBe(false);
    expect(state.votes).toHaveLength(0);
  });
});
