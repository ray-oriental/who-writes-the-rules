import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const script = fileURLToPath(new URL('../../tools/llm-proxy.mjs', import.meta.url));

async function listen(server: Server): Promise<number> {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test server did not bind.');
  return address.port;
}

async function stop(child: ChildProcess): Promise<void> {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise<void>(resolve => {
    child.once('exit', () => resolve());
    child.kill();
  });
}

async function startProxy(env: NodeJS.ProcessEnv) {
  const child = spawn(process.execPath, [script], {
    env: { ...process.env, ...env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  let output = '';
  const port = await new Promise<number>((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error('Proxy startup timed out.'));
    }, 10_000);
    child.once('error', () => { clearTimeout(timer); reject(new Error('Proxy startup failed.')); });
    child.once('exit', () => { clearTimeout(timer); reject(new Error('Proxy exited before startup.')); });
    const collect = (chunk: Buffer) => {
      output += chunk.toString();
      const match = output.match(/listening on 127\.0\.0\.1:(\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    };
    child.stdout.on('data', collect);
    child.stderr.on('data', collect);
  });
  return { child, base: `http://127.0.0.1:${port}`, output: () => output };
}

describe('zero-dependency loopback proxy', () => {
  it('forwards requests, applies model overrides, preserves statuses and CORS, and keeps credentials out of output', async () => {
    const credential = `test-credential-${randomUUID()}`;
    const requests: { path: string | undefined; authorization: string | undefined; body: Record<string, unknown> }[] = [];
    let upstreamStatus = 202;
    const upstreamBody = JSON.stringify({ choices: [{ message: { content: '{"ok":true}' } }] });
    const upstream = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      requests.push({ path: request.url, authorization: request.headers.authorization,
        body: JSON.parse(Buffer.concat(chunks).toString()) as Record<string, unknown> });
      response.writeHead(upstreamStatus, { 'Content-Type': 'application/json' });
      response.end(upstreamBody);
    });
    const upstreamPort = await listen(upstream);
    let proxy: Awaited<ReturnType<typeof startProxy>> | undefined;
    try {
      proxy = await startProxy({ LLM_API_KEY: credential, LLM_BASE_URL: `http://127.0.0.1:${upstreamPort}/v1/`, LLM_MODEL: 'forced-model' });
      const health = await fetch(`${proxy.base}/health`);
      expect(await health.json()).toEqual({ ok: true });
      expect(health.headers.get('access-control-allow-origin')).toBe('*');

      const options = await fetch(`${proxy.base}/v1/chat/completions`, { method: 'OPTIONS',
        headers: { Origin: 'null', 'Access-Control-Request-Headers': 'content-type' } });
      expect(options.status).toBe(204);
      expect(options.headers.get('access-control-allow-origin')).toBe('*');
      expect(options.headers.get('access-control-allow-methods')).toContain('POST');
      expect(options.headers.get('access-control-allow-headers')).toContain('Content-Type');

      const body = { model: 'requested-model', messages: [{ role: 'user', content: 'private request text' }], temperature: 0.2,
        response_format: { type: 'json_object' } };
      const response = await fetch(`${proxy.base}/v1/chat/completions`, { method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer caller-value' }, body: JSON.stringify(body) });
      expect(response.status).toBe(202);
      expect(await response.text()).toBe(upstreamBody);
      expect(response.headers.get('access-control-allow-origin')).toBe('*');
      expect(requests).toEqual([{ path: '/v1/chat/completions', authorization: `Bearer ${credential}`,
        body: { ...body, model: 'forced-model' } }]);

      upstreamStatus = 503;
      const failure = await fetch(`${proxy.base}/v1/chat/completions`, { method: 'POST', body: JSON.stringify(body) });
      expect(failure.status).toBe(503);
      expect(await failure.text()).toBe(upstreamBody);
      expect(failure.headers.get('access-control-allow-origin')).toBe('*');

      for (const invalid of ['{', 'null', '[]']) {
        const invalidResponse = await fetch(`${proxy.base}/v1/chat/completions`, { method: 'POST', body: invalid });
        expect(invalidResponse.status).toBe(400);
        expect(invalidResponse.headers.get('access-control-allow-origin')).toBe('*');
        await invalidResponse.text();
      }
      const oversized = await fetch(`${proxy.base}/v1/chat/completions`, { method: 'POST',
        body: JSON.stringify({ content: 'x'.repeat(1024 * 1024) }) });
      expect(oversized.status).toBe(413);
      await oversized.text();
      expect(requests).toHaveLength(2);
      expect((await fetch(`${proxy.base}/missing`)).status).toBe(404);
      expect(proxy.output().trim().split(/\r?\n/)).toHaveLength(1);
      expect(proxy.output()).toContain(`upstream 127.0.0.1:${upstreamPort}`);
      expect(proxy.output()).not.toContain(credential);
      expect(proxy.output()).not.toContain('private request text');
      expect(proxy.output()).not.toContain('caller-value');
    } finally {
      if (proxy) await stop(proxy.child);
      upstream.closeAllConnections();
      await new Promise<void>(resolve => upstream.close(() => resolve()));
    }
  }, 20_000);

  it('keeps the requested model without an override and safely reports an unreachable upstream', async () => {
    const models: unknown[] = [];
    const upstream = createServer(async (request, response) => {
      const chunks: Buffer[] = [];
      for await (const chunk of request) chunks.push(Buffer.from(chunk));
      models.push(JSON.parse(Buffer.concat(chunks).toString()).model);
      response.end('{}');
    });
    const port = await listen(upstream);
    const proxy = await startProxy({ LLM_API_KEY: 'synthetic-test-value', LLM_MODEL: '', LLM_BASE_URL: `http://127.0.0.1:${port}/v1` });
    try {
      const response = await fetch(`${proxy.base}/v1/chat/completions`, { method: 'POST', body: '{"model":"requested"}' });
      await response.text();
      expect(models).toEqual(['requested']);
      upstream.closeAllConnections();
      await new Promise<void>(resolve => upstream.close(() => resolve()));
      const failure = await fetch(`${proxy.base}/v1/chat/completions`, { method: 'POST', body: '{}' });
      expect(failure.status).toBe(502);
      expect(failure.headers.get('access-control-allow-origin')).toBe('*');
      expect(await failure.text()).not.toContain('synthetic-test-value');
    } finally {
      await stop(proxy.child);
      if (upstream.listening) {
        upstream.closeAllConnections();
        await new Promise<void>(resolve => upstream.close(() => resolve()));
      }
    }
  }, 20_000);

  it('exits clearly when the required environment key is missing', async () => {
    const child = spawn(process.execPath, [script], { env: { ...process.env, LLM_API_KEY: '' }, windowsHide: true });
    let output = '';
    child.stdout.on('data', chunk => { output += String(chunk); });
    child.stderr.on('data', chunk => { output += String(chunk); });
    const code = await new Promise<number | null>((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', resolve);
    });
    expect(code).toBe(1);
    expect(output).toContain('LLM_API_KEY is required');
  });
});
