import json
import sqlite3
import os
import glob
import re

def normalize_ascii(text):
    if text is None: return None
    t = str(text)
    # the prompt specifies ug/g not µg/g
    t = t.replace("µ", "u")
    return "".join(c for c in t if ord(c) <= 127)

def passes_name_gate(sid_raw):
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

def load_mm_results():
    db_src_path = "C:/Projects/sstac-dashboard/scripts/matrix-map/_enrichment_working/bnrrm_clean_rebuild.db"
    db_dest_path = "C:/Projects/sstac-dashboard/scripts/matrix-map/_enrichment_working/bnrrm_multimodal_validation.db"
    
    if os.path.exists(db_dest_path):
        os.remove(db_dest_path)
        
    db_src = sqlite3.connect(db_src_path)
    db_dest = sqlite3.connect(db_dest_path)
    
    c_src = db_src.cursor()
    c_dest = db_dest.cursor()
    
    # Copy schema
    c_src.execute("SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') AND sql IS NOT NULL")
    for row in c_src.fetchall():
        c_dest.execute(row[0])
        
    # Copy sites and ra_documents
    for t in ['sites', 'ra_documents']:
        c_src.execute(f"SELECT * FROM {t}")
        rows = c_src.fetchall()
        cols = [d[0] for d in c_src.description]
        c_dest.executemany(f"INSERT INTO {t} VALUES ({','.join(['?']*len(cols))})", rows)
    db_dest.commit()
    
    c_dest.execute("SELECT MAX(station_id) FROM stations")
    max_st = c_dest.fetchone()[0] or 0
    c_dest.execute("SELECT MAX(event_id) FROM sampling_events")
    max_ev = c_dest.fetchone()[0] or 0
    
    quarantine = []
    
    files = glob.glob("C:/Projects/sstac-dashboard/scripts/matrix-map/_enrichment_working/mm_*.json")
    for f in files:
        doc_id_str = os.path.basename(f).replace("mm_doc", "").replace(".json", "")
        try:
            doc_id = int(doc_id_str)
        except ValueError:
            print(f"Skipping {f}, invalid doc_id format {doc_id_str}")
            continue
            
        c_dest.execute("SELECT site_id FROM ra_documents WHERE doc_id=?", (doc_id,))
        res = c_dest.fetchone()
        if not res:
            print(f"Skipping {f}, no site_id found for doc_id {doc_id}")
            continue
        site_id = res[0]
        
        with open(f, 'r') as fp:
            try:
                data = json.load(fp)
            except json.JSONDecodeError:
                continue
                
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
                    quarantine.append({"doc_id": doc_id, "station_id": station_id_raw, "reason": reason})
                    continue
                    
                # Get or create station
                c_dest.execute("SELECT station_id FROM stations WHERE site_id=? AND name=?", (site_id, station_id_raw))
                st_res = c_dest.fetchone()
                if st_res:
                    st_id = st_res[0]
                else:
                    max_st += 1
                    st_id = max_st
                    c_dest.execute("INSERT INTO stations (station_id, site_id, name) VALUES (?, ?, ?)", (max_st, site_id, station_id_raw))
                    
                # Get or create event
                c_dest.execute("SELECT event_id FROM sampling_events WHERE station_id=? AND IFNULL(date_sampled,'')=? AND IFNULL(depth_top_cm,'')=? AND IFNULL(depth_bottom_cm,'')=?", 
                               (st_id, date_sampled or '', depth_top or '', depth_bottom or ''))
                ev_res = c_dest.fetchone()
                if ev_res:
                    ev_id = ev_res[0]
                else:
                    max_ev += 1
                    ev_id = max_ev
                    media_type = row.get("media_type") or "sediment"
                    c_dest.execute("INSERT INTO sampling_events (event_id, station_id, date_sampled, depth_top_cm, depth_bottom_cm, media_type) VALUES (?, ?, ?, ?, ?, ?)", 
                                   (ev_id, st_id, date_sampled, depth_top, depth_bottom, media_type))
                                   
                # Insert parameters
                for param in row.get("parameters", []):
                    p_name = normalize_ascii(param.get("name"))
                    p_val = param.get("value")
                    p_unit = normalize_ascii(param.get("unit"))
                    
                    try:
                        v = float(str(p_val).replace(',', '').replace('<', '').replace('>', ''))
                    except (ValueError, TypeError):
                        v = None
                        
                    if p_name:
                        c_dest.execute("INSERT OR IGNORE INTO sediment_chemistry (event_id, parameter, value, unit) VALUES (?, ?, ?, ?)", (ev_id, p_name, v, p_unit))

    db_dest.commit()
    db_dest.close()
    
    with open("C:/Projects/sstac-dashboard/scripts/matrix-map/_enrichment_working/mm_quarantine.json", "w") as f:
        json.dump(quarantine, f, indent=2)
        
    print(f"Loaded {len(files)} files into bnrrm_multimodal_validation.db")
    print(f"Quarantined {len(quarantine)} samples")

if __name__ == "__main__":
    load_mm_results()
