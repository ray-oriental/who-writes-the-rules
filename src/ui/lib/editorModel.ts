/**
 * Pure helpers for the delegation editor: paths into the draft, ids, the "what is still missing"
 * checklist, the plain-language sentences for conditions, and the vote explanation.
 * Types only from the engine; no engine code.
 */
import type {
  ClauseCond,
  ClauseTemplate,
  Claim,
  ConveneCond,
  DelegationConfig,
  Forum,
  FormatOption,
  GameConfig,
  Id,
  MustHave,
  ParamSpec,
} from '../../engine/types';

// ───────────────────────────── Paths into the draft ─────────────────────────────

function tokens(path: string): (string | number)[] {
  return (path.match(/[^.[\]]+/g) ?? []).map((t) => (/^\d+$/.test(t) ? Number(t) : t));
}

export function getIn(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const t of tokens(path)) {
    if (cur === null || cur === undefined) return undefined;
    cur = (cur as Record<string | number, unknown>)[t];
  }
  return cur;
}

/** Mutates `obj`. Missing containers on the way are created. */
export function setIn(obj: unknown, path: string, value: unknown): void {
  const ts = tokens(path);
  let cur = obj as Record<string | number, unknown>;
  for (let i = 0; i < ts.length - 1; i++) {
    const next = cur[ts[i]];
    if (next === null || next === undefined || typeof next !== 'object') {
      cur[ts[i]] = typeof ts[i + 1] === 'number' ? [] : {};
    }
    cur = cur[ts[i]] as Record<string | number, unknown>;
  }
  const last = ts[ts.length - 1];
  if (value === undefined) delete cur[last];
  else cur[last] = value;
}

export function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function sameDraft(a: DelegationConfig, b: DelegationConfig): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

// ───────────────────────────────── Ids and text ─────────────────────────────────

export function slug(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '')
      .slice(0, 40) || 'item'
  );
}

export function uniqueId(base: string, taken: readonly string[]): string {
  const b = slug(base);
  if (!taken.includes(b)) return b;
  let n = 2;
  while (taken.includes(`${b}_${n}`)) n++;
  return `${b}_${n}`;
}

export function firstWords(text: string, count = 6): string {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '';
  const head = words.slice(0, count).join(' ');
  return words.length > count ? `${head}…` : head;
}

export function sentenceCase(text: string): string {
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

export function prettyKey(key: string): string {
  return key.replace(/_/g, ' ');
}

/** Next free `C-<SHORT>-NN` / `R-<SHORT>-NN` given the ids already used in the whole game. */
export function nextCode(kind: 'C' | 'R', short: string, taken: readonly string[]): string {
  const code = short.toUpperCase().replace(/[^A-Z0-9]/g, '') || 'NEW';
  const re = new RegExp(`^${kind}-${code}-(\\d+)$`);
  let max = 0;
  for (const id of taken) {
    const m = re.exec(id);
    if (m) max = Math.max(max, Number(m[1]));
  }
  let n = max + 1;
  let id = '';
  do {
    id = `${kind}-${code}-${String(n).padStart(2, '0')}`;
    n++;
  } while (taken.includes(id));
  return id;
}

export function allCodes(config: GameConfig, draft: DelegationConfig): string[] {
  const ids: string[] = [];
  for (const c of config.general.claims) ids.push(c.id);
  for (const r of config.general.research) ids.push(r.id);
  for (const d of config.delegations) {
    if (d.id === draft.id) continue;
    for (const c of d.claims) ids.push(c.id);
    for (const r of d.research) ids.push(r.id);
  }
  for (const c of draft.claims) ids.push(c.id);
  for (const r of draft.research) ids.push(r.id);
  return ids;
}

export const ID_PATTERN = /^[a-z][a-z0-9_]{1,30}$/;

// ───────────────────────────────── Sections ─────────────────────────────────

export type SectionId =
  | 'identity'
  | 'redlines'
  | 'musthaves'
  | 'attendance'
  | 'walkouts'
  | 'voting'
  | 'facts'
  | 'relations'
  | 'voices'
  | 'brief'
  | 'claims'
  | 'research';

export const SECTIONS: { id: SectionId; title: string; short: string; prefixes: string[] }[] = [
  { id: 'identity', title: 'Identity', short: 'Identity', prefixes: ['name', 'short', 'type', 'playable', 'difficulty', 'owner', 'summary', 'mandate'] },
  { id: 'redlines', title: 'What it will never accept', short: 'Red lines', prefixes: ['red_lines'] },
  { id: 'musthaves', title: 'What it needs in the text', short: 'Must-haves', prefixes: ['must_haves'] },
  { id: 'attendance', title: 'Will it come to the table?', short: 'Attendance', prefixes: ['attendance'] },
  { id: 'walkouts', title: 'When it walks out', short: 'Walkouts', prefixes: ['walkout_triggers'] },
  { id: 'voting', title: 'How it votes', short: 'Voting', prefixes: ['vote_threshold', 'trust_initial', 'side_payment_values'] },
  { id: 'facts', title: 'Facts it may use', short: 'Facts', prefixes: ['facts'] },
  { id: 'relations', title: 'How it sees the others', short: 'Relations', prefixes: ['relations'] },
  { id: 'voices', title: 'Voices', short: 'Voices', prefixes: ['voices', 'internal_resolution', 'lead_voice'] },
  { id: 'brief', title: 'Role brief for the AI', short: 'Role brief', prefixes: ['brief', 'style'] },
  { id: 'claims', title: 'Claims and sources', short: 'Claims', prefixes: ['claims'] },
  { id: 'research', title: 'Research still to do', short: 'Research', prefixes: ['research'] },
];

export function sectionOfPath(path: string): SectionId | null {
  const head = /^[^.[]+/.exec(path)?.[0] ?? '';
  return SECTIONS.find((s) => s.prefixes.includes(head))?.id ?? null;
}

// ─────────────────────────── Sources and completeness ───────────────────────────

export function hasSource(claim: Claim | undefined): boolean {
  return !!claim && claim.source.trim() !== '';
}

export interface UnsourcedRule {
  kind: string;
  label: string;
}

/** Rules, conditions and facts that lean on no claim, or only on claims without a source. */
export function unsourcedRules(d: DelegationConfig): UnsourcedRule[] {
  const byId = new Map(d.claims.map((c) => [c.id, c]));
  const out: UnsourcedRule[] = [];
  const check = (kind: string, label: string, ids?: Id[]) => {
    const list = ids ?? [];
    if (list.length === 0 || list.every((id) => !hasSource(byId.get(id)))) out.push({ kind, label });
  };
  d.red_lines.forEach((r) => check('Red line', r.label || r.id, r.source_ids));
  d.must_haves.forEach((m) => check('Must-have', m.label || m.id, m.source_ids));
  d.attendance.conditions.forEach((c) => check('Attendance condition', c.id, c.source_ids));
  d.walkout_triggers.forEach((w) => check('Walkout trigger', w.id, w.source_ids));
  d.facts.forEach((f, i) => check('Fact', `Fact ${i + 1}`, f.source_ids));
  return out;
}

export function researchToFind(d: DelegationConfig): number {
  return d.research.filter((r) => r.status === 'todo' || r.status === 'in_progress').length;
}

export function isPlaceholderBrief(brief: string): boolean {
  const t = brief.trim();
  return t.length < 60 || /placeholder|\btodo\b|\btbd\b|lorem/i.test(t);
}

export interface ChecklistItem {
  key: string;
  text: string;
  section: SectionId;
}

function listNamesPlain(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** What the delegation still needs, in the order a newcomer should do it. */
export function checklist(d: DelegationConfig, config: GameConfig): ChecklistItem[] {
  const out: ChecklistItem[] = [];
  const add = (key: string, text: string, section: SectionId) => out.push({ key, text, section });
  const plural = (n: number, one: string, many: string) => (n === 1 ? one : many);

  if (!d.name.trim()) add('name', 'No name yet.', 'identity');
  if (!/^[A-Za-z]{2,4}$/.test(d.short.trim())) add('short', 'The badge needs 2 to 4 letters.', 'identity');
  if (!(d.owner ?? '').trim())
    add('owner', 'No owner yet: put your handle so the team knows who looks after this file.', 'identity');
  if (!d.summary.trim()) add('summary', 'No one-line summary yet: it is what the seat card shows.', 'identity');
  if (!d.mandate.trim()) add('mandate', 'No mandate yet: it is what the role card shows.', 'identity');

  const noSource = unsourcedRules(d).length;
  if (noSource > 0)
    add('unsourced', `${noSource} ${plural(noSource, 'rule has', 'rules have')} no source.`, 'claims');
  const noSay = [...d.red_lines, ...d.must_haves, ...d.attendance.conditions, ...d.walkout_triggers].filter(
    (r) => !r.say.trim(),
  ).length;
  if (noSay > 0)
    add(
      'nosay',
      `${noSay} ${plural(noSay, 'rule has', 'rules have')} no "What it says" sentence, so the offline game cannot speak for it.`,
      d.red_lines.some((r) => !r.say.trim()) ? 'redlines' : d.must_haves.some((r) => !r.say.trim()) ? 'musthaves' : 'attendance',
    );
  const unsourcedClaims = d.claims.filter((c) => !hasSource(c)).length;
  if (unsourcedClaims > 0)
    add(
      'claims',
      `${unsourcedClaims} ${plural(unsourcedClaims, 'claim needs', 'claims need')} a source.`,
      'claims',
    );
  const toFind = researchToFind(d);
  if (toFind > 0)
    add(
      'research',
      `${toFind} research ${plural(toFind, 'question is', 'questions are')} still to find.`,
      'research',
    );
  if (isPlaceholderBrief(d.brief)) add('brief', 'The role brief is still the placeholder.', 'brief');
  if (!d.style.trim()) add('style', 'No speaking style yet.', 'brief');

  const others = config.delegations.filter((o) => o.id !== d.id);
  const missing = others.filter((o) => !(d.relations[o.id] ?? '').trim()).map((o) => o.name);
  if (missing.length > 0) add('relations', `No line yet on how it sees: ${listNamesPlain(missing)}.`, 'relations');

  if (d.red_lines.length < 1)
    add('redlines', 'Fewer than one red line: with none, this delegation can be talked into anything.', 'redlines');
  if (d.must_haves.length < 2) add('musthaves', 'Fewer than two must-haves.', 'musthaves');
  if (d.facts.length < 1) add('facts', 'No facts yet: add what the player and the AI may cite.', 'facts');
  return out;
}

// ─────────────────────────── Conditions as sentences ───────────────────────────

export type ParamKind = ParamSpec['type'];

export function valueLabel(spec: ParamSpec | undefined, value: string | number): string {
  if (spec && spec.type !== 'number' && spec.value_labels) return spec.value_labels[String(value)] ?? String(value);
  return String(value);
}

export function paramLabel(key: string, spec: ParamSpec | undefined): string {
  return spec?.label ?? prettyKey(key);
}

function q(text: string): string {
  return `"${text}"`;
}

/** The comparison kinds the builder offers, inferred from which keys a condition holds. */
export type Comparison = 'is' | 'in' | 'not_in' | 'gte' | 'lte' | 'between' | 'eq' | 'includes';

export type ClauseShape =
  | { kind: 'empty' }
  | { kind: 'present'; clause: Id }
  | { kind: 'absent'; clause: Id }
  | { kind: 'param'; clause: Id; param: string; comparison: Comparison }
  | { kind: 'custom' };

/** Reads a ClauseCond into something the builder can show; 'custom' = a combination it cannot edit. */
export function shapeOf(cond: ClauseCond): ClauseShape {
  const keys = Object.keys(cond).filter((k) => (cond as Record<string, unknown>)[k] !== undefined);
  if (keys.length === 0) return { kind: 'empty' };
  const only = (...allowed: string[]) => keys.every((k) => allowed.includes(k));
  if (cond.clause_present && only('clause_present')) return { kind: 'present', clause: cond.clause_present };
  if (cond.clause_absent && only('clause_absent')) return { kind: 'absent', clause: cond.clause_absent };
  if (cond.clause && only('clause')) return { kind: 'present', clause: cond.clause };
  if (cond.clause && cond.param) {
    const base = { kind: 'param' as const, clause: cond.clause, param: cond.param };
    if (only('clause', 'param', 'equals')) return { ...base, comparison: typeof cond.equals === 'number' ? 'eq' : 'is' };
    if (cond.in && only('clause', 'param', 'in')) return { ...base, comparison: 'in' };
    if (cond.not_in && only('clause', 'param', 'not_in')) return { ...base, comparison: 'not_in' };
    if (cond.gte !== undefined && cond.lte !== undefined && only('clause', 'param', 'gte', 'lte'))
      return { ...base, comparison: 'between' };
    if (cond.gte !== undefined && only('clause', 'param', 'gte')) return { ...base, comparison: 'gte' };
    if (cond.lte !== undefined && only('clause', 'param', 'lte')) return { ...base, comparison: 'lte' };
    if (cond.includes !== undefined && only('clause', 'param', 'includes')) return { ...base, comparison: 'includes' };
  }
  return { kind: 'custom' };
}

/** The condition without a lead-in, e.g. `"Jailbreak success rate" threshold is between 5 and 10 %`. */
export function describeClauseCond(cond: ClauseCond, catalog: ClauseTemplate[]): string {
  const shape = shapeOf(cond);
  if (shape.kind === 'empty') return '';
  if (shape.kind === 'custom') return 'this combination of tests (kept as written)';
  const tpl = catalog.find((c) => c.id === shape.clause);
  const name = tpl ? q(tpl.label) : `${q(shape.clause)} (not in the catalog)`;
  if (shape.kind === 'present') return `${name} is on the table`;
  if (shape.kind === 'absent') return `${name} is not on the table`;
  const spec = tpl?.params[shape.param];
  const many = tpl ? Object.keys(tpl.params).length > 1 : false;
  const subject = many || !tpl ? `${name} ${paramLabel(shape.param, spec).toLowerCase()}` : name;
  const unit = spec && spec.type === 'number' && spec.unit ? ` ${spec.unit}` : '';
  const val = (v: string | number) => (typeof v === 'number' ? String(v) : q(valueLabel(spec, v)));
  switch (shape.comparison) {
    case 'is':
    case 'eq':
      return `${subject} is ${val(cond.equals ?? '')}${unit}`;
    case 'in':
      return `${subject} is one of ${(cond.in ?? []).map(val).join(', ')}`;
    case 'not_in':
      return `${subject} is not one of ${(cond.not_in ?? []).map(val).join(', ')}`;
    case 'gte':
      return `${subject} is at least ${cond.gte}${unit}`;
    case 'lte':
      return `${subject} is at most ${cond.lte}${unit}`;
    case 'between':
      return `${subject} is between ${cond.gte} and ${cond.lte}${unit}`;
    case 'includes':
      return `${subject} includes ${q(valueLabel(spec, cond.includes ?? ''))}`;
  }
}

export function describeClauseSentence(cond: ClauseCond, catalog: ClauseTemplate[], lead: string): string {
  const d = describeClauseCond(cond, catalog);
  return d ? `${lead} ${d}.` : '';
}

export interface ConveneContext {
  catalog: ClauseTemplate[];
  forums: Forum[];
  formats: FormatOption[];
  delegations: { id: Id; name: string }[];
}

export function categoriesOf(catalog: ClauseTemplate[]): string[] {
  return [...new Set(catalog.map((c) => c.category))];
}

/** Agenda choice value -> words. A clause-template id names the clause, anything else is a category. */
export function describeAgenda(value: string, ctx: ConveneContext): string {
  const tpl = ctx.catalog.find((c) => c.id === value);
  if (tpl) return `the agenda includes the clause ${q(tpl.label)}`;
  return `the agenda includes ${prettyKey(value)}`;
}

/** Parts of a convening condition as a list of phrases ("the format is official"). */
export function conveneParts(cond: ConveneCond, ctx: ConveneContext): string[] {
  const parts: string[] = [];
  const nameOf = (id: Id) => ctx.delegations.find((d) => d.id === id)?.name ?? id;
  if (cond.agenda_includes) parts.push(describeAgenda(cond.agenda_includes, ctx));
  if (cond.forum) parts.push(`the forum is ${q(ctx.forums.find((f) => f.id === cond.forum)?.name ?? cond.forum)}`);
  if (cond.forum_exclusive !== undefined)
    parts.push(cond.forum_exclusive ? 'the forum is exclusive' : 'the forum is not exclusive');
  if (cond.not_invited !== undefined) parts.push(cond.not_invited ? 'it was not invited' : 'it was invited');
  if (cond.format)
    parts.push(`the format is ${(ctx.formats.find((f) => f.id === cond.format)?.label ?? cond.format).toLowerCase()}`);
  if (cond.annex_exists !== undefined)
    parts.push(cond.annex_exists ? 'an expert annex already exists' : 'no expert annex exists yet');
  if (cond.other_invited) parts.push(`${nameOf(cond.other_invited)} is invited`);
  if (cond.other_not_invited) parts.push(`${nameOf(cond.other_not_invited)} is not invited`);
  return parts;
}

export function joinParts(parts: string[]): string {
  if (parts.length <= 1) return parts.join('');
  return `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}`;
}

export function describeEffect(modifier: number | undefined, action: string | undefined): string {
  const bits: string[] = [];
  if (modifier !== undefined && modifier !== 0)
    bits.push(modifier < 0 ? `willingness drops by ${Math.abs(modifier)}` : `willingness rises by ${modifier}`);
  if (action === 'refuse') bits.push('it refuses to come');
  if (action === 'consider_parallel_forum') bits.push('it considers a rival forum');
  if (bits.length === 0) return 'nothing changes';
  return bits.join(' and ');
}

export function describeAttendance(
  cond: ConveneCond,
  modifier: number | undefined,
  action: string | undefined,
  ctx: ConveneContext,
): string {
  const parts = conveneParts(cond, ctx);
  const effect = describeEffect(modifier, action);
  return parts.length ? `If ${joinParts(parts)}, ${effect}.` : `Whatever the setup, ${effect}.`;
}

// ───────────────────────────────── Voting ─────────────────────────────────

export interface VoteExplanation {
  headline: string;
  lines: string[];
}

/**
 * What the threshold means, from the weights alone (no softening, trust or side payments).
 * The engine adds a met need's weight and subtracts an unmet one's.
 */
export function explainVote(musts: MustHave[], threshold: number): VoteExplanation {
  if (musts.length === 0)
    return {
      headline:
        threshold > 0
          ? `It has no must-haves yet. With a threshold of ${threshold} it votes no on any text, unless trust or a side payment lifts its score.`
          : 'It has no must-haves yet, so it votes yes on any text that crosses none of its red lines.',
      lines: ['Add must-haves in "What it needs in the text" to give its vote a shape.'],
    };
  const weights = musts.map((m) => m.weight);
  const total = weights.reduce((a, b) => a + b, 0);
  const headline = `With weights ${weights.join(', ')} and a threshold of ${threshold} it votes yes when its score reaches ${threshold}.`;
  const lines: string[] = [
    `A need that is met adds its weight; one that is not met takes it away. All met scores ${total}; none met scores ${-total}.`,
  ];
  if (musts.length > 12) return { headline, lines };
  const n = musts.length;
  const winners: number[] = [];
  for (let mask = 0; mask < 1 << n; mask++) {
    let met = 0;
    for (let i = 0; i < n; i++) if (mask & (1 << i)) met += weights[i];
    if (2 * met - total >= threshold) winners.push(mask);
  }
  if (winners.length === 0) {
    lines.push(`Even with every need met the score is ${total}, below the threshold: on its needs alone it can never vote yes.`);
  } else if (winners.includes(0)) {
    lines.push('It already votes yes with none of its needs met, so the threshold does not bind.');
  } else {
    const minimal = winners.filter((m) => !winners.some((o) => o !== m && (o & m) === o));
    minimal.sort((a, b) => popcount(a) - popcount(b) || a - b);
    const name = (i: number) => q(musts[i].label || musts[i].id);
    const describe = (mask: number) => {
      const names: string[] = [];
      for (let i = 0; i < n; i++) if (mask & (1 << i)) names.push(name(i));
      return joinParts(names);
    };
    const shown = minimal.slice(0, 4).map(describe);
    lines.push(
      `Smallest sets that carry the vote, before softening: ${shown.join('; or ')}${minimal.length > 4 ? '; and others' : ''}.`,
    );
    lines.push(
      'A softening argument gives back part of an unmet need\'s weight, so a nearly met set can still tip over. Trust and side payments add to the score as well.',
    );
  }
  return { headline, lines };
}

function popcount(x: number): number {
  let c = 0;
  while (x) {
    c += x & 1;
    x >>= 1;
  }
  return c;
}

// ─────────────────────────── Repository links ───────────────────────────

/** Link to edit or create the file on GitHub; undefined when no repository is configured. */
export function githubLink(
  repoUrl: string,
  branch: string,
  filePath: string,
  isNew: boolean,
): string | undefined {
  const base = repoUrl.trim().replace(/\/+$/, '');
  if (!/^https?:\/\//.test(base)) return undefined;
  const b = encodeURIComponent(branch || 'main');
  if (isNew) return `${base}/new/${b}?filename=${encodeURIComponent(filePath)}`;
  return `${base}/edit/${b}/${filePath}`;
}
