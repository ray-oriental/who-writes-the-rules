import type { ConfigIssue } from '../../engine/types';
import { Button } from '../components/Button';
import { Banner, ScreenHead } from '../components/Misc';
import { WITHDRAWN } from '../lib/easterEggs';
import { href } from '../router';
import './Summit.css';

export function ConfigErrorsScreen({ errors, hasLocalEdits, onDiscardLocalEdits }: {
  errors: ConfigIssue[];
  hasLocalEdits?: boolean;
  onDiscardLocalEdits?: () => void;
}) {
  return <main className="l-page l-page--narrow summit-screen">
    {hasLocalEdits && <Banner tone="error" title="The configuration does not load with the edits saved in this browser."
      actions={<Button variant="primary" onClick={onDiscardLocalEdits}>Discard my edits and reload</Button>} />}
    <ScreenHead title="Configuration errors" lead="Fix these entries and reload the game." />
    <ul className="summit-records">{errors.map((issue, index) => <li key={index}>
      <code>{issue.file} {issue.path}</code><p>{issue.message}</p>
    </li>)}</ul>
  </main>;
}

export function NotFoundScreen({ path }: { path: string }) {
  return <div className="l-page summit-screen">
    <ScreenHead title="Page not found" lead={path} />
    <p className="t-meta"><em>{WITHDRAWN.title}.</em> {WITHDRAWN.lead}</p>
    <p><a href={href()}>Return to the game</a></p>
  </div>;
}
