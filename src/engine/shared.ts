import type { Clause, ClauseTemplate, GameConfig, GameState, Message, Params, Phase } from './types';

export function transition(state: GameState, phase: Phase, now: number): GameState {
  return { ...state, phase, timeline: [...state.timeline, { phase, track: state.track, at: now }] };
}

export function appendMessage(state: GameState, message: Omit<Message, 'id' | 'track' | 'cycle' | 'round'>): GameState {
  return { ...state, messages: [...state.messages, {
    ...message, id: `m${state.messages.length + 1}`, track: state.track, cycle: state.cycle, round: state.round,
  }] };
}

export function present(config: GameConfig, state: GameState): string[] {
  return config.scenario.seats.filter(id => (id === state.seat || state.attendance.some(a => a.delegation === id && a.status === 'attend'))
    && !state.walkouts.some(w => w.delegation === id));
}

export const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value));
export const roundsInCycle = (config: GameConfig, state: GameState): number => state.track === 2 ? config.rules.track2.rounds : config.rules.rounds_per_cycle;

export function validateParams(template: ClauseTemplate, input: Params): Params | undefined {
  if (Object.keys(input).some(key => !Object.hasOwn(template.params, key))) return undefined;
  const params: Params = {};
  for (const [key, spec] of Object.entries(template.params)) {
    const value = input[key] ?? spec.default ?? (spec.type === 'enum' ? spec.values[0] : []);
    if (spec.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
      params[key] = clamp(value, spec.min, spec.max);
    } else if (spec.type === 'enum') {
      if (typeof value !== 'string' || !spec.values.includes(value)) return undefined;
      params[key] = value;
    } else {
      if (!Array.isArray(value) || value.some(v => !spec.values.includes(v))) return undefined;
      params[key] = [...new Set(value)];
    }
  }
  return params;
}

export function renderClause(template: ClauseTemplate, params: Params): string {
  return template.text.replace(/\{([^{}]+)\}/g, (_, key: string) => {
    const value = params[key];
    const spec = template.params[key];
    const label = (item: string) => spec && spec.type !== 'number' ? spec.value_labels?.[item] ?? item.replaceAll('_', ' ') : item;
    return Array.isArray(value) ? value.map(label).join(', ') : label(String(value ?? ''));
  });
}

export function makeClause(template: ClauseTemplate, params: Params, state: GameState, proposedBy = state.seat, previous?: Clause): Clause {
  const text = renderClause(template, params);
  const version = (previous?.version ?? 0) + 1;
  return { id: template.id, template: template.id, params, text, version, proposed_by: proposedBy,
    history: [...(previous?.history ?? []), { version, params: structuredClone(params), text, cycle: state.cycle, round: state.round }] };
}

export function allowedTemplates(config: GameConfig, state: GameState): ClauseTemplate[] {
  const scope = config.convene.agenda_scopes.find(a => a.id === state.choices?.agenda_scope);
  return config.catalog.filter(t => scope?.categories.includes(t.category)
    && (state.track === 1 || config.rules.track2.scope.includes(t.category)));
}
