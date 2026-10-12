/* A localhost-only Supabase fixture and reverse proxy for the native paper E2E. */
/* eslint-disable @typescript-eslint/no-require-imports */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const USER = Object.freeze({
  id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated',
  email: 'native-local@example.test', email_confirmed_at: '2026-01-01T00:00:00Z',
  app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {},
  is_anonymous: false, created_at: '2026-01-01T00:00:00Z',
});
const b64 = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
const TOKEN = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: USER.id, role: 'authenticated', is_anonymous: false, exp: 4102444800 })}.local`;
const TOKEN_RESPONSE = { access_token: TOKEN, token_type: 'bearer', expires_in: 3600,
  expires_at: 4102444800, refresh_token: 'local-refresh-token', user: USER };

function sendJson(response, data, status = 200) {
  const body = JSON.stringify(data);
  response.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(body),
    'content-range': '0-0/1', 'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization,apikey,content-type,x-client-info' });
  response.end(body);
}

function assetRows(root) {
  const sources = [
    ['v0.9.91/presentation.md', 'presentation.md', 'text/markdown'],
    ['v0.9.91/figures/native-figure-models.json', 'figures/native-figure-models.json', 'application/json'],
    ['v0.9.91/appendix_l_media/image1.png', 'appendix_l_media/image1.png', 'image/png'],
  ];
  return new Map(sources.map(([key, relative, mime]) => {
    const bytes = fs.readFileSync(path.join(root, 'v0.9.91', ...relative.split('/')));
    return [key, { asset_path: key, document_version: 'v0.9.91', byte_length: bytes.length,
      sha256: crypto.createHash('sha256').update(bytes).digest('hex'), mime_type: mime,
      payload: `\\x${bytes.toString('hex')}` }];
  }));
}

function startNativeLocalProxy({ outerPort, innerPort, root }) {
  const rows = assetRows(root);
  const sockets = new Set();
  const server = http.createServer((request, response) => {
    const url = new URL(request.url || '/', `http://127.0.0.1:${outerPort}`);
    if (url.pathname === '/__native_local_health') return sendJson(response, { ok: true });
    if (url.pathname.startsWith('/auth/v1/')) {
      if (url.pathname === '/auth/v1/token') return sendJson(response, TOKEN_RESPONSE);
      if (url.pathname === '/auth/v1/user') {
        if (request.headers.authorization !== `Bearer ${TOKEN}`) return sendJson(response, { message: 'local auth required' }, 401);
        return sendJson(response, USER);
      }
      if (url.pathname === '/auth/v1/logout') { response.writeHead(204); return response.end(); }
      return sendJson(response, { message: 'unhandled local auth request' }, 404);
    }
    if (url.pathname === '/rest/v1/matrix_paper_private_assets_v0991_native_v1') {
      if (request.headers.authorization !== `Bearer ${TOKEN}`) return sendJson(response, { message: 'local auth required' }, 401);
      const filter = url.searchParams.get('asset_path') || '';
      const row = rows.get(filter.startsWith('eq.') ? filter.slice(3) : '');
      if (!row) return sendJson(response, []);
      const columns = (url.searchParams.get('select') || '').split(',');
      return sendJson(response, [Object.fromEntries(columns.map((column) => [column, row[column]]))]);
    }
    if (url.pathname.startsWith('/rest/v1/')) return sendJson(response, []);
    if (url.pathname.startsWith('/storage/v1/')) return sendJson(response, { message: 'not in native delivery' }, 404);

    const upstream = http.request({ hostname: '127.0.0.1', port: innerPort, method: request.method,
      path: request.url, headers: { ...request.headers, host: `127.0.0.1:${innerPort}` } }, (upstreamResponse) => {
      response.writeHead(upstreamResponse.statusCode || 502, upstreamResponse.headers);
      upstreamResponse.on('error', () => response.destroy());
      response.on('error', () => upstreamResponse.destroy());
      upstreamResponse.pipe(response);
    });
    upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
    request.on('error', () => upstream.destroy());
    request.pipe(upstream);
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.once('close', () => sockets.delete(socket));
  });
  server.closeOwnedConnections = () => { for (const socket of sockets) socket.destroy(); };
  server.on('upgrade', (request, socket, head) => {
    const upstream = http.request({ hostname: '127.0.0.1', port: innerPort,
      path: request.url, headers: { ...request.headers, host: `127.0.0.1:${innerPort}` } });
    upstream.on('upgrade', (upstreamResponse, upstreamSocket, upstreamHead) => {
      socket.on('error', () => upstreamSocket.destroy());
      upstreamSocket.on('error', () => socket.destroy());
      socket.write(`HTTP/1.1 101 Switching Protocols\r\n${Object.entries(upstreamResponse.headers).map(([key, value]) => `${key}: ${value}`).join('\r\n')}\r\n\r\n`);
      if (upstreamHead.length) socket.write(upstreamHead);
      if (head.length) upstreamSocket.write(head);
      socket.pipe(upstreamSocket).pipe(socket);
    });
    upstream.on('error', () => socket.destroy());
    upstream.end();
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(outerPort, '127.0.0.1', () => resolve(server));
  });
}

module.exports = { startNativeLocalProxy };
