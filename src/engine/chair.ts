import type { GameConfig, GameState } from './types';
import { appendMessage, roundsInCycle } from './shared';

export function chairLine(config: GameConfig, state: GameState, kind: 'opening' | 'round' | 'report' | 'vote'): GameState {
  const rounds = roundsInCycle(config, state);
  const lines = {
    opening: `The session is open. Round ${state.round} of ${rounds}.`,
    round: state.round > rounds ? 'Negotiations are complete. The rapporteur will prepare the report.'
      : `Round ${state.round} of ${rounds}.${state.round === rounds ? ' This is the last round.' : ''}`,
    report: 'The rapporteur will report the clauses currently on the table.',
    vote: 'Delegations will now vote on the tabled text.',
  };
  return appendMessage(state, { speaker: 'chair', kind: 'chair', text: lines[kind] });
}
