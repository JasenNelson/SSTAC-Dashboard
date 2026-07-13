import argparse
import json
import re
import sys
from pathlib import Path

def main():
    parser = argparse.ArgumentParser(
        description="Extract the exact net-new undated rollback set from a generated ETL SQL file.",
    )
    parser.add_argument(
        "--input",
        default=".tmp/mo-nextrun-2026-07-12/etl_undated_output.sql",
        help="Path to the generated --allow-undated ETL .sql (default: the STEP-1 scratch path).",
    )
    parser.add_argument(
        "--out-sql",
        default=".tmp/mo-nextrun-2026-07-12/rollback_undated.sql",
        help="Path to write the rollback .sql.",
    )
    parser.add_argument(
        "--out-json",
        default=".tmp/mo-nextrun-2026-07-12/rollback_ids.json",
        help="Path to write the rollback id JSON.",
    )
    parser.add_argument(
        "--expected-undated",
        type=int,
        default=4178,
        help="STEP-1-approved undated-event count. A regenerated SQL with a different count HARD-STOPS "
             "(exit 3) unless --allow-drift is given, so a stale/wrong packet cannot proceed under the "
             "approved numbers. Set to 0 or pass --allow-drift to disable the guard.",
    )
    parser.add_argument("--expected-chemistry", type=int, default=5751,
                        help="STEP-1-approved net-new chemistry measurement count (guarded like --expected-undated).")
    parser.add_argument("--expected-toxicity", type=int, default=0,
                        help="STEP-1-approved net-new toxicity measurement count.")
    parser.add_argument("--expected-community", type=int, default=1,
                        help="STEP-1-approved net-new community measurement count.")
    parser.add_argument(
        "--allow-drift",
        action="store_true",
        help="Permit ANY approved count (undated/chemistry/toxicity/community) to differ from its "
             "--expected-* value (must be explicitly reviewed).",
    )
    args = parser.parse_args()
    input_sql = Path(args.input)
    if not input_sql.exists():
        # Fail NONZERO (codex P2): a silent exit-0 here would let a STEP-2 apply proceed with no
        # valid rollback packet if the operator regenerated the ETL output to a different path.
        print(f"Error: input SQL not found: {input_sql}", file=sys.stderr)
        sys.exit(1)

    undated_events = set()
    
    # Pass 1: Find undated event IDs
    with open(input_sql, "r", encoding="utf-8") as f:
        for line in f:
            if "INSERT INTO matrix_map.sample_events" in line and "'undated'" in line:
                m = re.search(r"SELECT\s+(\d+)", line)
                if m:
                    undated_events.add(int(m.group(1)))

    chemistry_ids = []
    toxicity_ids = []
    community_ids = []

    # Pass 2: Find measurements referencing undated events
    with open(input_sql, "r", encoding="utf-8") as f:
        for line in f:
            if "INSERT INTO matrix_map.measurements" in line:
                m_col = re.search(r"INSERT INTO matrix_map\.measurements\s*\((.*?)\)", line)
                if m_col:
                    cols = [c.strip() for c in m_col.group(1).split(",")]
                    if len(cols) > 0:
                        keycol = cols[0]
                        if keycol in ["bnrrm_chemistry_id", "bnrrm_toxicity_id", "bnrrm_community_id"]:
                            m_id = re.search(r"SELECT\s+(\d+)", line)
                            m_ev = re.search(r"WHERE bnrrm_event_id\s*=\s*(\d+)", line)
                            
                            if m_id and m_ev:
                                key_id = int(m_id.group(1))
                                event_id = int(m_ev.group(1))
                                
                                if event_id in undated_events:
                                    if keycol == "bnrrm_chemistry_id":
                                        chemistry_ids.append(key_id)
                                    elif keycol == "bnrrm_toxicity_id":
                                        toxicity_ids.append(key_id)
                                    elif keycol == "bnrrm_community_id":
                                        community_ids.append(key_id)

    undated_events_list = sorted(list(undated_events))
    chemistry_ids.sort()
    toxicity_ids.sort()
    community_ids.sort()

    u_count = len(undated_events_list)
    chem_count = len(chemistry_ids)
    tox_count = len(toxicity_ids)
    comm_count = len(community_ids)

    print(f"undated_event_ids_count: {u_count}")
    print(f"net_new_chemistry: {chem_count}")
    print(f"net_new_toxicity: {tox_count}")
    print(f"net_new_community: {comm_count}")

    # HARD-STOP on undated-count drift (codex): in the owner-gated live-load workflow a regenerated SQL
    # whose undated count differs from the STEP-1-approved number must NOT silently produce rollback
    # files and let the apply proceed under stale approval numbers.
    drift = []
    if args.expected_undated and u_count != args.expected_undated:
        drift.append(f"undated events {u_count} != approved {args.expected_undated}")
    if args.expected_chemistry and chem_count != args.expected_chemistry:
        drift.append(f"chemistry {chem_count} != approved {args.expected_chemistry}")
    if tox_count != args.expected_toxicity:
        drift.append(f"toxicity {tox_count} != approved {args.expected_toxicity}")
    if comm_count != args.expected_community:
        drift.append(f"community {comm_count} != approved {args.expected_community}")
    if drift:
        msg = ("COUNT DRIFT: " + "; ".join(drift) + ". Owner STEP-2 approval is for the exact "
               "STEP-1 counts (4178 undated events + 5752 measurements); refusing to write rollback "
               "artifacts under stale approval numbers. Re-obtain owner approval, or pass --allow-drift "
               "after explicit review.")
        if not args.allow_drift:
            print(msg, file=sys.stderr)
            sys.exit(3)
        print("WARNING (--allow-drift): " + msg, file=sys.stderr)

    json_path = Path(args.out_json)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    
    json_data = {
        "undated_event_ids_count": u_count,
        "net_new_chemistry": chem_count,
        "net_new_toxicity": tox_count,
        "net_new_community": comm_count,
        "undated_event_ids": undated_events_list,
        "chemistry_ids": chemistry_ids,
        "toxicity_ids": toxicity_ids,
        "community_ids": community_ids
    }
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(json_data, f, indent=2)

    # ROLLBACK SAFETY (codex P1, 2026-07-12): scope DELETEs by UNDATED-EVENT ATTACHMENT, not by
    # measurement idempotency-key IN-lists. The live matrix_map had 0 undated sample_events before this
    # load, so every row with (date_precision='undated' AND bnrrm_event_id in U) was created by THIS
    # load. Keying the measurement delete on sample_event_id -> those events (rather than on
    # bnrrm_chemistry_id/etc) means the rollback can NEVER delete a pre-existing or dated production row
    # even if a source idempotency-key value already existed (ON CONFLICT would have skipped inserting
    # it), and it is robust to idempotent re-application. The chemistry/tox/community id lists remain in
    # rollback_ids.json for reporting/verification only -- they are NOT used as delete predicates.
    sql_path = Path(args.out_sql)
    with open(sql_path, "w", encoding="utf-8") as f:
        f.write("-- T31 undated-load rollback -- SAFE: scoped by undated-event attachment (bnrrm_event_id in U),\n")
        f.write("-- NOT by measurement idempotency-key IN-lists. Live had 0 undated events pre-load, so these rows\n")
        f.write("-- are provably this load's; cannot delete a pre-existing or dated row; robust to idempotent re-runs.\n")
        if not undated_events_list:
            f.write("-- (no undated events found; nothing to roll back)\n")
            return
        u_arr = "ARRAY[" + ", ".join(str(x) for x in undated_events_list) + "]::bigint[]"
        # ATOMIC + VERIFY-BEFORE-COMMIT (codex P1 round1 + P2 round2): both DELETEs run inside ONE open
        # transaction (all-or-nothing), followed by an EXECUTABLE verification SELECT. The file
        # deliberately does NOT emit COMMIT -- the operator reviews the SELECT (must read 0), then issues
        # COMMIT to finalize or ROLLBACK to abort. Leaving the transaction open is the safe default: if
        # the session ends without COMMIT, Postgres rolls the whole thing back. Do NOT run this file
        # through a fire-and-forget autocommit path that appends its own COMMIT.
        f.write("BEGIN;\n")
        f.write(
            "DELETE FROM matrix_map.measurements\n"
            " WHERE sample_event_id IN (\n"
            "   SELECT id FROM matrix_map.sample_events\n"
            f"   WHERE date_precision = 'undated' AND bnrrm_event_id = ANY({u_arr}));\n"
        )
        f.write(
            "DELETE FROM matrix_map.sample_events\n"
            f" WHERE date_precision = 'undated' AND bnrrm_event_id = ANY({u_arr});\n"
        )
        f.write(
            "SELECT count(*) AS undated_rows_remaining FROM matrix_map.sample_events\n"
            f" WHERE date_precision = 'undated' AND bnrrm_event_id = ANY({u_arr});\n"
        )
        f.write("-- REVIEW the SELECT above (expect undated_rows_remaining = 0), THEN run:  COMMIT;   (or ROLLBACK; to abort)\n")

if __name__ == "__main__":
    main()
