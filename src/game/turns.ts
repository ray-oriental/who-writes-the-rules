import * as engine from '../engine';
import type { GameConfig, GameState } from '../engine/types';
import type { LlmRoles } from '../llm/types';

function cycleMessages(state: GameState) {
  return state.messages.filter(message => message.track === state.track && message.cycle === state.cycle);
}

export async function writeDeclineLetters(config: GameConfig, roles: LlmRoles, state: GameState) {
  const forum = config.forums.find(item => item.id === state.choices?.forum);
  const letters = await Promise.all(state.attendance.flatMap(result => {
    const { delegation, status, reasons } = result;
    if (status === 'attend') return [];
    return [roles.declineLetter({
      delegation, status, forum_name: forum?.name ?? 'the summit',
      reasons: reasons.map(reason => reason.say),
    }).then(response => ({ delegation, letter: response.letter, fallback: response.fallback }))];
  }));
  return { state: engine.setDeclineLetters(state, letters), fallback: letters.some(letter => letter.fallback) };
}

export async function exchange(config: GameConfig, roles: LlmRoles, state: GameState, text: string, addressee?: string) {
  const tagged = await roles.tagger({ player_text: text });
  const turn = engine.playerSpeak(config, state, { text, addressee, tags: tagged.tags, now: Date.now() });
  const amendable_templates = engine.allowedTemplates(config, turn.state).map(template => template.id);
  const replies = await Promise.all(turn.responders.map(async delegation => {
    const profile = config.delegations.find(item => item.id === delegation)!;
    const voice = engine.pickVoice(config, turn.state, delegation);
    const response = await roles.delegate({
      delegation, voice, track: state.track, cycle: state.cycle, round: state.round,
      player_text: text, addressed: addressee === delegation,
      clauses: engine.clauseBriefs(config, turn.state, delegation),
      missing: profile.must_haves.filter(item => !engine.matchClauseCond(item.when, state.clauses)),
      softened: profile.must_haves.filter(item => turn.state.soften_log.some(event =>
        event.delegation === delegation && event.must_have === item.id)).map(item => item.label),
      recent: turn.state.messages.slice(-8), amendable_templates,
    });
    return { delegation, voice, text: response.speech, amendment: response.amendment, fallback: response.fallback };
  }));
  const replied = replies.reduce((next, reply) => engine.recordSpeech(config, next, reply), turn.state);
  return { state: engine.endRound(config, replied), fallback: tagged.fallback || replies.some(reply => reply.fallback) };
}

export async function writeReport(config: GameConfig, roles: LlmRoles, state: GameState) {
  const previous = state.reports.find(report => report.track === state.track && report.cycle === state.cycle);
  const report = await roles.rapporteur({
    track: state.track, cycle: state.cycle, transcript: cycleMessages(state),
    clauses: state.clauses.map(({ id, text, proposed_by }) => ({ id, text, proposed_by })),
    // The player sponsors the draft, so the record never shows their own delegation objecting to it.
    positions: engine.reportPositions(config, state).map(position => position.delegation === state.seat
      ? { ...position, supports: state.clauses.map(clause => clause.text), opposes: [] } : position),
    objection: previous?.objection, previous_summary: previous?.summary,
  });
  return { state: engine.setReport(state, report), fallback: report.fallback };
}

export async function holdVote(config: GameConfig, roles: LlmRoles, state: GameState) {
  const transcript = cycleMessages(state);
  const statements = await Promise.all(engine.computeVote(config, state).map(async detail => {
    const delegation = detail.delegation;
    if (delegation === state.seat) {
      return { delegation, statement: detail.statement || 'I vote in favour of the text on the table.', adjust: 0, fallback: false };
    }
    const profile = config.delegations.find(item => item.id === delegation)!;
    const response = await roles.voteStatement({
      delegation, vote: detail.vote, in_swing_band: detail.in_swing_band, transcript,
      red_lines: profile.red_lines.filter(item => detail.red_lines_hit.includes(item.id)).map(item => item.say),
      satisfied: profile.must_haves.filter(item => detail.satisfied.includes(item.id)).map(item => item.label),
      missing: profile.must_haves.filter(item => detail.missing.includes(item.id)).map(item => item.say),
    });
    return { delegation, ...response };
  }));
  return { state: engine.finalizeVote(config, state, statements, Date.now()), fallback: statements.some(statement => statement.fallback) };
}
