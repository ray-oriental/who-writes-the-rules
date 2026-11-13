import { useId, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { cx } from '../lib/delegations';
import { Icon } from './Icon';
import './Forms.css';

// ──────────────────────────────── Field ────────────────────────────────

export interface FieldProps {
  label: ReactNode;
  /** Use only when the label alone is not enough (units, a constraint). */
  hint?: ReactNode;
  error?: ReactNode;
  /** Render-prop receives the id to put on the control. */
  children: (id: string, describedBy?: string) => ReactNode;
  className?: string;
}

/** Label above control. Wrap Select / NumberInput / TextArea in it when they stand alone. */
export function Field({ label, hint, error, children, className }: FieldProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [hintId, errId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={cx('field', className)}>
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      {children(id, describedBy)}
      {hint && (
        <p className="field__hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="field__error" id={errId}>
          {error}
        </p>
      )}
    </div>
  );
}

// ──────────────────────────────── Select ────────────────────────────────

export interface SelectOption {
  value: string;
  label: string;
  disabled?: boolean;
}

export interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'onChange' | 'value'> {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  /** Shown as a first, empty option. */
  placeholder?: string;
}

export function Select({ value, options, onChange, placeholder, className, ...rest }: SelectProps) {
  return (
    <span className={cx('select', className)}>
      <select className="select__control" value={value} onChange={(e) => onChange(e.target.value)} {...rest}>
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Icon name="chevron-down" className="select__chevron" />
    </span>
  );
}

// ────────────────────────────── NumberInput ──────────────────────────────

export interface NumberInputProps {
  id?: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  disabled?: boolean;
  'aria-label'?: string;
  'aria-describedby'?: string;
}

/** Stepper with −/+ buttons; clamps to [min, max]. Used for clause parameters. */
export function NumberInput({ id, value, onChange, min, max, step = 1, unit, disabled, ...aria }: NumberInputProps) {
  const clamp = (n: number) => Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
  const round = (n: number) => Math.round(n / step) * step;
  const set = (n: number) => onChange(clamp(round(n)));
  return (
    <span className={cx('number', disabled && 'number--disabled')}>
      <button
        type="button"
        className="number__step"
        aria-label="Decrease"
        disabled={disabled || value <= min}
        onClick={() => set(value - step)}
      >
        <Icon name="minus" size={14} />
      </button>
      <input
        id={id}
        className="number__control t-num"
        type="number"
        inputMode="decimal"
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onChange={(e) => {
          const n = e.target.valueAsNumber;
          if (!Number.isNaN(n)) onChange(clamp(n));
        }}
        {...aria}
      />
      {unit && <span className="number__unit">{unit}</span>}
      <button
        type="button"
        className="number__step"
        aria-label="Increase"
        disabled={disabled || value >= max}
        onClick={() => set(value + step)}
      >
        <Icon name="plus" size={14} />
      </button>
    </span>
  );
}

// ─────────────────────────────── TextArea ───────────────────────────────

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('textarea', className)} {...rest} />;
}

// ────────────────────────────── RadioCards ──────────────────────────────

export interface RadioCardOption {
  value: string;
  title: ReactNode;
  description?: ReactNode;
  /** Small line under the description: "Exclusive · binding: medium". */
  meta?: ReactNode;
  /** Element before the title, e.g. a DelegationBadge. */
  leading?: ReactNode;
  disabled?: boolean;
  /** Why it is disabled; replaces `meta` when disabled. */
  disabledReason?: ReactNode;
}

export interface RadioCardsProps {
  /** Visible group label; pass `hideLegend` if a Section title already says it. */
  legend: string;
  hideLegend?: boolean;
  name?: string;
  value: string | null;
  options: RadioCardOption[];
  onChange: (value: string) => void;
  /** Grid columns at desktop width. Defaults to the number of options (max 4). */
  columns?: number;
  disabled?: boolean;
  /** Called on hover/focus, e.g. to highlight a seat on the round table. */
  onPreview?: (value: string | null) => void;
}

/** Pick one of 2–6 described options. Native radios underneath: arrow keys move, Space selects. */
export function RadioCards({
  legend,
  hideLegend,
  name,
  value,
  options,
  onChange,
  columns,
  disabled,
  onPreview,
}: RadioCardsProps) {
  const autoName = useId();
  const groupName = name ?? autoName;
  const cols = columns ?? Math.min(options.length, 4);
  return (
    <fieldset className="radio-cards" disabled={disabled}>
      <legend className={hideLegend ? 'u-visually-hidden' : 'radio-cards__legend'}>{legend}</legend>
      <div className="radio-cards__grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {options.map((o) => {
          const checked = value === o.value;
          return (
            <label
              key={o.value}
              className={cx('radio-card', checked && 'radio-card--checked', o.disabled && 'radio-card--disabled')}
              onMouseEnter={onPreview ? () => onPreview(o.value) : undefined}
              onMouseLeave={onPreview ? () => onPreview(null) : undefined}
            >
              <input
                className="radio-card__input"
                type="radio"
                name={groupName}
                value={o.value}
                checked={checked}
                disabled={o.disabled}
                onChange={() => onChange(o.value)}
                onFocus={onPreview ? () => onPreview(o.value) : undefined}
                onBlur={onPreview ? () => onPreview(null) : undefined}
              />
              <span className="radio-card__mark" aria-hidden="true" />
              <span className="radio-card__body">
                <span className="radio-card__title">
                  {o.leading}
                  <span>{o.title}</span>
                </span>
                {o.description && <span className="radio-card__desc">{o.description}</span>}
                {o.disabled && o.disabledReason ? (
                  <span className="radio-card__meta radio-card__meta--reason">
                    <Icon name="lock" size={12} />
                    {o.disabledReason}
                  </span>
                ) : (
                  o.meta && <span className="radio-card__meta">{o.meta}</span>
                )}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ───────────────────────────── CheckboxList ─────────────────────────────

export interface CheckboxItem {
  value: string;
  label: ReactNode;
  /** Right-aligned note, e.g. "trust −1 if left out". */
  note?: ReactNode;
  leading?: ReactNode;
  disabled?: boolean;
}

export interface CheckboxListProps {
  legend: string;
  hideLegend?: boolean;
  items: CheckboxItem[];
  value: string[];
  onChange: (value: string[]) => void;
  disabled?: boolean;
}

/** Ruled list of checkboxes, one per row. Used for invite lists and multi-valued params. */
export function CheckboxList({ legend, hideLegend, items, value, onChange, disabled }: CheckboxListProps) {
  const toggle = (v: string) => onChange(value.includes(v) ? value.filter((x) => x !== v) : [...value, v]);
  return (
    <fieldset className="checklist" disabled={disabled}>
      <legend className={hideLegend ? 'u-visually-hidden' : 'checklist__legend'}>{legend}</legend>
      <ul className="checklist__list">
        {items.map((it) => (
          <li key={it.value}>
            <label className={cx('checklist__row', it.disabled && 'checklist__row--disabled')}>
              <input
                type="checkbox"
                className="checklist__input"
                checked={value.includes(it.value)}
                disabled={it.disabled}
                onChange={() => toggle(it.value)}
              />
              <span className="checklist__box" aria-hidden="true">
                <Icon name="check" size={12} />
              </span>
              {it.leading}
              <span className="checklist__label">{it.label}</span>
              {it.note && <span className="checklist__note">{it.note}</span>}
            </label>
          </li>
        ))}
      </ul>
    </fieldset>
  );
}

// ────────────────────────────── ScoreInput ──────────────────────────────

export interface ScoreInputProps {
  /** The question being scored; becomes the group label. */
  label: ReactNode;
  value: number | null;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  /** Words under the two ends, e.g. ["Not at all", "Completely"]. */
  anchors?: [string, string];
  disabled?: boolean;
}

/** 1–5 rating as a row of segmented radio buttons. */
export function ScoreInput({ label, value, onChange, min = 1, max = 5, anchors, disabled }: ScoreInputProps) {
  const name = useId();
  const values = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  return (
    <fieldset className="score" disabled={disabled}>
      <legend className="score__legend">{label}</legend>
      <div className="score__row">
        {values.map((v) => (
          <label key={v} className={cx('score__opt', value === v && 'score__opt--checked')}>
            <input
              className="score__input"
              type="radio"
              name={name}
              value={v}
              checked={value === v}
              onChange={() => onChange(v)}
            />
            <span className="t-num">{v}</span>
          </label>
        ))}
      </div>
      {anchors && (
        <div className="score__anchors" aria-hidden="true">
          <span>{anchors[0]}</span>
          <span>{anchors[1]}</span>
        </div>
      )}
    </fieldset>
  );
}
