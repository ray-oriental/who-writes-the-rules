import { useRef, useState } from 'react';
import type { DelegationConfig } from '../../engine/types';
import { useConfig, useConfigEdit } from '../../game/context';
import { Button } from '../components/Button';
import { DelegationBadge } from '../components/DelegationBadge';
import { Field, Select } from '../components/Forms';
import { Banner, Chip, ScreenHead, Section } from '../components/Misc';
import { Dialog } from '../components/Overlay';
import { ID_PATTERN, researchToFind, slug, unsourcedRules } from '../lib/editorModel';
import { downloadText } from '../lib/files';
import { href, navigate } from '../router';
import { EditorBody } from './DelegationEditor';
import './Delegations.css';

const TYPE_LABEL: Record<DelegationConfig['type'], string> = {
  state: 'State',
  regional: 'Regional bloc',
  firm: 'Firm',
  expert_body: 'Expert body',
};

export function DelegationsScreen() {
  const { config } = useConfig();
  const edit = useConfigEdit();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ tone: 'info' | 'error'; text: string } | null>(null);
  const [confirm, setConfirm] = useState(false);

  const onImport = async (file: File | undefined) => {
    if (!file) return;
    const text = await file.text();
    const r = edit.importPack(text);
    if (r.error) setMessage({ tone: 'error', text: r.error });
    else setMessage({ tone: 'info', text: `Applied ${r.applied} ${r.applied === 1 ? 'edit' : 'edits'} from the pack.` });
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="l-page dl-page">
      <ScreenHead
        eyebrow="Team"
        title="Delegations"
        lead="Everyone who sits at the table. Open one to see what it still needs, change what it wants, and try the result in the game."
        aside={
          <Button variant="primary" iconBefore="plus" onClick={() => navigate(href('delegations', 'new'))}>
            Add a delegation
          </Button>
        }
      />

      <div className="dl-layout">
        <div className="l-stack">
          <ul className="dl-list" aria-label="Delegations">
            {config.delegations.map((d) => {
              const st = edit.status[d.id] ?? 'bundled';
              const noSource = unsourcedRules(d).length;
              const toFind = researchToFind(d);
              return (
                <li key={d.id}>
                  <a className="dl-row" href={href('delegations', d.id)}>
                    <span className="dl-row__who">
                      <DelegationBadge id={d.id} size="lg" />
                      <span className="dl-row__name">
                        <strong>{d.name}</strong>
                        <span className="t-meta">
                          {TYPE_LABEL[d.type]} · {d.playable ? 'Playable' : 'AI only'} · Owner: {d.owner?.trim() || 'Unassigned'}
                        </span>
                      </span>
                    </span>
                    <span className="dl-row__chips">
                      {st === 'edited' && <Chip tone="info">Edited in this browser</Chip>}
                      {st === 'new' && <Chip tone="info">Added in this browser</Chip>}
                    </span>
                    <span className="dl-row__num">
                      <span className={noSource ? 'dl-num dl-num--open' : 'dl-num'}>
                        <b className="t-num">{noSource}</b> {noSource === 1 ? 'rule' : 'rules'} without a source
                      </span>
                      <span className={toFind ? 'dl-num dl-num--open' : 'dl-num'}>
                        <b className="t-num">{toFind}</b> research {toFind === 1 ? 'need' : 'needs'} to find
                      </span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>

        <aside className="dl-aside l-stack">
          <Section title="How edits reach the team" level={3}>
            <ol className="dl-steps">
              <li>
                <strong>Edit and save.</strong> The change is kept in this browser and the game uses it at once.
              </li>
              <li>
                <strong>Copy or download the YAML</strong>, or export a pack of all your edits.
              </li>
              <li>
                <strong>Put the file in <code>config/delegations/</code> on GitHub</strong> (the editor gives you the link), or send the pack to the maintainer.
              </li>
            </ol>
          </Section>

          {edit.dirty && (
            <Section title="Your edits in this browser" level={3}>
              <div className="l-stack l-stack--sm">
                <div className="l-cluster">
                  <Button variant="secondary" onClick={() => downloadText('wwtr-config-pack.json', edit.exportPack(), 'application/json;charset=utf-8')}>
                    Export my edits
                  </Button>
                  <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                    Import a pack
                  </Button>
                  <Button variant="quiet" onClick={() => setConfirm(true)}>
                    Discard all my edits
                  </Button>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="u-visually-hidden"
                  tabIndex={-1}
                  aria-label="Pack file to import"
                  onChange={(e) => void onImport(e.target.files?.[0])}
                />
                {message && (
                  <Banner tone={message.tone} onDismiss={() => setMessage(null)}>
                    {message.text}
                  </Banner>
                )}
              </div>
            </Section>
          )}
          {!edit.dirty && (
            <Section title="Got a pack from a teammate?" level={3}>
              <div className="l-stack l-stack--sm">
                <Button variant="secondary" onClick={() => fileRef.current?.click()}>
                  Import a pack
                </Button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="application/json,.json"
                  className="u-visually-hidden"
                  tabIndex={-1}
                  aria-label="Pack file to import"
                  onChange={(e) => void onImport(e.target.files?.[0])}
                />
                {message && (
                  <Banner tone={message.tone} onDismiss={() => setMessage(null)}>
                    {message.text}
                  </Banner>
                )}
              </div>
            </Section>
          )}
        </aside>
      </div>

      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Discard all your edits?"
        size="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(false)}>
              Keep them
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(false);
                edit.revertAll();
              }}
            >
              Discard all my edits
            </Button>
          </>
        }
      >
        <p>
          Every delegation goes back to the file that ships with the game, and delegations you added here disappear. Export a pack first if you
          want to keep a copy. A game in progress is restarted.
        </p>
      </Dialog>
    </div>
  );
}

const TYPE_OPTIONS = (Object.keys(TYPE_LABEL) as DelegationConfig['type'][]).map((v) => ({ value: v, label: TYPE_LABEL[v] }));

export function NewDelegationScreen() {
  const { config } = useConfig();
  const edit = useConfigEdit();
  const [name, setName] = useState('');
  const [short, setShort] = useState('');
  const [type, setType] = useState<DelegationConfig['type']>('state');
  const [draft, setDraft] = useState<DelegationConfig | null>(null);

  if (draft) return <EditorBody initial={draft} isNew />;

  const id = slug(name).replace(/^[^a-z]+/, '');
  const taken = config.delegations.some((d) => d.id === id);
  const badLetters = short !== '' && !/^[A-Za-z]{2,4}$/.test(short);
  const idProblem = !name.trim()
    ? null
    : !ID_PATTERN.test(id)
      ? 'The name needs at least two letters or digits, starting with a letter.'
      : taken
        ? `There is already a delegation with the id “${id}”. Pick a different name.`
        : null;
  const ready = name.trim() !== '' && /^[A-Za-z]{2,4}$/.test(short) && !idProblem;

  return (
    <div className="l-page l-page--narrow dl-page">
      <ScreenHead
        eyebrow={<a href={href('delegations')}>Delegations</a>}
        title="Add a delegation"
        lead="Three answers to start. The next page lists everything else a new delegation needs, and you can leave most of it empty at first."
      />
      <form
        className="l-stack"
        onSubmit={(e) => {
          e.preventDefault();
          if (!ready) return;
          const b = edit.blank(id, name.trim(), short.toUpperCase());
          setDraft({ ...b, type });
        }}
      >
        <Field label="Name" hint="As the player will see it, e.g. African Union.">
          {(fid, d) => (
            <input id={fid} className="ed-input" value={name} onChange={(e) => setName(e.target.value)} aria-describedby={d} autoFocus />
          )}
        </Field>
        <Field label="Badge letters (2 to 4)" error={badLetters ? 'Use two to four letters.' : undefined}>
          {(fid, d) => (
            <input
              id={fid}
              className="ed-input ed-input--mono"
              value={short}
              maxLength={4}
              onChange={(e) => setShort(e.target.value.toUpperCase())}
              aria-describedby={d}
            />
          )}
        </Field>
        <Field label="Type">{(fid) => <Select id={fid} value={type} options={TYPE_OPTIONS} onChange={(v) => setType(v as DelegationConfig['type'])} />}</Field>
        <p className="t-meta">
          File id: <code>{id || '…'}</code>
          {idProblem && <span className="dl-problem"> {idProblem}</span>}
        </p>
        <div className="l-actions l-actions--end">
          <Button variant="quiet" onClick={() => navigate(href('delegations'))}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" icon="arrow-right" disabled={!ready}>
            Start the draft
          </Button>
        </div>
      </form>
    </div>
  );
}
