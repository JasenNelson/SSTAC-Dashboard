import fs from 'node:fs'
import path from 'node:path'
import { execSync } from 'node:child_process'

function die(message, code = 1) {
  process.stderr.write(`${message}\n`)
  process.exit(code)
}

function normalizeRepoPath(p) {
  let s = String(p).trim()
  if (!s) return s
  s = s.replaceAll('\\\\', '/').replaceAll('\\', '/')
  if (s.startsWith('./')) s = s.slice(2)
  return s
}

function globToRegExp(glob) {
  // Supports: *, **, ?
  // Match path separators as '/'
  const g = normalizeRepoPath(glob)
  let re = '^'
  for (let i = 0; i < g.length; i++) {
    const c = g[i]
    if (c === '*') {
      const next = g[i + 1]
      if (next === '*') {
        // ** -> match anything, including '/'
        re += '.*'
        i++
      } else {
        // * -> match anything except '/'
        re += '[^/]*'
      }
      continue
    }
    if (c === '?') {
      re += '[^/]'
      continue
    }
    // escape regex special
    if ('\\.^$+{}()|[]'.includes(c)) re += `\\${c}`
    else re += c
  }
  re += '$'
  return new RegExp(re)
}

function anyMatchPath(paths, globs) {
  const regs = globs.map(globToRegExp)
  for (const p of paths) {
    for (const r of regs) {
      if (r.test(p)) return true
    }
  }
  return false
}

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'))
}

function listChangedFilesFromGit(baseRef, headRef) {
  const cmd = `git diff --name-only ${baseRef}...${headRef}`
  const out = execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString('utf8')
  return out
    .split(/\r?\n/)
    .map((s) => normalizeRepoPath(s))
    .filter(Boolean)
}

function parseArgs(argv) {
  const args = {
    base: 'origin/main',
    head: 'HEAD',
    files: null,
    json: false
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--base') args.base = argv[++i]
    else if (a === '--head') args.head = argv[++i]
    else if (a === '--json') args.json = true
    else if (a === '--files') {
      args.files = []
      for (let j = i + 1; j < argv.length; j++) args.files.push(normalizeRepoPath(argv[j]))
      break
    } else {
      die(`Unknown arg: ${a}\nUsage: node scripts/verify/docs-gate.mjs [--base <ref>] [--head <ref>] [--files <...>] [--json]`)
    }
  }

  return args
}

function extractHeadings(markdown) {
  const headings = []
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line)
    if (m) headings.push(m[2])
  }
  return headings
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  const manifestPath = path.resolve('docs/_meta/docs-manifest.json')
  if (!fs.existsSync(manifestPath)) {
    die(`Missing manifest: ${manifestPath}`)
  }

  const manifest = readJson(manifestPath)

  const changed = args.files ?? listChangedFilesFromGit(args.base, args.head)

  const bundles = manifest.bundles || {}
  const activated = new Set()

  for (const [bundleId, bundle] of Object.entries(bundles)) {
    const triggers = bundle.triggers || []
    if (triggers.length === 0) continue
    if (anyMatchPath(changed, triggers)) activated.add(bundleId)
  }

  // Expand includes transitively
  const queue = [...activated]
  while (queue.length) {
    const id = queue.pop()
    const b = bundles[id]
    if (!b) continue
    const includes = b.includes || []
    for (const inc of includes) {
      if (!activated.has(inc)) {
        activated.add(inc)
        queue.push(inc)
      }
    }
  }

  // Collect requirements
  const requiredDocuments = new Map() // doc_id -> { doc_id, why }
  const requiredSectionIds = new Set()

  for (const id of activated) {
    const b = bundles[id]
    if (!b) continue

    for (const doc of b.requires_documents || []) {
      if (!doc?.doc_id) continue
      if (!requiredDocuments.has(doc.doc_id)) requiredDocuments.set(doc.doc_id, doc)
    }

    for (const sid of b.requires_sections || []) requiredSectionIds.add(sid)
  }

  // Resolve document paths
  const docIndex = new Map()
  for (const d of manifest.documents || []) {
    if (d?.id && d?.path) docIndex.set(d.id, d)
  }

  const sectionCatalog = manifest.section_catalog || {}

  const errors = []

  // Verify required documents exist
  for (const [docId] of requiredDocuments) {
    const doc = docIndex.get(docId)
    if (!doc) {
      errors.push({
        kind: 'missing_doc_id',
        doc_id: docId,
        message: `Missing document definition for doc_id: ${docId}`
      })
      continue
    }

    const p = path.resolve(doc.path)
    if (!fs.existsSync(p)) {
      errors.push({
        kind: 'missing_doc_file',
        doc_id: docId,
        path: doc.path,
        message: `Missing required doc file: ${doc.path}`
      })
    }
  }

  // Verify required sections exist
  for (const sid of [...requiredSectionIds].sort()) {
    const entry = sectionCatalog[sid]
    if (!entry) {
      errors.push({
        kind: 'missing_section_catalog_entry',
        section_id: sid,
        message: `Missing section_catalog entry for: ${sid}`
      })
      continue
    }

    const p = path.resolve(entry.path)
    if (!fs.existsSync(p)) {
      errors.push({
        kind: 'missing_section_doc_file',
        section_id: sid,
        path: entry.path,
        message: `Missing doc file for section ${sid}: ${entry.path}`
      })
      continue
    }

    const md = fs.readFileSync(p, 'utf8')
    const headings = extractHeadings(md)
    if (!headings.includes(entry.heading_text_exact)) {
      errors.push({
        kind: 'missing_required_heading',
        section_id: sid,
        path: entry.path,
        expected_heading: entry.heading_text_exact,
        message: `Missing required heading for ${sid} in ${entry.path}: ${entry.heading_text_exact}`
      })
    }
  }

  const result = {
    activated_bundles: [...activated].sort(),
    changed_files: changed,
    required_documents: [...requiredDocuments.keys()].sort(),
    required_sections: [...requiredSectionIds].sort(),
    errors
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)
  } else {
    process.stdout.write('Docs gate resolver\n')
    process.stdout.write('==================\n\n')

    process.stdout.write(`Activated gates (${result.activated_bundles.length}):\n`)
    for (const g of result.activated_bundles) process.stdout.write(`- ${g}\n`)

    process.stdout.write(`\nRequired docs (${result.required_documents.length}):\n`)
    for (const d of result.required_documents) process.stdout.write(`- ${d}\n`)

    process.stdout.write(`\nRequired sections (${result.required_sections.length}):\n`)
    for (const sid of result.required_sections) {
      const e = sectionCatalog[sid]
      if (e) process.stdout.write(`- ${sid} (${e.path} :: ${e.heading_text_exact})\n`)
      else process.stdout.write(`- ${sid}\n`)
    }

    if (errors.length) {
      process.stdout.write(`\nSTATUS: FAIL (${errors.length} issues)\n`)
      for (const err of errors) process.stdout.write(`- ${err.message}\n`)
    } else {
      process.stdout.write('\nSTATUS: PASS\n')
    }
  }

  process.exit(errors.length ? 1 : 0)
}

main()
