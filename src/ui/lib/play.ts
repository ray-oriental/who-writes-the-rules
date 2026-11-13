import type { GameState, Id, OutcomeType } from '../../engine/types';
import type { SeatStatus } from '../components/RoundTable';

export const outcomeLabels: Record<OutcomeType, string> = {
  full_agreement: 'Full agreement', club_standard: 'Club standard', paper_standard: 'Paper standard',
  split_standards: 'Split standards', expert_consensus: 'Expert consensus only', no_agreement: 'No agreement',
};

export function tableStatus(seats: Id[], state: GameState): Record<Id, SeatStatus> {
  return Object.fromEntries(seats.map(id => {
    const attendance = state.attendance.find(result => result.delegation === id);
    if (state.walkouts.some(result => result.delegation === id)) return [id, 'walked_out'];
    if (id === state.seat) return [id, 'player'];
    if (attendance?.status === 'attend') return [id, 'present'];
    return [id, attendance?.status === 'excluded' ? 'excluded' : 'absent'];
  }));
}

export function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
