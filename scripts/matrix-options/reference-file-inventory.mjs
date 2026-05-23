#!/usr/bin/env node
import { readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);

function readRepeatedArg(name) {
  const values = [];
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === name && args[index + 1]) {
      values.push(args[index + 1]);
      index += 1;
    }
  }
  return values;
}

function readArg(name) {
  const index = args.indexOf(name);
  if (index === -1) return null;
  return args[index + 1] ?? null;
}

function hasFlag(name) {
  return args.includes(name);
}

function usage() {
  return [
    'Usage:',
    '  node scripts/matrix-options/reference-file-inventory.mjs --root "G:\\My Drive\\..." --root "C:\\Users\\..." [--out .tmp_reference_inventory.json]',
    '',
    'Or set MATRIX_REFERENCE_ROOTS to a semicolon-separated list of roots.',
    '',
    'This script records file metadata only. It does not copy, move, hash, or open source files.',
  ].join('\n');
}

async function walk(root, base = root, files = []) {
  const entries = await readdir(root, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, base, files);
      continue;
    }
    if (!entry.isFile()) continue;
    const info = await stat(fullPath);
    files.push({
      source_root: base,
      relative_path: path.relative(base, fullPath),
      name: entry.name,
      extension: path.extname(entry.name).toLowerCase(),
      size_bytes: info.size,
      modified_at: info.mtime.toISOString(),
    });
  }
  return files;
}

function summarize(files) {
  const byExtension = new Map();
  const byName = new Map();
  for (const file of files) {
    byExtension.set(file.extension, (byExtension.get(file.extension) ?? 0) + 1);
    const normalizedName = file.name.toLowerCase();
    const list = byName.get(normalizedName) ?? [];
    list.push(file);
    byName.set(normalizedName, list);
  }

  return {
    total_files: files.length,
    by_extension: Object.fromEntries(
      [...byExtension.entries()].sort((a, b) => a[0].localeCompare(b[0])),
    ),
    repeated_names: [...byName.entries()]
      .filter((entry) => entry[1].length > 1)
      .map(([name, matches]) => ({
        name,
        count: matches.length,
        locations: matches.map((match) => match.relative_path),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
  };
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    console.log(usage());
    return;
  }

  const envRoots = (process.env.MATRIX_REFERENCE_ROOTS ?? '')
    .split(';')
    .map((root) => root.trim())
    .filter(Boolean);
  const roots = [...readRepeatedArg('--root'), ...envRoots];
  if (roots.length === 0) {
    throw new Error('At least one --root value or MATRIX_REFERENCE_ROOTS is required.');
  }

  const rootResults = [];
  for (const root of roots) {
    const files = await walk(root, root, []);
    rootResults.push({
      root,
      summary: summarize(files),
      files,
    });
  }
  const allFiles = rootResults.flatMap((rootResult) => rootResult.files);

  const payload = {
    inventoried_at: new Date().toISOString(),
    policy: 'metadata_only_no_source_file_copy',
    overall_summary: summarize(allFiles),
    roots: rootResults,
  };
  const out = readArg('--out');
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  if (out) {
    await writeFile(out, json, 'utf8');
    console.log(`Wrote reference inventory: ${out}`);
  } else {
    for (const rootResult of rootResults) {
      console.log(rootResult.root);
      console.log(JSON.stringify(rootResult.summary, null, 2));
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  console.error('');
  console.error(usage());
  process.exit(1);
});
