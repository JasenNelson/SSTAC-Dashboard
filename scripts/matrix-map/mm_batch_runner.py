import argparse
import sqlite3
import os
import sys
import subprocess
import json
import traceback
import glob
import shutil
from datetime import datetime, timezone

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from mm_extract_render import extract_candidate_pages
import mm_loader_common as L


def load_single_doc(db_path, doc_id, json_path):
    """Load one AGY-transcribed doc JSON into the target DB using the shared,
    correctness-fixed loaders (null-safe event dedup, no silent null-unit/conflict
    drop, single station_id allocation). Rejected rows + unit/value issues are
    QUARANTINED, never silently discarded.

    Returns (success, reason, accepted_stations, quarantine_records).
    """
    db = sqlite3.connect(db_path)
    c = db.cursor()

    res = c.execute("SELECT site_id FROM ra_documents WHERE doc_id=?", (doc_id,)).fetchone()
    if not res:
        db.close()
        return False, "no_site_id", 0, []
    site_id = res[0]

    if not os.path.exists(json_path):
        db.close()
        return False, "no_json", 0, []

    with open(json_path, "r", encoding="utf-8") as fp:
        try:
            data = json.load(fp)
        except json.JSONDecodeError as e:
            db.close()
            return False, f"bad_json: {e}", 0, []
    if not isinstance(data, list):
        db.close()
        return False, "json_not_a_list", 0, []

    quarantine = []
    accepted_stations = 0

    for row in data:
        if not isinstance(row, dict):
            quarantine.append({"doc_id": doc_id, "reason": "row_not_object", "raw": str(row)[:200]})
            continue
        station_id_raw = row.get("station_id")
        date_sampled = row.get("date_sampled")

        # Per-depth coercion: an implausible top depth does NOT null a valid bottom.
        depth_top, dt_reason = L.coerce_depth(row.get("depth_top_cm"))
        depth_bottom, db_reason = L.coerce_depth(row.get("depth_bottom_cm"))
        if dt_reason:
            quarantine.append({"doc_id": doc_id, "station_id": station_id_raw,
                               "reason": f"depth_top: {dt_reason}"})
        if db_reason:
            quarantine.append({"doc_id": doc_id, "station_id": station_id_raw,
                               "reason": f"depth_bottom: {db_reason}"})

        passed, reason = L.passes_name_gate(station_id_raw)
        if not passed:
            quarantine.append({"doc_id": doc_id, "station_id": station_id_raw,
                               "reason": f"name_gate: {reason}"})
            continue

        accepted_stations += 1
        st_id = L.find_or_create_station(c, site_id, station_id_raw)
        ev_id = L.find_or_create_event(c, st_id, date_sampled, depth_top, depth_bottom,
                                       row.get("media_type") or "sediment")

        for param in row.get("parameters", []) or []:
            L.insert_chemistry(c, ev_id, param.get("name"),
                               L.coerce_value(param.get("value")), param.get("unit"),
                               quarantine, doc_id=doc_id, source="agy_vision")

    db.commit()
    db.close()
    return True, "", accepted_stations, quarantine


def write_heartbeat(doc_id, ts, ledger_path):
    """Heartbeat from the SIDECAR ledger (never the deliverable DB)."""
    conn = sqlite3.connect(ledger_path)
    c = conn.cursor()
    counts = dict(c.execute("SELECT status, COUNT(*) FROM mm_batch_progress GROUP BY status").fetchall())
    conn.close()

    hb = {
        "last_doc_id": doc_id,
        "done": counts.get("done", 0),
        "review_zero": counts.get("review_zero", 0),
        "failed": counts.get("failed", 0),
        "no_tables": counts.get("no_tables", 0),
        "pending": counts.get("pending", 0),
        "in_progress": counts.get("in_progress", 0),
        "ts_iso": ts,
    }

    hb_path = os.path.join(os.path.dirname(ledger_path), "mm_batch_heartbeat.json")
    with open(hb_path, "w") as f:
        json.dump(hb, f, indent=2)


def _load_exclusion_manifest(manifest_path):
    """Return the set of doc_ids to EXCLUDE from the worklist -- the SINGLE source
    of truth (built in Part B against PRISTINE DB2 + the verified VERBATIM mapping).

    Accepted JSON shapes:
      - {"seed_site_docs": [...], "verbatim_docs": [...]}  (preferred; union excluded)
      - a flat list of doc_ids
      - a dict mapping verbatim-file -> doc_id (or -> {"doc_id": ...})
    Deliberately does NOT derive seed sites from "has dated events": once the
    VERBATIM merge adds dates, that heuristic over-excludes non-VERBATIM docs at any
    touched site (verified in self-test). The manifest is captured before the merge.
    """
    if not manifest_path:
        return set()
    with open(manifest_path, "r", encoding="utf-8") as f:
        m = json.load(f)
    ids = set()
    if isinstance(m, list):
        for x in m:
            ids.add(int(x if not isinstance(x, dict) else x["doc_id"]))
    elif isinstance(m, dict):
        if "verbatim_docs" in m or "seed_site_docs" in m:
            for key in ("seed_site_docs", "verbatim_docs"):
                for x in m.get(key, []):
                    ids.add(int(x if not isinstance(x, dict) else x["doc_id"]))
        else:
            for v in m.values():
                ids.add(int(v if not isinstance(v, dict) else v["doc_id"]))
    return ids


def run_batch(db_path, doc_ids=None, limit=None, max_attempts=3, crash_after=None,
              mock_agy=False, ledger_path=None, manifest_path=None):
    # A FULL run (no explicit --doc-ids) MUST have the exclusion manifest, or it would
    # re-process the 9 seed sites + the 132 VERBATIM-merged docs (wasted AGY + dup risk).
    if not doc_ids and not manifest_path:
        raise SystemExit("Refusing full run without --manifest (the verified seed+VERBATIM "
                         "exclusion list). Pass --manifest, or scope with --doc-ids for a smoke.")
    working_dir = os.path.dirname(db_path)
    # SIDECAR ledger + quarantine -- NEVER inside the deliverable DB (same-schema).
    if not ledger_path:
        ledger_path = os.path.join(working_dir, "mm_batch_ops.db")
    # Compare with normcase+realpath so a Windows case-alias (BNRRM.db vs bnrrm.db) or a
    # symlink to the same file cannot bypass the guard (codex P2).
    def _canon(p):
        return os.path.normcase(os.path.realpath(os.path.abspath(p)))
    if _canon(ledger_path) == _canon(db_path):
        raise SystemExit("Refusing --ledger == --db: the ops ledger/quarantine must be a SIDECAR, "
                         "never inside the deliverable DB (same-schema requirement).")
    conn = sqlite3.connect(ledger_path)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS mm_batch_progress (
            doc_id INTEGER PRIMARY KEY, status TEXT, attempts INTEGER,
            last_error TEXT, accepted INTEGER DEFAULT 0,
            quarantined INTEGER DEFAULT 0, updated_at TEXT)
    """)
    c.execute("""
        CREATE TABLE IF NOT EXISTS mm_quarantine (
            id INTEGER PRIMARY KEY, doc_id INTEGER, reason TEXT,
            detail TEXT, ts TEXT)
    """)
    conn.commit()

    # Read ra_documents from the TARGET (read-only here); exclude via the manifest.
    target = sqlite3.connect(db_path)
    exclude = _load_exclusion_manifest(manifest_path)
    all_docs = target.execute(
        "SELECT doc_id FROM ra_documents WHERE filepath IS NOT NULL AND filepath != ''"
    ).fetchall()
    target.close()

    for (doc_id,) in all_docs:
        if doc_id in exclude:
            continue
        c.execute("INSERT OR IGNORE INTO mm_batch_progress (doc_id, status, attempts) VALUES (?, 'pending', 0)", (doc_id,))
    conn.commit()
    print(f"Excluded {len(exclude)} docs (manifest: seed-site + VERBATIM); "
          f"{len(all_docs)} docs with filepath total.")

    if doc_ids:
        ids = [int(x.strip()) for x in doc_ids.split(',')]
        placeholders = ','.join(['?']*len(ids))
        c.execute(f"SELECT doc_id FROM mm_batch_progress WHERE status != 'done' AND doc_id IN ({placeholders}) ORDER BY doc_id", ids)
    else:
        c.execute("SELECT doc_id FROM mm_batch_progress WHERE status != 'done' ORDER BY doc_id")

    worklist = [row[0] for row in c.fetchall()]

    valid_worklist = []
    for doc_id in worklist:
        # Re-apply the manifest exclusion at worklist time too: a prior run may have
        # pre-seeded excluded docs into the ledger as 'pending' (codex P1). The manifest
        # is the single source of truth -- never process an excluded doc, even on resume.
        if doc_id in exclude:
            continue
        status, attempts = c.execute("SELECT status, attempts FROM mm_batch_progress WHERE doc_id=?", (doc_id,)).fetchone()
        if status in ('failed', 'in_progress', 'pending', 'review_zero') and attempts < max_attempts:
            valid_worklist.append(doc_id)

    if limit is not None:
        valid_worklist = valid_worklist[:limit]

    print(f"Worklist contains {len(valid_worklist)} docs to process.")

    processed_count = 0
    pdf_base_dir = "G:/My Drive/Site_Remediation_Data/PDF_Archive"
    target = sqlite3.connect(db_path)
    filepath_map = {row[0]: row[1] for row in
                    target.execute("SELECT doc_id, filepath FROM ra_documents").fetchall()}
    target.close()

    def _persist_quarantine(doc_id, records, ts):
        for rec in records:
            c.execute("INSERT INTO mm_quarantine (doc_id, reason, detail, ts) VALUES (?, ?, ?, ?)",
                      (doc_id, rec.get("reason", "?"), json.dumps(rec), ts))

    for doc_id in valid_worklist:
        ts = datetime.now(timezone.utc).isoformat()

        c.execute("UPDATE mm_batch_progress SET status='in_progress', attempts=attempts+1, updated_at=? WHERE doc_id=?", (ts, doc_id))
        conn.commit()

        filepath = filepath_map.get(doc_id)
        full_pdf_path = os.path.join(pdf_base_dir, filepath) if (filepath and not os.path.isabs(filepath)) else filepath
        if not full_pdf_path or not os.path.exists(full_pdf_path):
            full_pdf_path = filepath

        temp_img_dir = os.path.join(working_dir, f"temp_doc_{doc_id}")
        json_out_path = os.path.join(working_dir, f"mm_{doc_id}.json")

        try:
            extract_candidate_pages(full_pdf_path, temp_img_dir)

            pngs = glob.glob(os.path.join(temp_img_dir, "*.png"))
            if not pngs:
                ts = datetime.now(timezone.utc).isoformat()
                c.execute("UPDATE mm_batch_progress SET status='no_tables', updated_at=? WHERE doc_id=?", (ts, doc_id))
                conn.commit()
                write_heartbeat(doc_id, ts, ledger_path)
            else:
                prompt = (
                    f"view the PNGs in {temp_img_dir} and transcribe each sample to {json_out_path} "
                    f"per the {{station_id,date_sampled,depth_top_cm,depth_bottom_cm,media_type,parameters[]}} schema; "
                    f"skip criteria/QA/lab-id/units columns"
                )

                # STALE-JSON GUARD: delete any prior output FIRST, so a leftover file
                # cannot be loaded and false-pass the live-AGY path (codex-R2). After the
                # call, existence => the file was written by THIS run.
                if os.path.exists(json_out_path):
                    os.remove(json_out_path)

                if mock_agy:
                    print(f"Mocking AGY for doc {doc_id}...")
                    dummy_data = [{
                        "station_id": f"TEST_ST_{doc_id}",
                        "date_sampled": "2026-06-24",
                        "depth_top_cm": 0,
                        "depth_bottom_cm": 15,
                        "media_type": "sediment",
                        "parameters": [{"name": "Lead", "value": "10.5", "unit": "mg/kg"}]
                    }]
                    with open(json_out_path, "w") as f:
                        json.dump(dummy_data, f)
                else:
                    agy_cmd = [
                        "powershell.exe", "-Command",
                        f"& 'C:\\Users\\jasen\\AppData\\Local\\agy\\bin\\agy.exe' --model \"Gemini 3.1 Pro (High)\" --print-timeout 15m -p \"{prompt}\""
                    ]
                    print(f"Running AGY for doc {doc_id}...")
                    subprocess.run(agy_cmd, timeout=1200, check=True)

                ts = datetime.now(timezone.utc).isoformat()
                # Output must EXIST (we deleted any stale copy above); absence => AGY wrote
                # nothing this run -> fail, never load a leftover.
                if not os.path.exists(json_out_path):
                    c.execute("UPDATE mm_batch_progress SET status='failed', last_error='agy_no_output', updated_at=? WHERE doc_id=?", (ts, doc_id))
                    conn.commit()
                    write_heartbeat(doc_id, ts, ledger_path)
                else:
                    success, err_msg, accepted, quarantine = load_single_doc(db_path, doc_id, json_out_path)
                    _persist_quarantine(doc_id, quarantine, ts)
                    if success:
                        # ACCEPTANCE GATE: 0 accepted stations -> FLAG for review, never silent done.
                        final_status = 'done' if accepted > 0 else 'review_zero'
                        c.execute("UPDATE mm_batch_progress SET status=?, accepted=?, quarantined=?, updated_at=? WHERE doc_id=?",
                                  (final_status, accepted, len(quarantine), ts, doc_id))
                    else:
                        c.execute("UPDATE mm_batch_progress SET status='failed', last_error=?, quarantined=?, updated_at=? WHERE doc_id=?",
                                  (err_msg, len(quarantine), ts, doc_id))
                    conn.commit()
                    write_heartbeat(doc_id, ts, ledger_path)

        except Exception as e:
            err = str(e)
            ts = datetime.now(timezone.utc).isoformat()
            c.execute("UPDATE mm_batch_progress SET status='failed', last_error=?, updated_at=? WHERE doc_id=?", (err, ts, doc_id))
            conn.commit()
            write_heartbeat(doc_id, ts, ledger_path)

        if os.path.exists(temp_img_dir):
            shutil.rmtree(temp_img_dir, ignore_errors=True)
            
        processed_count += 1
        if crash_after and processed_count >= crash_after:
            print(f"CRASH SIMULATION: Exiting after {processed_count} docs.")
            sys.exit(1)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--doc-ids", type=str)
    parser.add_argument("--limit", type=int)
    parser.add_argument("--max-attempts", type=int, default=3)
    parser.add_argument("--crash-after", type=int)
    parser.add_argument("--mock-agy", action="store_true")
    parser.add_argument("--ledger", type=str, help="sidecar ops DB path (default: <workdir>/mm_batch_ops.db)")
    parser.add_argument("--manifest", type=str, help="JSON of the 132 VERBATIM-merged doc_ids to exclude")
    args = parser.parse_args()

    run_batch(args.db, args.doc_ids, args.limit, args.max_attempts, args.crash_after,
              args.mock_agy, ledger_path=args.ledger, manifest_path=args.manifest)
