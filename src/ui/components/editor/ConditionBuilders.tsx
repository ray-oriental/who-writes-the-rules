import { useMemo, type ReactNode } from 'react';
import type { ClauseCond, ClauseTemplate, ConveneCond, ParamSpec } from '../../../engine/types';
import { useConfig } from '../../../game/context';
import { Field, NumberInput, Select, CheckboxList } from '../Forms';
import { Button } from '../Button';
import { Icon } from '../Icon';
import {
  categoriesOf,
  conveneParts,
  describeClauseCond,
  describeEffect,
  joinParts,
  paramLabel,
  prettyKey,
  sentenceCase,
  shapeOf,
  valueLabel,
  type Comparison,
  type ConveneContext,
} from '../../lib/editorModel';
import { getIn } from '../../lib/editorModel';
import { useEditor } from './EditorContext';

// ─────────────────────── A select with option groups ───────────────────────

function GroupedSelect({
  id,
  value,
  groups,
  placeholder,
  onChange,
}: {
  id?: string;
  value: string;
  groups: { label: string; options: { value: string; label: string }[] }[];
  placeholder: string;
  onChange: (v: string) => void;
}) {
  return (
    <span className="select">
      <select id={id} className="select__control" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{placeholder}</option>
        {groups.map((g) => (
          <optgroup key={g.label} label={g.label}>
            {g.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <Icon name="chevron-down" className="select__chevron" />
    </span>
  );
}

function categoryGroups(catalog: ClauseTemplate[]) {
  return categoriesOf(catalog).map((cat) => ({
    label: sentenceCase(prettyKey(cat)),
    options: catalog.filter((c) => c.category === cat).map((c) => ({ value: c.id, label: c.label })),
  }));
}

function SentenceLine({ children, empty }: { children: ReactNode; empty?: string }) {
  return (
    <p className="ed-sentence" aria-live="polite">
      <span className="ed-sentence__tag">In words</span>
      {children || <span className="ed-sentence__empty">{empty}</span>}
    </p>
  );
}

// ─────────────────────────── Clause condition builder ───────────────────────────

const COMPARISONS: Record<ParamSpec['type'], { value: Comparison; label: string }[]> = {
  enum: [
    { value: 'is', label: 'is' },
    { value: 'in', label: 'is one of' },
    { value: 'not_in', label: 'is not one of' },
  ],
  number: [
    { value: 'gte', label: 'is at least' },
    { value: 'lte', label: 'is at most' },
    { value: 'between', label: 'is between' },
  ],
  multi: [{ value: 'includes', label: 'includes' }],
};

function clamp(spec: Extract<ParamSpec, { type: 'number' }>, n: number): number {
  return Math.min(spec.max, Math.max(spec.min, n));
}

/** Starting condition when a parameter is picked, with a comparison that fits its type. */
function startFor(clause: string, param: string, spec: ParamSpec): ClauseCond {
  if (spec.type === 'enum') return { clause, param, equals: spec.default ?? spec.values[0] ?? '' };
  if (spec.type === 'number') return { clause, param, gte: spec.default };
  return { clause, param, includes: spec.default?.[0] ?? spec.values[0] ?? '' };
}

function withComparison(cond: ClauseCond, spec: ParamSpec, cmp: Comparison): ClauseCond {
  const { clause, param } = cond;
  if (!clause || !param) return cond;
  if (spec.type === 'number') {
    const base = cond.gte ?? cond.lte ?? spec.default;
    if (cmp === 'gte') return { clause, param, gte: base };
    if (cmp === 'lte') return { clause, param, lte: base };
    return { clause, param, gte: base, lte: clamp(spec, base + (spec.step ?? 1)) };
  }
  if (spec.type === 'enum') {
    const current = typeof cond.equals === 'string' ? cond.equals : spec.default ?? spec.values[0] ?? '';
    const list = cond.in ?? cond.not_in ?? [current];
    if (cmp === 'is') return { clause, param, equals: list[0] !== undefined ? String(list[0]) : current };
    if (cmp === 'in') return { clause, param, in: list.length ? list : [current] };
    return { clause, param, not_in: list.length ? list : [current] };
  }
  return { clause, param, includes: cond.includes ?? spec.values[0] ?? '' };
}

/**
 * Picks a clause, a parameter, a comparison and a value, and shows the result as a sentence.
 * `lead` is the sentence opener ("Crossed when", "Met when").
 */
const CLAUSE_KEYS = ['clause', 'param', 'equals', 'in', 'not_in', 'gte', 'lte', 'includes', 'clause_present', 'clause_absent'];

export function ClauseCondBuilder({
  path,
  lead,
  label = 'The condition',
  mixed,
}: {
  path: string;
  lead: string;
  label?: string;
  /** The object at `path` also holds convening keys (walkouts): keep them when this part changes. */
  mixed?: boolean;
}) {
  const { config } = useConfig();
  const { draft, set: setPath, issuesAt } = useEditor();
  const whole = (getIn(draft, path) as Record<string, unknown> | undefined) ?? {};
  const cond = (mixed ? Object.fromEntries(Object.entries(whole).filter(([k]) => CLAUSE_KEYS.includes(k))) : whole) as ClauseCond;
  const set = (p: string, next: ClauseCond) =>
    setPath(p, mixed ? { ...Object.fromEntries(Object.entries(whole).filter(([k]) => !CLAUSE_KEYS.includes(k))), ...next } : next);
  const catalog = config.catalog;
  const shape = shapeOf(cond);
  const errors = issuesAt(path);
  const groups = useMemo(() => categoryGroups(catalog), [catalog]);

  const clauseId =
    shape.kind === 'present' || shape.kind === 'absent' || shape.kind === 'param' ? shape.clause : '';
  const tpl = catalog.find((c) => c.id === clauseId);
  const target = shape.kind === 'param' ? `param:${shape.param}` : shape.kind === 'absent' ? 'absent' : 'present';
  const spec = shape.kind === 'param' ? tpl?.params[shape.param] : undefined;

  const pickClause = (id: string) => set(path, id ? { clause_present: id } : {});
  const pickTarget = (v: string) => {
    if (!tpl) return;
    if (v === 'present') set(path, { clause_present: tpl.id });
    else if (v === 'absent') set(path, { clause_absent: tpl.id });
    else {
      const key = v.slice('param:'.length);
      const s = tpl.params[key];
      if (s) set(path, startFor(tpl.id, key, s));
    }
  };

  const targetOptions = tpl
    ? [
        { value: 'present', label: 'is on the table (any setting)' },
        { value: 'absent', label: 'is not on the table' },
        ...Object.entries(tpl.params).map(([key, s]) => ({
          value: `param:${key}`,
          label: `has its “${paramLabel(key, s)}” set…`,
        })),
      ]
    : [];

  const sentence = describeClauseCond(cond, catalog);

  return (
    <div className="ed-builder" role="group" aria-label={label}>
      <div className="ed-builder__row">
        <Field label="Clause">
          {(id) => (
            <GroupedSelect
              id={id}
              value={clauseId}
              groups={groups}
              placeholder="Choose a clause…"
              onChange={pickClause}
            />
          )}
        </Field>
        {tpl && (
          <Field label="What about it">
            {(id) => <Select id={id} value={target} options={targetOptions} onChange={pickTarget} />}
          </Field>
        )}
        {shape.kind === 'param' && spec && (
          <Field label="Compare">
            {(id) => (
              <Select
                id={id}
                value={shape.comparison}
                options={COMPARISONS[spec.type]}
                onChange={(v) => set(path, withComparison(cond, spec, v as Comparison))}
              />
            )}
          </Field>
        )}
      </div>

      {shape.kind === 'param' && spec && (
        <ValueControls
          cond={cond}
          spec={spec}
          comparison={shape.comparison}
          onChange={(c) => set(path, c)}
        />
      )}

      {shape.kind === 'param' && tpl && !spec && (
        <p className="ed-note ed-note--warn">
          “{shape.param}” is not a parameter of this clause. Pick one from the list above.
        </p>
      )}
      {shape.kind === 'custom' && (
        <p className="ed-note ed-note--warn">
          This condition combines tests in a way the builder cannot edit. It is kept as written.{' '}
          <Button size="sm" variant="quiet" onClick={() => set(path, {})}>
            Start again
          </Button>
        </p>
      )}
      {errors.length > 0 && (
        <p className="ed-note ed-note--error" role="alert">
          {errors.join(' ')}
        </p>
      )}
      <SentenceLine empty="Choose a clause to build the condition.">
        {sentence ? `${lead} ${sentence}.` : ''}
      </SentenceLine>
    </div>
  );
}

function ValueControls({
  cond,
  spec,
  comparison,
  onChange,
}: {
  cond: ClauseCond;
  spec: ParamSpec;
  comparison: Comparison;
  onChange: (c: ClauseCond) => void;
}) {
  const { clause, param } = cond;
  if (!clause || !param) return null;
  if (spec.type === 'number') {
    const unit = spec.unit;
    const step = spec.step ?? 1;
    const gte = cond.gte ?? spec.default;
    const lte = cond.lte ?? spec.default;
    if (comparison === 'between')
      return (
        <div className="ed-builder__row">
          <Field label="From">
            {(id) => (
              <NumberInput id={id} value={gte} min={spec.min} max={spec.max} step={step} unit={unit}
                onChange={(n) => onChange({ clause, param, gte: n, lte: Math.max(n, lte) })} />
            )}
          </Field>
          <Field label="To">
            {(id) => (
              <NumberInput id={id} value={lte} min={spec.min} max={spec.max} step={step} unit={unit}
                onChange={(n) => onChange({ clause, param, gte: Math.min(gte, n), lte: n })} />
            )}
          </Field>
        </div>
      );
    const key = comparison === 'lte' ? 'lte' : 'gte';
    const value = key === 'gte' ? gte : lte;
    return (
      <div className="ed-builder__row">
        <Field label={`Value (${spec.min} to ${spec.max}${unit ? ` ${unit}` : ''})`}>
          {(id) => (
            <NumberInput id={id} value={value} min={spec.min} max={spec.max} step={step} unit={unit}
              onChange={(n) => onChange({ clause, param, [key]: n })} />
          )}
        </Field>
      </div>
    );
  }
  const options = spec.values.map((v) => ({ value: v, label: valueLabel(spec, v) }));
  if (spec.type === 'enum' && (comparison === 'in' || comparison === 'not_in')) {
    const list = (comparison === 'in' ? cond.in : cond.not_in) ?? [];
    return (
      <CheckboxList
        legend="Values"
        items={options}
        value={list.map(String)}
        onChange={(v) => onChange(comparison === 'in' ? { clause, param, in: v } : { clause, param, not_in: v })}
      />
    );
  }
  const current = comparison === 'includes' ? cond.includes ?? '' : String(cond.equals ?? '');
  return (
    <div className="ed-builder__row">
      <Field label="Value">
        {(id) => (
          <Select id={id} value={current} options={options}
            onChange={(v) => onChange(comparison === 'includes' ? { clause, param, includes: v } : { clause, param, equals: v })} />
        )}
      </Field>
    </div>
  );
}

// ─────────────────────────── Convening condition builder ───────────────────────────

type Tri = '' | 'yes' | 'no';
const triOf = (v: boolean | undefined): Tri => (v === undefined ? '' : v ? 'yes' : 'no');
const fromTri = (v: string): boolean | undefined => (v === '' ? undefined : v === 'yes');

export function useConveneContext(excludeId?: string): ConveneContext {
  const { config } = useConfig();
  return useMemo(
    () => ({
      catalog: config.catalog,
      forums: config.forums,
      formats: config.convene.formats,
      delegations: config.delegations.filter((d) => d.id !== excludeId).map((d) => ({ id: d.id, name: d.name })),
    }),
    [config, excludeId],
  );
}

/** Optional parts of a convening rule: agenda, forum, format, who is invited. Empty parts are ignored. */
export function ConveneCondBuilder({
  value,
  onChange,
  excludeId,
}: {
  value: ConveneCond;
  onChange: (c: ConveneCond) => void;
  excludeId: string;
}) {
  const { config } = useConfig();
  const ctx = useConveneContext(excludeId);
  const cats = categoriesOf(config.catalog);
  const agendaGroups = [
    { label: 'A kind of clause', options: cats.map((c) => ({ value: c, label: sentenceCase(prettyKey(c)) })) },
    ...categoryGroups(config.catalog).map((g) => ({ ...g, label: `A specific clause: ${g.label.toLowerCase()}` })),
  ];
  const patch = (p: Partial<ConveneCond>) => {
    const next: Record<string, unknown> = { ...value, ...p };
    for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '') delete next[k];
    onChange(next as ConveneCond);
  };
  const triOptions = (yes: string, no: string) => [
    { value: '', label: 'Not part of the rule' },
    { value: 'yes', label: yes },
    { value: 'no', label: no },
  ];
  const others = ctx.delegations.map((d) => ({ value: d.id, label: d.name }));
  return (
    <div className="ed-builder__grid">
      <Field label="The agenda includes">
        {(id) => (
          <GroupedSelect id={id} value={value.agenda_includes ?? ''} groups={agendaGroups} placeholder="Not part of the rule"
            onChange={(v) => patch({ agenda_includes: v || undefined })} />
        )}
      </Field>
      <Field label="The forum is">
        {(id) => (
          <Select id={id} value={value.forum ?? ''} placeholder="Not part of the rule"
            options={config.forums.map((f) => ({ value: f.id, label: f.name }))}
            onChange={(v) => patch({ forum: v || undefined })} />
        )}
      </Field>
      <Field label="The forum is exclusive">
        {(id) => (
          <Select id={id} value={triOf(value.forum_exclusive)} options={triOptions('Yes, exclusive', 'No, open to all')}
            onChange={(v) => patch({ forum_exclusive: fromTri(v) })} />
        )}
      </Field>
      <Field label="It was not invited">
        {(id) => (
          <Select id={id} value={triOf(value.not_invited)} options={triOptions('Yes, left off the list', 'No, it was invited')}
            onChange={(v) => patch({ not_invited: fromTri(v) })} />
        )}
      </Field>
      <Field label="The format is">
        {(id) => (
          <Select id={id} value={value.format ?? ''} placeholder="Not part of the rule"
            options={config.convene.formats.map((f) => ({ value: f.id, label: f.label }))}
            onChange={(v) => patch({ format: (v || undefined) as ConveneCond['format'] })} />
        )}
      </Field>
      <Field label="An expert annex already exists">
        {(id) => (
          <Select id={id} value={triOf(value.annex_exists)} options={triOptions('Yes, one exists', 'No, none yet')}
            onChange={(v) => patch({ annex_exists: fromTri(v) })} />
        )}
      </Field>
      <Field label="Another delegation is invited">
        {(id) => (
          <Select id={id} value={value.other_invited ?? ''} placeholder="Not part of the rule" options={others}
            onChange={(v) => patch({ other_invited: v || undefined })} />
        )}
      </Field>
      <Field label="Another delegation is not invited">
        {(id) => (
          <Select id={id} value={value.other_not_invited ?? ''} placeholder="Not part of the rule" options={others}
            onChange={(v) => patch({ other_not_invited: v || undefined })} />
        )}
      </Field>
    </div>
  );
}

export type EffectKind = 'modifier' | 'refuse' | 'consider_parallel_forum';

/** What an attendance rule does: add or subtract willingness, refuse, or consider a rival forum. */
export function EffectControls({
  modifier,
  action,
  onChange,
}: {
  modifier: number | undefined;
  action: 'refuse' | 'consider_parallel_forum' | undefined;
  onChange: (modifier: number | undefined, action: 'refuse' | 'consider_parallel_forum' | undefined) => void;
}) {
  const kind: EffectKind = action ?? 'modifier';
  return (
    <div className="ed-builder__row">
      <Field label="Then">
        {(id) => (
          <Select
            id={id}
            value={kind}
            options={[
              { value: 'modifier', label: 'its willingness changes' },
              { value: 'refuse', label: 'it refuses to come' },
              { value: 'consider_parallel_forum', label: 'it considers a rival forum' },
            ]}
            onChange={(v) =>
              v === 'modifier' ? onChange(modifier ?? -1, undefined) : onChange(undefined, v as 'refuse' | 'consider_parallel_forum')
            }
          />
        )}
      </Field>
      {kind === 'modifier' && (
        <Field label="By how much (negative = less willing)">
          {(id) => <NumberInput id={id} value={modifier ?? 0} min={-10} max={10} step={1} onChange={(n) => onChange(n, undefined)} />}
        </Field>
      )}
    </div>
  );
}

/** Whole attendance or walkout rule as a sentence. */
export function RuleSentence({ children }: { children: string }) {
  return <SentenceLine empty="Fill in at least one part above.">{children}</SentenceLine>;
}

export { conveneParts, describeEffect, joinParts };
