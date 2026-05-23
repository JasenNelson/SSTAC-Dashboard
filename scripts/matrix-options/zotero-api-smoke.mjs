#!/usr/bin/env node
import { writeFile } from 'node:fs/promises';

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
    '  node scripts/matrix-options/zotero-api-smoke.mjs [--collection KEY] [--limit N] [--all] [--include-children] [--out .tmp_zotero_items.json]',
    '  node scripts/matrix-options/zotero-api-smoke.mjs --collections [--out .tmp_zotero_collections.json]',
    '',
    'Required environment variables:',
    '  ZOTERO_LIBRARY_TYPE=user|group',
    '  ZOTERO_LIBRARY_ID=<numeric user or group id>',
    '  ZOTERO_API_KEY=<read-only API key>',
    '',
    'This script exports Zotero item metadata only. It does not download PDFs or attachments.',
  ].join('\n');
}

function requiredEnv(name) {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value.trim();
}

function normalizeCreator(creator) {
  if (!creator || typeof creator !== 'object') return null;
  const creatorType = creator.creatorType ?? 'creator';
  const name =
    creator.name ??
    [creator.firstName, creator.lastName].filter(Boolean).join(' ').trim();
  return name ? { creatorType, name } : null;
}

function normalizeItem(item) {
  const data = item.data ?? {};
  return {
    key: item.key ?? data.key ?? null,
    version: item.version ?? data.version ?? null,
    itemType: data.itemType ?? null,
    title: data.title ?? null,
    creators: Array.isArray(data.creators)
      ? data.creators.map(normalizeCreator).filter(Boolean)
      : [],
    date: data.date ?? null,
    publicationTitle: data.publicationTitle ?? null,
    publisher: data.publisher ?? null,
    DOI: data.DOI ?? null,
    url: data.url ?? null,
    abstractNote: data.abstractNote ?? null,
    collections: Array.isArray(data.collections) ? data.collections : [],
    tags: Array.isArray(data.tags)
      ? data.tags.map((tag) => tag.tag).filter(Boolean)
      : [],
    relations: data.relations ?? {},
    attachmentMeta:
      data.itemType === 'attachment'
        ? {
            parentItem: data.parentItem ?? null,
            linkMode: data.linkMode ?? null,
            contentType: data.contentType ?? null,
            filename: data.filename ?? null,
          }
        : null,
  };
}

function normalizeCollection(collection) {
  const data = collection.data ?? {};
  return {
    key: collection.key ?? data.key ?? null,
    version: collection.version ?? data.version ?? null,
    name: data.name ?? null,
    parentCollection: data.parentCollection ?? null,
    relations: data.relations ?? {},
  };
}

async function fetchZoteroJson(url, apiKey) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Zotero-API-Version': '3',
    },
  });

  if (!response.ok) {
    throw new Error(
      `Zotero API request failed: ${response.status} ${response.statusText}`,
    );
  }

  const records = await response.json();
  return {
    records: Array.isArray(records) ? records : [],
    totalResults: Number(response.headers.get('Total-Results') ?? '0'),
  };
}

async function main() {
  if (hasFlag('--help') || hasFlag('-h')) {
    console.log(usage());
    return;
  }

  const libraryType = requiredEnv('ZOTERO_LIBRARY_TYPE');
  const libraryId = requiredEnv('ZOTERO_LIBRARY_ID');
  const apiKey = requiredEnv('ZOTERO_API_KEY');
  if (!['user', 'group'].includes(libraryType)) {
    throw new Error('ZOTERO_LIBRARY_TYPE must be "user" or "group".');
  }

  const collectionKey =
    readArg('--collection') ?? process.env.ZOTERO_COLLECTION_KEY ?? null;
  const limit = Number(readArg('--limit') ?? '100');
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new Error('--limit must be an integer from 1 to 100.');
  }
  const exportAll = hasFlag('--all');
  const includeChildren = hasFlag('--include-children');
  const exportCollections = hasFlag('--collections');

  const libraryPrefix =
    libraryType === 'group' ? `groups/${libraryId}` : `users/${libraryId}`;
  const itemPath = collectionKey
    ? `collections/${collectionKey}/items${includeChildren ? '' : '/top'}`
    : `items${includeChildren ? '' : '/top'}`;
  const resourcePath = exportCollections ? 'collections' : itemPath;
  const url = new URL(`https://api.zotero.org/${libraryPrefix}/${resourcePath}`);
  url.searchParams.set('format', 'json');
  url.searchParams.set('limit', String(limit));
  if (!exportCollections) {
    url.searchParams.set('sort', 'dateModified');
    url.searchParams.set('direction', 'desc');
  }

  const allRecords = [];
  let totalResults = 0;
  let start = 0;
  do {
    url.searchParams.set('start', String(start));
    const page = await fetchZoteroJson(url, apiKey);
    totalResults = page.totalResults;
    allRecords.push(...page.records);
    start += limit;
    console.error(
      `Fetched ${allRecords.length}${totalResults ? ` of ${totalResults}` : ''} Zotero ${exportCollections ? 'collections' : 'items'}`,
    );
    if (page.records.length < limit) break;
  } while (exportAll && (totalResults === 0 || allRecords.length < totalResults));

  const payload = {
    exported_at: new Date().toISOString(),
    library_type: libraryType,
    library_id: libraryId,
    collection_key: collectionKey,
    resource: exportCollections ? 'collections' : 'items',
    include_children: includeChildren,
    source_url: url.toString().replace(apiKey, '[redacted]'),
    count: allRecords.length,
    total_results: totalResults,
    items: exportCollections ? [] : allRecords.map(normalizeItem),
    collections: exportCollections
      ? allRecords.map(normalizeCollection)
      : [],
  };

  const out = readArg('--out');
  const json = `${JSON.stringify(payload, null, 2)}\n`;
  if (out) {
    await writeFile(out, json, 'utf8');
    console.log(`Wrote Zotero metadata export: ${out}`);
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
