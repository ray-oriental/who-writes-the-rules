import { useMemo, useState } from 'react';
import type { Clause, ClauseTemplate, Id, Params } from '../../engine/types';
import { useGame } from '../../game/context';
import { cx } from '../lib/delegations';
import { humaniseHeading, renderClauseText, valueLabel } from '../lib/clauseText';
import { Button } from './Button';
import { CheckboxList, Field, NumberInput, Select } from './Forms';
import { Icon } from './Icon';
import { Drawer } from './Overlay';

function defaults(template: ClauseTemplate): Params {
  return Object.fromEntries(Object.entries(template.params).map(([key, spec]) =>
    [key, spec.default ?? (spec.type === 'multi' ? [] : spec.type === 'enum' ? spec.values[0] : spec.min)]));
}

/**
 * Wide drawer for tabling or revising a clause: templates grouped by category on the left,
 * parameters and a live preview of the sentence as it will be tabled on the right.
 */
export function ClauseBuilder({ templates, clauses, initialTemplate, onClose }: {
  /** Every template the player may table (including ones already on the table). */
  templates: ClauseTemplate[];
  clauses: Clause[];
  initialTemplate?: Id;
  onClose(): void;
}) {
  const { actions } = useGame();
  const onTable = (id: Id) => clauses.find(clause => clause.template === id);
  const [templateId, setTemplateId] = useState(() =>
    initialTemplate ?? templates.find(item => !onTable(item.id))?.id ?? templates[0]?.id ?? '');
  const template = templates.find(item => item.id === templateId);
  const clause = template ? onTable(template.id) : undefined;
  const [params, setParams] = useState<Params>(() => {
    const first = templates.find(item => item.id === templateId);
    const existing = first ? onTable(first.id) : undefined;
    return existing?.params ?? (first ? defaults(first) : {});
  });
  const groups = useMemo(() => {
    const byCategory = new Map<string, ClauseTemplate[]>();
    templates.forEach(item => byCategory.set(item.category, [...(byCategory.get(item.category) ?? []), item]));
    return Array.from(byCategory.entries());
  }, [templates]);
  const choose = (item: ClauseTemplate) => {
    setTemplateId(item.id);
    setParams(onTable(item.id)?.params ?? defaults(item));
  };
  const setParam = (name: string, value: Params[string]) => setParams(current => ({ ...current, [name]: value }));

  return <Drawer open onClose={onClose} width={600} title={clause ? 'Revise a clause' : 'Propose a clause'} footer={
    <>
      <Button onClick={onClose}>Cancel</Button>
      <Button variant="primary" type="submit" form="clause-builder" disabled={!template}>
        {clause ? 'Update clause' : 'Table clause'}</Button>
    </>
  }>
    <div className="builder">
      <nav className="builder__list" aria-label="Clause template">
        {groups.map(([category, items]) => <div key={category} className="builder__group">
          <h3 className="t-eyebrow">{humaniseHeading(category)}</h3>
          <ul>{items.map(item => {
            const existing = onTable(item.id);
            return <li key={item.id}>
              <button type="button" className={cx('builder__option', item.id === templateId && 'builder__option--on')}
                data-template={item.id} aria-pressed={item.id === templateId} onClick={() => choose(item)}>
                <span className="builder__label">{item.label}
                  {existing && <span className="builder__mark"><Icon name="check" size={12} />On the table</span>}</span>
                <span className="builder__desc">{item.description}</span>
              </button>
            </li>;
          })}</ul>
        </div>)}
      </nav>
      <form id="clause-builder" className="builder__form" onSubmit={event => {
        event.preventDefault();
        if (!template) return;
        if (clause) actions.editClause(clause.id, params);
        else actions.proposeClause(template.id, params);
        onClose();
      }}>
        {template && <>
          <div className="builder__head">
            <h3 className="t-heading">{template.label}</h3>
            <p className="t-meta">{template.description}</p>
          </div>
          <div className="l-stack l-stack--sm">
            {Object.entries(template.params).map(([name, spec]) => {
              const label = spec.label ?? name.replaceAll('_', ' ');
              if (spec.type === 'multi') {
                return <CheckboxList key={name} legend={label} value={(params[name] as string[] | undefined) ?? []}
                  items={spec.values.map(value => ({ value, label: valueLabel(spec, value) }))}
                  onChange={value => setParam(name, value)} />;
              }
              return <Field key={name} label={label}>{id => spec.type === 'number'
                ? <NumberInput id={id} min={spec.min} max={spec.max} step={spec.step} unit={spec.unit}
                  value={params[name] as number} onChange={value => setParam(name, value)} />
                : <Select id={id} value={params[name] as string}
                  options={spec.values.map(value => ({ value, label: valueLabel(spec, value) }))}
                  onChange={value => setParam(name, value)} />}</Field>;
            })}
          </div>
          <div className="builder__preview" aria-live="polite">
            <p className="t-eyebrow">{clause ? 'Will read as' : 'Will be tabled as'}</p>
            <p className="builder__sentence">{renderClauseText(template, params)}</p>
          </div>
        </>}
      </form>
    </div>
  </Drawer>;
}
