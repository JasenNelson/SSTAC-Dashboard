#!/usr/bin/env node
// build-guidance-index.mjs
//
// Cheap, metadata-only index builder for the external Guidance reference corpus.
// Consumes the JSON emitted by reference-file-inventory.mjs (which records file
// metadata only -- name, extension, size, mtime, relative path -- and never opens,
// copies, or hashes a source file). This transform derives ONLY what the file path
// and filename already tell us:
//   - Category: the full relative folder path (e.g. HHRA/Health Canada), NOT just the
//     top segment. Files directly under the root use "(root)".
//   - Year:     the first 19xx/20xx run found in the filename, blank if none.
//   - Type:     the file extension (already lower-cased by the inventory script).
//   - Filename: the file name verbatim.
// Title and Subject are LEFT BLANK by design -- they cannot be derived without opening
// (reading / OCR / vision of) the source PDF, which this cheap lane explicitly does not do.
//
// Outputs:
//   --out-md   <path>  a human-readable markdown index grouped by Category (default deliverable)
//   --out-json <path>  the machine-readable derived records + summary
//   --master-append <path> (OPTIONAL) an append-block in the G:\ master-index column order
//     (Filename | Category | Year | Title | Subject | Type). Written ONLY when this flag is
//     passed -- the default run does not touch the external master index.
//
// This script reads ONE json file and writes text/markdown. It never opens a source PDF.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const args = process.argv.slice(2);
function readArg(name, fallback = null) {
  const i = args.indexOf(name);
  return i === -1 ? fallback : (args[i + 1] ?? fallback);
}

function toCategory(relativePath) {
  const segments = relativePath.split(/[\\/]/).filter(Boolean);
  segments.pop(); // drop the filename
  return segments.length ? segments.join('/') : '(root)';
}

function toYear(name) {
  const match = name.match(/(?:19|20)\d{2}/);
  return match ? match[0] : '';
}

function toType(extension) {
  return (extension || '').replace(/^\./, '').toUpperCase();
}

// Escape pipe/backtick so filenames cannot break the markdown table layout.
function mdCell(value) {
  return String(value).replace(/\|/g, '\\|');
}

function buildRecords(inventory) {
  const records = [];
  for (const rootResult of inventory.roots ?? []) {
    for (const file of rootResult.files ?? []) {
      const relativePath = file.relative_path.split(/[\\/]/).join('/');
      records.push({
        filename: file.name,
        category: toCategory(file.relative_path),
        year: toYear(file.name),
        type: toType(file.extension),
        extension: file.extension,
        relative_path: relativePath,
        is_pdf: file.extension === '.pdf',
        title: '',
        subject: '',
      });
    }
  }
  records.sort((a, b) =>
    a.category.localeCompare(b.category) || a.filename.localeCompare(b.filename),
  );
  return records;
}

function buildMarkdown(records, meta) {
  const pdfCount = records.filter((r) => r.is_pdf).length;
  const nonPdfCount = records.length - pdfCount;
  const categories = [...new Set(records.map((r) => r.category))].sort((a, b) =>
    a.localeCompare(b),
  );

  const lines = [];
  lines.push(`# Guidance corpus -- cheap filename index (${meta.date})`);
  lines.push('');
  lines.push(
    'Metadata-only index of the external Guidance reference corpus. Derived from filenames',
  );
  lines.push(
    'and folder paths ONLY -- no PDF was opened, read, OCR-ed, or vision-processed to build',
  );
  lines.push(
    'this. `Title` and `Subject` are intentionally blank: they require reading the source',
  );
  lines.push('document and are out of scope for this cheap lane.');
  lines.push('');
  lines.push(`- Source root: \`${meta.sourceRoot}\``);
  lines.push(`- Generated: ${meta.date} (via scripts/matrix-options/build-guidance-index.mjs)`);
  lines.push(`- Total files indexed: ${records.length}`);
  lines.push(`- PDF files: ${pdfCount}`);
  lines.push(`- Non-PDF files: ${nonPdfCount}`);
  lines.push(`- Categories (relative folder paths): ${categories.length}`);
  lines.push('');
  lines.push('Provenance: file metadata captured by scripts/matrix-options/reference-file-inventory.mjs');
  lines.push('(policy: metadata_only_no_source_file_copy).');
  lines.push('');

  for (const category of categories) {
    const rows = records.filter((r) => r.category === category);
    lines.push(`## ${category} (${rows.length})`);
    lines.push('');
    lines.push('| Filename | Year | Type |');
    lines.push('| --- | --- | --- |');
    for (const r of rows) {
      lines.push(`| ${mdCell(r.filename)} | ${r.year} | ${r.type} |`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

function buildMasterAppend(records, meta) {
  const lines = [];
  lines.push(`## Guidance/ subfolder (cheap filename index ${meta.date})`);
  lines.push('');
  lines.push(
    'Appended additively -- filename/folder-derived only; Title/Subject blank (no source file opened).',
  );
  lines.push('');
  lines.push('| Filename | Category | Year | Title | Subject | Type |');
  lines.push('| --- | --- | --- | --- | --- | --- |');
  for (const r of records) {
    lines.push(`| ${mdCell(r.filename)} | ${mdCell(r.category)} | ${r.year} |  |  | ${r.type} |`);
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  const inventoryPath = readArg('--inventory');
  const outMd = readArg('--out-md');
  const outJson = readArg('--out-json');
  const masterAppend = readArg('--master-append');
  const date = readArg('--date') || new Date().toISOString().slice(0, 10);

  if (!inventoryPath || !outMd || !outJson) {
    console.error(
      'Usage: node scripts/matrix-options/build-guidance-index.mjs --inventory <json> --out-md <md> --out-json <json> [--master-append <md>] [--date YYYY-MM-DD]',
    );
    process.exit(1);
  }

  const inventory = JSON.parse(await readFile(inventoryPath, 'utf8'));
  const sourceRoot = inventory.roots?.[0]?.root ?? '(unknown)';
  const records = buildRecords(inventory);
  const meta = { date, sourceRoot };

  const pdfCount = records.filter((r) => r.is_pdf).length;
  const payload = {
    generated_at: date,
    policy: 'metadata_only_no_source_file_open',
    source_root: sourceRoot,
    inventory_source: path.basename(inventoryPath),
    counts: {
      total_files: records.length,
      pdf_files: pdfCount,
      non_pdf_files: records.length - pdfCount,
      categories: new Set(records.map((r) => r.category)).size,
    },
    records,
  };

  await mkdir(path.dirname(outMd), { recursive: true });
  await mkdir(path.dirname(outJson), { recursive: true });
  await writeFile(outMd, buildMarkdown(records, meta), 'utf8');
  await writeFile(outJson, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  console.log(`Wrote ${outMd}`);
  console.log(`Wrote ${outJson}`);
  console.log(`Records: ${records.length} (PDF: ${pdfCount}, non-PDF: ${records.length - pdfCount})`);

  if (masterAppend) {
    await mkdir(path.dirname(masterAppend), { recursive: true });
    await writeFile(masterAppend, buildMasterAppend(records, meta), 'utf8');
    console.log(`Wrote master-index append block: ${masterAppend}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
