import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

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

function parseArgs(argv) {
  const args = {
    roots: [],
    includeRepoRootMd: false,
    json: false,
    out: null,
    failOnBrokenLinks: true
  }

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--root') args.roots.push(normalizeRepoPath(argv[++i]))
    else if (a === '--include-root-md') args.includeRepoRootMd = true
    else if (a === '--json') args.json = true
    else if (a === '--out') args.out = argv[++i]
    else if (a === '--no-fail-on-broken-links') args.failOnBrokenLinks = false
    else {
      die(
        `Unknown arg: ${a}\nUsage: node scripts/verify/docs-archive-investigation.mjs [--root <dir>]* [--include-root-md] [--json] [--out <file>] [--no-fail-on-broken-links]\n\n` +
          `--root may be repeated to scan multiple directories (default: docs).\n` +
          `--include-root-md also scans repo-root-level *.md files (non-recursive).`
      )
    }
  }

  if (args.roots.length === 0) args.roots = ['docs']
  return args
}

function listMarkdownFiles(rootDirAbs) {
  const out = []
  const stack = [rootDirAbs]
  while (stack.length) {
    const dir = stack.pop()
    const entries = fs.readdirSync(dir, { withFileTypes: true })
    for (const e of entries) {
      const p = path.join(dir, e.name)
      if (e.isDirectory()) stack.push(p)
      else if (e.isFile() && e.name.toLowerCase().endsWith('.md')) out.push(p)
    }
  }
  out.sort()
  return out
}

function listRepoRootMarkdownFiles(repoRootAbs) {
  const out = []
  for (const e of fs.readdirSync(repoRootAbs, { withFileTypes: true })) {
    if (e.isFile() && e.name.toLowerCase().endsWith('.md')) {
      out.push(path.join(repoRootAbs, e.name))
    }
  }
  out.sort()
  return out
}

function collectMarkdownFiles(args) {
  const found = new Set()
  for (const root of args.roots) {
    const abs = path.resolve(root)
    if (!fs.existsSync(abs)) die(`Missing root: ${root} (${abs})`)
    for (const p of listMarkdownFiles(abs)) found.add(p)
  }
  if (args.includeRepoRootMd) {
    for (const p of listRepoRootMarkdownFiles(path.resolve('.'))) found.add(p)
  }
  return [...found].sort()
}

export function stripFences(markdown) {
  // Reduce false-positive links/duplication by removing code. ORDER MATTERS:
  //  1. Remove multi-line fenced code blocks FIRST. (Doing inline removal first can
  //     desync on backticks INSIDE a fence -- e.g. console.error(`...`) in a ```js block --
  //     and then consume the closing fence's backticks, stripping real prose.)
  //  2. THEN remove single-line inline code spans of ANY backtick-run length: a run of N
  //     backticks closed by the next run of exactly N backticks (\1 backreference). This
  //     covers `inline` and the ``multi-backtick`` form and is line-bounded ([^\n]) so it
  //     cannot run across lines into other content.
  // Docs legitimately show markdown-link SYNTAX inside backticks (e.g. `[text](file.md)`),
  // which must not be treated as real link targets (that produced a false "broken link"
  // gate failure on 2026-06-01).
  return markdown
    .replace(/```[\s\S]*?```/g, '')
    .replace(/(`+)[^\n]*?\1/g, '')
}

function extractHeadings(markdown) {
  const headings = []
  for (const line of markdown.split(/\r?\n/)) {
    const m = /^(#{1,6})\s+(.+)$/.exec(line)
    if (m) headings.push(m[2].trim())
  }
  return headings
}

function slugifyGithubLike(heading) {
  // Lightweight GitHub-ish slugification:
  // - lowercase
  // - spaces -> '-'
  // - drop most punctuation
  // - collapse multiple '-'
  const s = String(heading)
    .trim()
    .toLowerCase()
    .replace(/[’']/g, '') // drop apostrophes
    .replace(/&[a-z]+;/g, '') // drop simple entities

  const parts = []
  for (const ch of s) {
    if ((ch >= 'a' && ch <= 'z') || (ch >= '0' && ch <= '9')) parts.push(ch)
    else if (ch === ' ' || ch === '-' || ch === '_') parts.push('-')
    // else drop
  }
  return parts.join('').replace(/-+/g, '-').replace(/^-|-$/g, '')
}

function buildHeadingSlugSet(markdown) {
  const headings = extractHeadings(markdown)
  const used = new Map() // base -> count
  const slugs = new Set()

  for (const h of headings) {
    const base = slugifyGithubLike(h)
    if (!base) continue
    const n = used.get(base) ?? 0
    used.set(base, n + 1)
    const slug = n === 0 ? base : `${base}-${n}`
    slugs.add(slug)
  }

  return slugs
}

function isExternalLink(href) {
  const s = String(href).trim()
  if (!s) return true
  if (s.startsWith('#')) return true
  if (s.startsWith('http://') || s.startsWith('https://')) return true
  if (s.startsWith('mailto:')) return true
  if (s.startsWith('tel:')) return true
  if (s.startsWith('data:')) return true
  // Treat site-root paths as app routes, not repo files
  if (s.startsWith('/')) return true
  return false
}

export function parseMarkdownLinks(markdown) {
  // Captures both links and images. This intentionally avoids full Markdown parsing.
  // Format: [text](href "title") or ![alt](href)
  const links = []
  const re = /!?\[[^\]]*]\(([^)\s]+)(?:\s+"[^"]*")?\)/g
  let m
  while ((m = re.exec(markdown)) !== null) {
    links.push(m[1])
  }
  return links
}

function readUtf8(p) {
  return fs.readFileSync(p, 'utf8')
}

function toWordCounts(text) {
  const m = text.toLowerCase().match(/[a-z0-9]{2,}/g)
  const counts = new Map()
  if (!m) return { counts, total: 0 }
  for (const w of m) counts.set(w, (counts.get(w) ?? 0) + 1)
  return { counts, total: m.length }
}

const STOPWORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'are',
  'was',
  'were',
  'will',
  'can',
  'could',
  'should',
  'would',
  'not',
  'you',
  'your',
  'our',
  'their',
  'they',
  'them',
  'into',
  'about',
  'when',
  'where',
  'what',
  'how',
  'why',
  'use',
  'using',
  'used',
  'must',
  'may',
  'etc'
])

function jaccard(aSet, bSet) {
  if (aSet.size === 0 && bSet.size === 0) return 1
  let inter = 0
  for (const x of aSet) if (bSet.has(x)) inter++
  const union = aSet.size + bSet.size - inter
  return union === 0 ? 0 : inter / union
}

class UnionFind {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i)
    this.rank = Array(n).fill(0)
  }
  find(x) {
    const p = this.parent[x]
    if (p !== x) this.parent[x] = this.find(p)
    return this.parent[x]
  }
  union(a, b) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra === rb) return
    const rka = this.rank[ra]
    const rkb = this.rank[rb]
    if (rka < rkb) this.parent[ra] = rb
    else if (rkb < rka) this.parent[rb] = ra
    else {
      this.parent[rb] = ra
      this.rank[ra]++
    }
  }
}

function main() {
  const args = parseArgs(process.argv.slice(2))

  const mdFilesAbs = collectMarkdownFiles(args)
  const mdFilesRepo = mdFilesAbs.map((p) => normalizeRepoPath(path.relative(path.resolve('.'), p)))

  // Preload docs content + heading slugs
  const contents = new Map() // repoPath -> raw markdown
  const contentsNoFences = new Map()
  const headingSlugSets = new Map() // repoPath -> Set(slug)

  for (const repoPath of mdFilesRepo) {
    const abs = path.resolve(repoPath)
    const raw = readUtf8(abs)
    const noFences = stripFences(raw)
    contents.set(repoPath, raw)
    contentsNoFences.set(repoPath, noFences)
    headingSlugSets.set(repoPath, buildHeadingSlugSet(raw))
  }

  // Link graph + validation
  const outbound = new Map() // src -> [{ target, fragment }]
  const inbound = new Map() // target -> Set(src)
  const broken = []

  for (const src of mdFilesRepo) {
    const srcAbs = path.resolve(src)
    const srcDir = path.dirname(srcAbs)
    const raw = contents.get(src) ?? ''
    const links = parseMarkdownLinks(stripFences(raw))
    const outEdges = []

    for (const hrefRaw of links) {
      const href = String(hrefRaw).trim()
      if (isExternalLink(href)) continue

      const [pPart, fragmentPart] = href.split('#')
      const targetPath = normalizeRepoPath(pPart || '')
      const fragment = fragmentPart ? String(fragmentPart).trim() : null

      if (!targetPath) continue
      // ignore non-md files (images, PDFs, etc.) for now
      if (!targetPath.toLowerCase().endsWith('.md')) continue

      // Resolve relative links from the source file
      const resolvedAbs = path.resolve(srcDir, targetPath)
      const resolvedRepo = normalizeRepoPath(path.relative(path.resolve('.'), resolvedAbs))

      outEdges.push({ target: resolvedRepo, fragment })

      if (!inbound.has(resolvedRepo)) inbound.set(resolvedRepo, new Set())
      inbound.get(resolvedRepo).add(src)

      if (!fs.existsSync(resolvedAbs)) {
        broken.push({
          kind: 'missing_target_file',
          source: src,
          href,
          resolved: resolvedRepo,
          message: `Missing doc target file: ${src} -> ${href} (resolved ${resolvedRepo})`
        })
        continue
      }

      if (fragment) {
        const slugSet = headingSlugSets.get(resolvedRepo)
        if (slugSet && !slugSet.has(fragment)) {
          broken.push({
            kind: 'missing_target_heading',
            source: src,
            href,
            resolved: resolvedRepo,
            fragment,
            message: `Missing heading anchor: ${src} -> ${href} (no '#${fragment}' in ${resolvedRepo})`
          })
        }
      }
    }

    outbound.set(src, outEdges)
  }

  // Ensure every file has an inbound set (even empty)
  for (const p of mdFilesRepo) {
    if (!inbound.has(p)) inbound.set(p, new Set())
  }

  // Duplication clusters (file-level, word-set Jaccard)
  const wordSets = mdFilesRepo.map((p) => {
    const txt = contentsNoFences.get(p) ?? ''
    const words = txt.toLowerCase().match(/[a-z0-9]{3,}/g) ?? []
    const set = new Set()
    for (const w of words) {
      if (STOPWORDS.has(w)) continue
      if (w.length < 4) continue
      set.add(w)
    }
    return set
  })

  const uf = new UnionFind(mdFilesRepo.length)
  const similarityEdges = []
  const DUP_THRESHOLD = 0.45

  for (let i = 0; i < mdFilesRepo.length; i++) {
    for (let j = i + 1; j < mdFilesRepo.length; j++) {
      const sim = jaccard(wordSets[i], wordSets[j])
      if (sim >= DUP_THRESHOLD) {
        uf.union(i, j)
        similarityEdges.push({ a: mdFilesRepo[i], b: mdFilesRepo[j], similarity: Number(sim.toFixed(4)) })
      }
    }
  }

  const clustersByRoot = new Map()
  for (let i = 0; i < mdFilesRepo.length; i++) {
    const r = uf.find(i)
    if (!clustersByRoot.has(r)) clustersByRoot.set(r, [])
    clustersByRoot.get(r).push(mdFilesRepo[i])
  }

  const duplicationClusters = [...clustersByRoot.values()]
    .filter((c) => c.length >= 2)
    .map((c) => c.sort())
    .sort((a, b) => b.length - a.length || a[0].localeCompare(b[0]))

  // Unique-value extraction (TF-IDF top terms per file)
  const perFile = mdFilesRepo.map((p) => toWordCounts(contentsNoFences.get(p) ?? ''))
  const df = new Map()
  for (const { counts } of perFile) {
    for (const term of counts.keys()) df.set(term, (df.get(term) ?? 0) + 1)
  }

  const N = mdFilesRepo.length
  const uniqueTermsTop = {}
  for (let i = 0; i < mdFilesRepo.length; i++) {
    const file = mdFilesRepo[i]
    const { counts, total } = perFile[i]
    const scored = []
    for (const [term, tfRaw] of counts.entries()) {
      if (STOPWORDS.has(term)) continue
      if (term.length < 4) continue
      const dfi = df.get(term) ?? 1
      const tf = total ? tfRaw / total : 0
      const idf = Math.log((N + 1) / (dfi + 1)) + 1
      const score = tf * idf
      scored.push([term, score])
    }
    scored.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    uniqueTermsTop[file] = scored.slice(0, 20).map(([term, score]) => ({
      term,
      score: Number(score.toFixed(6))
    }))
  }

  // Emit
  const inboundCounts = {}
  for (const [k, set] of inbound.entries()) inboundCounts[k] = set.size
  const outboundObject = Object.fromEntries(outbound.entries())

  const result = {
    docs_root: args.roots.length === 1 ? args.roots[0] : args.roots,
    scanned_roots: args.roots,
    include_repo_root_md: args.includeRepoRootMd,
    markdown_files: mdFilesRepo,
    link_graph: {
      outbound: outboundObject,
      inbound_counts: inboundCounts
    },
    broken_links: broken,
    duplication: {
      threshold: DUP_THRESHOLD,
      clusters: duplicationClusters,
      edges: similarityEdges.sort((x, y) => y.similarity - x.similarity || x.a.localeCompare(y.a) || x.b.localeCompare(y.b))
    },
    unique_value: {
      tfidf_top_terms: uniqueTermsTop
    }
  }

  const output = args.json ? JSON.stringify(result, null, 2) : formatHuman(result)
  if (args.out) {
    fs.mkdirSync(path.dirname(args.out), { recursive: true })
    fs.writeFileSync(args.out, `${output}\n`, 'utf8')
  } else {
    process.stdout.write(`${output}\n`)
  }

  if (args.failOnBrokenLinks && broken.length) process.exit(1)
  process.exit(0)
}

function formatHuman(result) {
  const lines = []
  lines.push('Docs archive-investigation')
  lines.push('=========================')
  lines.push('')
  const roots = Array.isArray(result.scanned_roots) ? result.scanned_roots : [result.scanned_roots]
  lines.push(`Scanned roots: ${roots.join(', ')}`)
  if (result.include_repo_root_md) lines.push('Repo-root *.md included (non-recursive)')
  lines.push(`Markdown files scanned: ${result.markdown_files.length}`)
  lines.push('')

  const broken = result.broken_links || []
  if (broken.length) {
    lines.push(`Broken links: ${broken.length}`)
    for (const b of broken.slice(0, 50)) lines.push(`- ${b.message}`)
    if (broken.length > 50) lines.push(`- ... ${broken.length - 50} more`)
  } else {
    lines.push('Broken links: 0')
  }
  lines.push('')

  const clusters = result.duplication?.clusters ?? []
  lines.push(`Duplication clusters (>=2 files, threshold ${result.duplication.threshold}): ${clusters.length}`)
  for (const c of clusters.slice(0, 20)) {
    lines.push(`- (${c.length}) ${c.join(', ')}`)
  }
  if (clusters.length > 20) lines.push(`- ... ${clusters.length - 20} more`)
  lines.push('')

  lines.push('Top inbound-linked docs:')
  const inboundCounts = result.link_graph?.inbound_counts ?? {}
  const topInbound = Object.entries(inboundCounts)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 15)
  for (const [p, n] of topInbound) lines.push(`- ${p}: ${n}`)
  lines.push('')

  const brokenCount = (result.broken_links || []).length
  if (brokenCount) {
    lines.push(`STATUS: FAIL (${brokenCount} broken link(s) — gate will exit non-zero)`)
  } else {
    lines.push('STATUS: PASS (archive investigation completed)')
  }
  return lines.join('\n')
}

// Run only when invoked directly (not when imported by a test).
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main()
}

