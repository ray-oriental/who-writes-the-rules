import { useState } from 'react';
import type { LlmMode } from '../../llm/types';
import { useSettings } from '../../game/context';
import { Button } from '../components/Button';
import { Field, Select } from '../components/Forms';
import { Banner, ScreenHead, Section } from '../components/Misc';
import { href } from '../router';
import './Summit.css';

export function SettingsScreen() {
  const { settings, update, updateLlm, presets, testConnection } = useSettings();
  const { llm } = settings;
  const [testing, setTesting] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string }>();
  const field = (label: string, key: 'base_url' | 'model' | 'api_key' | 'proxy_url', secret = false) =>
    <Field label={label}>{id => <input className="summit-input" id={id} type={secret ? 'password' : 'text'}
      value={llm[key]} autoComplete={secret ? 'new-password' : 'off'} spellCheck={false}
      onChange={event => updateLlm({ [key]: event.target.value })} />}</Field>;

  return <div className="l-page l-page--narrow summit-screen">
    <ScreenHead title="Settings" />
    <Section title="Delegation responses">
      <Field label="Model mode">{id => <Select id={id} value={llm.mode} onChange={value => {
        updateLlm({ mode: value as LlmMode });
        setStatus(undefined);
      }} options={[
        { value: 'mock', label: 'Offline templates' }, { value: 'direct', label: 'OpenAI-compatible endpoint' },
        { value: 'proxy', label: 'Local model proxy' },
      ]} />}</Field>
      {llm.mode === 'mock' && <p className="t-meta">The game uses built-in responses and runs offline.</p>}
      {llm.mode === 'direct' && <>
        <Field label="Provider preset">{id => <Select id={id} value={llm.preset} options={presets.map(item =>
          ({ value: item.id, label: item.label }))} onChange={value => {
          const preset = presets.find(item => item.id === value);
          if (preset) updateLlm({ preset: value, base_url: preset.base_url, model: preset.model, json_mode: preset.json_mode, api_key: '' });
        }} />}</Field>
        {field('Base URL', 'base_url')}
        {field('Model', 'model')}
        {field('API key', 'api_key', true)}
        {llm.preset === 'ollama'
          ? <p className="t-meta">Enter an installed Ollama model. Leave the API key blank for local Ollama.
            {window.location.protocol === 'file:' && <> For direct connection, open the game through a local web server.</>}
          </p>
          : <p className="t-meta">The API key is saved in this browser. The endpoint receives the game text and key when called.</p>}
      </>}
      {llm.mode === 'proxy' && <>
        {field('Proxy URL', 'proxy_url')}
        {field('Model', 'model')}
        <p className="t-meta">Start <code>npm run proxy</code> on this computer and configure its upstream credentials in the terminal.</p>
      </>}
      {llm.mode !== 'mock' && <label className="l-cluster"><input type="checkbox" checked={llm.json_mode}
        onChange={event => updateLlm({ json_mode: event.target.checked })} /> Request JSON mode</label>}
      <div className="l-cluster"><Button disabled={testing} onClick={async () => {
        setTesting(true);
        setStatus(undefined);
        try {
          setStatus(await testConnection());
        } finally {
          setTesting(false);
        }
      }}>{testing ? 'Testing…' : 'Test connection'}</Button></div>
      {status && <Banner tone={status.ok ? 'info' : 'error'}>{status.message}</Banner>}
    </Section>
    <Section title="Expo">
      <label className="l-cluster"><input type="checkbox" checked={settings.kiosk}
        onChange={event => update({ kiosk: event.target.checked })} /> Kiosk mode</label>
      {settings.kiosk && <p className="t-meta">Research, Settings and Admin are hidden from the menu. Open <code>#/settings</code> to come back here.</p>}
      <p className="t-meta"><a href={href('print')}>Print cards</a> for a paper backup.</p>
    </Section>
  </div>;
}
