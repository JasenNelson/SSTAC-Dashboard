"""
graph_smoke.py -- Phase 2 graph-quality smoke test + SUBSTRATE INVARIANT assert.

Two-band threshold semantics (plan Phase 2 acceptance thresholds):
  HEALTHY -> metric passes cleanly.
  WARN    -> between the healthy band and the HARD limit: the run continues, but the
             metric is receipt-flagged and MUST be investigated before the owner gate.
  HARD    -> at/beyond the hard limit: abort-and-fix-scoping (this script exits 1).

Some metrics (communities count) have no stated HARD limit in the plan -- those are
WARN-only (can never abort the run on their own) and are marked as such below.

The SUBSTRATE INVARIANT and the worktree/node_modules/env PATH audit are ZERO-TOLERANCE
HARD checks (no WARN band): any hit aborts regardless of the two-band table.

Usage:
    python graph_smoke.py --graph graphify-out/graph.json --manifest graphify-out/manifest.json
        --repo-root . [--allowlist <file>] [--receipt <path>]
"""

import argparse
import json
import subprocess
import sys
from pathlib import Path


# (metric_key, description, healthy_fn, hard_fn) -- healthy_fn/hard_fn take the metric value.
# hard_fn is None for WARN-only metrics (no stated HARD threshold in the plan).
THRESHOLD_TABLE = [
    (
        'internal_import_resolution_pct',
        'internal-import resolution',
        lambda v: v >= 70.0,
        lambda v: v < 50.0,
    ),
    (
        'unresolved_alias_pct',
        'unresolved @/ aliases (pct of import links)',
        lambda v: v == 0.0,
        lambda v: v > 5.0,
    ),
    (
        'mean_nodes_per_file',
        'nodes/file (mean)',
        lambda v: 3.0 <= v <= 40.0,
        lambda v: v < 2.0 or v > 100.0,
    ),
    (
        'file_coverage_pct',
        'file coverage (files with >=1 node / in-scope manifest files)',
        lambda v: v >= 90.0,
        lambda v: v < 75.0,
    ),
    (
        'largest_community_pct',
        'largest community (pct of nodes)',
        lambda v: v <= 35.0,
        lambda v: v > 50.0,
    ),
    (
        'num_communities',
        'communities (count) -- WARN-only, no stated HARD limit',
        # Upper bound widened 250 -> 700 (2026-07-17 calibration follow-up,
        # docs/KB_COMMUNITY_CALIBRATION_2026-07-17.md): the 250 ceiling was set
        # against the OHD reference instance at ~2851 nodes, but OHD's own live
        # graph had already grown past 250 communities by 2026-07-11 and sits at
        # 669 communities / 2907 nodes as of 2026-07-17 (13 consecutive green
        # nightlies throughout). SSTAC's Phase 2 graph is 534 communities / 8517
        # nodes -- a LOWER communities-per-1000-nodes density (62.7) than every
        # OHD snapshot observed (129.7-296.9). Neither data point indicates a
        # clustering/extraction defect (largest_community_pct stays <2% for
        # SSTAC; small communities are numerous but hold little node mass) --
        # the fixed absolute band was simply stale for both graphs' current
        # scale. 700 covers both current data points with margin while still
        # flagging genuinely pathological over-fragmentation.
        lambda v: 15 <= v <= 700,
        None,
    ),
    (
        'graph_size_mib',
        'graph.json size (MiB)',
        lambda v: v < 300.0,
        lambda v: v >= 450.0,
    ),
]


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--graph', required=True)
    parser.add_argument('--manifest', required=False)
    parser.add_argument('--repo-root', required=True)
    parser.add_argument('--allowlist', required=False,
                         help='Optional file of newline-separated untracked-allowlist paths '
                              '(root-anchored, relative to --repo-root). Default: empty.')
    parser.add_argument('--receipt', required=False,
                         help='Optional path to write the metrics table as JSON.')
    return parser.parse_args()


def classify(value, healthy_fn, hard_fn):
    if healthy_fn(value):
        return 'HEALTHY'
    if hard_fn is not None and hard_fn(value):
        return 'HARD'
    return 'WARN'


def git_tracked_files(repo_root):
    result = subprocess.run(
        ['git', 'ls-files'], cwd=str(repo_root), capture_output=True, text=True, check=True
    )
    return set(result.stdout.replace('\\', '/').splitlines())


def git_worktree_paths(repo_root):
    """Returns worktree directory names (basename only) other than the main checkout,
    for the worktree/node_modules/env PATH audit."""
    try:
        result = subprocess.run(
            ['git', 'worktree', 'list', '--porcelain'], cwd=str(repo_root),
            capture_output=True, text=True, check=True,
        )
    except (subprocess.CalledProcessError, OSError):
        return []
    names = []
    main_root = str(repo_root.resolve())
    for line in result.stdout.splitlines():
        if line.startswith('worktree '):
            wt_path = line[len('worktree '):].strip()
            if str(Path(wt_path).resolve()) != main_root:
                names.append(Path(wt_path).name)
    return names


def compute_metrics(graph, manifest, repo_root, worktree_names):
    nodes = graph.get('nodes', [])
    links = graph.get('links', [])
    node_by_id = {n.get('id'): n for n in nodes if n.get('id')}

    # --- internal-import resolution + unresolved @/ aliases ---
    import_links = [l for l in links if l.get('relation') in ('imports', 'imports_from')]
    resolved = 0
    unresolved_alias = 0
    for l in import_links:
        tgt_id = l.get('target')
        tgt_node = node_by_id.get(tgt_id)
        if tgt_node is None:
            # Target node missing entirely -- cannot resolve.
            continue
        if tgt_id.startswith('ref_'):
            label = tgt_node.get('label') or ''
            if label.startswith('@/'):
                unresolved_alias += 1
            # else: a resolved-but-external package reference (e.g. "@playwright/test",
            # "react") -- expected, not a resolution failure.
        else:
            resolved += 1

    if import_links:
        internal_import_resolution_pct = (resolved / len(import_links)) * 100.0
        unresolved_alias_pct = (unresolved_alias / len(import_links)) * 100.0
    else:
        # No import links at all (e.g. a tiny/synthetic graph): vacuously nothing failed
        # to resolve -- 0 imports is not the same failure mode as "many imports, none
        # resolved", so this must not read as a HARD abort.
        internal_import_resolution_pct = 100.0
        unresolved_alias_pct = 0.0

    # --- nodes/file (mean) + file coverage ---
    by_file = {}
    for n in nodes:
        sf = n.get('source_file')
        if sf:
            by_file.setdefault(sf, 0)
            by_file[sf] += 1
    mean_nodes_per_file = (sum(by_file.values()) / len(by_file)) if by_file else 0.0

    if manifest is not None:
        in_scope_count = len(manifest)
        file_coverage_pct = (len(by_file) / in_scope_count * 100.0) if in_scope_count else 100.0
    else:
        file_coverage_pct = None

    # --- communities ---
    community_counts = {}
    for n in nodes:
        c = n.get('community')
        if c is not None:
            community_counts[c] = community_counts.get(c, 0) + 1
    num_communities = len(community_counts)
    largest_community_pct = (
        (max(community_counts.values()) / len(nodes) * 100.0) if community_counts and nodes else 0.0
    )

    metrics = {
        'internal_import_resolution_pct': round(internal_import_resolution_pct, 2),
        'unresolved_alias_pct': round(unresolved_alias_pct, 2),
        'mean_nodes_per_file': round(mean_nodes_per_file, 2),
        'largest_community_pct': round(largest_community_pct, 2),
        'num_communities': num_communities,
    }
    if file_coverage_pct is not None:
        metrics['file_coverage_pct'] = round(file_coverage_pct, 2)

    return metrics


def substrate_invariant_offenders(graph, repo_root, allowlist):
    tracked = git_tracked_files(repo_root)
    offenders = []
    seen = set()
    for n in graph.get('nodes', []):
        sf = n.get('source_file')
        if not sf or sf in seen:
            continue
        seen.add(sf)
        norm = sf.replace('\\', '/').lstrip('/')
        if norm in tracked or norm in allowlist:
            continue
        offenders.append(sf)
    return sorted(offenders)


def suspicious_path_hits(graph, worktree_names):
    """Zero-tolerance HARD check: node_modules/, .venv-graphify/, .env-like, or a known
    in-root worktree directory name appearing as a source_file. Independent of (and a
    cheaper defense-in-depth complement to) scan_secrets.py's value-signature audit --
    this only inspects the PATH string recorded in the graph, never file contents."""
    # Substring patterns catch a .env file NESTED anywhere ("sub/.env", "sub/.env.local").
    # They deliberately do NOT catch a root-level ".env" (no leading "/" in a normalized
    # relative path, no trailing "." either) -- that exact-basename case is checked
    # separately below so a root .env is still zero-tolerance HARD.
    patterns = ['node_modules/', '.venv-graphify/', '/.env', '.env.']
    for name in worktree_names:
        patterns.append(f'{name}/')

    hits = []
    seen = set()
    for n in graph.get('nodes', []):
        sf = n.get('source_file')
        if not sf or sf in seen:
            continue
        seen.add(sf)
        norm = sf.replace('\\', '/')
        basename = norm.rsplit('/', 1)[-1]
        if basename == '.env' or basename.startswith('.env.'):
            hits.append((sf, '<root-or-any-level .env exact/prefix match>'))
            continue
        for pat in patterns:
            if pat in norm:
                hits.append((sf, pat))
                break
    return hits


def main():
    args = parse_args()
    repo_root = Path(args.repo_root)

    with open(args.graph, 'r', encoding='utf-8') as f:
        graph = json.load(f)

    manifest = None
    if args.manifest and Path(args.manifest).exists():
        with open(args.manifest, 'r', encoding='utf-8') as f:
            manifest = json.load(f)

    allowlist = set()
    if args.allowlist and Path(args.allowlist).exists():
        with open(args.allowlist, 'r', encoding='utf-8') as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    allowlist.add(line.lstrip('/'))

    worktree_names = git_worktree_paths(repo_root)

    metrics = compute_metrics(graph, manifest, repo_root, worktree_names)
    metrics['graph_size_mib'] = round(Path(args.graph).stat().st_size / (1024 * 1024), 2)

    hard_abort = False
    report_rows = []
    for key, desc, healthy_fn, hard_fn in THRESHOLD_TABLE:
        if key not in metrics:
            continue
        value = metrics[key]
        status = classify(value, healthy_fn, hard_fn)
        report_rows.append({'metric': key, 'description': desc, 'value': value, 'status': status})
        if status == 'HARD':
            hard_abort = True

    offenders = substrate_invariant_offenders(graph, repo_root, allowlist)
    path_hits = suspicious_path_hits(graph, worktree_names)

    print("--- graph_smoke: metric table ---")
    for row in report_rows:
        print(f"  {row['metric']}: {row['value']} [{row['status']}] ({row['description']})")

    print("--- graph_smoke: SUBSTRATE INVARIANT ---")
    if offenders:
        print(f"  HARD FAIL: {len(offenders)} source_file(s) neither git-tracked nor allowlisted:")
        for o in offenders[:50]:
            print(f"    {o}")
        if len(offenders) > 50:
            print(f"    ... and {len(offenders) - 50} more")
        hard_abort = True
    else:
        print("  OK: every source_file is git-tracked or allowlisted.")

    print("--- graph_smoke: worktree/node_modules/env PATH audit (zero-tolerance) ---")
    if path_hits:
        print(f"  HARD FAIL: {len(path_hits)} suspicious source_file path(s):")
        for sf, pat in path_hits[:50]:
            print(f"    {sf} (matched: {pat})")
        hard_abort = True
    else:
        print("  OK: zero hits.")

    if args.receipt:
        receipt = {
            'metrics': report_rows,
            'substrate_invariant_offenders': offenders,
            'path_audit_hits': [{'source_file': sf, 'pattern': pat} for sf, pat in path_hits],
            'hard_abort': hard_abort,
        }
        Path(args.receipt).parent.mkdir(parents=True, exist_ok=True)
        with open(args.receipt, 'w', encoding='utf-8') as f:
            json.dump(receipt, f, indent=2)

    if hard_abort:
        print("graph_smoke: HARD ABORT -- one or more zero-tolerance or hard-limit checks failed.")
        sys.exit(1)

    print("graph_smoke: PASS (WARN rows above, if any, must still be investigated before the owner gate).")
    sys.exit(0)


if __name__ == '__main__':
    main()
