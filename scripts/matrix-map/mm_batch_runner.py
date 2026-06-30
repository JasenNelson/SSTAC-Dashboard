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


class AgyNoOutputError(RuntimeError):
    """AGY did not complete a usable transcription; stop the batch run."""


def load_single_doc(db_path, doc_id, json_path, db_conn=None):
    """Load one AGY-transcribed doc JSON into the target DB using the shared,
    correctness-fixed loaders (null-safe event dedup, no silent null-unit/conflict
    drop, single station_id allocation). Rejected rows + unit/value issues are
    QUARANTINED, never silently discarded.

    Returns (success, reason, accepted_stations, quarantine_records).
    """
    db = db_conn if db_conn else sqlite3.connect(db_path)
    c = db.cursor()

    res = c.execute("SELECT site_id FROM ra_documents WHERE doc_id=?", (doc_id,)).fetchone()
    if not res:
        if not db_conn: db.close()
        return False, "no_site_id", 0, []
    site_id = res[0]

    if not os.path.exists(json_path):
        if not db_conn: db.close()
        return False, "no_json", 0, []

    try:
        with open(json_path, "r", encoding="utf-8-sig") as fp:
            content = fp.read()
        if '\x00' in content:
            raise UnicodeError("NUL bytes detected")
        data = json.loads(content)
    except (UnicodeDecodeError, UnicodeError, json.JSONDecodeError):
        try:
            with open(json_path, "r", encoding="utf-16") as fp:
                data = json.load(fp)
        except Exception:
            try:
                with open(json_path, "r", encoding="utf-16-le") as fp:
                    data = json.load(fp)
            except Exception:
                try:
                    with open(json_path, "r", encoding="utf-16-be") as fp:
                        data = json.load(fp)
                except Exception as e:
                    if not db_conn: db.close()
                    return False, f"decode_error or bad_json: {e}", 0, []

    if not isinstance(data, list):
        if not db_conn: db.close()
        return False, "json_not_a_list", 0, []
        
    if len(data) == 0:
        if not db_conn: db.close()
        return False, "empty_list", 0, []

    quarantine = []
    accepted_stations = 0

    for row in data:
        if not isinstance(row, dict):
            quarantine.append({"doc_id": doc_id, "reason": "row_not_object", "raw": str(row)[:200]})
            continue
        station_id_raw = row.get("station_id")
        date_sampled = row.get("date_sampled")
        media = row.get("media_type")

        # MEDIA GATE (owner 2026-06-25): sediment-only DB -> quarantine non-sediment
        # (soil/groundwater/etc.), recorded not discarded.
        if not L.is_sediment(media):
            quarantine.append({"doc_id": doc_id, "station_id": station_id_raw,
                               "reason": f"non_sediment_media: {media}"})
            continue

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
                                       media or "sediment")

        for param in row.get("parameters", []) or []:
            L.insert_chemistry(c, ev_id, param.get("name"),
                               L.coerce_value(param.get("value")), param.get("unit"),
                               quarantine, doc_id=doc_id, source="agy_vision")

    if not db_conn:
        db.commit()
        db.close()
    return True, "", accepted_stations, quarantine


def write_heartbeat(doc_id, ts, ledger_path):
    """Heartbeat from the SIDECAR ledger (never the deliverable DB). BEST-EFFORT:
    a heartbeat is a monitoring artifact, not data -- it must NEVER raise into the
    caller, or a heartbeat failure after a durable ledger commit would re-enter the
    per-doc exception handler and corrupt the cumulative accepted count / revert a
    completed doc. All errors are swallowed."""
    try:
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
    except Exception as e:
        print(f"Warning: write_heartbeat failed (non-fatal): {e}")


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
              mock_agy=False, ledger_path=None, manifest_path=None, passes=1):
    db_path = os.path.abspath(db_path)
    if ledger_path:
        ledger_path = os.path.abspath(ledger_path)
    if manifest_path:
        manifest_path = os.path.abspath(manifest_path)
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

        doc_db_conn = sqlite3.connect(db_path)
        any_output = False  # safe default; re-set inside the pngs-exist branch
        try:
            extract_candidate_pages(full_pdf_path, temp_img_dir)

            pngs = glob.glob(os.path.join(temp_img_dir, "*.png"))
            if not pngs:
                ts = datetime.now(timezone.utc).isoformat()
                c.execute("UPDATE mm_batch_progress SET status='no_tables', updated_at=? WHERE doc_id=?", (ts, doc_id))
                conn.commit()
                write_heartbeat(doc_id, ts, ledger_path)
            else:
                def _prompt(out):
                    return (
                        f"view the PNGs in {temp_img_dir} and transcribe ONLY the SEDIMENT samples to "
                        f"{out} as a JSON array; each sample = {{station_id, date_sampled, "
                        f"depth_top_cm, depth_bottom_cm, media_type, parameters:[{{name, value, unit}}]}}. "
                        f"Transcribe EVERY sediment sample and EVERY data row COMPLETELY -- do not omit, "
                        f"summarize, sample, or truncate. If a station was sampled on multiple DATES or "
                        f"DEPTHS, include ALL of them as SEPARATE entries. For station_id use the FULL "
                        f"sample/station identifier EXACTLY as printed (e.g. 'SED11-137A') from the column "
                        f"header or 'Sample ID' row; NEVER a single column letter (A,B,C), a row number, or "
                        f"an abbreviation. ALWAYS include the measurement UNIT for each parameter (e.g. "
                        f"mg/kg, ug/kg). Set media_type per sample; SKIP soil, groundwater, surface-water "
                        f"samples and criteria/guideline/QA-QC/lab-id columns."
                    )

                def _station_count():
                    n = doc_db_conn.execute("SELECT COUNT(*) FROM stations").fetchone()[0]
                    return n

                # MULTI-PASS UNION (reliability hardening 2026-06-25): vision is non-
                # deterministic + may miss samples (the golden was captured in one run, missed
                # in another). Run N passes; the loader dedups (station + ISO-date + depth), so
                # the UNION recovers samples any single pass omitted. Stale-JSON guard per pass.
                base = os.path.splitext(os.path.basename(json_out_path))[0]  # mm_<doc>
                st_before = _station_count()
                quarantine_all = []
                any_output = False
                last_err = None
                last_committed_count = st_before  # updated after each per-pass commit
                for k in range(passes):
                    out = os.path.join(working_dir, f"{base}_p{k}.json")
                    if os.path.exists(out):
                        os.remove(out)
                    if mock_agy:
                        with open(out, "w") as f:
                            json.dump([{"station_id": f"TEST_ST_{doc_id}", "date_sampled": "2026-06-24",
                                        "depth_top_cm": 0, "depth_bottom_cm": 15, "media_type": "sediment",
                                        "parameters": [{"name": "Lead", "value": "10.5", "unit": "mg/kg"}]}], f)
                    else:
                        import time
                        agy_log = os.path.join(working_dir, f"{base}_p{k}_run.log")
                        if os.path.exists(agy_log):
                            try:
                                os.remove(agy_log)
                            except Exception:
                                pass
                        agy_cmd = ["powershell.exe", "-Command",
                                   f"& 'C:\\Users\\jasen\\AppData\\Local\\agy\\bin\\agy.exe' --model "
                                   f"\"Gemini 3.1 Pro (High)\" --print-timeout 15m -p \"{_prompt(out)}\" "
                                   f"> '{agy_log}' 2>&1; "
                                   f"if ($LastExitCode) {{ exit $LastExitCode }}"]
                        print(f"Running AGY for doc {doc_id} pass {k + 1}/{passes}...")
                        try:
                            res = subprocess.run(
                                agy_cmd,
                                timeout=1200
                            )
                        except subprocess.TimeoutExpired as e:
                            raise AgyNoOutputError(
                                f"AGY timed out after 1200 seconds without producing output. Log: {agy_log}"
                            ) from e
                        if res.returncode != 0 or not os.path.exists(out):
                            log_content = ""
                            if os.path.exists(agy_log):
                                try:
                                    with open(agy_log, "rb") as lf:
                                        raw_bytes = lf.read()
                                    if raw_bytes.startswith(b'\xff\xfe') or raw_bytes.startswith(b'\xfe\xff'):
                                        log_content = raw_bytes.decode('utf-16', errors='ignore')
                                    else:
                                        log_content = raw_bytes.decode('utf-8-sig', errors='ignore').replace('\x00', '')
                                except Exception:
                                    pass
                            print(f"AGY command failed or did not write output file. Exit code: {res.returncode}. Output:\n{log_content}")
                            log_lower = log_content.lower()
                            if "resource_exhausted" in log_lower or "quota" in log_lower or "overloaded" in log_lower:
                                print("Rate limit or overload detected! Sleeping for 5 minutes (300s) to reset quota...")
                                time.sleep(300)
                            if res.returncode != 0:
                                raise AgyNoOutputError(f"AGY exited with code {res.returncode}. Log:\n{log_content}")
                            else:
                                raise AgyNoOutputError(f"AGY exited with code 0 but did not write output. Log:\n{log_content}")
                        else:
                            if os.path.exists(agy_log):
                                try:
                                    os.remove(agy_log)
                                except Exception:
                                    pass
                    if os.path.exists(out):  # fresh (we deleted any stale copy) -> load this pass
                        ok, err_msg, _acc, q = load_single_doc(db_path, doc_id, out, db_conn=doc_db_conn)
                        quarantine_all.extend(q)
                        if ok:
                            any_output = True
                            doc_db_conn.commit()  # commit per pass; ON CONFLICT DO NOTHING makes additive writes idempotent
                            last_committed_count = _station_count()  # snapshot committed count (no pending tx at this point)
                        else:
                            last_err = err_msg

                ts = datetime.now(timezone.utc).isoformat()
                if not any_output:
                    raise AgyNoOutputError(f"No pass produced usable output for doc {doc_id}. Last error: {last_err}")
                else:
                    _persist_quarantine(doc_id, quarantine_all, ts)
                    new_stations = _station_count() - st_before  # net-new across all passes
                    
                    prior_accepted_row = c.execute("SELECT accepted FROM mm_batch_progress WHERE doc_id=?", (doc_id,)).fetchone()
                    prior_accepted = prior_accepted_row[0] if prior_accepted_row and prior_accepted_row[0] is not None else 0
                    total_accepted = prior_accepted + new_stations
                    
                    # ACCEPTANCE GATE: 0 total accepted sediment stations -> FLAG for review.
                    final_status = 'done' if total_accepted > 0 else 'review_zero'
                    doc_db_conn.commit()
                    c.execute("UPDATE mm_batch_progress SET status=?, accepted=?, quarantined=?, last_error=?, updated_at=? WHERE doc_id=?",
                              (final_status, total_accepted, len(quarantine_all), last_err, ts, doc_id))
                    conn.commit()
                    write_heartbeat(doc_id, ts, ledger_path)

        except AgyNoOutputError as e:
            err = str(e)
            ts = datetime.now(timezone.utc).isoformat()
            if any_output:
                _persist_quarantine(doc_id, quarantine_all, ts)
                new_stations = _station_count() - st_before
                doc_db_conn.commit()
                # Cumulative accepted: never overwrite a preserved prior count with a
                # smaller/zero net-new value (a duplicate-only retry yields new_stations==0).
                prior_accepted_row = c.execute("SELECT accepted FROM mm_batch_progress WHERE doc_id=?", (doc_id,)).fetchone()
                prior_accepted = prior_accepted_row[0] if prior_accepted_row and prior_accepted_row[0] is not None else 0
                total_accepted = prior_accepted + new_stations
                c.execute("""
                    UPDATE mm_batch_progress
                    SET status='pending',
                        attempts=CASE WHEN attempts > 0 THEN attempts - 1 ELSE 0 END,
                        accepted=?,
                        quarantined=?,
                        last_error=?,
                        updated_at=?
                    WHERE doc_id=?
                """, (total_accepted, len(quarantine_all), err, ts, doc_id))
                conn.commit()
                write_heartbeat(doc_id, ts, ledger_path)
                print(f"Fatal AGY execution condition at doc {doc_id}; preserved union and stopping the run.")
                raise
            else:
                # No pass produced usable stations; nothing was committed. Implicit rollback
                # on doc_db_conn.close() (finally) handles any partial uncommitted state.
                c.execute("""
                    UPDATE mm_batch_progress
                    SET status='pending',
                        attempts=CASE WHEN attempts > 0 THEN attempts - 1 ELSE 0 END,
                        last_error=?,
                        updated_at=?
                    WHERE doc_id=?
                """, (err, ts, doc_id))
                conn.commit()
                write_heartbeat(doc_id, ts, ledger_path)
                print(f"Fatal AGY execution condition at doc {doc_id}; leaving doc pending and stopping the run.")
                raise
        except Exception as e:
            err = str(e)
            ts = datetime.now(timezone.utc).isoformat()
            if any_output:
                # Earlier pass(es) committed real stations via commit-per-pass; no rollback.
                # Partial uncommitted state from the failing pass is discarded implicitly
                # by doc_db_conn.close() in the finally block; last_committed_count holds
                # only the durable committed tally.  Leave doc retriable so the union can
                # be extended on the next run.
                _persist_quarantine(doc_id, quarantine_all, ts)
                new_stations = last_committed_count - st_before
                prior_accepted_row = c.execute("SELECT accepted FROM mm_batch_progress WHERE doc_id=?", (doc_id,)).fetchone()
                prior_accepted = prior_accepted_row[0] if prior_accepted_row and prior_accepted_row[0] is not None else 0
                total_accepted = prior_accepted + new_stations
                c.execute("""
                    UPDATE mm_batch_progress
                    SET status='pending',
                        attempts=CASE WHEN attempts > 0 THEN attempts - 1 ELSE 0 END,
                        accepted=?,
                        quarantined=?,
                        last_error=?,
                        updated_at=?
                    WHERE doc_id=?
                """, (total_accepted, len(quarantine_all), err, ts, doc_id))
                conn.commit()
                write_heartbeat(doc_id, ts, ledger_path)
            else:
                # No pass ever committed data; nothing to preserve. Mark failed.
                c.execute("UPDATE mm_batch_progress SET status='failed', last_error=?, updated_at=? WHERE doc_id=?", (err, ts, doc_id))
                conn.commit()
                write_heartbeat(doc_id, ts, ledger_path)
        finally:
            doc_db_conn.close()
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
    parser.add_argument("--manifest", type=str, help="JSON exclusion manifest (seed/VERBATIM doc_ids)")
    parser.add_argument("--passes", type=int, default=1, help="vision passes per doc; union recovers samples a single pass misses")
    args = parser.parse_args()

    run_batch(args.db, args.doc_ids, args.limit, args.max_attempts, args.crash_after,
              args.mock_agy, ledger_path=args.ledger, manifest_path=args.manifest, passes=args.passes)
