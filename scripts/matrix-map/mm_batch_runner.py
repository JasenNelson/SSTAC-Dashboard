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

def passes_name_gate(sid_raw):
    import re
    sid_norm = re.sub(r'[^A-Z0-9]', '', str(sid_raw).upper())
    if not sid_norm:
        return False, "Empty or punctuation only"
    contains_bad = ["STANDARD", "GUIDELINE", "CRITERIA", "CSR", "BCCSR", "SEDQC", "SEDQL", "ISQG", "PEL", "TEL", "AWF", "AWM", "DRINKINGWATER", "RPD", "QA", "QC", "DUPLICATE", "BLANK", "MSVC", "BACKGROUND", "TYPICAL", "MEAN", "MEDIAN", "AVERAGE", "MAXIMUM", "MINIMUM", "DETECTION", "METHOD", "REPORTINGLIMIT", "REFERENCE", "COMMERCIAL", "INDUSTRIAL", "RESIDENTIAL", "AQUATICLIFE"]
    for bad in contains_bad:
        if bad in sid_norm:
            return False, f"Contains {bad}"
    is_bad = ["UNITS", "SAMPLE", "SAMPLEID", "SAMPLEDATE", "SAMPLELOCATION", "DESCRIPTION", "LOCATION", "LOCATIONID", "PARAMETER", "ANALYTE", "RESULT", "OF", "NA", "ND"]
    if sid_norm in is_bad:
        return False, f"Is {sid_norm}"
    if sid_norm.isnumeric():
        return False, "Purely numeric"
    has_letter = any(c.isalpha() for c in sid_norm)
    has_digit = any(c.isdigit() for c in sid_norm)
    if not (has_letter and has_digit):
        return False, "No alphanumeric structure (missing letter or digit)"
    return True, ""

def normalize_ascii(text):
    if text is None: return None
    t = str(text)
    t = t.replace("µ", "u")
    return "".join(c for c in t if ord(c) <= 127)

def load_single_doc(db_path, doc_id, json_path):
    db = sqlite3.connect(db_path)
    c = db.cursor()
    
    c.execute("SELECT MAX(station_id) FROM stations")
    max_st = c.fetchone()[0] or 0
    c.execute("SELECT MAX(event_id) FROM sampling_events")
    max_ev = c.fetchone()[0] or 0

    c.execute("SELECT site_id FROM ra_documents WHERE doc_id=?", (doc_id,))
    res = c.fetchone()
    if not res:
        db.close()
        return False, "no_site_id", 0

    site_id = res[0]
    
    if not os.path.exists(json_path):
        db.close()
        return False, "no_json", 0

    with open(json_path, 'r') as fp:
        try:
            data = json.load(fp)
        except json.JSONDecodeError as e:
            db.close()
            return False, f"bad_json: {e}", 0

    inserted_stations = 0
    
    for row in data:
        station_id_raw = row.get("station_id")
        date_sampled = row.get("date_sampled")
        
        try:
            depth_top = row.get("depth_top_cm")
            if depth_top is not None: depth_top = float(depth_top)
        except (ValueError, TypeError):
            depth_top = None
            
        try:
            depth_bottom = row.get("depth_bottom_cm")
            if depth_bottom is not None: depth_bottom = float(depth_bottom)
        except (ValueError, TypeError):
            depth_bottom = None
            
        if depth_top is not None and (depth_top < 0 or depth_top > 1000):
            depth_top, depth_bottom = None, None
        
        passed, reason = passes_name_gate(station_id_raw)
        if not passed:
            continue
            
        inserted_stations += 1
        
        c.execute("SELECT station_id FROM stations WHERE site_id=? AND name=?", (site_id, station_id_raw))
        st_res = c.fetchone()
        if st_res:
            st_id = st_res[0]
        else:
            max_st += 1
            st_id = max_st
            c.execute("INSERT INTO stations (station_id, site_id, name) VALUES (?, ?, ?)", (max_st, site_id, station_id_raw))
            
        c.execute("SELECT event_id FROM sampling_events WHERE station_id=? AND IFNULL(date_sampled,'')=? AND IFNULL(depth_top_cm,'')=? AND IFNULL(depth_bottom_cm,'')=?", 
                       (st_id, date_sampled or '', depth_top or '', depth_bottom or ''))
        ev_res = c.fetchone()
        if ev_res:
            ev_id = ev_res[0]
        else:
            max_ev += 1
            ev_id = max_ev
            media_type = row.get("media_type") or "sediment"
            c.execute("INSERT INTO sampling_events (event_id, station_id, date_sampled, depth_top_cm, depth_bottom_cm, media_type) VALUES (?, ?, ?, ?, ?, ?)", 
                           (ev_id, st_id, date_sampled, depth_top, depth_bottom, media_type))
                           
        for param in row.get("parameters", []):
            p_name = normalize_ascii(param.get("name"))
            p_val = param.get("value")
            p_unit = normalize_ascii(param.get("unit"))
            
            try:
                v = float(str(p_val).replace(',', '').replace('<', '').replace('>', ''))
            except (ValueError, TypeError):
                v = None
                
            if p_name:
                c.execute("INSERT OR IGNORE INTO sediment_chemistry (event_id, parameter, value, unit) VALUES (?, ?, ?, ?)", (ev_id, p_name, v, p_unit))

    db.commit()
    db.close()
    
    return True, "", inserted_stations


def write_heartbeat(doc_id, ts, db_path):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    c.execute("SELECT status, COUNT(*) FROM mm_batch_progress GROUP BY status")
    counts = dict(c.fetchall())
    conn.close()
    
    hb = {
        "last_doc_id": doc_id,
        "done": counts.get("done", 0),
        "failed": counts.get("failed", 0),
        "no_tables": counts.get("no_tables", 0),
        "pending": counts.get("pending", 0),
        "in_progress": counts.get("in_progress", 0),
        "ts_iso": ts
    }
    
    working_dir = os.path.dirname(db_path)
    hb_path = os.path.join(working_dir, "mm_batch_heartbeat.json")
    with open(hb_path, "w") as f:
        json.dump(hb, f, indent=2)


def run_batch(db_path, doc_ids=None, limit=None, max_attempts=3, crash_after=None, mock_agy=False):
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    c.execute("""
        CREATE TABLE IF NOT EXISTS mm_batch_progress (
            doc_id INTEGER PRIMARY KEY,
            status TEXT,
            attempts INTEGER,
            last_error TEXT,
            updated_at TEXT
        )
    """)
    
    c.execute("SELECT doc_id, filepath, title FROM ra_documents WHERE filepath IS NOT NULL AND filepath != ''")
    all_docs = c.fetchall()
    
    for doc_id, filepath, title in all_docs:
        if title and "seed site" in title.lower():
            continue
        c.execute("INSERT OR IGNORE INTO mm_batch_progress (doc_id, status, attempts) VALUES (?, 'pending', 0)", (doc_id,))
    conn.commit()

    if doc_ids:
        ids = [int(x.strip()) for x in doc_ids.split(',')]
        placeholders = ','.join(['?']*len(ids))
        c.execute(f"SELECT doc_id FROM mm_batch_progress WHERE status != 'done' AND doc_id IN ({placeholders}) ORDER BY doc_id", ids)
    else:
        c.execute("SELECT doc_id FROM mm_batch_progress WHERE status != 'done' ORDER BY doc_id")
    
    worklist = [row[0] for row in c.fetchall()]
    
    valid_worklist = []
    for doc_id in worklist:
        c.execute("SELECT status, attempts FROM mm_batch_progress WHERE doc_id=?", (doc_id,))
        status, attempts = c.fetchone()
        if status in ('failed', 'in_progress', 'pending'):
            if attempts < max_attempts:
                valid_worklist.append(doc_id)
                
    if limit is not None:
        valid_worklist = valid_worklist[:limit]
        
    print(f"Worklist contains {len(valid_worklist)} docs to process.")
    
    processed_count = 0
    working_dir = os.path.dirname(db_path)
    pdf_base_dir = "G:/My Drive/Site_Remediation_Data/PDF_Archive"
    
    for doc_id in valid_worklist:
        ts = datetime.now(timezone.utc).isoformat()
        
        c.execute("UPDATE mm_batch_progress SET status='in_progress', attempts=attempts+1, updated_at=? WHERE doc_id=?", (ts, doc_id))
        conn.commit()
        
        c.execute("SELECT filepath FROM ra_documents WHERE doc_id=?", (doc_id,))
        filepath = c.fetchone()[0]
        full_pdf_path = os.path.join(pdf_base_dir, filepath) if not os.path.isabs(filepath) else filepath
        if not os.path.exists(full_pdf_path):
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
                write_heartbeat(doc_id, ts, db_path)
            else:
                prompt = (
                    f"view the PNGs in {temp_img_dir} and transcribe each sample to {json_out_path} "
                    f"per the {{station_id,date_sampled,depth_top_cm,depth_bottom_cm,media_type,parameters[]}} schema; "
                    f"skip criteria/QA/lab-id/units columns"
                )
                
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
                        f"& 'C:\\Users\\jasen\\AppData\\Local\\agy\\bin\\agy' --model \"Gemini 3.1 Pro (High)\" --print-timeout 15m -p \"{prompt}\""
                    ]
                    print(f"Running AGY for doc {doc_id}...")
                    subprocess.run(agy_cmd, timeout=1200, check=True)
                
                success, err_msg, num_stations = load_single_doc(db_path, doc_id, json_out_path)
                ts = datetime.now(timezone.utc).isoformat()
                if success:
                    final_status = 'done' if num_stations > 0 else 'no_tables'
                    c.execute("UPDATE mm_batch_progress SET status=?, updated_at=? WHERE doc_id=?", (final_status, ts, doc_id))
                else:
                    c.execute("UPDATE mm_batch_progress SET status='failed', last_error=?, updated_at=? WHERE doc_id=?", (err_msg, ts, doc_id))
                conn.commit()
                write_heartbeat(doc_id, ts, db_path)
                
        except Exception as e:
            err = str(e)
            ts = datetime.now(timezone.utc).isoformat()
            c.execute("UPDATE mm_batch_progress SET status='failed', last_error=?, updated_at=? WHERE doc_id=?", (err, ts, doc_id))
            conn.commit()
            write_heartbeat(doc_id, ts, db_path)
        
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
    args = parser.parse_args()
    
    run_batch(args.db, args.doc_ids, args.limit, args.max_attempts, args.crash_after, args.mock_agy)
