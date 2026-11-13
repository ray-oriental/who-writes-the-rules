import { Fragment, useEffect, useState } from 'react';
import type { Claim, DelegationConfig, ResearchNeed, ResearchStatus } from '../../engine/types';
import { useConfig, useData } from '../../game/context';
import { Button } from '../components/Button';
import { DelegationBadge } from '../components/DelegationBadge';
import { Field, Select } from '../components/Forms';
import { Chip, EmptyState, ScreenHead, Section } from '../components/Misc';
import { download } from '../lib/play';
import { href } from '../router';
import './Research.css';
import './Summit.css';

const statusLabels: Record<ResearchStatus, string> = {
  todo: 'To find', in_progress: 'In progress', found: 'Found · needs review', verified: 'Verified',
};

function sourceUrl(value: string | undefined): string | undefined {
  if (!value) return;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' || url.protocol === 'http:') return url.href;
  } catch {
    return;
  }
}

type RepoKind = 'edit' | 'blob' | 'tree';

/** Link into the GitHub repository from scenario.repo_url + repo_branch; undefined when unset or not GitHub. */
function repoLink(repo: string, branch: string, kind: RepoKind, path: string): string | undefined {
  const url = sourceUrl(repo);
  if (!url) return;
  const parsed = new URL(url);
  if (parsed.origin !== 'https://github.com' || !/^\/[\w.-]+\/[\w.-]+\/?$/.test(parsed.pathname) || !branch) return;
  return parsed.origin + parsed.pathname.replace(/\/$/, '').replace(/\.git$/, '') + '/' + kind + '/' + encodeURIComponent(branch) + '/' + path;
}

const statusOrder: ResearchStatus[] = ['verified', 'found', 'in_progress', 'todo'];
const shortLabels: Record<ResearchStatus, string> = {
  verified: 'verified', found: 'found', in_progress: 'in progress', todo: 'to find',
};

interface Dossier {
  id: string;
  name: string;
  owner?: string;
  research: ResearchNeed[];
  claims: Claim[];
}

function countStatuses(needs: ResearchNeed[]): Record<ResearchStatus, number> {
  const counts: Record<ResearchStatus, number> = { verified: 0, found: 0, in_progress: 0, todo: 0 };
  for (const need of needs) counts[need.status] += 1;
  return counts;
}

const hasSource = (claim: Claim | undefined) => !!claim?.source.trim();

/** Segmented bar. Segments differ by fill pattern as well as tone, so colour is never the only cue. */
function Bar({ segments }: { segments: { key: string; count: number }[] }) {
  const total = segments.reduce((sum, item) => sum + item.count, 0);
  return <div className="research-bar" aria-hidden="true">
    {total > 0 && segments.filter(item => item.count > 0).map(item =>
      <span key={item.key} className={'research-bar__seg research-bar__seg--' + item.key} style={{ flexGrow: item.count }} />)}
  </div>;
}

function StatusCounts({ counts, compact }: { counts: Record<ResearchStatus, number>; compact?: boolean }) {
  return <p className="research-counts t-meta">{statusOrder.filter(status => !compact || counts[status] > 0).map(status =>
    <span key={status}><span className={'research-swatch research-swatch--' + status} aria-hidden="true" />
      <strong className="t-num">{counts[status]}</strong> {shortLabels[status]}</span>)}</p>;
}

type RuleKind = 'Red line' | 'Must-have' | 'Attendance condition' | 'Walkout trigger' | 'Fact';
interface UnsourcedRule { key: string; kind: RuleKind; label: string; say: string; claimIds: string[] }

/** Rules, conditions and facts that lean on no claim, or only on claims that still lack a source. */
function unsourcedRules(d: DelegationConfig, claimById: ReadonlyMap<string, Claim>): UnsourcedRule[] {
  const out: UnsourcedRule[] = [];
  const check = (key: string, kind: RuleKind, label: string, say: string, ids: string[] | undefined) => {
    const claimIds = ids ?? [];
    if (claimIds.length === 0 || claimIds.every(id => !hasSource(claimById.get(id)))) out.push({ key, kind, label, say, claimIds });
  };
  for (const item of d.red_lines) check('red:' + item.id, 'Red line', item.label, item.say, item.source_ids);
  for (const item of d.must_haves) check('must:' + item.id, 'Must-have', item.label, item.say, item.source_ids);
  for (const item of d.attendance.conditions) check('att:' + item.id, 'Attendance condition', item.id, item.say, item.source_ids);
  for (const item of d.walkout_triggers) check('walk:' + item.id, 'Walkout trigger', item.id, item.say, item.source_ids);
  d.facts.forEach((item, index) => check('fact:' + index, 'Fact', 'Fact ' + (index + 1), item.text, item.source_ids));
  return out;
}

function recordHref(dossier: string, id: string): string {
  return href('research', dossier, id);
}

function RecordLink({ dossier, id }: { dossier: string; id: string }) {
  return <a className="research-id" href={recordHref(dossier, id)} aria-label={'Permalink for ' + id}>{id}</a>;
}

function Need({ need, dossier, claimLinks }: { need: ResearchNeed; dossier: string; claimLinks: ReadonlyMap<string, string> }) {
  return <li className="research-record l-stack l-stack--sm" id={'research-record-' + need.id} tabIndex={-1}>
    <div className="l-cluster">
      <RecordLink dossier={dossier} id={need.id} />
      <Chip tone={need.status === 'verified' ? 'ok' : need.status === 'todo' ? 'neutral' : 'info'}>{statusLabels[need.status]}</Chip>
      <span className="t-meta">Task owner · {need.owner?.trim() || 'Unassigned'}</span>
    </div>
    <h3>{need.question}</h3>
    <p>{need.why}</p>
    {need.leads?.length ? <div className="research-leads">
      <p className="t-meta"><strong>Where to look</strong></p>
      <ul className="summit-bullets">{need.leads.map((lead, index) => {
        const url = sourceUrl(lead);
        return <li key={index}>{url ? <a href={url} target="_blank" rel="noreferrer">{url.replace(/^https?:\/\//, "")}</a> : lead}</li>;
      })}</ul>
    </div> : null}
    {need.notes && <p className="t-meta">{need.notes}</p>}
    {!!need.claim_ids?.length && <p className="t-meta">Claims · {need.claim_ids.map((id, index) => {
      const link = claimLinks.get(id);
      return <Fragment key={id}>{index > 0 && ', '}{link ? <a href={link}>{id}</a> : id}</Fragment>;
    })}</p>}
  </li>;
}

function ClaimRow({ claim, dossier }: { claim: Claim; dossier: string }) {
  const url = sourceUrl(claim.url);
  const cited = hasSource(claim);
  return <li className="research-record l-stack l-stack--sm" id={'research-record-' + claim.id} tabIndex={-1}>
    <div className="l-cluster"><RecordLink dossier={dossier} id={claim.id} />
      <Chip>{claim.confidence + ' confidence'}</Chip>
    </div>
    <h3>{claim.claim}</h3>
    {cited
      ? <p>{url ? <a href={url} target="_blank" rel="noreferrer">{claim.source}</a> : claim.source}</p>
      : <p className="l-cluster">{url && <a href={url} target="_blank" rel="noreferrer">{url.replace(/^https?:\/\//, '')}</a>}
        <Chip tone="warn">Needs a source</Chip></p>}
    {claim.notes && <p className="t-meta">{claim.notes}</p>}
    {claim.used_in.length > 0 && <p className="t-meta">Used in · {claim.used_in.join(', ')}</p>}
  </li>;
}

function HowTo({ repoUrl, branch, path, isExample }: { repoUrl: string; branch: string; path: string; isExample: boolean }) {
  const file = repoLink(repoUrl, branch, 'edit', path);
  const folder = repoLink(repoUrl, branch, 'tree', 'config/delegations');
  const guide = repoLink(repoUrl, branch, 'blob', 'docs/CONFIG-GUIDE.md');
  return <Section title="How to update a dossier">
    <ol className="research-steps">
      <li>Open the delegation's YAML file{' '}
        {isExample
          ? (folder ? <>in <a href={folder} target="_blank" rel="noreferrer">the delegations folder on GitHub</a></> : <>(for example {path})</>)
          : (file ? <a href={file} target="_blank" rel="noreferrer">(edit it on GitHub)</a> : <>({path})</>)}.
      </li>
      <li>Set <code>owner</code> to your handle, and each task's <code>owner</code> and <code>status</code>.</li>
      <li>Once you find a source, add <code>source</code> and <code>url</code> to the claim.</li>
    </ol>
    <p className="t-meta">More in {guide
      ? <a href={guide} target="_blank" rel="noreferrer">docs/CONFIG-GUIDE.md</a> : <code>docs/CONFIG-GUIDE.md</code>}.</p>
  </Section>;
}

function Overview({ dossiers }: { dossiers: Dossier[] }) {
  const needs = dossiers.flatMap(item => item.research);
  const claims = dossiers.flatMap(item => item.claims);
  const counts = countStatuses(needs);
  const sourced = claims.filter(hasSource).length;
  const missing = claims.length - sourced;
  return <Section title="Where every dossier stands">
    <div className="research-totals">
      <div className="l-stack l-stack--sm">
        <p className="t-eyebrow">Research needs · {needs.length} in total</p>
        <Bar segments={statusOrder.map(key => ({ key, count: counts[key] }))} />
        <StatusCounts counts={counts} />
      </div>
      <div className="l-stack l-stack--sm">
        <p className="t-eyebrow">Claims · {claims.length} in total</p>
        <Bar segments={[{ key: 'verified', count: sourced }, { key: 'todo', count: missing }]} />
        <p className="research-counts t-meta">
          <span><span className="research-swatch research-swatch--verified" aria-hidden="true" /><strong className="t-num">{sourced}</strong> with a source</span>
          <span><span className="research-swatch research-swatch--todo" aria-hidden="true" /><strong className="t-num">{missing}</strong> still need one</span>
        </p>
      </div>
    </div>
    <ul className="research-board">
      {dossiers.map(item => {
        const c = countStatuses(item.research);
        const noSource = item.claims.filter(claim => !hasSource(claim)).length;
        return <li key={item.id}>
          <a className="research-board__row" href={href('research', item.id)}>
            <span className="research-board__who">
              {item.id === 'general'
                ? <span className="research-board__shared" aria-hidden="true">ALL</span>
                : <DelegationBadge id={item.id} size="sm" />}
              <strong>{item.name}</strong>
            </span>
            <span className="research-board__owner t-meta">Owner · {item.owner?.trim() || 'Unassigned'}</span>
            <span className="research-board__progress">
              <Bar segments={statusOrder.map(key => ({ key, count: c[key] }))} />
              <StatusCounts counts={c} compact />
            </span>
            <span className={'research-board__claims t-meta' + (noSource ? ' research-board__claims--gap' : '')}>
              {noSource === 0 ? 'All claims sourced' : noSource + (noSource === 1 ? ' claim needs a source' : ' claims need a source')}
            </span>
          </a>
        </li>;
      })}
    </ul>
  </Section>;
}

export function ResearchScreen({ delegation, recordId }: { delegation?: string; recordId?: string }) {
  const { config } = useConfig();
  const { exportClaimsCsv } = useData();
  const [filter, setFilter] = useState('all');
  const [unassigned, setUnassigned] = useState(false);
  const overview = !delegation;
  const active = config.delegations.find(item => item.id === delegation);
  const isShared = delegation === 'general';
  const group = isShared ? config.general : active;
  const dossier = active?.id ?? 'general';
  const path = active ? 'config/delegations/' + encodeURIComponent(active.id) + '.yaml' : 'config/general.yaml';
  const edit = repoLink(config.scenario.repo_url, config.scenario.repo_branch, 'edit', path);
  const filtered = group?.research.filter(item => (filter === 'all' || item.status === filter) &&
    (!unassigned || !item.owner?.trim())) ?? [];
  const claimLinks = new Map(config.general.claims.map(claim => [claim.id, recordHref('general', claim.id)]));
  const claimById = new Map(config.general.claims.map(claim => [claim.id, claim]));
  for (const d of config.delegations) {
    for (const claim of d.claims) {
      claimLinks.set(claim.id, recordHref(d.id, claim.id));
      claimById.set(claim.id, claim);
    }
  }
  const dossiers: Dossier[] = [
    { id: 'general', name: 'Shared research', research: config.general.research, claims: config.general.claims },
    ...config.delegations.map(d => ({ id: d.id, name: d.name, owner: d.owner, research: d.research, claims: d.claims })),
  ];
  const rules = active ? unsourcedRules(active, claimById) : [];
  const examplePath = 'config/delegations/' + encodeURIComponent(config.delegations[0]?.id ?? 'china') + '.yaml';

  useEffect(() => {
    if (!recordId) return;
    const record = document.getElementById('research-record-' + recordId);
    record?.focus({ preventScroll: true });
    record?.scrollIntoView({ block: 'start' });
  }, [recordId]);

  return <div className="l-page summit-screen">
    <ScreenHead title="Research dossiers" lead="Track the evidence behind each delegation and the questions the team still needs to answer."
      aside={<Button onClick={() => download('claims.csv', exportClaimsCsv(), 'text/csv;charset=utf-8')}>Download claims CSV</Button>} />
    <HowTo repoUrl={config.scenario.repo_url} branch={config.scenario.repo_branch}
      path={overview ? examplePath : decodeURIComponent(path)} isExample={overview} />
    <div className="research-layout">
      <nav className="research-nav" aria-label="Research dossiers">
        <a href={href('research', 'general')} aria-current={isShared ? 'page' : undefined}>Shared research
          <span>{config.general.research.filter(item => item.status !== 'verified').length} open</span>
        </a>
        {config.delegations.map(item => <a key={item.id} href={href('research', item.id)}
          aria-current={item.id === active?.id ? 'page' : undefined}>
          <DelegationBadge id={item.id} withName size="sm" />
          <span>{item.research.filter(need => need.status !== 'verified').length} open</span>
        </a>)}
      </nav>
      {overview ? <Overview dossiers={dossiers} /> : !group ? <EmptyState title="Unknown delegation">Choose a dossier from the research list.</EmptyState> :
        <div className="l-stack l-stack--lg">
          <header className="research-heading">
            <div className="l-stack l-stack--sm">
              <h2 className="t-title">{active?.name ?? 'Shared research'}</h2>
              <p className="t-meta">Dossier owner · {active?.owner?.trim() || 'Unassigned'}</p>
              <code className="research-id">{decodeURIComponent(path)}</code>
            </div>
            <div className="research-heading__links">
              {active && <a href={href('delegations', active.id)}>Edit this delegation</a>}
              {edit && <a href={edit} target="_blank" rel="noreferrer">Edit on GitHub</a>}
              <a href={href('research')}>All dossiers</a>
            </div>
          </header>
          {recordId && !group.research.some(item => item.id === recordId) && !group.claims.some(item => item.id === recordId) &&
            <EmptyState title="Research item unavailable">This dossier has no item with the ID {recordId}.</EmptyState>}
          <Section title="Materials to find" aside={<span className="t-meta">{group.research.filter(item => item.status === 'verified').length} of {group.research.length} verified</span>}>
            <div className="research-filter">
              <Field label="Filter by status">{id => <Select id={id} value={filter}
                onChange={setFilter} options={[{ value: 'all', label: 'All statuses' }, ...Object.entries(statusLabels)
                  .map(([value, label]) => ({ value, label }))]} />}</Field>
              <label className="research-filter__toggle"><input type="checkbox" checked={unassigned}
                onChange={event => setUnassigned(event.target.checked)} /> Unassigned only</label>
            </div>
            {filtered.length ? <ul className="research-records">{filtered.map(need =>
              <Need key={need.id} need={need} dossier={dossier} claimLinks={claimLinks} />)}</ul> :
              <EmptyState title="No matching research items" />}
          </Section>
          {active && <Section title="Rules without a source" aside={<span className="t-meta">{rules.length} to back up</span>}>
            {rules.length ? <ul className="research-records">{rules.map(rule =>
              <li key={rule.key} className="research-record l-stack l-stack--sm">
                <div className="l-cluster"><Chip tone="warn">{rule.kind}</Chip><strong>{rule.label}</strong></div>
                <p>{rule.say}</p>
                <p className="t-meta">{rule.claimIds.length ? <>Leans on · {rule.claimIds.map((id, index) => {
                  const link = claimLinks.get(id);
                  return <Fragment key={id}>{index > 0 && ', '}{link ? <a href={link}>{id}</a> : id}</Fragment>;
                })}, none with a source yet</> : 'No claim listed in source_ids yet'}</p>
              </li>)}</ul> :
              <EmptyState title="Every rule has a source">Nothing in this delegation's rules or facts is waiting on a citation.</EmptyState>}
          </Section>}
          <Section title="Claims and sources">
            {group.claims.length ? <ul className="research-records">{group.claims.map(claim =>
              <ClaimRow key={claim.id} claim={claim} dossier={dossier} />)}</ul> : <EmptyState title="No claims recorded" />}
          </Section>
        </div>}
    </div>
  </div>;
}
