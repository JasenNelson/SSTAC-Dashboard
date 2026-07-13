import os
import sys
import json
import psycopg2
import subprocess
from pathlib import Path
import argparse

import urllib.parse
import re


def _redact(text):
    """Strip any embedded postgres URI (which carries the password) from an error
    or log string, so a libpq/psycopg2 message that echoes a malformed DSN cannot
    disclose the credential."""
    return re.sub(r"postgres(?:ql)?://\S*", "postgresql://<redacted>", str(text))


def get_database_url():
    raw_url = None
    # 1. Parse .env.local
    env_local_path = Path("C:/Projects/sstac-dashboard/.env.local")
    if env_local_path.exists():
        with open(env_local_path, "r", encoding="utf-8") as f:
            for line in f:
                if line.strip().startswith("DATABASE_URL="):
                    val = line.strip().split("DATABASE_URL=", 1)[1].strip()
                    # Strip surrounding dotenv quotes so a quoted value does not
                    # carry the quote chars into the DSN and break parsing.
                    if len(val) >= 2 and val[0] == val[-1] and val[0] in ("'", '"'):
                        val = val[1:-1]
                    if val:
                        raw_url = val
                        break

    # 2. Check process environment
    if not raw_url:
        raw_url = os.environ.get("DATABASE_URL")

    # 3. Fallback to Windows Credential Manager (SSTAC_CATALOG_DSN)
    if not raw_url:
        try:
            cmd = [
                "powershell",
                "-Command",
                "$cred = Get-StoredCredential -Target 'SSTAC_CATALOG_DSN'; if ($cred) { $cred.GetNetworkCredential().Password } else { '' }"
            ]
            res = subprocess.run(cmd, capture_output=True, text=True, check=True)
            pwd = res.stdout.strip()
            if pwd:
                raw_url = pwd
        except Exception as e:
            print(f"Warning: Could not retrieve credential from Credential Manager: {e}", file=sys.stderr)

    if not raw_url:
        return None

    # Parse and automatically percent-encode the password if it contains special characters
    m = re.match(r"^postgres(?:ql)?://([^:]+):(.*)@([^@/]+)(/.*)?$", raw_url)
    if m:
        username = m.group(1)
        password = m.group(2)
        host_port = m.group(3)
        rest = m.group(4) or ""
        
        # Swap direct connection host to pooler host to bypass local IPv6 connection limits
        if "db.qyrhsieynzfgyuqzznap.supabase.co" in host_port:
            host_port = "aws-1-ca-central-1.pooler.supabase.com:5432"
            username = "postgres.qyrhsieynzfgyuqzznap"
            
        unquoted_password = urllib.parse.unquote(password)
        encoded_password = urllib.parse.quote(unquoted_password, safe="")
        
        return f"postgresql://{username}:{encoded_password}@{host_port}{rest}"
        
    return raw_url

def get_counts(conn):
    counts = {}
    with conn.cursor() as cursor:
        cursor.execute("""
            SELECT 'substances' as tbl, count(*) as cnt FROM matrix_map.substances
            UNION ALL
            SELECT 'dras' as tbl, count(*) as cnt FROM matrix_map.dras
            UNION ALL
            SELECT 'samples' as tbl, count(*) as cnt FROM matrix_map.samples
            UNION ALL
            SELECT 'sample_events' as tbl, count(*) as cnt FROM matrix_map.sample_events
            UNION ALL
            SELECT 'measurements' as tbl, count(*) as cnt FROM matrix_map.measurements;
        """)
        for row in cursor.fetchall():
            counts[row[0]] = row[1]
            
        cursor.execute("SELECT medium, count(*) FROM matrix_map.measurements GROUP BY medium;")
        medium_counts = {}
        for row in cursor.fetchall():
            medium_counts[row[0]] = row[1]
        counts["medium"] = medium_counts
    return counts

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="C:/Projects/sstac-dashboard/scripts/matrix-map/mm_live_load_manifest.json")
    parser.add_argument("--scripts-dir", default="C:/Projects/sstac-dashboard/scripts/matrix-map")
    parser.add_argument("--report", default="C:/Projects/sstac-dashboard/.tmp_agy_closeout_liveload_apply.md",
                        help="Closeout report path (default: primary checkout). Set this for worktree/"
                             "sandboxed STEP-2 runs so the report is not written to an unwritable path.")
    args = parser.parse_args()

    # PREFLIGHT the closeout-report TARGET writability BEFORE touching the live DB (codex): otherwise a
    # bad --report path (missing parent, an existing directory, or a read-only file) would only fail
    # AFTER every batch is committed, losing the audit closeout of a live data load. mkdir the parent,
    # then actually open the target for append to prove it is a writable file (not a dir / read-only).
    Path(args.report).parent.mkdir(parents=True, exist_ok=True)
    try:
        with open(args.report, "a", encoding="utf-8"):
            pass
    except OSError as e:
        print(f"Error: --report target is not a writable file: {args.report} ({e})")
        sys.exit(1)

    db_url = get_database_url()
    if not db_url:
        print("Error: DATABASE_URL not found in .env.local, environment, or Windows Credential Manager.")
        print("Please add DATABASE_URL=postgresql://... to C:/Projects/sstac-dashboard/.env.local")
        sys.exit(1)
        
    print("Connecting to Supabase Database...")
    try:
        conn = psycopg2.connect(db_url)
        # Use autocommit so the explicit transaction brackets inside the batch files control transactions
        conn.autocommit = True
    except Exception as e:
        print(f"Error connecting to database: {_redact(e)}")
        sys.exit(1)
        
    print("Fetching PRE-LOAD counts...")
    pre_counts = get_counts(conn)
    print("PRE-LOAD counts:")
    print(json.dumps(pre_counts, indent=2))
    
    manifest_path = Path(args.manifest)
    if not manifest_path.exists():
        print(f"Error: Manifest not found at {manifest_path}")
        sys.exit(1)
        
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    batches = manifest.get("apply_order", [])
    if not batches:
        print("Error: No batches found in manifest 'apply_order'.")
        sys.exit(1)
        
    scripts_dir = Path(args.scripts_dir)

    # Preflight: verify EVERY batch file exists before touching the live DB, so a
    # missing file fails fast rather than committing a partial prefix and only then
    # discovering a later batch is absent.
    missing = [b for b in batches if not (scripts_dir / b).exists()]
    if missing:
        print(f"Error: {len(missing)} batch file(s) missing; nothing applied: {missing}")
        sys.exit(1)

    print(f"Applying {len(batches)} batches in order...")
    applied_batches = []
    for batch_file in batches:
        batch_path = scripts_dir / batch_file
        if not batch_path.exists():
            print(f"Error: Batch file {batch_path} does not exist.")
            sys.exit(1)
            
        print(f"Applying {batch_file}...")
        with open(batch_path, "r", encoding="utf-8") as f:
            sql_text = f.read()
            
        with conn.cursor() as cursor:
            try:
                cursor.execute(sql_text)
                applied_batches.append(batch_file)
            except Exception as e:
                print(f"Error executing batch {batch_file}: {_redact(e)}")
                print("Stopping load pipeline.")
                print(f"COMMITTED batches before this failure ({len(applied_batches)}): "
                      f"{applied_batches}")
                print(f"FAILED batch: {batch_file}. The committed batches above are durable "
                      f"(each batch is its own transaction). Re-running is safe -- batches are "
                      f"idempotent (ON CONFLICT DO NOTHING), so a re-run re-applies the committed "
                      f"prefix as no-ops and resumes at the failed batch.")
                sys.exit(1)
                
    print("Fetching POST-LOAD counts...")
    post_counts = get_counts(conn)
    print("POST-LOAD counts:")
    print(json.dumps(post_counts, indent=2))
    
    conn.close()
    
    # Calculate deltas
    deltas = {}
    for tbl in ["substances", "dras", "samples", "sample_events", "measurements"]:
        deltas[tbl] = post_counts[tbl] - pre_counts[tbl]
        
    medium_deltas = {}
    all_mediums = set(pre_counts["medium"].keys()) | set(post_counts["medium"].keys())
    for med in all_mediums:
        medium_deltas[med] = post_counts["medium"].get(med, 0) - pre_counts["medium"].get(med, 0)
    deltas["medium"] = medium_deltas
    
    print("DELTAS:")
    print(json.dumps(deltas, indent=2))
    
    # Build report
    report_lines = []
    report_lines.append("# Live Load Apply Closeout Report")
    report_lines.append("")
    report_lines.append("## Pre vs Post Counts")
    report_lines.append("")
    report_lines.append("| Table | Pre-Load Count | Post-Load Count | Delta |")
    report_lines.append("| --- | --- | --- | --- |")
    for tbl in ["substances", "dras", "samples", "sample_events", "measurements"]:
        report_lines.append(f"| {tbl} | {pre_counts[tbl]} | {post_counts[tbl]} | {deltas[tbl]} |")
    report_lines.append("")
    report_lines.append("## Measurement Medium Breakdown")
    report_lines.append("")
    report_lines.append("| Medium | Pre-Load Count | Post-Load Count | Delta |")
    report_lines.append("| --- | --- | --- | --- |")
    for med in sorted(all_mediums, key=lambda m: (m is None, str(m))):
        med_disp = "(NULL)" if med is None else med
        pre_med = pre_counts["medium"].get(med, 0)
        post_med = post_counts["medium"].get(med, 0)
        del_med = medium_deltas.get(med, 0)
        report_lines.append(f"| {med_disp} | {pre_med} | {post_med} | {del_med} |")
    report_lines.append("")
    report_lines.append("## Applied Batches")
    report_lines.append("")
    for b in applied_batches:
        report_lines.append(f"- {b}")
    report_lines.append("")
    report_lines.append("## Verification Summary")
    report_lines.append("- Safe DATA-ONLY INSERTs applied; no schema, RLS, or RPC changes.")
    report_lines.append("- Deltas above are NET observed count changes (post minus pre). Absent")
    report_lines.append("  concurrent matrix_map writes they equal the rows this load added; they are")
    report_lines.append("  expected to be <= the manifest source row_counts because ON CONFLICT DO")
    report_lines.append("  NOTHING skips already-existing rows (idempotent), so a re-run on an unchanged")
    report_lines.append("  source nets 0. This report states observed counts; it does not assert a")
    report_lines.append("  manifest match and does not lock against concurrent writes.")
    report_lines.append("")
    
    report_path = Path(args.report)
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("\n".join(report_lines))
        
    print(f"Closeout report successfully written to {report_path}")

if __name__ == "__main__":
    main()
