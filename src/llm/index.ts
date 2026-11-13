import { z } from 'zod';
import { chatJson, LlmClientError } from './client';
import type { LlmPreset, LlmSettings } from './types';

export { createLlmRoles } from './roles';

const modelNote = 'Check the provider’s current model list and enter a model available to your account.';

export const LLM_PRESETS: LlmPreset[] = [
  { id: 'deepseek', label: 'DeepSeek', base_url: 'https://api.deepseek.com/v1', model: 'deepseek-chat', json_mode: true, note: modelNote },
  { id: 'moonshot', label: 'Moonshot (Kimi)', base_url: 'https://api.moonshot.cn/v1', model: 'moonshot-v1-8k', json_mode: true, note: modelNote },
  { id: 'dashscope', label: 'Alibaba DashScope', base_url: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus', json_mode: true, note: modelNote },
  { id: 'openai', label: 'OpenAI', base_url: 'https://api.openai.com/v1', model: 'gpt-4o-mini', json_mode: true, note: modelNote },
  { id: 'ollama', label: 'Local Ollama', base_url: 'http://localhost:11434/v1', model: '', json_mode: true, note: 'Enter a model installed locally. Check the server’s current model list.' },
  { id: 'custom', label: 'Custom', base_url: '', model: '', json_mode: true, note: modelNote },
];

export const DEFAULT_LLM_SETTINGS: LlmSettings = {
  mode: 'mock', preset: 'deepseek',
  base_url: LLM_PRESETS[0].base_url, model: LLM_PRESETS[0].model,
  api_key: '', json_mode: true,
  proxy_url: 'http://127.0.0.1:8787/v1', timeout_ms: 30_000,
};

export async function testConnection(settings: LlmSettings): Promise<{ ok: boolean; message: string }> {
  if (settings.mode === 'mock') return { ok: true, message: 'Offline mock mode is ready.' };
  try {
    await chatJson({
      settings, system: 'Return only JSON {"ok":true}.', user: 'Connection check.',
      temperature: 0.2, schema: z.object({ ok: z.literal(true) }), retries: 0,
    });
    return { ok: true, message: 'The model endpoint responded successfully.' };
  } catch (error) {
    if (error instanceof LlmClientError && error.kind === 'network') {
      return { ok: false, message: 'Cannot reach the endpoint. Check its address and CORS support, or try proxy mode.' };
    }
    return { ok: false, message: error instanceof LlmClientError ? error.message : 'The connection check failed.' };
  }
}
