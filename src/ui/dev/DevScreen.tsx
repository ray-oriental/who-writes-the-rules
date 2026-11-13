import { useContext } from 'react';
import { useGame, useSettings } from '../../game/context';
import { Button } from '../components/Button';
import { ScreenHead } from '../components/Misc';
import { navigate } from '../router';
import { FIXTURE_LIST } from './fixtures';
import { FixtureDevContext } from './FixtureProviders';
import './DevScreen.css';

/** #/dev: jump to any phase fixture, and toggle the shell states (error, busy, kiosk). */
export function DevScreen() {
  const controls = useContext(FixtureDevContext);
  const { settings, update } = useSettings();
  const { view } = useGame();

  if (!controls) {
    return (
      <div className="l-page">
        <ScreenHead
          eyebrow="Development"
          title="Fixtures are not loaded"
          lead="The app is running on the real providers."
        />
      </div>
    );
  }

  return (
    <div className="l-page l-page--narrow">
      <ScreenHead
        eyebrow="Development"
        title="Fixtures"
        lead="Each entry loads one game state and opens the play screen."
      />
      <ol className="dev-list">
        {FIXTURE_LIST.map((f) => (
          <li key={f.key}>
            <button
              type="button"
              className="dev-list__item"
              aria-current={controls.current === f.key ? 'true' : undefined}
              onClick={() => {
                controls.load(f.key);
                navigate('/');
              }}
            >
              <span className="dev-list__key">{f.key}</span>
              <span className="dev-list__label">{f.label}</span>
              {f.note && <span className="dev-list__note">{f.note}</span>}
            </button>
          </li>
        ))}
      </ol>
      <div className="l-actions">
        <Button
          size="sm"
          onClick={() =>
            controls.setError(
              view.error ? null : 'The model did not answer in 30 seconds. A template was used instead.',
            )
          }
        >
          {view.error ? 'Clear error' : 'Show error banner'}
        </Button>
        <Button
          size="sm"
          onClick={() => controls.setBusy(view.busy ? null : { kind: 'responding', who: ['us', 'evaluator'] })}
        >
          {view.busy ? 'Clear busy' : 'Set busy'}
        </Button>
        <Button size="sm" onClick={() => update({ kiosk: !settings.kiosk })}>
          {settings.kiosk ? 'Kiosk off' : 'Kiosk on'}
        </Button>
      </div>
    </div>
  );
}
