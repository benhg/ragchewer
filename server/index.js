import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');

const PORT = Number(process.env.CW_PORT || 8787);
const ENDPOINT = process.env.CW_LLM_ENDPOINT || '';
const API_KEY = process.env.CW_LLM_KEY || '';
const DEFAULT_MODEL = process.env.CW_LLM_MODEL || 'gpt-4o-mini';
const DEV_MODE = process.argv.includes('--dev');

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
    'Access-Control-Allow-Origin': '*'
  });
  res.end(body);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

async function handleChat(req, res) {
  if (!ENDPOINT || !API_KEY) {
    return sendJson(res, 500, { error: 'LLM proxy not configured.' });
  }

  let body;
  try {
    body = await readBody(req);
  } catch (error) {
    return sendJson(res, 400, { error: 'Invalid JSON body.' });
  }

  const payload = {
    model: body.model || DEFAULT_MODEL,
    messages: body.messages || [],
    max_tokens: body.max_tokens ?? 120,
    temperature: body.temperature ?? 0.7
  };

  try {
    const response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const text = await response.text();
    res.writeHead(response.status, {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    });
    res.end(text);
  } catch (error) {
    sendJson(res, 502, { error: 'LLM proxy request failed.' });
  }
}

async function serveStatic(req, res) {
  if (DEV_MODE) {
    res.writeHead(404);
    res.end('Not found');
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const requestPath = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = path.join(distDir, requestPath);

  try {
    const data = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    const contentType = ext === '.html'
      ? 'text/html'
      : ext === '.js'
        ? 'text/javascript'
        : ext === '.css'
          ? 'text/css'
          : 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  } catch (error) {
    if (requestPath !== '/index.html') {
      try {
        const fallback = await fs.readFile(path.join(distDir, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(fallback);
        return;
      } catch (fallbackError) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
    }
    res.writeHead(404);
    res.end('Not found');
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
    });
    res.end();
    return;
  }

  if (req.url?.startsWith('/api/chat') && req.method === 'POST') {
    await handleChat(req, res);
    return;
  }

  if (req.url?.startsWith('/api/status')) {
    sendJson(res, 200, { configured: Boolean(ENDPOINT && API_KEY), model: DEFAULT_MODEL });
    return;
  }

  if (req.url?.startsWith('/health')) {
    sendJson(res, 200, { ok: true });
    return;
  }

  await serveStatic(req, res);
});

server.listen(PORT, () => {
  console.log(`CW ragchewer server listening on ${PORT}`);
});
