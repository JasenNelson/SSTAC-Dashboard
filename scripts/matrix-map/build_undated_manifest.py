import argparse
import json
import glob
import re
import sys
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(
        description="Build the undated-load manifest from the split ETL chunks (with a completeness guard).",
    )
    parser.add_argument("--expected-chunks", type=int, default=25,
                        help="Approved chunk count. A different count HARD-STOPS (exit 3) unless "
                             "--allow-drift, so a stale/partial etl_output_chunks dir cannot bless a "
                             "partial live load. Set 0 to disable.")
    parser.add_argument("--expected-inserts", type=int, default=25829,
                        help="Approved total INSERT statement count. Guarded like --expected-chunks.")
    parser.add_argument("--allow-drift", action="store_true",
                        help="Permit chunk/insert totals to differ from the approved values (review first).")
    args = parser.parse_args()

    scripts_dir_hint = "scripts/matrix-map/etl_output_chunks"
    chunks_dir = Path(scripts_dir_hint)
    if not chunks_dir.exists():
        print(f"Error: Directory {chunks_dir} does not exist.")
        sys.exit(1)

    sql_files = list(chunks_dir.glob("*.sql"))
    
    def extract_nn(p):
        match = re.match(r"^(\d+)", p.name)
        return int(match.group(1)) if match else 999999

    sql_files.sort(key=extract_nn)

    apply_order = []
    row_counts = {}
    total_insert_statements = 0

    for sql_file in sql_files:
        filename = sql_file.name
        apply_order.append(filename)
        
        count = 0
        with open(sql_file, "r", encoding="utf-8") as f:
            for line in f:
                # Count actual INSERT statements, NOT "ON CONFLICT" (codex: the chunk header comment
                # "-- Idempotent: each INSERT uses ON CONFLICT DO NOTHING." would be miscounted, and a
                # non-ON-CONFLICT audit INSERT would be missed).
                if line.lstrip().upper().startswith("INSERT INTO"):
                    count += 1
                    
        row_counts[filename] = count
        total_insert_statements += count

    # COMPLETENESS GUARD (codex): refuse to bless a partial/stale chunk set. If split_etl_output.py was
    # interrupted or run against an old etl_output_chunks dir, the counts here will differ from the
    # STEP-1-approved values -- hard-stop so apply_live_load.py cannot commit an incomplete batch set.
    drift = []
    if args.expected_chunks and len(apply_order) != args.expected_chunks:
        drift.append(f"chunks {len(apply_order)} != approved {args.expected_chunks}")
    if args.expected_inserts and total_insert_statements != args.expected_inserts:
        drift.append(f"total INSERTs {total_insert_statements} != approved {args.expected_inserts}")
    if drift:
        msg = ("MANIFEST DRIFT: " + "; ".join(drift) + ". Refusing to write a manifest for a partial/"
               "stale chunk set (would risk a partial live load). Regenerate the chunks cleanly, or pass "
               "--allow-drift after explicit review.")
        if not args.allow_drift:
            print(msg, file=sys.stderr)
            sys.exit(3)
        print("WARNING (--allow-drift): " + msg, file=sys.stderr)

    manifest = {
        "source": "etl_undated_output.sql (T31 --allow-undated, 2026-07-12)",
        "scripts_dir_hint": scripts_dir_hint,
        "apply_order": apply_order,
        "row_counts": row_counts,
        "total_insert_statements": total_insert_statements
    }

    out_file = Path("scripts/matrix-map/mm_undated_load_manifest.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)

    print(f"Manifest written to {out_file}")
    print(f"Total chunks: {len(apply_order)}")
    print(f"Total INSERT statements: {total_insert_statements}")

if __name__ == "__main__":
    main()
