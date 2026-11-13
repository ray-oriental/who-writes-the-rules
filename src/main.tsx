import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { loadConfig } from './engine';
import { GameProviders } from './game/providers';
import { discardLocalConfig, readConfigOverrides } from './game/configEdit';
import { App } from './ui/App';
import { FixtureProviders } from './ui/dev/FixtureProviders';
import { ConfigErrorsScreen } from './ui/screens/stubs';
import './ui/styles/responsive.css';

const root = createRoot(document.getElementById('root')!);
const fixtures = import.meta.env.DEV && new URLSearchParams(window.location.search).has('fixtures');
const overrides = readConfigOverrides();
const loaded = loadConfig(overrides);
const hasLocalEdits = !loaded.ok && Object.keys(overrides).length > 0 && loadConfig().ok;
const recoveryProps = { hasLocalEdits, onDiscardLocalEdits: discardLocalConfig };

root.render(<StrictMode>
  {fixtures ? <FixtureProviders><App /></FixtureProviders>
    : loaded.ok ? <GameProviders config={loaded.config} warnings={loaded.warnings}><App /></GameProviders>
    : <ConfigErrorsScreen errors={loaded.errors} {...recoveryProps} />}
</StrictMode>);
