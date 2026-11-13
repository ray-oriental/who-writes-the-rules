import { createContext, useContext, type ReactNode } from 'react';
import type { ConfigIssue, DelegationConfig, GameConfig } from '../../../engine/types';
import { Field, NumberInput, Select, TextArea, type SelectOption } from '../Forms';
import { getIn } from '../../lib/editorModel';
import { cx } from '../../lib/delegations';
import './editor.css';

export interface EditorApi {
  config: GameConfig;
  draft: DelegationConfig;
  isNew: boolean;
  /** Replace the value at a path such as `red_lines[0].label`. */
  set(path: string, value: unknown): void;
  /** Change a copy of the latest draft. */
  update(fn: (d: DelegationConfig) => void): void;
  /** Validation messages whose path is `path` or lies under it. */
  issuesAt(path: string): string[];
  /** Validation messages for exactly this path (an item or a list as a whole). */
  issuesExact(path: string): string[];
  /** Add an empty claim to section 11 and return its id. */
  addClaim(usedIn?: string): string;
}

export const EditorContext = createContext<EditorApi | null>(null);

export function useEditor(): EditorApi {
  const ctx = useContext(EditorContext);
  if (!ctx) throw new Error('EditorContext is missing');
  return ctx;
}

export function issueMatches(issue: ConfigIssue, path: string): boolean {
  return issue.path === path || issue.path.startsWith(`${path}.`) || issue.path.startsWith(`${path}[`);
}

function ErrorText({ messages }: { messages: string[] }) {
  return messages.length ? <>{messages.join(' ')}</> : null;
}

// ─────────────────────────── Fields bound to a path ───────────────────────────

export function TextField({
  path,
  label,
  hint,
  placeholder,
  mono,
  maxLength,
  className,
  onValue,
}: {
  path: string;
  label: ReactNode;
  hint?: ReactNode;
  placeholder?: string;
  mono?: boolean;
  maxLength?: number;
  className?: string;
  /** Called with the new text before it is stored (used to derive ids). */
  onValue?: (value: string, previous: string) => void;
}) {
  const { draft, set, issuesAt } = useEditor();
  const value = (getIn(draft, path) as string | undefined) ?? '';
  const err = issuesAt(path);
  return (
    <Field label={label} hint={hint} error={<ErrorText messages={err} />} className={className}>
      {(id, describedBy) => (
        <input
          id={id}
          className={cx('ed-input', mono && 'ed-input--mono', err.length > 0 && 'ed-input--invalid')}
          type="text"
          value={value}
          maxLength={maxLength}
          placeholder={placeholder}
          aria-invalid={err.length > 0 || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            onValue?.(e.target.value, value);
            set(path, e.target.value);
          }}
        />
      )}
    </Field>
  );
}

export function AreaField({
  path,
  label,
  hint,
  rows = 3,
  placeholder,
  onValue,
}: {
  path: string;
  label: ReactNode;
  hint?: ReactNode;
  rows?: number;
  placeholder?: string;
  onValue?: (value: string, previous: string) => void;
}) {
  const { draft, set, issuesAt } = useEditor();
  const value = (getIn(draft, path) as string | undefined) ?? '';
  const err = issuesAt(path);
  return (
    <Field label={label} hint={hint} error={<ErrorText messages={err} />}>
      {(id, describedBy) => (
        <TextArea
          id={id}
          rows={rows}
          value={value}
          placeholder={placeholder}
          aria-invalid={err.length > 0 || undefined}
          aria-describedby={describedBy}
          onChange={(e) => {
            onValue?.(e.target.value, value);
            set(path, e.target.value);
          }}
        />
      )}
    </Field>
  );
}

export function NumField({
  path,
  label,
  hint,
  min,
  max,
  step = 1,
  unit,
  fallback = 0,
}: {
  path: string;
  label: ReactNode;
  hint?: ReactNode;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  /** Shown when the draft has no value at the path. */
  fallback?: number;
}) {
  const { draft, set, issuesAt } = useEditor();
  const raw = getIn(draft, path);
  const value = typeof raw === 'number' ? raw : fallback;
  const err = issuesAt(path);
  return (
    <Field label={label} hint={hint} error={<ErrorText messages={err} />}>
      {(id, describedBy) => (
        <NumberInput
          id={id}
          value={value}
          min={min}
          max={max}
          step={step}
          unit={unit}
          aria-describedby={describedBy}
          onChange={(n) => set(path, n)}
        />
      )}
    </Field>
  );
}

export function SelectField<T extends string>({
  path,
  label,
  hint,
  options,
  placeholder,
}: {
  path: string;
  label: ReactNode;
  hint?: ReactNode;
  options: (SelectOption & { value: T })[];
  placeholder?: string;
}) {
  const { draft, set, issuesAt } = useEditor();
  const value = (getIn(draft, path) as string | undefined) ?? '';
  const err = issuesAt(path);
  return (
    <Field label={label} hint={hint} error={<ErrorText messages={err} />}>
      {(id, describedBy) => (
        <Select
          id={id}
          value={value}
          options={options}
          placeholder={placeholder}
          aria-describedby={describedBy}
          onChange={(v) => set(path, v)}
        />
      )}
    </Field>
  );
}

export function IssueList({ messages }: { messages: string[] }) {
  if (messages.length === 0) return null;
  return (
    <ul className="ed-issues" role="alert">
      {messages.map((m, i) => (
        <li key={i}>{m}</li>
      ))}
    </ul>
  );
}

/** Intro sentence(s) at the top of a section. */
export function SectionIntro({ children }: { children: ReactNode }) {
  return <p className="ed-intro">{children}</p>;
}
