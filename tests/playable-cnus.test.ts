import { describe, expect, it } from 'vitest';
import * as engine from '../src/engine';
import type { AttendanceResult, GameState, Params } from '../src/engine/types';
import { createLlmRoles, DEFAULT_LLM_SETTINGS } from '../src/llm';
import { exchange, holdVote, writeDeclineLetters, writeReport } from '../src/game/turns';

const loaded = engine.loadConfig();
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { config } = loaded;
const roles = createLlmRoles(config, () => DEFAULT_LLM_SETTINGS);

type Package = [string, Params][];
interface Plan {
  seat: string; forum?: string; scope?: string; format?: 'track1' | 'track2'; invited?: string[];
  clauses: Package; speech: string[];
}

// Each line contains phrases the offline tagger recognises (see config/argument_tags.yaml).
const SPEECH = {
  filler: 'We note the points made and ask the chair to continue.',
  recognition: 'Our common test protocol supports mutual recognition and comparable national reports.',
  access: 'We propose structured access in a secure enclave with confidence interval reporting.',
  sovereignty: 'Respect for sovereignty matters: national institutions run the tests and we only exchange results.',
  capacity: 'We can fund evaluator training and shared testing facilities for every delegation.',
};

async function convened(plan: Plan): Promise<GameState> {
  let state = engine.createGame(config, { id: 'cnus', seed: 7, now: 10 });
  state = engine.chooseSeat(config, state, plan.seat, 20);
  state = engine.leaveRoleCard(config, state, 30);
  state = engine.submitQuiz(state, 'pre', ['Governments, labs, and auditors must balance secrecy and verification.'], 40);
  const invited = plan.invited ?? config.scenario.seats.filter(id => id !== plan.seat);
  state = engine.convene(config, state, {
    forum: plan.forum ?? 'un_multilateral', agenda_scope: plan.scope ?? 'tests_verification',
    format: plan.format ?? 'track1', invited,
  }, 50);
  return (await writeDeclineLetters(config, roles, state)).state;
}

async function play(plan: Plan): Promise<GameState> {
  let state = engine.enterRoom(config, await convened(plan), 60);
  for (const [template, params] of plan.clauses) state = engine.proposeClause(config, state, template, params);
  const speech = [...plan.speech, ...Array(Math.max(0, 3 - plan.speech.length)).fill(SPEECH.filler)] as string[];
  for (const text of speech) state = (await exchange(config, roles, state, text)).state;
  state = engine.startReport(config, state, 100);
  state = (await writeReport(config, roles, state)).state;
  return (await holdVote(config, roles, state)).state;
}

const lastVote = (state: GameState) => state.votes.at(-1)!;
const detail = (state: GameState, id: string) => lastVote(state).details.find(item => item.delegation === id)!;
const verdict = (state: GameState) => engine.continueAfterVote(config, state, 120);
const status = (attendance: AttendanceResult[], id: string) => attendance.find(item => item.delegation === id)!;

const base = (overrides: Record<string, Params>): Package => ([
  ['jailbreak_rate', {}], ['dangerous_capability_eval', {}], ['compute_threshold', {}],
  ['verifier', {}], ['model_access', { level: 'structured_access' }], ['mutual_recognition', {}],
  ['incident_reporting', {}], ['capacity_building', {}],
] as Package).map(([id, params]) => [id, overrides[id] ?? params]);

const nationalPackage = base({ verifier: { who: 'national_institute' } });
const thirdPartyPackage = base({ verifier: { who: 'third_party' } });
const allArguments = [SPEECH.recognition, SPEECH.access, SPEECH.capacity];
const usArguments = [SPEECH.sovereignty, SPEECH.recognition, SPEECH.capacity];

async function attendanceFor(seat: string, forum: string, scope: string, invited: string[]) {
  return (await convened({ seat, forum, scope, invited, clauses: [], speech: [] })).attendance;
}

describe('China seat', () => {
  it('wins with national execution, mutual recognition and arguments about verification without weights', async () => {
    const voted = await play({ seat: 'china', clauses: nationalPackage, speech: allArguments });
    expect(lastVote(voted)).toMatchObject({ passed: true, needed: 4 });
    expect(detail(voted, 'china').missing).toEqual([]);
    expect(detail(voted, 'china').satisfied).toEqual(['national_execution', 'cn_workable_tests', 'cn_recognise_results']);
    expect(verdict(voted).outcome).toMatchObject({ passed: true, type: 'full_agreement' });
  });

  it('cannot win a national-execution text without arguments: the US and EU hold out', async () => {
    const voted = await play({ seat: 'china', clauses: nationalPackage, speech: [] });
    expect(lastVote(voted).passed).toBe(false);
    expect(detail(voted, 'us').vote).toBe('no');
    expect(detail(voted, 'eu').vote).toBe('no');
  });

  it('fails through three cycles when it demands model weights', async () => {
    let state = engine.enterRoom(config, await convened({ seat: 'china', clauses: [], speech: [] }), 60);
    for (const [id, params] of base({ model_access: { level: 'weights' } })) state = engine.proposeClause(config, state, id, params);
    for (let cycle = 1; cycle <= config.rules.max_cycles; cycle += 1) {
      for (const text of allArguments) state = (await exchange(config, roles, state, text)).state;
      state = engine.startReport(config, state, 100);
      state = (await writeReport(config, roles, state)).state;
      state = (await holdVote(config, roles, state)).state;
      expect(lastVote(state).passed).toBe(false);
      expect(detail(state, 'china').red_lines_hit).toContain('cn_no_weights_access');
      expect(detail(state, 'us').red_lines_hit).toContain('us_no_weights_transfer');
      state = engine.continueAfterVote(config, state, 100 + cycle);
    }
    expect(state.outcome?.type).toBe('no_agreement');
  });

  it('walks out of its own export-control text, leaving a text without its own vote', async () => {
    const draft: Package = [...nationalPackage, ['export_controls', { scope: 'targeted' }]];
    const voted = await play({ seat: 'china', scope: 'tests_export_controls', clauses: draft, speech: allArguments });
    expect(voted.walkouts.map(item => item.delegation)).toContain('china');
    expect(lastVote(voted).details.some(item => item.delegation === 'china')).toBe(false);
    expect(verdict(voted).outcome?.type).not.toBe('full_agreement');
  });

  it('cannot get a full agreement by demanding the US lift chip controls: the US hits a red line', async () => {
    const draft: Package = [...nationalPackage, ['export_controls', { scope: 'none' }]];
    const voted = await play({ seat: 'china', scope: 'tests_export_controls', clauses: draft, speech: allArguments });
    expect(detail(voted, 'us')).toMatchObject({ vote: 'no', red_lines_hit: ['us_no_export_control_rollback'] });
    expect(verdict(voted).outcome?.type).not.toBe('full_agreement');
  });

  it('does not pass an empty draft', async () => {
    expect(lastVote(await play({ seat: 'china', clauses: [], speech: [] })).passed).toBe(false);
  });

  it('joins a US-led club only if developing countries are present and recognition is on the agenda', async () => {
    const guests = ['china', 'eu', 'frontier_lab', 'evaluator'];
    const without = await attendanceFor('us', 'likeminded_club', 'tests_verification', guests);
    expect(status(without, 'china').status).toBe('decline');
    expect(status(without, 'china').reasons.map(item => item.id)).toContain('cn_club_without_global_south');
    const withSouth = await attendanceFor('us', 'likeminded_club', 'tests_verification', [...guests, 'global_south']);
    expect(status(withSouth, 'china').status).toBe('attend');
    const testsOnly = await attendanceFor('us', 'likeminded_club', 'tests_only', [...guests, 'global_south']);
    expect(status(testsOnly, 'china').status).toBe('decline');
  });

  it('accepts a US-proposed bilateral risk channel but refuses it once export controls are on the agenda', async () => {
    const channel = await attendanceFor('us', 'bilateral_us_china', 'tests_verification', ['china']);
    expect(status(channel, 'china').status).toBe('attend');
    const controls = await attendanceFor('us', 'bilateral_us_china', 'tests_export_controls', ['china']);
    expect(status(controls, 'china').status).toBe('decline');
  });
});

describe('US seat', () => {
  it('wins with third-party verification, structured access and sovereignty-respecting arguments', async () => {
    const voted = await play({ seat: 'us', clauses: thirdPartyPackage, speech: usArguments });
    expect(lastVote(voted)).toMatchObject({ passed: true, needed: 4 });
    expect(detail(voted, 'us').missing).toEqual([]);
    expect(detail(voted, 'us').satisfied).toEqual(['us_dangerous_capabilities', 'us_checkable_results', 'us_safeguarded_access']);
    expect(detail(voted, 'china').vote).toBe('yes');
    expect(verdict(voted).outcome).toMatchObject({ passed: true, type: 'full_agreement' });
  });

  it('gets only a paper standard when it does not answer the Chinese sovereignty concern', async () => {
    const voted = await play({ seat: 'us', clauses: thirdPartyPackage, speech: [] });
    expect(detail(voted, 'china').vote).toBe('no');
    expect(verdict(voted).outcome?.type).not.toBe('full_agreement');
  });

  it('fails when it demands model weights, hitting its own red line and two others', async () => {
    const draft = base({ model_access: { level: 'weights' }, verifier: { who: 'third_party' } });
    const voted = await play({ seat: 'us', clauses: draft, speech: usArguments });
    expect(lastVote(voted).passed).toBe(false);
    expect(detail(voted, 'us').red_lines_hit).toContain('us_no_weights_transfer');
    expect(detail(voted, 'china').red_lines_hit).toContain('cn_no_weights_access');
    expect(detail(voted, 'frontier_lab').red_lines_hit).toContain('lab_no_weights_transfer');
  });

  it('loses China and a full agreement when it opens the agenda to broad export controls', async () => {
    const draft: Package = [...thirdPartyPackage, ['export_controls', { scope: 'broad' }]];
    const voted = await play({ seat: 'us', scope: 'tests_export_controls', clauses: draft, speech: usArguments });
    expect(status(voted.attendance, 'china').status).toBe('decline');
    expect(detail(voted, 'global_south').red_lines_hit).toContain('gs_no_broad_restrictions');
    expect(verdict(voted).outcome?.type).not.toBe('full_agreement');
  });

  it('treats the bilateral as a risk channel: it declines verification talks there and the room cannot reach quorum', async () => {
    const narrow = await attendanceFor('china', 'bilateral_us_china', 'tests_only', ['us']);
    expect(status(narrow, 'us').status).toBe('attend');
    const verification = await attendanceFor('china', 'bilateral_us_china', 'tests_verification', ['us']);
    expect(status(verification, 'us').status).toBe('decline');
    expect(status(verification, 'us').reasons.map(item => item.id)).toContain('us_bilateral_risk_channel');
    const state = await convened({ seat: 'china', forum: 'bilateral_us_china', scope: 'tests_only', invited: ['us'], clauses: [], speech: [] });
    expect(engine.quorumMet(config, state)).toBe(false);
  });

  it('does not pass an empty draft', async () => {
    expect(lastVote(await play({ seat: 'us', clauses: [], speech: [] })).passed).toBe(false);
  });
});
