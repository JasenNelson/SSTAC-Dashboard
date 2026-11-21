#!/usr/bin/env node
// Matrix R2 local full-stack preview: one loopback origin for the app and the local Supabase stack.
//
// The app's Content-Security-Policy (src/middleware.ts, protected) allows browser connections only to
// 'self' and https://*.supabase.co. The preview therefore serves Supabase API paths from the app's own
// origin, as the native local e2e runtime does (e2e/fixtures/native-local-proxy.cjs): requests for
// /auth/v1, /rest/v1, /storage/v1, /graphql/v1 and /functions/v1 go to the local Supabase API; every
// other request goes to `next start` on an inner loopback port, which this process starts and owns.
//
//   node same-origin-proxy.mjs --outer 3210 --inner 3211 --supabase http://127.0.0.1:55421 --app <previewWorktree>
import { spawn } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';

const args = Object.fromEntries(process.argv.slice(2).reduce((pairs, value, index, all) => (index % 2 === 0 ? [...pairs, [value.replace(/^--/, ''), all[index + 1]]] : pairs), []));
const outer = Number(args.outer);
const inner = Number(args.inner);
const supabase = new URL(args.supabase ?? '');
if (!Number.isInteger(outer) || !Number.isInteger(inner) || outer === inner) throw new Error('outer and inner ports are required and must differ');
if (supabase.protocol !== 'http:' || supabase.hostname !== '127.0.0.1') throw new Error('the local Supabase API must be loopback http');
if (!args.app || !path.isAbsolute(args.app)) throw new Error('--app must be the absolute preview worktree');

const SUPABASE_PREFIXES = ['/auth/v1/', '/rest/v1/', '/storage/v1/', '/graphql/v1/', '/functions/v1/'];
// The served app gets an explicit environment: OS basics plus the five preview values. Nothing from
// the user's registry environment (provider keys, Redis, Sentry, Vercel) can reach it.
const OS_NAMES = new Set(['path', 'pathext', 'systemroot', 'windir', 'comspec', 'temp', 'tmp', 'userprofile', 'appdata', 'localappdata',
  'homedrive', 'homepath', 'number_of_processors', 'processor_architecture', 'os', 'programdata', 'programfiles', 'programfiles(x86)', 'commonprogramfiles']);
const PREVIEW_NAMES = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'MATRIX_R2_GUIDED_REVIEW_UI', 'NEXT_TELEMETRY_DISABLED', 'NODE_ENV'];
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([name]) => OS_NAMES.has(name.toLowerCase())));
for (const name of PREVIEW_NAMES) {
  if (!process.env[name]) throw new Error(`preview value ${name} is missing`);
  childEnv[name] = process.env[name];
}
const appSupabase = new URL(childEnv.NEXT_PUBLIC_SUPABASE_URL);
if (appSupabase.hostname !== '127.0.0.1' || Number(appSupabase.port) !== outer) throw new Error('NEXT_PUBLIC_SUPABASE_URL must be this proxy origin');
const next = spawn(process.execPath, [path.join(args.app, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-H', '127.0.0.1', '-p', String(inner)], { cwd: args.app, env: childEnv, stdio: 'inherit' });
next.on('exit', (code) => { console.error(`[r2-proxy] next exited (${code})`); process.exit(code ?? 1); });
const stop = () => { try { next.kill(); } catch { /* already gone */ } process.exit(0); };
process.on('SIGINT', stop);
process.on('SIGTERM', stop);

const server = http.createServer((request, response) => {
  const toSupabase = SUPABASE_PREFIXES.some((prefix) => (request.url ?? '').startsWith(prefix));
  const target = toSupabase ? { hostname: supabase.hostname, port: Number(supabase.port) } : { hostname: '127.0.0.1', port: inner };
  const headers = { ...request.headers, host: `${target.hostname}:${target.port}` };
  if (!toSupabase) { headers['x-forwarded-host'] = request.headers.host ?? `127.0.0.1:${outer}`; headers.host = request.headers.host ?? `127.0.0.1:${outer}`; }
  const upstream = http.request({ ...target, method: request.method, path: request.url, headers }, (reply) => {
    response.writeHead(reply.statusCode ?? 502, reply.headers);
    reply.pipe(response);
  });
  upstream.on('error', () => { if (!response.headersSent) response.writeHead(502); response.end(); });
  request.pipe(upstream);
});
server.listen(outer, '127.0.0.1', () => console.log(`[r2-proxy] http://127.0.0.1:${outer} -> next 127.0.0.1:${inner}, supabase ${supabase.origin}`));
