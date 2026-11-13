import { z } from 'zod';
import type { LlmSettings } from './types';

export type LlmErrorKind = 'settings' | 'network' | 'http' | 'timeout' | 'json' | 'schema';

/** Safe to display: provider bodies and original error messages are never retained. */
export class LlmClientError extends Error {
  constructor(public readonly kind: LlmErrorKind, public readonly attempts: number = 1) {
    const messages: Record<LlmErrorKind, string> = {
      settings: 'Check the model and endpoint settings.',
      network: 'The model endpoint could not be reached.',
      http: 'The model endpoint returned an unsuccessful response.',
      timeout: 'The model request timed out.',
      json: 'The model returned invalid JSON.',
      schema: 'The model response did not match the requested shape.',
    };
    super(messages[kind]);
    this.name = 'LlmClientError';
  }
}

/** Find the first complete JSON container, respecting escaped strings and nesting. */
export function extractJson(content: string): unknown {
  const cleaned = content.replace(/<think\b[^>]*>[\s\S]*?<\/think\s*>/gi, '')
    .replace(/^\s*```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '')
    .trim();
  const start = cleaned.search(/[\[{]/);
  if (start < 0) throw new LlmClientError('json');
  const stack: string[] = [];
  let quoted = false;
  let escaped = false;
  for (let index = start; index < cleaned.length; index += 1) {
    const char = cleaned[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quoted = false;
      continue;
    }
    if (char === '"') quoted = true;
    else if (char === '{' || char === '[') stack.push(char);
    else if (char === '}' || char === ']') {
      const opening = stack.pop();
      if (opening !== (char === '}' ? '{' : '[')) throw new LlmClientError('json');
      if (stack.length === 0) {
        try {
          return JSON.parse(cleaned.slice(start, index + 1)) as unknown;
        } catch {
          throw new LlmClientError('json');
        }
      }
    }
  }
  throw new LlmClientError('json');
}

export interface ChatJsonOptions<T> {
  settings: LlmSettings;
  system: string;
  user: string;
  temperature: number;
  schema: z.ZodType<T>;
  fetchImpl?: typeof fetch;
  /** Bound synchronous generation on loopback Ollama, where requests share a model runner. */
  localOutputLimit?: number;
  /** Connection checks make a single request. Game roles keep the default retry. */
  retries?: 0 | 1;
}

async function requestJson<T>(options: ChatJsonOptions<T>, attempt: number): Promise<T> {
  const { settings, system, user, temperature, schema } = options;
  let endpoint: URL;
  try {
    const base = settings.mode === 'proxy' ? settings.proxy_url : settings.base_url;
    endpoint = new URL(`${base.trim().replace(/\/+$/, '')}/chat/completions`);
    if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
      throw new Error();
    }
    if (!settings.model.trim() || settings.mode === 'mock') throw new Error();
  } catch {
    throw new LlmClientError('settings');
  }
  const controller = new AbortController();
  const timeoutMs = Number.isFinite(settings.timeout_ms) && settings.timeout_ms > 0
    ? settings.timeout_ms : 30_000;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new LlmClientError('timeout'));
      controller.abort();
    }, timeoutMs);
  });
  const request = async (): Promise<T> => {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (settings.mode === 'direct' && settings.api_key.trim()) headers.Authorization = `Bearer ${settings.api_key}`;
    const localQwen = settings.mode === 'direct' && settings.preset === 'ollama'
      && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
      && /^qwen3(?:[.:]|$)/i.test(settings.model.trim());
    const responseFormat = settings.json_mode && localQwen && attempt === 0
      ? { type: 'json_schema', json_schema: { name: 'game_response', schema: z.toJSONSchema(schema, { io: 'input', unrepresentable: 'any' }) } }
      : { type: 'json_object' };
    const response = await (options.fetchImpl ?? globalThis.fetch)(endpoint.toString(), {
      method: 'POST', headers, signal: controller.signal,
      body: JSON.stringify({
        model: settings.model,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: attempt === 0 ? user
            : `${user}\nReturn only valid JSON matching the requested shape.` },
        ],
        temperature,
        ...(localQwen ? { reasoning_effort: 'none', max_tokens: options.localOutputLimit ?? 128 } : {}),
        ...(settings.json_mode ? { response_format: responseFormat } : {}),
      }),
    });
    if (!response.ok) throw new LlmClientError('http');
    let envelope: unknown;
    try {
      envelope = await response.json();
    } catch {
      throw new LlmClientError('json');
    }
    const messageSchema = envelope as { choices?: { message?: { content?: unknown } }[] } | null;
    const content = messageSchema?.choices?.[0]?.message?.content;
    if (typeof content !== 'string') throw new LlmClientError('json');
    const result = schema.safeParse(extractJson(content));
    if (!result.success) throw new LlmClientError('schema');
    return result.data;
  };
  try {
    return await Promise.race([request(), timeout]);
  } catch (error) {
    if (error instanceof LlmClientError) throw error;
    throw new LlmClientError(controller.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
}

export async function chatJson<T>(options: ChatJsonOptions<T>): Promise<T> {
  const attempts = (options.retries ?? 1) + 1;
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      return await requestJson(options, attempt);
    } catch (error) {
      if (attempt === attempts - 1) {
        throw new LlmClientError(error instanceof LlmClientError ? error.kind : 'network', attempts);
      }
    }
  }
  throw new LlmClientError('network', attempts);
}
