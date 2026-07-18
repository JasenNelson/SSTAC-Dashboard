"""
scan_secrets.py -- secrets scanner for the KB pilot's Graphify/wiki scan outputs.

Two independent checks, per the plan's port map (section 6 / section 11 P2):
  1. PATH AUDIT: flags any scanned file whose PATH itself looks like a leaked-secret
     artifact (.env, credentials.json, *.pem, id_rsa, ...) that should never have entered
     graphify-out/ or wiki/ in the first place. Defense-in-depth over .graphifyignore /
     .gitignore -- catches an ignore-rule gap rather than trusting the rules alone.
  2. VALUE-SIGNATURE AUDIT: reads text files under the target and regex-searches for
     known secret-shaped signatures (JWT, sk-..., sbp_..., postgres://user:pass@,
     PRIVATE KEY blocks, SERVICE_ROLE markers). NEVER prints the matched substring --
     only counts per kind and the offending file path, so a passing run's own output
     cannot itself leak a secret.

Quarantine (--quarantine) is destructive (renames files) and is therefore GATED to scan
ON SCAN OUTPUTS ONLY: the resolved target must live under one of the ALLOWED_QUARANTINE_ROOTS
(graphify-out/, wiki/, wiki.staging/) relative to --repo-root. This script NEVER renames,
moves, or logs the CONTENT of source repository files -- if the target does not resolve
under an allowed root, --quarantine is refused with a non-zero exit rather than silently
no-op'd.

--expect-hits is a positive-control mode: the caller points --target at a SYNTHETIC scratch
fixture (never a real .env.local or other real secret-bearing file) seeded with FAKE
signatures, and the scanner asserts hits were actually found (i.e. the detector logic
itself did not regress silently). It exits non-zero if the expected hits do NOT appear.

Usage:
    python scan_secrets.py --repo-root . --target wiki [--target graphify-out/GRAPH_REPORT.md]
    python scan_secrets.py --repo-root . --target graphify-out --quarantine
    python scan_secrets.py --repo-root . --target .tmp_secrets_fixture --expect-hits
"""

import argparse
import re
import sys
from pathlib import Path

# --- Path-audit patterns (case-insensitive; matched against the file's name/relative path) ---
PATH_SECRET_PATTERNS = [
    re.compile(r'(^|[\\/])\.env(\.|$)', re.IGNORECASE),
    re.compile(r'credentials\.json$', re.IGNORECASE),
    re.compile(r'\.pem$', re.IGNORECASE),
    re.compile(r'\.key$', re.IGNORECASE),
    re.compile(r'id_rsa', re.IGNORECASE),
    re.compile(r'\.pfx$', re.IGNORECASE),
    re.compile(r'\.p12$', re.IGNORECASE),
]

# --- Value-signature patterns: (kind, compiled regex). Order matters only for reporting. ---
VALUE_SIGNATURES = [
    ('jwt', re.compile(r'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}')),
    # Matches classic sk-<32chars> keys AND the current sk-proj-/sk-svcacct-/sk-admin-
    # prefixed formats (a bare `sk-[A-Za-z0-9]{20,}` misses these: the segment between
    # "sk-" and the next hyphen is too short to satisfy a 20-char run on its own).
    ('openai_style_key', re.compile(r'sk-(?:proj-|svcacct-|admin-)?[A-Za-z0-9_-]{20,}')),
    ('supabase_publishable_or_secret', re.compile(r'sbp_[A-Za-z0-9]{20,}')),
    ('postgres_creds_url', re.compile(r'postgres(?:ql)?://[^\s:@/]+:[^\s@/]+@')),
    ('private_key_block', re.compile(r'-----BEGIN [A-Z ]*PRIVATE KEY-----')),
    ('service_role_marker', re.compile(r'SERVICE_ROLE')),
]

# Roots (relative to --repo-root) under which a DESTRUCTIVE quarantine-rename is permitted.
# These are pipeline SCAN OUTPUT directories only -- never source paths.
ALLOWED_QUARANTINE_ROOTS = ('graphify-out', 'wiki', 'wiki.staging')

# Binary-ish extensions skipped by the value-signature audit (path audit still applies).
SKIP_VALUE_SCAN_EXT = {
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.ico', '.pdf', '.pyc', '.so', '.dll', '.exe',
}


def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo-root', required=True)
    parser.add_argument('--target', action='append', required=True,
                         help='File or directory to scan, relative to --repo-root. May repeat.')
    parser.add_argument('--quarantine', action='store_true',
                         help='Rename offending files in place (ONLY under an allowed scan-output root).')
    parser.add_argument('--expect-hits', action='store_true',
                         help='Positive-control mode: assert hits were found; exit non-zero if not.')
    return parser.parse_args()


def iter_files(path):
    if path.is_file():
        yield path
    elif path.is_dir():
        for p in sorted(path.rglob('*')):
            if p.is_file():
                yield p


def path_audit(path):
    rel = path.as_posix()
    for pat in PATH_SECRET_PATTERNS:
        if pat.search(rel):
            return pat.pattern
    return None


def value_audit(path):
    """Returns a list of matched KIND strings (never the matched text itself)."""
    if path.suffix.lower() in SKIP_VALUE_SCAN_EXT:
        return []
    try:
        data = path.read_bytes()
    except OSError:
        return []
    try:
        text = data.decode('utf-8')
    except UnicodeDecodeError:
        try:
            text = data.decode('latin-1')
        except UnicodeDecodeError:
            return []

    hits = []
    for kind, pat in VALUE_SIGNATURES:
        if pat.search(text):
            hits.append(kind)
    return hits


def resolve_under_allowed_root(repo_root, target_path):
    """Returns True if target_path (resolved) is repo_root/<allowed_root>[/...]."""
    try:
        rel = target_path.resolve().relative_to(repo_root.resolve())
    except ValueError:
        return False
    if not rel.parts:
        return False
    return rel.parts[0] in ALLOWED_QUARANTINE_ROOTS


def quarantine_rename(path):
    quarantined = path.with_name(path.name + '.quarantined')
    counter = 1
    while quarantined.exists():
        quarantined = path.with_name(f"{path.name}.quarantined.{counter}")
        counter += 1
    path.rename(quarantined)
    return quarantined


def main():
    args = parse_args()
    repo_root = Path(args.repo_root)

    path_hits = []       # list of (relpath, pattern)
    value_hits = []       # list of (relpath, [kinds])
    kind_counts = {}
    quarantined_files = []

    for target_arg in args.target:
        target_path = (repo_root / target_arg)
        if not target_path.exists():
            print(f"WARNING: scan target does not exist, skipping: {target_arg}")
            continue

        for f in iter_files(target_path):
            try:
                rel = f.resolve().relative_to(repo_root.resolve()).as_posix()
            except ValueError:
                rel = str(f)

            p_hit = path_audit(f)
            if p_hit:
                path_hits.append((rel, p_hit))

            kinds = value_audit(f)
            if kinds:
                value_hits.append((rel, kinds))
                for k in kinds:
                    kind_counts[k] = kind_counts.get(k, 0) + 1

    total_hit_files = len({rel for rel, _ in path_hits} | {rel for rel, _ in value_hits})

    print(f"scan_secrets: scanned targets={args.target}")
    print(f"scan_secrets: path-audit hits={len(path_hits)}, value-audit hits={len(value_hits)}, "
          f"distinct files={total_hit_files}")
    if kind_counts:
        print("scan_secrets: value-signature kind counts (counts only, values never printed):")
        for k, c in sorted(kind_counts.items()):
            print(f"  {k}: {c}")
    if path_hits:
        print("scan_secrets: path-audit offending files:")
        for rel, pat in path_hits:
            print(f"  {rel} (matched pattern: {pat})")
    if value_hits:
        print("scan_secrets: value-audit offending files (path + kinds only):")
        for rel, kinds in value_hits:
            print(f"  {rel} -> {', '.join(kinds)}")

    has_hits = bool(path_hits or value_hits)

    if args.expect_hits:
        if not has_hits:
            print("POSITIVE CONTROL FAILED: --expect-hits was set but zero hits were found "
                  "-- the detector logic may have regressed.")
            sys.exit(2)
        print("POSITIVE CONTROL OK: expected hits were found on the synthetic fixture.")
        sys.exit(0)

    if has_hits and args.quarantine:
        offending_paths = {repo_root / rel for rel, _ in path_hits} | {repo_root / rel for rel, _ in value_hits}
        for p in sorted(offending_paths):
            if not resolve_under_allowed_root(repo_root, p):
                print(f"REFUSING to quarantine (outside allowed scan-output roots "
                      f"{ALLOWED_QUARANTINE_ROOTS}): {p}")
                sys.exit(1)
        for p in sorted(offending_paths):
            q = quarantine_rename(p)
            quarantined_files.append(str(q.relative_to(repo_root)))
        print(f"scan_secrets: quarantined {len(quarantined_files)} file(s).")

    if has_hits:
        sys.exit(1)
    else:
        print("scan_secrets: clean (zero hits).")
        sys.exit(0)


if __name__ == '__main__':
    main()
