import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConfigIssue, DelegationConfig } from '../../engine/types';
import { useConfig, useConfigEdit, useGame } from '../../game/context';
import { Button } from '../components/Button';
import { DelegationBadge } from '../components/DelegationBadge';
import { Dialog } from '../components/Overlay';
import { Chip, EmptyState, ScreenHead, Section } from '../components/Misc';
import { EditorContext, type EditorApi, issueMatches } from '../components/editor/EditorContext';
import {
  AttendanceSection,
  BriefSection,
  ClaimsSection,
  FactsSection,
  IdentitySection,
  MustHavesSection,
  RedLinesSection,
  RelationsSection,
  ResearchSection,
  VoicesSection,
  VotingSection,
  WalkoutsSection,
} from '../components/editor/Sections';
import { cx } from '../lib/delegations';
import {
  SECTIONS,
  allCodes,
  checklist,
  clone,
  getIn,
  githubLink,
  nextCode,
  sameDraft,
  setIn,
  type SectionId,
} from '../lib/editorModel';
import { copyText, downloadText } from '../lib/files';
import { href } from '../router';
import './Delegations.css';

const SECTION_BODY: Record<SectionId, () => JSX.Element> = {
  identity: IdentitySection,
  redlines: RedLinesSection,
  musthaves: MustHavesSection,
  attendance: AttendanceSection,
  walkouts: WalkoutsSection,
  voting: VotingSection,
  facts: FactsSection,
  relations: RelationsSection,
  voices: VoicesSection,
  brief: BriefSection,
  claims: ClaimsSection,
  research: ResearchSection,
};

/** True if the path points at something the form shows: a known field, and list items that exist. */
function isPlaced(path: string, draft: DelegationConfig): boolean {
  const head = /^[^.[]+/.exec(path)?.[0];
  if (!head || head === 'id' || !SECTIONS.some((s) => s.prefixes.includes(head))) return false;
  const re = /([A-Za-z_.]+)\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path))) {
    const list = getIn(draft, path.slice(0, m.index + m[1].length));
    if (!Array.isArray(list) || Number(m[2]) >= list.length) return false;
  }
  return true;
}

function scrollToSection(id: SectionId) {
  const el = document.getElementById(`ed-sec-${id}`);
  if (!el) return;
  const calm = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  el.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'start' });
}

export function EditorBody({ initial, isNew }: { initial: DelegationConfig; isNew: boolean }) {
  const { config } = useConfig();
  const edit = useConfigEdit();
  const game = useGame();
  const [draft, setDraft] = useState<DelegationConfig>(initial);
  const [baseline, setBaseline] = useState<DelegationConfig>(initial);
  const savingRef = useRef(false);
  const [saved, setSaved] = useState(false);
  const [issues, setIssues] = useState<{ errors: ConfigIssue[]; warnings: ConfigIssue[] }>({ errors: [], warnings: [] });
  const [copied, setCopied] = useState<'yes' | 'no' | null>(null);
  const [confirm, setConfirm] = useState<'save' | 'discard' | null>(null);
  const [active, setActive] = useState<SectionId>('identity');
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const dirty = !sameDraft(draft, baseline);
  const unsaved = dirty || (isNew && !saved);

  const update = useCallback((fn: (d: DelegationConfig) => void) => {
    setSaved(false);
    setDraft((d) => {
      const next = clone(d);
      fn(next);
      return next;
    });
  }, []);
  const set = useCallback((path: string, value: unknown) => update((d) => setIn(d, path, value)), [update]);

  const api: EditorApi = useMemo(
    () => ({
      config,
      draft,
      isNew,
      set,
      update,
      issuesAt: (path) => issues.errors.filter((i) => issueMatches(i, path)).map((i) => i.message),
      issuesExact: (path) => issues.errors.filter((i) => i.path === path).map((i) => i.message),
      addClaim: (usedIn) => {
        const cur = draftRef.current;
        const id = nextCode('C', cur.short, allCodes(config, cur));
        update((d) => {
          d.claims.push({
            id,
            claim: '',
            used_in: usedIn ? [usedIn] : [],
            source: '',
            confidence: 'medium',
          });
        });
        return id;
      },
    }),
    [config, draft, isNew, set, update, issues],
  );

  const todo = useMemo(() => checklist(draft, config), [draft, config]);
  const todoBySection = useMemo(() => {
    const m = new Map<SectionId, number>();
    for (const t of todo) m.set(t.section, (m.get(t.section) ?? 0) + 1);
    return m;
  }, [todo]);
  const errorBySection = useMemo(() => {
    const m = new Map<SectionId, number>();
    for (const e of issues.errors) {
      if (!isPlaced(e.path, draft)) continue;
      const head = /^[^.[]+/.exec(e.path)![0];
      const s = SECTIONS.find((x) => x.prefixes.includes(head));
      if (s) m.set(s.id, (m.get(s.id) ?? 0) + 1);
    }
    return m;
  }, [issues, draft]);
  const unplaced = issues.errors.filter((e) => !isPlaced(e.path, draft));

  // Leaving with unsaved changes: browser unload, and clicks on in-app links.
  useEffect(() => {
    if (!unsaved) return;
    const onUnload = (e: BeforeUnloadEvent) => {
      // A successful save reloads the page itself; that reload must not ask "leave site?".
      if (savingRef.current) return;
      e.preventDefault();
      e.returnValue = '';
    };
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement | null)?.closest?.('a[href^="#/"]');
      if (!a) return;
      const target = a.getAttribute('href');
      if (target === window.location.hash) return;
      if (!window.confirm('You have unsaved changes to this delegation. Leave without saving?')) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    window.addEventListener('beforeunload', onUnload);
    document.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('beforeunload', onUnload);
      document.removeEventListener('click', onClick, true);
    };
  }, [unsaved]);

  // Which section is at the top of the viewport, for the left list.
  useEffect(() => {
    let frame = 0;
    const onScroll = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        let current: SectionId = SECTIONS[0].id;
        for (const s of SECTIONS) {
          const el = document.getElementById(`ed-sec-${s.id}`);
          if (el && el.getBoundingClientRect().top < 140) current = s.id;
        }
        setActive(current);
      });
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);

  const doSave = () => {
    setConfirm(null);
    const v = edit.validate(draft);
    if (v.errors.length > 0) {
      setIssues(v);
      setSaved(false);
      return;
    }
    // Saving reloads the app with the new config. Point the address at this delegation's own
    // editor first, so a newly added delegation reopens there instead of on the empty Add form.
    const previousHash = window.location.hash;
    const ownHash = href('delegations', draft.id);
    savingRef.current = true;
    if (isNew) window.history.replaceState(null, '', ownHash);
    const r = edit.save(draft);
    if (!r.ok) {
      savingRef.current = false;
      if (isNew) window.history.replaceState(null, '', previousHash);
      setIssues({ errors: r.errors, warnings: v.warnings });
      setSaved(false);
      return;
    }
    setIssues({ errors: [], warnings: v.warnings });
    setBaseline(clone(draft));
    setSaved(true);
    savingRef.current = false;
    // Under fixtures nothing reloads, so tell the router about the address set above.
    if (isNew) window.dispatchEvent(new HashChangeEvent('hashchange'));
  };
  const onSaveClick = () => {
    if (game.view.state.phase !== 'seat') setConfirm('save');
    else doSave();
  };

  const yaml = () => edit.toYaml(draft);
  const filePath = edit.filePath(draft.id);
  const ghLink = githubLink(config.scenario.repo_url, config.scenario.repo_branch, filePath, isNew || edit.status[draft.id] === 'new');
  const canDiscard = !isNew && (edit.status[draft.id] ?? 'bundled') !== 'bundled';
  const hasRepo = !!config.scenario.repo_url.trim();

  const statusText = issues.errors.length
    ? `${issues.errors.length} ${issues.errors.length === 1 ? 'problem' : 'problems'} to fix before saving`
    : unsaved
      ? 'Unsaved changes'
      : saved
        ? 'Saved in this browser. The game now uses it.'
        : 'No changes yet';

  return (
    <EditorContext.Provider value={api}>
      <div className="l-page l-page--wide ed-page">
        <ScreenHead
          eyebrow={
            <>
              <a href={href('delegations')}>Delegations</a> · {isNew ? 'New delegation' : 'Editing'}
            </>
          }
          title={draft.name.trim() || 'New delegation'}
          lead="Fill in what this delegation wants, with a source for every rule. Nothing changes until you save."
          aside={
            <div className="l-cluster">
              {!isNew && draft.id && <DelegationBadge id={draft.id} size="lg" />}
              {isNew && <Chip tone="info">Added in this browser once saved</Chip>}
              {!isNew && edit.status[draft.id] === 'edited' && <Chip tone="info">Edited in this browser</Chip>}
              {!isNew && edit.status[draft.id] === 'new' && <Chip tone="info">Added in this browser</Chip>}
            </div>
          }
        />

        <div className="ed-layout">
          <nav className="ed-nav" aria-label="Sections of this delegation">
            <ul>
              {SECTIONS.map((s, i) => {
                const open = todoBySection.get(s.id) ?? 0;
                const bad = errorBySection.get(s.id) ?? 0;
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      className={cx('ed-nav__item', active === s.id && 'ed-nav__item--active')}
                      aria-current={active === s.id ? 'location' : undefined}
                      onClick={() => scrollToSection(s.id)}
                    >
                      <span className="ed-nav__num t-num">{i + 1}</span>
                      <span className="ed-nav__label">{s.short}</span>
                      {bad > 0 ? (
                        <span className="ed-nav__flag ed-nav__flag--error" title={`${bad} to fix`}>
                          {bad}
                          <span className="u-visually-hidden"> to fix</span>
                        </span>
                      ) : open > 0 ? (
                        <span className="ed-nav__flag" title={`${open} still open`}>
                          {open}
                          <span className="u-visually-hidden"> still open</span>
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="ed-main l-stack l-stack--lg">
            <section className="ed-todo" aria-labelledby="ed-todo-title">
              <h2 className="ed-todo__title" id="ed-todo-title">
                What this delegation still needs
              </h2>
              {todo.length === 0 ? (
                <p className="ed-todo__done">
                  Nothing is missing. Ask a teammate to play against it.{' '}
                  <a href={href()}>Try it in the game</a>
                </p>
              ) : (
                <ul className="ed-todo__list">
                  {todo.map((t) => (
                    <li key={t.key}>
                      <button type="button" className="ed-todo__item" onClick={() => scrollToSection(t.section)}>
                        <span>{t.text}</span>
                        <span className="ed-todo__go">
                          {SECTIONS.find((s) => s.id === t.section)?.short}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <p className="ed-todo__how">
                Every rule has a “What it says” sentence. The offline game speaks from these sentences and the debrief quotes them, so write each as the delegation itself would say it.
              </p>
            </section>

            {SECTIONS.map((s, i) => {
              const Body = SECTION_BODY[s.id];
              return (
                <Section key={s.id} id={`ed-sec-${s.id}`} number={i + 1} title={s.title} className="ed-section">
                  <Body />
                </Section>
              );
            })}
          </div>
        </div>
      </div>

      <div className="ed-bar" role="region" aria-label="Save">
        {(unplaced.length > 0 || issues.warnings.length > 0 || (issues.errors.length > 0 && unplaced.length === 0)) && (
          <div className="ed-bar__issues">
            {unplaced.length > 0 && (
              <ul role="alert" className="ed-bar__list ed-bar__list--error">
                {unplaced.map((e, i) => (
                  <li key={i}>
                    {e.path ? <code>{e.path}</code> : null} {e.message}
                  </li>
                ))}
              </ul>
            )}
            {issues.errors.length > unplaced.length && (
              <p className="ed-bar__hint ed-bar__hint--error">Problems are marked next to the fields below.</p>
            )}
            {issues.warnings.length > 0 && (
              <ul className="ed-bar__list">
                {issues.warnings.map((w, i) => (
                  <li key={i}>
                    Warning: {w.path ? <code>{w.path}</code> : null} {w.message}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="ed-bar__row">
          <div className="ed-bar__status" aria-live="polite">
            <span className={cx('ed-bar__dot', unsaved && 'ed-bar__dot--on')} aria-hidden="true" />
            <span>{statusText}</span>
            {saved && !unsaved && (
              <a href={href()} className="ed-bar__try">
                Try it in the game
              </a>
            )}
          </div>
          <div className="ed-bar__actions">
            {canDiscard && (
              <Button variant="quiet" onClick={() => setConfirm('discard')}>
                Discard my edits
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={async () => {
                setCopied((await copyText(yaml())) ? 'yes' : 'no');
                window.setTimeout(() => setCopied(null), 2500);
              }}
            >
              {copied === 'yes' ? 'Copied' : copied === 'no' ? 'Copy failed' : 'Copy YAML'}
            </Button>
            <Button variant="secondary" onClick={() => downloadText(`${draft.id}.yaml`, yaml(), 'text/yaml;charset=utf-8')}>
              {`Download ${draft.id}.yaml`}
            </Button>
            {hasRepo && ghLink ? (
              <a className="button button--secondary button--md" href={ghLink} target="_blank" rel="noreferrer">
                <span className="button__label">Open on GitHub</span>
              </a>
            ) : (
              <span className="ed-bar__path">
                File: <code>{filePath}</code>
              </span>
            )}
            <Button variant="primary" onClick={onSaveClick}>
              Save in this browser
            </Button>
          </div>
        </div>
      </div>

      <Dialog
        open={confirm === 'save'}
        onClose={() => setConfirm(null)}
        title="Save and restart the game?"
        size="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(null)}>
              Keep editing
            </Button>
            <Button variant="primary" onClick={doSave}>
              Save and restart
            </Button>
          </>
        }
      >
        <p>A game is in progress. Its rules may change with this edit, so saving abandons it and starts afresh.</p>
      </Dialog>
      <Dialog
        open={confirm === 'discard'}
        onClose={() => setConfirm(null)}
        title="Discard your edits?"
        size="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConfirm(null)}>
              Keep them
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                setConfirm(null);
                edit.revert(draft.id);
              }}
            >
              Discard my edits
            </Button>
          </>
        }
      >
        <p>
          {edit.status[draft.id] === 'new'
            ? 'This delegation was added in this browser and will disappear.'
            : 'This delegation goes back to the file that ships with the game.'}{' '}
          A game in progress is restarted.
        </p>
      </Dialog>
    </EditorContext.Provider>
  );
}

export function DelegationEditorScreen({ id }: { id: string }) {
  const { config } = useConfig();
  const found = config.delegations.find((d) => d.id === id);
  if (!found)
    return (
      <div className="l-page">
        <EmptyState title="No such delegation" action={<a href={href('delegations')}>Back to the cast</a>}>
          Nothing in the loaded configuration has the id “{id}”.
        </EmptyState>
      </div>
    );
  // Key by id so switching delegations starts a fresh draft.
  return <EditorBody key={id} initial={clone(found)} isNew={false} />;
}
