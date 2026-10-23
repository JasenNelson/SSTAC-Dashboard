// Transitive src/ import closure of the Jermilova viewer, by entrypoint-based
// TypeScript module resolution (not tsc --listFilesOnly: the viewer tsconfig
// includes all of ../../src, so a file listing is not a transitive closure).
//
//   node viewers/jermilova-public/scripts/src-closure.mjs --write <base-commit>
//       resolve the live closure, verify every entry's bytes equal the Git blob at
//       <base-commit>, and write src-closure.json
//   node viewers/jermilova-public/scripts/src-closure.mjs --check
//       resolve the live closure and fail closed on any MISSING, EXTRA or CHANGED entry
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const viewerRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const repoRoot = path.resolve(viewerRoot, '../..');
export const closurePath = path.join(viewerRoot, 'src-closure.json');
const srcRoot = path.join(repoRoot, 'src') + path.sep;

// Originals the viewer forks. They must NOT be reachable as modules (the viewer
// imports the forks instead); they are pinned so a source change is detected.
export const FORK_ORIGINALS = {
  'forked/JermilovaBnrrmClient.tsx': 'src/app/(dashboard)/bn-rrm/BNRRMClient.tsx',
  'forked/Canvas.tsx': 'src/components/bn-rrm/canvas/Canvas.tsx',
  'forked/ResultsPanel.tsx': 'src/components/bn-rrm/panels/ResultsPanel.tsx',
  'forked/SiteMap.tsx': 'src/components/bn-rrm/map/SiteMap.tsx',
  'forked/SiteDetails.tsx': 'src/components/bn-rrm/map/SiteDetails.tsx',
  'forked/siteDataStore.ts': 'src/stores/bn-rrm/siteDataStore.ts',
  'forked/networkStore.ts': 'src/stores/bn-rrm/networkStore.ts',
};

// The viewer stylesheet imports the authenticated app's stylesheet (CSS, not TS).
const CSS_SOURCES = ['src/app/globals.css'];

const ENTRY_DIRS = ['app', 'components', 'forked', 'lib'];
const posix = (p) => p.split(path.sep).join('/');
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

function compilerOptions() {
  const parsed = ts.getParsedCommandLineOfConfigFile(path.join(viewerRoot, 'tsconfig.json'), {}, {
    ...ts.sys,
    onUnRecoverableConfigFileDiagnostic: (d) => {
      throw new Error(ts.flattenDiagnosticMessageText(d.messageText, '\n'));
    },
  });
  if (!parsed) throw new Error('Viewer tsconfig could not be parsed.');
  return parsed.options;
}

function entryFiles() {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts')) out.push(full);
    }
  };
  for (const d of ENTRY_DIRS) {
    const dir = path.join(viewerRoot, d);
    if (fs.existsSync(dir)) walk(dir);
  }
  return out.sort();
}

const isTestFile = (f) => /\.test\.(ts|tsx)$/.test(f);

export function resolveClosure() {
  const options = compilerOptions();
  const all = entryFiles();
  // Product graph (non-test entries) decides what the viewer ships; tests may also
  // import the fork originals to prove parity, so they are walked separately.
  const product = walk(options, all.filter((f) => !isTestFile(f)));
  const withTests = walk(options, all);

  const originals = Object.values(FORK_ORIGINALS);
  const leaked = product.modules.filter((m) => originals.includes(m));
  if (leaked.length) throw new Error('Forked originals are reachable from product code: ' + leaked.join(', '));

  const entries = [];
  const add = (rel, role) => {
    const bytes = fs.readFileSync(path.join(repoRoot, ...rel.split('/')));
    entries.push({ path: rel, role, bytes: bytes.length, sha256: sha256(bytes) });
  };
  for (const m of product.modules) add(m, 'module');
  for (const m of withTests.modules) {
    if (!product.modules.includes(m) && !originals.includes(m)) add(m, 'test-module');
  }
  for (const o of [...originals].sort()) add(o, 'fork-original');
  for (const c of CSS_SOURCES) add(c, 'stylesheet');
  return { entries, external: [...new Set([...product.external, ...withTests.external])].sort() };
}

function walk(options, entries) {
  const seen = new Set();
  const srcFiles = new Set();
  const external = new Set();
  const queue = [...entries];
  while (queue.length) {
    const file = queue.pop();
    if (seen.has(file)) continue;
    seen.add(file);
    if (file.endsWith('.json')) continue;
    const info = ts.preProcessFile(fs.readFileSync(file, 'utf8'), true, true);
    for (const ref of info.importedFiles) {
      const spec = ref.fileName;
      const resolved = ts.resolveModuleName(spec, file, options, ts.sys).resolvedModule;
      if (!resolved) {
        // Local CSS side-effect imports are resolved by path and must exist.
        if (/\.css$/.test(spec) && (spec.startsWith('.') || spec.startsWith('@/'))) {
          const cssPath = spec.startsWith('@/')
            ? path.join(repoRoot, 'src', ...spec.slice(2).split('/'))
            : path.resolve(path.dirname(file), spec);
          if (!fs.existsSync(cssPath)) {
            throw new Error(`Missing local stylesheet '${spec}' in ${posix(path.relative(repoRoot, file))}`);
          }
          if (cssPath.startsWith(srcRoot)) srcFiles.add(cssPath);
          continue;
        }
        // Package subpaths (CSS side-effect imports such as leaflet/dist/leaflet.css)
        // may stay unresolved; any other relative or @/ specifier fails closed.
        if (spec.startsWith('.') || spec.startsWith('@/')) {
          throw new Error(`Unresolved local import '${spec}' in ${posix(path.relative(repoRoot, file))}`);
        }
        external.add(spec);
        continue;
      }
      const target = path.resolve(resolved.resolvedFileName);
      if (resolved.isExternalLibraryImport || target.includes(`${path.sep}node_modules${path.sep}`)) {
        external.add(spec);
        continue;
      }
      if (target.startsWith(srcRoot)) srcFiles.add(target);
      else if (!target.startsWith(viewerRoot + path.sep)) {
        throw new Error(`Import escapes viewer and src: ${posix(target)}`);
      }
      queue.push(target);
    }
  }

  return {
    modules: [...srcFiles].map((f) => posix(path.relative(repoRoot, f))).sort(),
    external: [...external],
  };
}

function gitBlob(commit, rel) {
  return execFileSync('git', ['-C', repoRoot, 'show', `${commit}:${rel}`], { maxBuffer: 64 * 1024 * 1024 });
}

export function compareClosure(pinned, live) {
  const byPath = (list) => new Map(list.map((e) => [e.path, e]));
  const p = byPath(pinned.entries);
  const l = byPath(live.entries);
  const missing = [...p.keys()].filter((k) => !l.has(k));
  const extra = [...l.keys()].filter((k) => !p.has(k));
  const changed = [...p.keys()].filter((k) => {
    const a = p.get(k);
    const b = l.get(k);
    return b && (a.sha256 !== b.sha256 || a.bytes !== b.bytes || a.role !== b.role);
  });
  // A new or dropped package import is a dependency change too, even with no src/ change.
  const pinnedExternal = new Set(pinned.external_specifiers ?? []);
  const liveExternal = new Set(live.external ?? []);
  const externalAdded = [...liveExternal].filter((s) => !pinnedExternal.has(s)).sort();
  const externalRemoved = [...pinnedExternal].filter((s) => !liveExternal.has(s)).sort();
  return {
    missing,
    extra,
    changed,
    externalAdded,
    externalRemoved,
    ok: !missing.length && !extra.length && !changed.length && !externalAdded.length && !externalRemoved.length,
  };
}

function main() {
  const [mode, base] = process.argv.slice(2);
  const live = resolveClosure();
  if (mode === '--write') {
    if (!/^[0-9a-f]{40}$/.test(base || '')) throw new Error('--write needs the full 40-hex base commit.');
    for (const e of live.entries) {
      const blob = gitBlob(base, e.path);
      if (blob.length !== e.bytes || sha256(blob) !== e.sha256) {
        throw new Error(`Live bytes differ from ${base} for ${e.path}`);
      }
    }
    const doc = {
      schema_version: 'jermilova-viewer-src-closure-v1',
      base_commit: base,
      method: 'entrypoint TypeScript module resolution (ts.preProcessFile + ts.resolveModuleName, viewer tsconfig)',
      entry_dirs: ENTRY_DIRS,
      entry_count: live.entries.length,
      entries: live.entries,
      external_specifiers: live.external,
    };
    fs.writeFileSync(closurePath, JSON.stringify(doc, null, 2) + '\n');
    console.log(JSON.stringify({ wrote: posix(path.relative(repoRoot, closurePath)), entries: live.entries.length }));
    return;
  }
  if (mode === '--check') {
    const pinned = JSON.parse(fs.readFileSync(closurePath, 'utf8'));
    const result = compareClosure(pinned, live);
    console.log(JSON.stringify(result));
    if (!result.ok) process.exitCode = 1;
    return;
  }
  throw new Error('Usage: src-closure.mjs --write <base-commit> | --check');
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
