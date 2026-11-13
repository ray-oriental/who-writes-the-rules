import type { ClauseTemplate, ParamSpec, Params, ParamValue } from '../../engine/types';

/** "third_party" -> "third party" */
export function humanise(value: string): string {
  return value.replaceAll('_', ' ');
}

/** "test_method" -> "Test method" */
export function humaniseHeading(value: string): string {
  const text = humanise(value);
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Display label for one enum / multi value. */
export function valueLabel(spec: ParamSpec, value: string): string {
  return ('value_labels' in spec ? spec.value_labels?.[value] : undefined) ?? humanise(value);
}

/** "a, b and c" */
function joinWords(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function renderValue(spec: ParamSpec | undefined, value: ParamValue | undefined): string {
  if (value === undefined) return '…';
  if (typeof value === 'number') return String(value);
  if (Array.isArray(value)) {
    if (!value.length) return 'none';
    return joinWords(value.map(item => (spec ? valueLabel(spec, item) : humanise(item))));
  }
  return spec ? valueLabel(spec, value) : humanise(value);
}

/**
 * The sentence a clause will read as once tabled: fills the `{param}` placeholders of the template text.
 * Numbers print as they are, enum values as their label, multi values joined with commas and "and".
 */
export function renderClauseText(template: ClauseTemplate, params: Params): string {
  return template.text.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in template.params ? renderValue(template.params[name], params[name]) : match);
}
