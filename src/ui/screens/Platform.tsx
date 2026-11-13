import { useState } from 'react';
import type { RankedProposal } from '../../game/api';
import { useConfig, useData, useGame, usePlatform } from '../../game/context';
import { Button } from '../components/Button';
import { DocPara, DocSection, Document } from '../components/Document';
import { Field, ScoreInput, TextArea } from '../components/Forms';
import { Chip, EmptyState, ScreenHead, Section } from '../components/Misc';
import { Dialog } from '../components/Overlay';
import { cx, listNames, useDelegations } from '../lib/delegations';
import { download, outcomeLabels } from '../lib/play';
import './Summit.css';
import './Platform.css';

function RatingDialog({ proposal, onClose, onSave }: { proposal: RankedProposal; onClose(): void; onSave(): void }) {
  const { config } = useConfig();
  const platform = usePlatform();
  const questions = config.rules.leaderboard.questions;
  const [scores, setScores] = useState<(number | null)[]>(questions.map(() => null));
  const [comment, setComment] = useState('');
  return <Dialog open title="Rate this text" onClose={onClose} footer={<Button variant="primary" type="submit" form="rating-form"
    disabled={scores.some(value => value === null)}>Save rating</Button>}>
    <form className="l-stack" id="rating-form" onSubmit={event => {
      event.preventDefault();
      if (scores.some(value => value === null)) return;
      platform.rate(proposal.id, scores.filter(value => value !== null), comment);
      onSave();
    }}>
      {questions.map((question, index) => <ScoreInput key={index} label={question} anchors={['Not at all', 'Completely']} value={scores[index]} onChange={value =>
        setScores(current => current.map((old, i) => i === index ? value : old))} />)}
      <Field label="Comment (optional)">{id => <TextArea id={id} rows={3} maxLength={500}
        value={comment} onChange={event => setComment(event.target.value)} />}</Field>
    </form>
  </Dialog>;
}

function ScoreBar({ fraction, label }: { fraction: number; label: string }) {
  return <span className="gallery-bar" role="img" aria-label={label}>
    <span className="gallery-bar__fill" style={{ width: Math.round(Math.min(1, Math.max(0, fraction)) * 100) + '%' }} />
  </span>;
}

export function GalleryScreen() {
  const platform = usePlatform();
  const { config } = useConfig();
  const { get } = useDelegations();
  const [filter, setFilter] = useState('');
  const [rating, setRating] = useState<RankedProposal | null>(null);
  const [saved, setSaved] = useState(false);
  const proposals = platform.proposals.filter(item => !filter || item.outcome === filter);
  const questions = config.rules.leaderboard.questions;
  return <div className="l-page l-page--narrow summit-screen">
    <ScreenHead title="Proposal gallery" lead="Compare texts adopted in this browser and rate them as an observer."
      aside={<p className="gallery-howto t-meta">Pick a text, press <strong>Rate proposal</strong> and answer {questions.length} short questions.</p>} />
    {saved && <div className="gallery-saved l-cluster" role="status"><p>Rating saved.</p>
      <Button variant="primary" onClick={() => { setSaved(false); setFilter(''); window.scrollTo(0, 0); }}>Next viewer</Button></div>}
    <div className="gallery-filter" role="group" aria-label="Filter by outcome">
      {[['', 'All outcomes'], ...Object.entries(outcomeLabels)].map(([value, label]) =>
        <button key={value} type="button" className={cx('gallery-filter__chip', filter === value && 'gallery-filter__chip--on')}
          aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}</button>)}
    </div>
    {proposals.length === 0 && <EmptyState title="No proposals to show">An adopted proposal or technical annex will appear here.</EmptyState>}
    {proposals.map(item => {
      const votes = item.yes + item.no;
      return <Document key={item.id} title={item.title} kicker={outcomeLabels[item.outcome]}
        symbol={'Rank ' + item.rank} meta={[
          ['Summit vote', item.yes + ' in favour · ' + item.no + ' against'],
          ['Audience score', item.n_ratings ? item.score.toFixed(2) + ' / 5 · ' + item.n_ratings + (item.n_ratings === 1 ? ' rating' : ' ratings') : 'Unrated'],
        ]}>
        <div className="gallery-gap">
          <p className="gallery-gap__rank t-num"><span className="t-eyebrow">Rank</span> {item.rank} <span className="t-meta">of {platform.proposals.length}</span></p>
          <div className="gallery-gap__cell">
            <span className="t-eyebrow">In the room</span>
            <ScoreBar fraction={votes ? item.yes / votes : 0} label={item.yes + ' of ' + votes + ' delegations voted yes'} />
            <span className="t-meta">{item.yes} of {votes} voted yes</span>
          </div>
          <div className="gallery-gap__cell">
            <span className="t-eyebrow">Outside the room</span>
            <ScoreBar fraction={item.n_ratings ? item.score / 5 : 0} label={item.n_ratings ? 'Audience score ' + item.score.toFixed(1) + ' of 5' : 'No audience ratings yet'} />
            <span className="t-meta">{item.n_ratings ? item.score.toFixed(1) + ' of 5 from ' + item.n_ratings + (item.n_ratings === 1 ? ' viewer' : ' viewers') : 'Not rated yet'}</span>
          </div>
        </div>
        <DocSection title="Text adopted">{item.clauses.map((text, index) => <DocPara key={index} n={index + 1}>{text}</DocPara>)}</DocSection>
        <p>At the table · {listNames(item.attended.map(id => get(id).name)) || 'None recorded'}</p>
        <p>Absent · {listNames(item.absent.map(id => get(id).name)) || 'None'}</p>
        <p>In favour · {listNames(item.votes.filter(vote => vote.vote === 'yes').map(vote => get(vote.delegation).name)) || 'None'}</p>
        <p>Against · {listNames(item.votes.filter(vote => vote.vote === 'no').map(vote => get(vote.delegation).name)) || 'None'}</p>
        <div className="l-actions"><Button variant="primary" onClick={() => setRating(item)}>Rate proposal</Button></div>
      </Document>;
    })}
    {rating && <RatingDialog proposal={rating} onClose={() => setRating(null)} onSave={() => { setRating(null); setSaved(true); }} />}
  </div>;
}

export function AdminScreen() {
  const { warnings } = useConfig();
  const data = useData();
  const platform = usePlatform();
  const { view } = useGame();
  const { get } = useDelegations();
  const [notice, setNotice] = useState('');
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState<RankedProposal | null>(null);
  const csv = 'text/csv;charset=utf-8';
  const json = 'application/json';
  return <div className="l-page l-page--narrow summit-screen">
    <ScreenHead title="Local administration" lead="Export completed games and manage the gallery on this browser." />
    <Section title="Exports">
      <div className="admin-groups">
        <div className="admin-group">
          <h3 className="t-heading">Game records</h3>
          <p className="t-meta">One row or entry per completed game on this browser.</p>
          <div className="l-cluster">
            <Button onClick={() => download('games.csv', data.exportGamesCsv(), csv)}>Games CSV</Button>
            <Button onClick={() => download('games.json', data.exportGamesJson(), json)}>Games JSON</Button>
          </div>
        </div>
        <div className="admin-group">
          <h3 className="t-heading">Research</h3>
          <p className="t-meta">Every claim from every dossier, in the course table format.</p>
          <div className="l-cluster">
            <Button onClick={() => download('claims.csv', data.exportClaimsCsv(), csv)}>Claims CSV</Button>
          </div>
        </div>
        <div className="admin-group">
          <h3 className="t-heading">Gallery</h3>
          <p className="t-meta">Proposals and ratings. Import merges another browser's file.</p>
          <div className="l-cluster">
            <Button onClick={() => download('gallery.json', platform.exportJson(), json)}>Export gallery JSON</Button>
          </div>
          <Field label="Import gallery JSON">{id => <input id={id} type="file" accept=".json,application/json" onChange={async event => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (!file) return;
            try {
              const result = platform.importJson(await file.text());
              setNotice(result.error ?? (result.added + ' new records imported.'));
            } catch {
              setNotice('The selected file could not be read.');
            }
          }} />}</Field>
          {notice && <p role="status">{notice}</p>}
        </div>
      </div>
    </Section>
    <Section title={'Completed games (' + data.games.length + ')'}>
      {data.games.length === 0 ? <p className="t-meta">No completed games yet.</p> :
        <ul className="summit-records">{data.games.map(game => <li key={game.id}>
          <strong>{get(game.seat).name}</strong> · {game.outcome && outcomeLabels[game.outcome]} · {game.duration_s}s
        </li>)}</ul>}
    </Section>
    <Section title="Gallery moderation">
      {platform.proposals.length === 0 && <p className="t-meta">No proposals are published on this browser.</p>}
      {platform.proposals.map(proposal => <details key={proposal.id} className="summit-details">
        <summary>{proposal.title} · {proposal.n_ratings} ratings</summary>
        <ul className="summit-records">{platform.ratingsFor(proposal.id).map(rating => <li key={rating.id} className="summit-panel__head">
          <span>{rating.scores.join(' / ')} {rating.comment && '· ' + rating.comment}</span>
          <Button size="sm" onClick={() => platform.removeRating(rating.id)}>Remove rating</Button>
        </li>)}</ul>
        <Button size="sm" variant="danger" onClick={() => setRemoving(proposal)}>Remove proposal</Button>
      </details>)}
    </Section>
    <Section title="Configuration" aside={<Chip>{warnings.length} warnings</Chip>}>
      {warnings.length ? <details className="summit-details"><summary>Show validation warnings</summary>
        <ul className="summit-records">{warnings.map((item, index) => <li key={index}>
          <code>{item.file} {item.path}</code><p>{item.message}</p>
        </li>)}</ul></details> : <p>All configuration checks passed.</p>}
    </Section>
    <Section title="Reset">
      <p className="t-meta">Deletes the current game, completed games, proposals and ratings stored in this browser.</p>
      <div className="l-actions"><Button variant="danger" disabled={!!view.busy} onClick={() => setConfirm(true)}>Clear local game data</Button></div>
    </Section>
    <Dialog open={confirm} onClose={() => setConfirm(false)} title="Clear local game data?" footer={<>
      <Button variant="quiet" onClick={() => setConfirm(false)}>Keep data</Button>
      <Button variant="danger" disabled={!!view.busy} onClick={() => { data.clearAll(); setConfirm(false); }}>Clear game data</Button>
    </>}><p>This deletes the current game, completed games, proposals and ratings from this browser. It cannot be undone.</p></Dialog>
    <Dialog open={!!removing} onClose={() => setRemoving(null)} title="Remove this proposal?" footer={<>
      <Button variant="quiet" onClick={() => setRemoving(null)}>Keep proposal</Button>
      <Button variant="danger" onClick={() => { if (removing) platform.removeProposal(removing.id); setRemoving(null); }}>Remove proposal and ratings</Button>
    </>}><p>{removing?.title} and all of its ratings will be removed from this browser.</p></Dialog>
  </div>;
}
