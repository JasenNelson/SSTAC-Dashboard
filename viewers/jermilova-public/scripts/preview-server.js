'use strict';
/* eslint-disable @typescript-eslint/no-require-imports -- standalone CommonJS Node script; never bundled */
const http = require('node:http');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { createReadStream } = fs;
const root = path.resolve(process.argv[2]);
const port = Number(process.argv[3]);
const hardEnd = Number(process.argv[4]);
const maxBytes = 25000000;
const rootPrefix = root.endsWith(path.sep) ? root : root + path.sep;
let ending = false;
let rootReal = null;
const sockets = new Set();
function log(line) { process.stdout.write(line + '\n'); }
function sendError(res, status) {
  if (res.destroyed) return;
  if (!res.headersSent) res.writeHead(status, { 'Content-Length': '0', 'Connection': 'close', 'Cache-Control': 'no-store' });
  res.end();
}
function mime(file) {
  const ext = path.extname(file).toLowerCase();
  const values = {
    '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8', '.geojson': 'application/geo+json; charset=utf-8',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.woff': 'font/woff',
    '.woff2': 'font/woff2', '.ico': 'image/x-icon'
  };
  return values[ext] || 'application/octet-stream';
}
async function pathHasNoSymlink(full) {
  const parsed = path.parse(full);
  let cursor = parsed.root;
  const pieces = full.slice(parsed.root.length).split(path.sep).filter(Boolean);
  for (const piece of pieces) {
    cursor = path.join(cursor, piece);
    const info = await fsp.lstat(cursor);
    if (info.isSymbolicLink()) return false;
  }
  return true;
}
function isContained(rootPath, targetPath) {
  const resolvedRoot = path.resolve(rootPath);
  const resolvedTarget = path.resolve(targetPath);
  const prefix = resolvedRoot.endsWith(path.sep) ? resolvedRoot : resolvedRoot + path.sep;
  return resolvedTarget.toLowerCase().startsWith(prefix.toLowerCase());
}
async function route(req, res) {
  if (ending || Date.now() >= hardEnd) return sendError(res, 503);
  if (req.socket.remoteAddress !== '127.0.0.1') return sendError(res, 403);
  if (req.method !== 'GET' && req.method !== 'HEAD') return sendError(res, 405);
  if (req.headers['transfer-encoding'] || (req.headers['content-length'] && req.headers['content-length'] !== '0')) {
    req.destroy();
    return;
  }
  const raw = req.url;
  if (!raw || raw.length > 4096 || raw.includes('%') || raw.includes('\\') || raw.includes('..') || raw.includes(':') || raw.includes('?')) return sendError(res, 400);
  if (raw === '/Jermilova') {
    res.writeHead(308, { 'Location': '/Jermilova/', 'Content-Length': '0', 'Cache-Control': 'no-store' });
    return res.end();
  }
  let relative;
  if (raw === '/Jermilova/' || raw === '/Jermilova/index.html') relative = 'index.html';
  else if (raw.startsWith('/_next/')) relative = raw.slice(1);
  else if (raw.startsWith('/bn-rrm/')) relative = raw.slice(1);
  else if (raw === '/favicon.ico') relative = 'favicon.ico';
  else return sendError(res, 404);
  const pieces = relative.split('/');
  if (pieces.some(x => !x || x === '.' || x === '..')) return sendError(res, 400);
  const target = path.resolve(root, relative);
  const foldedTarget = target.toLowerCase();
  const foldedPrefix = rootPrefix.toLowerCase();
  if (!foldedTarget.startsWith(foldedPrefix)) return sendError(res, 404);
  try {
    if (!(await pathHasNoSymlink(root))) return sendError(res, 404);
    const rootStat = await fsp.lstat(root);
    if (!rootStat.isDirectory()) return sendError(res, 404);
    const currentRootReal = await fsp.realpath(root);
    if (!rootReal || currentRootReal.toLowerCase() !== rootReal.toLowerCase()) return sendError(res, 404);
    let cursor = root;
    for (let i = 0; i < pieces.length; i++) {
      cursor = path.join(cursor, pieces[i]);
      const info = await fsp.lstat(cursor);
      if (info.isSymbolicLink()) return sendError(res, 404);
      if (i < pieces.length - 1 && !info.isDirectory()) return sendError(res, 404);
      if (i === pieces.length - 1 && !info.isFile()) return sendError(res, 404);
    }
    const targetReal = await fsp.realpath(target);
    if (!isContained(currentRootReal, targetReal)) return sendError(res, 404);
    const info = await fsp.stat(targetReal);
    if (info.size > maxBytes) return sendError(res, 413);
    const remaining = hardEnd - Date.now();
    if (remaining <= 0) return sendError(res, 503);
    const headers = {
      'Content-Type': mime(targetReal), 'Content-Length': String(info.size),
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff'
    };
    res.writeHead(200, headers);
    if (req.method === 'HEAD') return res.end();
    const timeoutMs = Math.min(5000, remaining);
    let stream;
    let finished = false;
    const timer = setTimeout(() => {
      if (finished) return;
      if (stream) stream.destroy(new Error('response deadline exceeded'));
      res.destroy();
    }, timeoutMs);
    const stop = () => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      if (stream && !stream.destroyed) stream.destroy();
    };
    res.on('finish', stop);
    res.on('close', stop);
    res.on('error', stop);
    stream = createReadStream(targetReal, { highWaterMark: 65536 });
    stream.on('error', () => {
      if (!res.destroyed) res.destroy();
      stop();
    });
    stream.pipe(res);
  } catch (error) {
    if (!res.headersSent) sendError(res, error && error.code === 'ENOENT' ? 404 : 404);
    else if (!res.destroyed) res.destroy();
  }
}
const server = http.createServer({ maxHeaderSize: 16384 }, (req, res) => {
  route(req, res).catch(() => sendError(res, 500));
});
server.headersTimeout = 3000;
server.requestTimeout = 3000;
server.keepAliveTimeout = 1000;
server.maxHeadersCount = 32;
server.maxConnections = 32;
server.maxRequestsPerSocket = 4;
server.on('connection', socket => {
  sockets.add(socket);
  socket.setTimeout(5000, () => socket.destroy());
  socket.on('close', () => sockets.delete(socket));
});
server.on('clientError', (_error, socket) => {
  if (socket.writable) socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
  else socket.destroy();
});
server.on('error', error => {
  const code = String(error && (error.code || error.message) || 'SERVER_ERROR').replace(/[^\x20-\x7E]/g, '?');
  log('SERVER_ERROR ' + code);
  process.exit(73);
});
function stopAtDeadline() {
  if (ending) return;
  ending = true;
  server.close(() => process.exit(0));
  if (typeof server.closeAllConnections === 'function') server.closeAllConnections();
  const forceTimer = setTimeout(() => {
    for (const socket of sockets) socket.destroy();
    process.exit(0);
  }, 1000);
  forceTimer.unref();
}
const remaining = hardEnd - Date.now();
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535 || !Number.isSafeInteger(hardEnd) || remaining <= 0) {
  log('SERVER_ARGUMENTS_INVALID');
  process.exit(72);
}
const deadlineTimer = setTimeout(stopAtDeadline, remaining);
deadlineTimer.unref();
(async () => {
  if (!(await pathHasNoSymlink(root))) throw new Error('SERVER_ROOT_INVALID');
  const rootStat = await fsp.lstat(root);
  if (!rootStat.isDirectory()) throw new Error('SERVER_ROOT_INVALID');
  rootReal = await fsp.realpath(root);
  if (rootReal.toLowerCase() !== root.toLowerCase()) throw new Error('SERVER_ROOT_INVALID');
  server.listen({ port, host: '127.0.0.1', exclusive: true, backlog: 16 }, () => {
    const address = server.address();
    if (!address || typeof address === 'string' || address.address !== '127.0.0.1' || address.family !== 'IPv4' || address.port !== port) {
      log('SERVER_BIND_INVALID');
      server.closeAllConnections();
      server.close(() => process.exit(74));
      return;
    }
    log('SERVER_BOUND 127.0.0.1:' + port + ' family=IPv4');
  });
})().catch(() => { log('SERVER_ROOT_INVALID'); process.exit(75); });