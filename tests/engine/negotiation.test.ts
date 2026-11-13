import { describe, expect, it } from 'vitest';
import { acceptSuggestion, allowedTemplates, canRequestReport, canSpeak, clauseBriefs, derive, dismissSuggestion,
  editClause, endRound, offerSidePayment, pickResponders, pickVoice, playerSpeak, proposeClause, recordSpeech, validateParams, withdrawClause } from '../../src/engine';
import { fixture, freeze, ready, room } from './fixture';

describe('clause table and suggestions', () => {
  it('filters by agenda and expert scope', () => {
    const config = fixture();
    const state = room(config);
    expect(allowedTemplates(config, state).map(t => t.id)).not.toContain('controls');
    const broad = { ...state, choices: { ...state.choices!, agenda_scope: 'broad' } };
    expect(allowedTemplates(config, broad).map(t => t.id)).toContain('controls');
    expect(allowedTemplates(config, { ...broad, track: 2 }).map(t => t.id)).not.toContain('controls');
    expect(proposeClause(config, state, 'controls', {})).toBe(state);
  });
  it('validates every parameter kind, fills defaults and renders text', () => {
    const config = fixture();
    const state = room(config);
    expect(proposeClause(config, state, 'metric', { rate: 100 }).clauses[0]).toMatchObject({ id: 'metric', params: { rate: 50 }, text: 'The threshold is 50%.' });
    expect(proposeClause(config, state, 'metric', { rate: -10 }).clauses[0].params.rate).toBe(0);
    expect(proposeClause(config, state, 'verifier', {}).clauses[0].params).toEqual({ who: 'national', access: 'api' });
    expect(proposeClause(config, state, 'domains', { areas: ['bio', 'bio'] }).clauses[0].params).toEqual({ areas: ['bio'] });
    expect(proposeClause(config, state, 'verifier', { who: 'unknown' })).toBe(state);
    expect(proposeClause(config, state, 'domains', { areas: ['unknown'] })).toBe(state);
    expect(proposeClause(config, state, 'domains', { areas: 'bio' })).toBe(state);
    expect(proposeClause(config, state, 'metric', { rate: NaN })).toBe(state);
    expect(proposeClause(config, state, 'metric', { rate: '5' })).toBe(state);
    expect(proposeClause(config, state, 'metric', { unexpected: 1 })).toBe(state);
    expect(proposeClause(config, ready(config), 'metric', {})).toEqual(ready(config));
  });
  it('supports enum first-value and empty multi defaults and value labels', () => {
    const config = fixture();
    config.catalog[0].params.who = { type: 'enum', values: ['national', 'shared'], value_labels: { national: 'National institutes' } };
    config.catalog[2].params.areas = { type: 'multi', values: ['bio'] };
    expect(validateParams(config.catalog[0], {})?.who).toBe('national');
    expect(proposeClause(config, room(config), 'verifier', {}).clauses[0].text).toBe('National institutes tests with api access.');
    expect(validateParams(config.catalog[2], {})).toEqual({ areas: [] });
  });
  it('edits existing templates and partial params with version histories without mutation', () => {
    const config = fixture();
    const first = proposeClause(config, room(config), 'verifier', {});
    const snapshot = structuredClone(first);
    const second = editClause(config, freeze(first), 'verifier', { who: 'shared' });
    expect(second.clauses).toHaveLength(1);
    expect(second.clauses[0].params.access).toBe('api');
    expect(second.clauses[0].version).toBe(2);
    expect(second.clauses[0].history.map(h => h.version)).toEqual([1, 2]);
    expect(first).toEqual(snapshot);
    expect(proposeClause(config, second, 'verifier', {}).clauses[0].version).toBe(3);
    expect(editClause(config, second, 'missing', {})).toBe(second);
    expect(withdrawClause(config, second, 'missing')).toBe(second);
    expect(withdrawClause(config, second, 'verifier').clauses).toEqual([]);
    const withdrawn = withdrawClause(config, second, 'verifier');
    expect(withdrawn.messages.at(-1)).toMatchObject({ speaker: 'system', kind: 'system' });
    expect(withdrawn.messages.at(-1)?.text).toContain('Version 1');
    expect(withdrawn.messages.at(-1)?.text).toContain('Version 2');
  });
  it('evaluates mixed walkout conditions after each change and removes the delegation from speakers and voters', () => {
    const config = fixture();
    config.delegations[1].walkout_triggers.push({ id: 'exit', when: { clause: 'verifier', param: 'who', equals: 'shared', forum: 'open' }, say: 'We are leaving.' });
    const state = proposeClause(config, room(config), 'verifier', { who: 'shared' });
    expect(state.walkouts).toEqual([{ delegation: 'b', cycle: 1, round: 1, trigger: 'exit', say: 'We are leaving.' }]);
    expect(state.messages.at(-1)).toMatchObject({ kind: 'walkout', speaker: 'b' });
    expect(derive(config, state).present).not.toContain('b');
    expect(derive(config, state).voters).not.toContain('b');
    expect(pickResponders(config, state, 'b')).not.toContain('b');
    expect(recordSpeech(config, state, { delegation: 'b', text: 'Cannot speak.' })).toBe(state);
    expect(editClause(config, state, 'verifier', { who: 'national' }).walkouts).toHaveLength(1);
  });
  it('walks out on withdrawal and honors all mixed convening keys', () => {
    const config = fixture();
    config.delegations[1].walkout_triggers.push({ id: 'exit', when: { clause_absent: 'metric', format: 'track1' }, say: 'We need a metric.' });
    config.delegations[2].walkout_triggers.push({ id: 'inactive', when: { clause_present: 'metric', format: 'track2' }, say: 'Experts only.' });
    const state = proposeClause(config, room(config), 'metric', {});
    expect(state.walkouts).toEqual([]);
    expect(withdrawClause(config, state, 'metric').walkouts.map(w => w.delegation)).toEqual(['b']);
  });
  it('rejects a suggestion crossing its proposer red line and validates all model params', () => {
    const config = fixture();
    const state = room(config);
    const speech = (template: string, params: Record<string, string | number>) => recordSpeech(config, state, { delegation: 'b', text: 'A suggestion.', amendment: { template, params } });
    expect(speech('verifier', { access: 'weights' }).suggestions).toEqual([]);
    expect(speech('verifier', { access: 'invalid' }).suggestions).toEqual([]);
    expect(speech('controls', {}).suggestions).toEqual([]);
    expect(speech('missing', {}).suggestions).toEqual([]);
    expect(speech('metric', { rate: 100 }).suggestions[0].params.rate).toBe(50);
  });
  it('keeps one open suggestion per delegation and applies only accepted suggestions', () => {
    const config = fixture();
    let state = recordSpeech(config, room(config), { delegation: 'b', text: 'Metric.', voice: 'technical', fallback: true, amendment: { template: 'metric', params: { rate: 9 } } });
    expect(state.clauses).toHaveLength(0);
    expect(state.messages.at(-1)).toMatchObject({ id: 'm2', voice: 'technical', fallback: true });
    expect(state.suggestions[0].id).toBe('s-b-2');
    state = recordSpeech(config, state, { delegation: 'b', text: 'Changed.', amendment: { template: 'verifier', params: {} } });
    expect(state.suggestions).toHaveLength(1);
    expect(state.suggestions[0].template).toBe('verifier');
    expect(dismissSuggestion(state, 'missing').suggestions).toHaveLength(1);
    expect(dismissSuggestion(state, state.suggestions[0].id).suggestions).toEqual([]);
    state = acceptSuggestion(config, freeze(state), state.suggestions[0].id);
    expect(state.clauses.map(c => c.template)).toEqual(['verifier']);
    expect(state.clauses[0].proposed_by).toBe('b');
    expect(state.suggestions).toEqual([]);
    expect(acceptSuggestion(config, state, 'missing')).toBe(state);
  });
});

describe('arguments and speaker selection', () => {
  it('does not soften twice for repeated tags within a cycle and never exceeds max_soften', () => {
    const config = fixture();
    let state = room(config);
    const speak = (tag: string) => { state = playerSpeak(config, freeze(state), { text: 'Recognize tests.', tags: [{ tag, confidence: 1 }], now: 5 }).state; };
    speak('recognition');
    expect(state.soften_log).toHaveLength(3);
    speak('recognition');
    expect(state.soften_log).toHaveLength(3);
    speak('capacity');
    speak('evidence');
    expect(state.soften_log.filter(e => e.delegation === 'b').reduce((sum, e) => sum + e.amount, 0)).toBe(2);
    state = { ...state, cycle: 2 };
    speak('recognition');
    expect(state.soften_log.filter(e => e.delegation === 'b').reduce((sum, e) => sum + e.amount, 0)).toBe(2);
  });
  it('permits the tag again in a later cycle while respecting each must-have budget', () => {
    const config = fixture();
    config.delegations[1].must_haves[0].max_soften = 3;
    let state = playerSpeak(config, room(config), { text: 'A case.', tags: [{ tag: 'recognition', confidence: 1 }], now: 5 }).state;
    state = playerSpeak(config, { ...state, cycle: 2 }, { text: 'A new case.', tags: [{ tag: 'recognition', confidence: 1 }], now: 6 }).state;
    expect(state.soften_log.filter(e => e.delegation === 'b')).toHaveLength(2);
    expect(state.soften_log.filter(e => e.delegation === 'c')).toHaveLength(2);
  });
  it('caps tags at two, ignores unknown and low confidence tags and affects only present AI delegations', () => {
    const config = fixture();
    const state = { ...room(config), attendance: room(config).attendance.map(a => a.delegation === 'c' ? { ...a, status: 'decline' as const } : a) };
    const result = playerSpeak(config, state, { text: 'An argument.', addressee: 'd', now: 5, tags: [
      { tag: 'missing', confidence: 1 }, { tag: 'recognition', confidence: 0.5 }, { tag: 'recognition', confidence: 0.6 },
      { tag: 'recognition', confidence: 1 }, { tag: 'capacity', confidence: 1 }, { tag: 'evidence', confidence: 1 },
    ] });
    expect(result.state.messages.at(-1)?.tags?.map(t => t.tag)).toEqual(['recognition', 'capacity']);
    expect(result.state.soften_log.every(e => ['b', 'd'].includes(e.delegation))).toBe(true);
    expect(result.responders[0]).toBe('d');
  });
  it('softens all matching must-haves with independent capped amounts and defaults', () => {
    const config = fixture();
    const d = config.delegations[1];
    d.must_haves[0].soften_amount = 10;
    d.must_haves.push({ id: 'extra', label: 'Extra', when: { clause_present: 'metric' }, weight: 1, softenable_by: ['recognition'], say: 'Include a metric.' });
    const state = playerSpeak(config, room(config), { text: 'Recognize tests.', tags: [{ tag: 'recognition', confidence: 1 }], now: 5 }).state;
    expect(state.soften_log.filter(e => e.delegation === 'b').map(e => e.amount)).toEqual([2, 1]);
  });
  it('selects addressee then conflict, least recent speech then seat order and clamps count', () => {
    const config = fixture();
    let state = room(config);
    expect(pickResponders(config, state, undefined, 0)).toEqual(['b']);
    expect(pickResponders(config, state, 'd', 100)).toEqual(['d', 'b']);
    state = recordSpeech(config, state, { delegation: 'b', text: 'Already spoke.' });
    expect(pickResponders(config, state)).toEqual(['c', 'd']);
    config.delegations[3].must_haves[0].weight = 9;
    expect(pickResponders(config, state)).toEqual(['d', 'c']);
    config.delegations[2].red_lines[0].when = { clause_present: 'metric' };
    state = proposeClause(config, state, 'metric', {});
    expect(pickResponders(config, state)).toEqual(['c', 'd']);
    expect(pickResponders(config, state, 'a')).toEqual(['c', 'd']);
    expect(pickResponders(config, { ...state, attendance: [] })).toEqual([]);
  });
  it('picks crossed red-line voice, heaviest missing voice and first fallback voice', () => {
    const config = fixture();
    let state = room(config);
    expect(pickVoice(config, state, 'b')).toBe('technical');
    state = proposeClause(config, state, 'verifier', {});
    expect(pickVoice(config, state, 'b')).toBe('technical');
    state = editClause(config, state, 'verifier', { access: 'weights' });
    expect(pickVoice(config, state, 'b')).toBe('political');
    expect(pickVoice(config, state, 'missing')).toBeUndefined();
    config.delegations[1].voices = [];
    config.delegations[1].red_lines = [];
    config.delegations[1].must_haves = [];
    expect(pickVoice(config, state, 'b')).toBeUndefined();
  });
  it('returns model clause briefs and hides red-line labels in the UI projection', () => {
    const config = fixture();
    let state = proposeClause(config, room(config), 'verifier', {});
    expect(clauseBriefs(config, state, 'b')[0]).toMatchObject({ position: 'support', reason: 'National institutes should perform the tests.' });
    state = editClause(config, state, 'verifier', { who: 'shared' });
    expect(clauseBriefs(config, state, 'b')[0].position).toBe('oppose');
    state = editClause(config, state, 'verifier', { access: 'weights' });
    expect(clauseBriefs(config, state, 'b')[0]).toMatchObject({ position: 'red_line', reason: 'We cannot release model weights.' });
    expect(derive(config, state).stances.verifier.b).toBe('oppose');
    state = proposeClause(config, state, 'metric', {});
    expect(clauseBriefs(config, state, 'b')[1].position).toBe('neutral');
  });
  it('limits rounds and reports by completed rounds using the active track', () => {
    const config = fixture();
    let state = room(config);
    expect(canRequestReport(config, state)).toBe(false);
    state = endRound(config, state);
    expect(canRequestReport(config, state)).toBe(true);
    state = endRound(config, endRound(config, state));
    expect(canSpeak(config, state)).toBe(false);
    expect(endRound(config, state)).toBe(state);
    expect(playerSpeak(config, state, { text: 'Too late.', tags: [], now: 5 })).toEqual({ state, responders: [] });
    expect(state.messages.at(-1)?.text).toContain('complete');
    config.rules.allow_early_report_after = 99;
    expect(canRequestReport(config, { ...state, track: 2, round: 3 })).toBe(true);
    expect(canSpeak(config, { ...state, track: 2, round: 3 })).toBe(false);
  });
  it('limits and validates side payments and emits deterministic messages', () => {
    const config = fixture();
    let state = room(config);
    expect(offerSidePayment(config, state, 'a', 'training')).toBe(state);
    expect(offerSidePayment(config, state, 'b', 'missing')).toBe(state);
    state = offerSidePayment(config, freeze(state), 'b', 'training');
    expect(state.messages.at(-1)).toMatchObject({ kind: 'side_payment', addressed_to: 'b' });
    expect(offerSidePayment(config, state, 'b', 'training')).toBe(state);
    state = offerSidePayment(config, state, 'c', 'training');
    expect(offerSidePayment(config, state, 'd', 'training')).toBe(state);
    expect(offerSidePayment(config, { ...state, cycle: 2 }, 'd', 'training').side_payments).toHaveLength(3);
  });
});
