import type { GameConfig, GameState, Phase } from '../engine/types';
import type { GameLogSummary } from './api';

function csv(rows: (string | number | undefined)[][]): string {
  return rows.map(row => row.map(value => {
    const text = String(value ?? '');
    const safe = typeof value === 'string' && /^[\s]*[=+\-@\t\r]/.test(text) ? "'" + text : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  }).join(',')).join('\r\n') + '\r\n';
}

export function claimsCsv(config: GameConfig) {
  return csv([
    ['claim_id', 'claim', 'used_in', 'source', 'url', 'confidence', 'notes'],
    ...[config.general, ...config.delegations].flatMap(group => group.claims.map(claim =>
      [claim.id, claim.claim, claim.used_in.join(' | '), claim.source, claim.url, claim.confidence, claim.notes])),
  ]);
}

export function summarizeGame(game: GameState): GameLogSummary {
  return {
    id: game.id, started_at: game.started_at, seat: game.seat, outcome: game.outcome?.type,
    duration_s: Math.max(0, Math.round(((game.timeline.at(-1)?.at ?? game.started_at) - game.started_at) / 1000)),
    cycles: game.votes.filter(vote => vote.track === 1).length,
  };
}

function longestPhase(game: GameState): Phase | undefined {
  const time = new Map<Phase, number>();
  game.timeline.slice(0, -1).forEach(({ phase, at }, index) => {
    time.set(phase, (time.get(phase) ?? 0) + Math.max(0, game.timeline[index + 1].at - at));
  });
  return [...time].sort((a, b) => b[1] - a[1])[0]?.[0];
}

export function gamesCsv(games: GameState[]) {
  return csv([
    ['id', 'started_at', 'seat', 'forum', 'agenda_scope', 'format', 'invited', 'attendance', 'clauses', 'messages', 'softening',
      'votes', 'outcome', 'duration_s', 'longest_phase', 'cycles', 'prequiz', 'postquiz'],
    ...games.map(game => {
      const summary = summarizeGame(game);
      return [game.id, new Date(game.started_at).toISOString(), game.seat, game.choices?.forum, game.choices?.agenda_scope,
        game.choices?.format, game.choices?.invited.join(' | '), JSON.stringify(game.attendance), JSON.stringify(game.clauses),
        JSON.stringify(game.messages), JSON.stringify(game.soften_log), JSON.stringify(game.votes), summary.outcome,
        summary.duration_s, longestPhase(game), summary.cycles, JSON.stringify(game.quiz.pre), JSON.stringify(game.quiz.post)];
    }),
  ]);
}
