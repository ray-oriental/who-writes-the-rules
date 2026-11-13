import { describe, expect, it } from 'vitest';
import * as engine from '../src/engine';
import type { GameState, Params } from '../src/engine/types';
import { createLlmRoles, DEFAULT_LLM_SETTINGS } from '../src/llm';
import { exchange, holdVote, writeDeclineLetters, writeReport } from '../src/game/turns';
import { gameSchema } from '../src/game/storage';
import { emptyGallery, mergeGallery, publication, rank } from '../src/game/platform';

const loaded = engine.loadConfig();
if (!loaded.ok) throw new Error(JSON.stringify(loaded.errors));
const { config } = loaded;
const roles = createLlmRoles(config, () => DEFAULT_LLM_SETTINGS);

const reasonable: [string, Params][] = [
  ['jailbreak_rate', {}], ['dangerous_capability_eval', {}], ['compute_threshold', {}],
  ['verifier', { who: 'national_institute' }], ['model_access', { level: 'structured_access' }],
  ['mutual_recognition', {}], ['incident_reporting', {}], ['capacity_building', {}],
];

async function begin(seat = 'china', format: 'track1' | 'track2' = 'track1', agenda_scope = 'tests_verification') {
  let state = engine.createGame(config, { id: 'simulation', seed: 7, now: 10 });
  state = engine.chooseSeat(config, state, seat, 20);
  state = engine.leaveRoleCard(config, state, 30);
  state = engine.submitQuiz(state, 'pre', ['Governments, labs, and auditors must balance secrecy and verification.'], 40);
  const invited = config.scenario.seats.filter(id => id !== seat);
  state = engine.convene(config, state, { forum: 'un_multilateral', agenda_scope, format, invited }, 50);
  const attendance = await writeDeclineLetters(config, roles, state);
  expect(attendance.fallback).toBe(false);
  return attendance.state;
}

async function vote(state: GameState) {
  const statements = [
    'Our common test protocol supports mutual recognition and comparable national reports.',
    'We propose structured access in a secure enclave with confidence interval reporting.',
    'National institutions run the tests. We can fund evaluator training.',
  ];
  for (const text of statements) state = (await exchange(config, roles, state, text)).state;
  state = engine.startReport(config, state, 100);
  state = (await writeReport(config, roles, state)).state;
  expect(state.reports.at(-1)?.clauses.map(item => item.text)).toEqual(state.clauses.map(item => item.text));
  return (await holdVote(config, roles, state)).state;
}

function table(state: GameState, text: [string, Params][]) {
  return text.reduce((game, [template, params]) => engine.proposeClause(config, game, template, params), state);
}

describe('offline simulation with the shipped configuration', () => {
  it('adopts a workable national-verification package and completes the debrief', async () => {
    const play = async () => {
      const room = engine.enterRoom(config, await begin(), 60);
      expect(room.phase).toBe('negotiate');
      return vote(table(room, reasonable));
    };
    const voted = await play();
    expect(voted.votes.at(-1)).toMatchObject({ passed: true, needed: 4 });
    const again = await play();
    expect(again.votes).toEqual(voted.votes);
    expect(again.messages).toEqual(voted.messages);
    const result = engine.continueAfterVote(config, voted, 120);
    expect(result.outcome?.passed).toBe(true);
    const proposed = publication(config, voted, result);
    expect(proposed).toMatchObject({ kind: 'proposal', yes: voted.votes.at(-1)?.yes });
    let finished = engine.openDebrief(result, 130);
    finished = engine.finishDebrief(config, finished, 140);
    finished = engine.submitQuiz(finished, 'post', ['Different actors can agree on tests while disagreeing on access.'], 150);
    expect(finished.phase).toBe('done');
    expect(gameSchema.parse(JSON.parse(JSON.stringify(finished)))).toEqual(finished);

    const imported = JSON.stringify({ schema: 1, proposals: [proposed], ratings: [
      { id: 'first', proposal_id: proposed?.id, scores: [5, 4, 3], at: 160 },
    ] });
    const gallery = mergeGallery(emptyGallery, imported, 3);
    expect(gallery.added).toBe(2);
    expect(mergeGallery(gallery.data, imported, 3).added).toBe(0);
    expect(rank(gallery.data, 3, 5)[0]).toMatchObject({ score: 4, means: [5, 4, 3], rank: 1 });
  });

  it('rejects compulsory weights transfer through all three official cycles', async () => {
    const room = engine.enterRoom(config, await begin('eu'), 60);
    let state = table(room, reasonable.map(([id, params]) => [id, id === 'model_access' ? { level: 'weights' } : params]));
    for (let cycle = 1; cycle <= config.rules.max_cycles; cycle += 1) {
      state = await vote(state);
      expect(state.votes.at(-1)?.passed).toBe(false);
      expect(state.votes.at(-1)?.details.find(item => item.delegation === 'china')?.red_lines_hit).toContain('cn_no_weights_access');
      state = engine.continueAfterVote(config, state, 100 + cycle);
    }
    expect(state.outcome?.type).toBe('no_agreement');
  });

  it('blocks an empty draft from passing', async () => {
    const room = engine.enterRoom(config, await begin(), 60);
    const voted = await vote(room);
    expect(voted.votes.at(-1)).toMatchObject({ passed: false });
  });

  it('opens expert dialogue on a narrower agenda and carries its annex into an official meeting', async () => {
    const official = await begin('us', 'track1', 'tests_export_controls');
    expect(official.attendance.find(item => item.delegation === 'china')?.status).toBe('decline');
    const expert = engine.startTrack2(config, official, 60);
    expect(expert.attendance.find(item => item.delegation === 'china')?.status).toBe('attend');
    const room = engine.enterRoom(config, expert, 70);
    const drafted = table(room, reasonable.map(([id, params]) => [id, id === 'verifier' ? { who: 'third_party' } : params]));
    expect(drafted.clauses.some(item => item.template === 'mutual_recognition')).toBe(false);
    const voted = await vote(drafted);
    expect(voted.votes.at(-1)?.passed).toBe(true);
    const next = engine.continueAfterVote(config, voted, 120);
    expect(next).toMatchObject({ phase: 'convene', track: 1, convene_attempts: official.convene_attempts });
    expect(publication(config, voted, next)?.kind).toBe('annex');
    const reconvened = engine.convene(config, next, { ...official.choices!, agenda_scope: 'tests_verification' }, 130);
    const resumed = engine.enterRoom(config, reconvened, 140);
    expect(resumed.clauses.filter(clause => clause.from_annex)).toHaveLength(drafted.clauses.length);
  });

  it('offers the expert channel or a clean ending after walkouts cost quorum', async () => {
    const room = engine.enterRoom(config, await begin(), 60);
    const depleted = { ...room, walkouts: room.attendance.filter(item => item.status === 'attend').slice(0, 3)
      .map(item => ({ delegation: item.delegation, cycle: 1, round: 1, trigger: 'test', say: 'We are leaving.' })) };
    expect(engine.quorumMet(config, depleted)).toBe(false);
    expect(engine.canStartTrack2(config, depleted)).toBe(true);
    expect(engine.concede(config, depleted, 70).outcome?.type).toBe('no_agreement');
  });
});
