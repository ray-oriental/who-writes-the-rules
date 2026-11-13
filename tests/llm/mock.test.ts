import { describe, expect, it } from 'vitest';
import { createMockRoles } from '../../src/llm/mock';
import { createFixture, delegateInput, rapporteurInput, voteInput } from './fixture';

describe('deterministic offline roles', () => {
  it('returns identical results for all five roles on identical input', async () => {
    const config = createFixture();
    const roles = createMockRoles(config);
    const inputs = { delegate: delegateInput(), report: rapporteurInput(), vote: voteInput() };
    const before = JSON.stringify({ config, inputs });
    const run = () => Promise.all([
      roles.delegate(inputs.delegate), roles.tagger({ player_text: 'Shared results and training offer.' }),
      roles.rapporteur(inputs.report), roles.voteStatement(inputs.vote),
      roles.declineLetter({ delegation: 'a', status: 'decline', forum_name: 'Test forum', reasons: ['The scope is too wide.'] }),
    ]);
    expect(await run()).toEqual(await run());
    expect((await run()).every(result => result.fallback === false)).toBe(true);
    expect(JSON.stringify({ config, inputs })).toBe(before);
  });

  it('quotes the clause, gives the red-line reason and acknowledges being addressed', async () => {
    const input = delegateInput();
    input.clauses = [{ id: 'c1', text: 'Release weights.', position: 'red_line', reason: 'Weights must stay protected.' }];
    const result = await createMockRoles(createFixture()).delegate(input);
    expect(result.speech).toContain('"Release weights."');
    expect(result.speech).toContain('Weights must stay protected.');
    expect(result.speech).toMatch(/Thank you|To answer/);
    expect(result.speech).not.toContain('We need national execution.');
  });

  it('presses the heaviest missing requirement and proposes a single-parameter amendment', async () => {
    const result = await createMockRoles(createFixture()).delegate(delegateInput());
    expect(result.speech).toContain('We need national execution.');
    expect(result.speech).not.toContain('We need API-only access.');
    expect(result.amendment).toEqual({ template: 'verifier', params: { who: 'national' }, note: 'National execution' });
  });

  it('handles equality requirements and a numeric zero without omitting the value', async () => {
    const config = createFixture();
    config.delegations[0].must_haves[0].when.equals = 0;
    const input = delegateInput();
    input.missing = [input.missing[0]];
    expect((await createMockRoles(config).delegate(input)).amendment).toMatchObject({ template: 'access', params: { level: 0 } });
  });

  it.each(['odd round', 'no missing', 'not amendable'] as const)('omits amendment for %s', async kind => {
    const input = delegateInput();
    if (kind === 'odd round') input.round = 1;
    if (kind === 'no missing') input.missing = [];
    if (kind === 'not amendable') input.amendable_templates = [];
    expect((await createMockRoles(createFixture()).delegate(input)).amendment).toBeUndefined();
  });

  it('supports when nothing is missing and explains a soft objection with its reason', async () => {
    const roles = createMockRoles(createFixture());
    const input = { ...delegateInput(), missing: [], addressed: false };
    expect((await roles.delegate(input)).speech).toMatch(/support|workable|problem for us/);
    const opposed = await roles.delegate({ ...input, clauses: [{ id: 'c1', text: 'Shared verifier.', position: 'oppose', reason: 'We oppose this verifier.' }] });
    expect(opposed.speech).toContain('Shared verifier');
    expect(opposed.speech).toContain('We oppose this verifier.');
  });

  it('acknowledges softening once the player has moved a requirement', async () => {
    const result = await createMockRoles(createFixture()).delegate({ ...delegateInput(), softened: ['National execution'] });
    expect(result.speech).toContain('"National execution"');
  });

  it('varies sentence patterns by round and reflects delegation style', async () => {
    const config = createFixture();
    const roles = createMockRoles(config);
    const tabled = { ...delegateInput(), addressed: false, clauses: [{ id: 'c1', text: 'Incident reports.', position: 'neutral' as const }] };
    const results = await Promise.all([1, 2, 3, 4, 5].map(round => roles.delegate({ ...tabled, round })));
    expect(new Set(results.map(result => result.speech)).size).toBeGreaterThan(1);
    config.delegations[0].style = 'direct and plain';
    const direct = await Promise.all([1, 2, 3].map(round => createMockRoles(config).delegate({ ...tabled, round })));
    expect(direct.map(result => result.speech)).not.toEqual(results.slice(0, 3).map(result => result.speech));
  });

  it('matches examples case-insensitively and limits output to two tags', async () => {
    const result = await createMockRoles(createFixture()).tagger({ player_text: 'SHARED RESULTS, a TRAINING OFFER, and error bars.' });
    expect(result.tags).toEqual([{ tag: 'recognition', confidence: 0.9 }, { tag: 'capacity', confidence: 0.9 }]);
  });

  it('matches two distinct descriptive words at lower confidence', async () => {
    const roles = createMockRoles(createFixture());
    expect((await roles.tagger({ player_text: 'Mutual national verification.' })).tags)
      .toEqual([{ tag: 'recognition', confidence: 0.7 }]);
    expect((await roles.tagger({ player_text: 'National national national.' })).tags).toEqual([]);
    expect((await roles.tagger({ player_text: 'The results are for our proposal.' })).tags).toEqual([]);
  });

  it('prioritizes example matches over weaker description matches', async () => {
    const result = await createMockRoles(createFixture()).tagger({ player_text: 'Mutual national verification with a training offer.' });
    expect(result.tags[0]).toEqual({ tag: 'capacity', confidence: 0.9 });
  });

  it('summarises the table, records every position and objection, and lists contested clauses once', async () => {
    const input = rapporteurInput();
    input.objection = 'Please record our concern.';
    input.positions.push({ delegation: 'b', supports: [], opposes: ['c1'] });
    const result = await createMockRoles(createFixture()).rapporteur(input);
    expect(result.summary).toContain('1 clause on the table');
    expect(result.summary).toContain('1 of 1 clause remains contested');
    expect(result.summary).toContain(input.objection);
    expect(result.positions).toHaveLength(2);
    expect(result.open_issues).toEqual(['c1: opposed by Delegation A, b']);
  });

  it.each(['decline', 'excluded'] as const)('builds an attendance letter from %s reasons', async status => {
    const result = await createMockRoles(createFixture()).declineLetter({ delegation: 'a', status,
      forum_name: 'Test forum', reasons: ['The scope must be technical.'] });
    expect(result.letter).toContain('Test forum');
    expect(result.letter).toContain('The scope must be technical.');
    expect(result.letter).toContain(status === 'decline' ? 'cannot take part' : 'has not been invited');
  });

  it('keeps every reason in the letter and leads a no vote with the red line', async () => {
    const roles = createMockRoles(createFixture());
    const reasons = ['Protect weights.', 'Use national tests', 'Keep the scope technical.'];
    const letter = await roles.declineLetter({ delegation: 'a', status: 'decline', forum_name: 'Forum', reasons });
    for (const reason of reasons) expect(letter.letter).toContain(reason);
    expect(letter.letter).toContain('Use national tests.');
    const vote = await roles.voteStatement({ ...voteInput(), red_lines: ['We cannot release weights.'], in_swing_band: true });
    expect(vote.statement).toBe('We vote against. We cannot release weights.');
    expect(vote.adjust).toBe(0);
  });

  it('words yes votes, regrets and close calls', async () => {
    const roles = createMockRoles(createFixture());
    const yes = await roles.voteStatement({ ...voteInput(), vote: 'yes', missing: ['We need API-only access.'], satisfied: ['National execution', 'API access'] });
    expect(yes.statement).toContain('We vote in favour.');
    expect(yes.statement).toContain('national execution and API access');
    expect(yes.statement).toContain('We record one regret: We need API-only access.');
    const close = await roles.voteStatement({ ...voteInput(), in_swing_band: true });
    expect(close.statement).toBe('We vote against. We need national execution. It was a close decision.');
  });
});
