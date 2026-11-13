import { createServer } from 'node:http';

const apiKey = process.env.LLM_API_KEY?.trim();
if (!apiKey) {
  console.error('LLM_API_KEY is required. Set it in the environment before starting the proxy.');
  process.exit(1);
}

let upstream;
try {
  const base = new URL(process.env.LLM_BASE_URL || 'https://api.deepseek.com/v1');
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error();
  }
  upstream = new URL(`${base.href.replace(/\/+$/, '')}/chat/completions`);
} catch {
  console.error('LLM_BASE_URL must be an HTTP or HTTPS base URL without credentials, query or fragment.');
  process.exit(1);
}

const port = Number(process.env.PORT ?? 8787);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('PORT must be an integer between 0 and 65535.');
  process.exit(1);
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};
const bodyLimit = 1024 * 1024;

function readBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let oversized = false;
    request.on('data', chunk => {
      size += chunk.length;
      if (oversized) return;
      if (size > bodyLimit) {
        oversized = true;
        chunks.length = 0;
        reject(new Error('body_limit'));
        return;
      }
      chunks.push(chunk);
    });
    request.on('end', () => {
      if (!oversized) resolve(Buffer.concat(chunks).toString('utf8'));
    });
    request.on('error', () => reject(new Error('body_read')));
    request.on('aborted', () => reject(new Error('body_read')));
  });
}

function respond(response, status, value) {
  response.writeHead(status, { ...corsHeaders, 'Content-Type': 'application/json' });
  response.end(JSON.stringify(value));
}

const server = createServer(async (request, response) => {
  if (request.method === 'OPTIONS') {
    response.writeHead(204, corsHeaders);
    response.end();
    return;
  }
  if (request.method === 'GET' && request.url === '/health') {
    respond(response, 200, { ok: true });
    return;
  }
  if (request.method !== 'POST' || request.url !== '/v1/chat/completions') {
    respond(response, 404, { error: 'Route not found.' });
    return;
  }

  let body;
  try {
    body = JSON.parse(await readBody(request));
    if (body === null || typeof body !== 'object' || Array.isArray(body)) throw new Error('json');
  } catch (error) {
    const oversized = error.message === 'body_limit';
    respond(response, oversized ? 413 : 400,
      { error: oversized ? 'Request body exceeds 1 MB.' : 'A valid JSON object is required.' });
    return;
  }
  if (process.env.LLM_MODEL) body.model = process.env.LLM_MODEL;

  try {
    const result = await fetch(upstream, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(body),
      redirect: 'error',
      signal: AbortSignal.timeout(30_000),
    });
    const bytes = Buffer.from(await result.arrayBuffer());
    response.writeHead(result.status, {
      ...corsHeaders, 'Content-Type': result.headers.get('content-type') || 'application/json',
    });
    response.end(bytes);
  } catch {
    respond(response, 502, { error: 'The upstream model endpoint could not be reached.' });
  }
});

server.requestTimeout = 30_000;
server.on('error', () => {
  console.error('The proxy could not bind its loopback port.');
  process.exitCode = 1;
});
server.listen(port, '127.0.0.1', () => {
  console.log(`LLM proxy listening on 127.0.0.1:${server.address().port} (upstream ${upstream.host})`);
});
