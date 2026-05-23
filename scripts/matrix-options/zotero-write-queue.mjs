#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);

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
    '  node scripts/matrix-options/zotero-write-queue.mjs --queue <queue.json> [--dedupe-export .tmp_zotero_items_all_with_children.json] [--out .tmp_zotero_write_plan.json]',
    '  node scripts/matrix-options/zotero-write-queue.mjs --queue <queue.json> --execute [--dedupe-export .tmp_zotero_items_all_with_children.json] [--idempotency-key <value>] [--out .tmp_zotero_write_result.json]',
    '',
    'Environment variables required only with --execute:',
    '  ZOTERO_LIBRARY_TYPE=user|group',
    '  ZOTERO_LIBRARY_ID=<numeric user or group id>',
    '  ZOTERO_API_KEY=<API key with write access>',
    '',
    '--execute requires --dedupe-export unless --allow-duplicates is explicit.',
    '',
    'Default mode is dry-run. This script writes Zotero item metadata only.',
    'It does not download, upload, or attach source files.',
  ].join('\n');
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function normalizeUrl(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  try {
    const url = new URL(raw);
    url.hash = '';
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch {
    return raw.replace(/\/$/, '').toLowerCase();
  }
}

function toZoteroTags(tags) {
  return [...new Set(tags.filter(Boolean))].map((tag) => ({ tag }));
}

function buildItem(queue, entry) {
  const item = { ...entry.item };
  const queueCollections = Array.isArray(queue.target_collection_keys)
    ? queue.target_collection_keys
    : [];
  const itemCollections = Array.isArray(item.collections)
    ? item.collections
    : [];
  const defaultTags = Array.isArray(queue.default_tags)
    ? queue.default_tags
    : [];
  const itemTags = Array.isArray(item.tags) ? item.tags : [];

  item.collections = [...new Set([...queueCollections, ...itemCollections])];
  item.tags = toZoteroTags([...defaultTags, ...itemTags]);
  return item;
}

function loadDedupeRecords(exportPayload) {
  if (!exportPayload) return [];
  const items = Array.isArray(exportPayload.items) ? exportPayload.items : [];
  return items.filter((item) => item.itemType !== 'attachment');
}

function findDuplicate(candidate, existingRecords) {
  const candidateUrl = normalizeUrl(candidate.url);
  const candidateTitle = normalizeText(candidate.title);
  return existingRecords.find((record) => {
    const recordUrl = normalizeUrl(record.url);
    const recordTitle = normalizeText(record.title);
    if (candidateUrl && recordUrl && candidateUrl === recordUrl) return true;
    return candidateTitle && recordTitle && candidateTitle === recordTitle;
  });
}

async function readJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

async function postItems({
  libraryType,
  libraryId,
  apiKey,
  idempotencyKey,
  items,
}) {
  const libraryPrefix =
    libraryType === 'group' ? `groups/${libraryId}` : `users/${libraryId}`;
  const response = await fetch(`https://api.zotero.org/${libraryPrefix}/items`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Zotero-API-Key': apiKey,
      'Zotero-API-Version': '3',
      'Zotero-Write-Token': idempotencyKey,
    },
    body: JSON.stringify(items),
  });
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { raw: text };
  }
  if (!response.ok) {
    throw new Error(
      `Zotero write failed: ${response.status} ${response.statusText}\n${text}`,
    );
  }
  return {
    status: response.status,
    last_modified_version: response.headers.get('Last-Modified-Version'),
    body,
  };
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    console.log(usage());
    return;
  }

  const queuePath = readArg('--queue');
  if (!queuePath) throw new Error('--queue is required.');

  const execute = hasFlag('--execute');
  const allowDuplicates = hasFlag('--allow-duplicates');
  const queue = await readJson(queuePath);
  const dedupePath = readArg('--dedupe-export');
  if (execute && !dedupePath && !allowDuplicates) {
    throw new Error(
      '--dedupe-export is required with --execute unless --allow-duplicates is set.',
    );
  }
  const dedupePayload = dedupePath ? await readJson(dedupePath) : null;
  const existingRecords = loadDedupeRecords(dedupePayload);

  const entries = Array.isArray(queue.items) ? queue.items : [];
  if (entries.length === 0) throw new Error('Queue has no items.');
  if (entries.length > 50) {
    throw new Error('Zotero accepts at most 50 created items per request.');
  }

  const prepared = entries.map((entry, index) => {
    const item = buildItem(queue, entry);
    const duplicate = findDuplicate(item, existingRecords);
    return {
      index,
      source_id: entry.source_id ?? null,
      title: item.title,
      url: item.url ?? null,
      collections: item.collections,
      tags: item.tags.map((tag) => tag.tag),
      duplicate: duplicate
        ? {
            key: duplicate.key,
            title: duplicate.title,
            url: duplicate.url,
          }
        : null,
      item,
    };
  });

  const toCreate = prepared.filter(
    (entry) => allowDuplicates || !entry.duplicate,
  );
  const plan = {
    queue_id: queue.queue_id ?? null,
    dry_run: !execute,
    queue_path: queuePath,
    dedupe_export: dedupePath,
    total_entries: prepared.length,
    create_count: toCreate.length,
    skipped_as_duplicates: prepared.length - toCreate.length,
    target_collection_keys: queue.target_collection_keys ?? [],
    entries: prepared.map(({ item, ...entry }) => entry),
  };

  if (!execute) {
    const out = readArg('--out');
    const json = `${JSON.stringify(plan, null, 2)}\n`;
    if (out) {
      await writeFile(out, json, 'utf8');
      console.log(`Wrote Zotero write dry-run plan: ${out}`);
    } else {
      process.stdout.write(json);
    }
    return;
  }

  const libraryType = requiredEnv('ZOTERO_LIBRARY_TYPE');
  const libraryId = requiredEnv('ZOTERO_LIBRARY_ID');
  const apiKey = requiredEnv('ZOTERO_API_KEY');
  if (queue.library_type && queue.library_type !== libraryType) {
    throw new Error(
      `Queue library_type ${queue.library_type} does not match env ${libraryType}.`,
    );
  }
  if (queue.library_id && String(queue.library_id) !== libraryId) {
    throw new Error(
      `Queue library_id ${queue.library_id} does not match env ${libraryId}.`,
    );
  }
  if (toCreate.length === 0) {
    console.log('No Zotero items to create after duplicate filtering.');
    return;
  }

  const idempotencyKey =
    readArg('--idempotency-key') ??
    queue.batch_id ??
    randomBytes(8).toString('hex');
  const writeResult = await postItems({
    libraryType,
    libraryId,
    apiKey,
    idempotencyKey,
    items: toCreate.map((entry) => entry.item),
  });
  const result = {
    ...plan,
    dry_run: false,
    batch_id: idempotencyKey,
    write_result: writeResult,
  };
  const out = readArg('--out');
  const json = `${JSON.stringify(result, null, 2)}\n`;
  if (out) {
    await writeFile(out, json, 'utf8');
    console.log(`Wrote Zotero write result: ${out}`);
  } else {
    process.stdout.write(json);
  }
}

main().catch((error) => {
  console.error(error.message);
  console.error('');
  console.error(usage());
  process.exit(1);
});
