import { useEffect, useState, type ReactNode } from 'react';
import { Button, IconButton } from '../Button';
import { CheckboxList } from '../Forms';
import { Field } from '../Forms';
import { TextArea } from '../Forms';
import { getIn, firstWords } from '../../lib/editorModel';
import { cx } from '../../lib/delegations';
import { IssueList, useEditor } from './EditorContext';

interface ListEditorProps<T> {
  /** Path of the array in the draft, e.g. `red_lines`. */
  path: string;
  title: (item: T, index: number) => string;
  /** Short label for the item kind, used in buttons: "red line". */
  noun: string;
  makeItem: () => T;
  render: (item: T, index: number, base: string) => ReactNode;
  /** Shown beside the title, e.g. a "Needs a source" chip. */
  badge?: (item: T) => ReactNode;
  empty?: ReactNode;
}

/** Items you can add, remove (with undo) and move up or down. Every row edits the draft by path. */
export function ListEditor<T>({ path, title, noun, makeItem, render, badge, empty }: ListEditorProps<T>) {
  const { draft, update, issuesExact } = useEditor();
  const items = (getIn(draft, path) as T[] | undefined) ?? [];
  const [removed, setRemoved] = useState<{ item: T; index: number; title: string } | null>(null);

  const mutate = (fn: (list: T[]) => void) =>
    update((d) => {
      const holder = d as unknown as Record<string, unknown>;
      // Arrays live at one or two levels (`attendance.conditions`).
      const keys = path.split('.');
      let cur: Record<string, unknown> = holder;
      for (const k of keys.slice(0, -1)) cur = cur[k] as Record<string, unknown>;
      const last = keys[keys.length - 1];
      const list = ((cur[last] as T[] | undefined) ?? []).slice();
      fn(list);
      cur[last] = list;
    });

  return (
    <div className="ed-list">
      <IssueList messages={issuesExact(path)} />
      {items.length === 0 && (
        <p className="ed-list__empty">{empty ?? `No ${noun}s yet.`}</p>
      )}
      <ol className="ed-list__items">
        {items.map((item, i) => {
          const base = `${path}[${i}]`;
          const t = title(item, i);
          return (
            <li key={i} className="ed-item">
              <div className="ed-item__head">
                <span className="ed-item__index t-num">{i + 1}</span>
                <span className="ed-item__title">{t || <span className="ed-muted">Untitled {noun}</span>}</span>
                {badge?.(item)}
                <span className="ed-item__tools">
                  <IconButton
                    icon="chevron-down"
                    label={`Move ${noun} ${i + 1} up`}
                    className="ed-flip"
                    disabled={i === 0}
                    onClick={() => mutate((l) => void l.splice(i - 1, 0, ...l.splice(i, 1)))}
                  />
                  <IconButton
                    icon="chevron-down"
                    label={`Move ${noun} ${i + 1} down`}
                    disabled={i === items.length - 1}
                    onClick={() => mutate((l) => void l.splice(i + 1, 0, ...l.splice(i, 1)))}
                  />
                  <IconButton
                    icon="close"
                    label={`Remove ${noun} ${i + 1}`}
                    onClick={() => {
                      setRemoved({ item, index: i, title: t });
                      mutate((l) => void l.splice(i, 1));
                    }}
                  />
                </span>
              </div>
              <IssueList messages={issuesExact(base)} />
              <div className="ed-item__body l-stack">{render(item, i, base)}</div>
            </li>
          );
        })}
      </ol>
      {removed && (
        <p className="ed-undo" role="status">
          Removed {noun}{removed.title ? ` “${removed.title}”` : ''}.{' '}
          <Button
            size="sm"
            variant="quiet"
            onClick={() => {
              const r = removed;
              mutate((l) => void l.splice(Math.min(r.index, l.length), 0, r.item));
              setRemoved(null);
            }}
          >
            Undo
          </Button>
        </p>
      )}
      <div>
        <Button
          variant="secondary"
          iconBefore="plus"
          onClick={() => {
            setRemoved(null);
            mutate((l) => void l.push(makeItem()));
          }}
        >
          Add a {noun}
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────── Sources on a rule ─────────────────────────────

/** Pick which of this delegation's claims back a rule, or add a new claim and tick it. */
export function SourcePicker({ path }: { path: string }) {
  const { draft, set, addClaim, issuesAt } = useEditor();
  const value = (getIn(draft, path) as string[] | undefined) ?? [];
  const known = new Set(draft.claims.map((c) => c.id));
  const items = [
    ...draft.claims.map((c) => ({
      value: c.id,
      label: (
        <span>
          <span className="ed-mono">{c.id}</span> {firstWords(c.claim, 8) || <span className="ed-muted">empty claim</span>}
        </span>
      ),
      note: c.source.trim() ? undefined : 'needs a source',
    })),
    ...value
      .filter((id) => !known.has(id))
      .map((id) => ({ value: id, label: <span className="ed-mono">{id}</span>, note: 'not in this file' })),
  ];
  const err = issuesAt(path);
  const ownerPath = path.replace(/\.source_ids$/, '');
  const ownerId = getIn(draft, `${ownerPath}.id`) as string | undefined;
  const listKey = ownerPath.replace(/\[\d+\]$/, '').replace(/\./g, '/');
  const usedIn = ownerId ? `${listKey}/${ownerId}` : listKey;
  return (
    <div className="ed-sources">
      {items.length > 0 ? (
        <CheckboxList legend="Sources: claims that back this up" items={items} value={value} onChange={(v) => set(path, v)} />
      ) : (
        <p className="ed-muted">No claims in this file yet. Add one to cite a source for this rule.</p>
      )}
      {err.length > 0 && <p className="ed-note ed-note--error">{err.join(' ')}</p>}
      <div>
        <Button
          size="sm"
          variant="quiet"
          iconBefore="plus"
          onClick={() => {
            const id = addClaim(usedIn);
            set(path, [...value, id]);
          }}
        >
          Add a claim and select it
        </Button>
      </div>
    </div>
  );
}

// ───────────────────────────── One value per line ─────────────────────────────

const toLines = (text: string) =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

/** A list of short strings edited as one per line. The raw text stays local while typing. */
export function LinesField({
  path,
  label,
  hint,
  rows = 3,
  placeholder,
}: {
  path: string;
  label: ReactNode;
  hint?: ReactNode;
  rows?: number;
  placeholder?: string;
}) {
  const { draft, set, issuesAt } = useEditor();
  const value = (getIn(draft, path) as string[] | undefined) ?? [];
  const [text, setText] = useState(value.join('\n'));
  const joined = value.join('\n');
  // Follow outside changes (move up/down, undo) but not our own typing.
  useEffect(() => {
    if (toLines(text).join('\n') !== joined) setText(joined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined]);
  const err = issuesAt(path);
  return (
    <Field label={label} hint={hint} error={err.length ? err.join(' ') : undefined}>
      {(id, describedBy) => (
        <TextArea
          id={id}
          rows={rows}
          value={text}
          placeholder={placeholder}
          aria-describedby={describedBy}
          className={cx(err.length > 0 && 'ed-input--invalid')}
          onChange={(e) => {
            setText(e.target.value);
            set(path, toLines(e.target.value));
          }}
          onBlur={() => setText(joined)}
        />
      )}
    </Field>
  );
}
