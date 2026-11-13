import { afterEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { chatJson, extractJson, LlmClientError } from '../../src/llm/client';
import { DEFAULT_LLM_SETTINGS, testConnection } from '../../src/llm';
import type { LlmSettings } from '../../src/llm/types';

const schema = z.object({ speech: z.string() });
const settings: LlmSettings = { ...DEFAULT_LLM_SETTINGS, mode: 'direct',
  base_url: 'https://example.invalid/v1/', api_key: 'test-only-credential' };
function completion(value: unknown): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: typeof value === 'string' ? value : JSON.stringify(value) } }] }),
    { status: 200, headers: { 'Content-Type': 'application/json' } });
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('JSON extraction', () => {
  it.each([
    ['```json\n{"speech":"hello"}\n```', { speech: 'hello' }],
    ['```json{"speech":"hello"}```', { speech: 'hello' }],
    ['Here is the result. {"speech":"hello"} trailing prose', { speech: 'hello' }],
    ['<think>{"wrong":true}</think>\n{"speech":"hello"}', { speech: 'hello' }],
    ['<THINK>hidden\n[1,2]</THINK>\n[{"tag":"x","confidence":0.9}]', [{ tag: 'x', confidence: 0.9 }]],
    ['```json\n{"speech":"Use ```json code fences."}\n```', { speech: 'Use ```json code fences.' }],
    ['{"nested":[{"x":"a } [ bracket"}],"quote":"say \\"hi\\""}', { nested: [{ x: 'a } [ bracket' }], quote: 'say "hi"' }],
  ])('extracts %s', (content, expected) => {
    expect(extractJson(content)).toEqual(expected);
  });

  it.each(['nothing', '42', '{"unfinished":', '[}', '{bad}', '{"a":NaN}'])('rejects malformed content %s', content => {
    expect(() => extractJson(content)).toThrow(LlmClientError);
  });
});

describe('chatJson', () => {
  it('posts direct requests with the configured model, JSON mode and authorization', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(completion({ speech: 'hello' }));
    await expect(chatJson({ settings, system: 'system', user: 'user', temperature: 0.7, schema, fetchImpl }))
      .resolves.toEqual({ speech: 'hello' });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://example.invalid/v1/chat/completions');
    expect(init?.headers).toEqual({ 'Content-Type': 'application/json', Authorization: `Bearer ${settings.api_key}` });
    expect(JSON.parse(init!.body as string)).toEqual({ model: settings.model,
      messages: [{ role: 'system', content: 'system' }, { role: 'user', content: 'user' }],
      temperature: 0.7, response_format: { type: 'json_object' } });
  });

  it('disables Qwen3 thinking for the loopback Ollama preset without requiring an API key', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(completion({ speech: 'hello' }));
    await chatJson({ settings: { ...settings, preset: 'ollama', base_url: 'http://localhost:11434/v1',
      model: 'qwen3:4b', api_key: '' }, system: '', user: '', temperature: 0.2, schema, fetchImpl });
    const [, init] = fetchImpl.mock.calls[0];
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(JSON.parse(init!.body as string)).toMatchObject({
      reasoning_effort: 'none', max_tokens: 128,
      response_format: { type: 'json_schema', json_schema: { schema: { required: ['speech'] } } },
    });
  });

  it('uses the proxy URL without an authorization header or disabled JSON format', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(completion({ speech: 'hello' }));
    await chatJson({ settings: { ...settings, mode: 'proxy', json_mode: false }, system: '', user: '', temperature: 0.2, schema, fetchImpl });
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8787/v1/chat/completions');
    expect(init?.headers).not.toHaveProperty('Authorization');
    expect(init!.body).not.toContain(settings.api_key);
    expect(JSON.parse(init!.body as string)).not.toHaveProperty('response_format');
  });

  it.each(['network', 'http', 'json', 'schema', 'envelope'] as const)('retries once after a %s failure', async kind => {
    const fetchImpl = vi.fn<typeof fetch>();
    if (kind === 'network') fetchImpl.mockRejectedValueOnce(new Error(settings.api_key));
    else if (kind === 'http') fetchImpl.mockResolvedValueOnce(new Response(settings.api_key, { status: 429 }));
    else if (kind === 'json') fetchImpl.mockResolvedValueOnce(completion('invalid'));
    else if (kind === 'envelope') fetchImpl.mockResolvedValueOnce(new Response('null'));
    else fetchImpl.mockResolvedValueOnce(completion({ speech: 42 }));
    fetchImpl.mockResolvedValueOnce(completion({ speech: 'recovered' }));
    await expect(chatJson({ settings, system: '', user: 'original', temperature: 0.2, schema, fetchImpl }))
      .resolves.toEqual({ speech: 'recovered' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    const retry = JSON.parse(fetchImpl.mock.calls[1][1]!.body as string);
    expect(retry.messages[1].content).toBe('original\nReturn only valid JSON matching the requested shape.');
  });

  it('throws a typed redacted error after two failures', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new Error(settings.api_key));
    const error = await chatJson({ settings, system: '', user: '', temperature: 0.2, schema, fetchImpl }).catch(error => error);
    expect(error).toBeInstanceOf(LlmClientError);
    expect(error).toMatchObject({ kind: 'network', attempts: 2 });
    expect(String(error)).not.toContain(settings.api_key);
    expect(error.cause).toBeUndefined();
  });

  it('aborts both timed-out attempts even if an injected fetch ignores abort', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}));
    const pending = chatJson({ settings: { ...settings, timeout_ms: 10 }, system: '', user: '', temperature: 0.2, schema, fetchImpl });
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout', attempts: 2 });
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchImpl.mock.calls) expect(init?.signal?.aborted).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('applies the default timeout to response-body reading', async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue({ ok: true, json: () => new Promise(() => {}) } as Response);
    const pending = chatJson({ settings: { ...settings, timeout_ms: 0 }, system: '', user: '', temperature: 0.2, schema, fetchImpl });
    const assertion = expect(pending).rejects.toMatchObject({ kind: 'timeout' });
    await vi.advanceTimersByTimeAsync(59_999);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(1);
    await assertion;
  });

  it('rejects invalid endpoint settings without calling fetch', async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    await expect(chatJson({ settings: { ...settings, base_url: 'file:///test' }, system: '', user: '', temperature: 0.2, schema, fetchImpl }))
      .rejects.toMatchObject({ kind: 'settings' });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe('connection checks', () => {
  it('succeeds offline without fetching', async () => {
    const fetchImpl = vi.fn();
    vi.stubGlobal('fetch', fetchImpl);
    expect((await testConnection(DEFAULT_LLM_SETTINGS)).ok).toBe(true);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
  it('makes one tiny request and confirms valid JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(completion({ ok: true }));
    vi.stubGlobal('fetch', fetchImpl);
    expect((await testConnection(settings)).ok).toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
  it('gives a CORS and proxy hint on fetch failure without leaking the credential', async () => {
    const fetchImpl = vi.fn().mockRejectedValue(new Error(settings.api_key));
    vi.stubGlobal('fetch', fetchImpl);
    const result = await testConnection(settings);
    expect(result.ok).toBe(false);
    expect(result.message).toContain('CORS');
    expect(result.message).toContain('proxy');
    expect(result.message).not.toContain(settings.api_key);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
