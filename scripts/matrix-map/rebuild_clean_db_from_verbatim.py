import sqlite3
import json
import re
import os
import glob

def normalize_sample_id(s):
    if not s: return ""
    return re.sub(r'\s+', '', s).upper()

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

def parse_date(d_str):
    if not d_str: return None
    d_str = str(d_str).strip()
    formats = ["%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%Y%m%d", "%d-%b-%y", "%d-%b-%Y", "%d/%m/%Y", "%m/%d/%y"]
    for fmt in formats:
        try:
            from datetime import datetime
            return datetime.strptime(d_str, fmt).strftime("%Y-%m-%d")
        except ValueError: continue
    return None

def parse_depth(d_str):
    if not d_str: return None, None
    d_str = str(d_str).strip()
    match = re.match(r'([\d\.]+)\s*-\s*([\d\.]+)', d_str)
    if match:
        try: return round(float(match.group(1)) * 100), round(float(match.group(2)) * 100)
        except ValueError: return None, None
    match_single = re.match(r'^([\d\.]+)$', d_str)
    if match_single:
        try: return 0, round(float(match_single.group(1)) * 100)
        except ValueError: return None, None
    return None, None

def parse_param_unit(param_str):
    if not param_str: return "", ""
    param_str = param_str.strip()
    match = re.search(r'(.*?)\((.*?)\)$', param_str)
    if match: return match.group(1).strip(), match.group(2).strip()
    return param_str, ""

db_src = sqlite3.connect("scripts/matrix-map/_enrichment_working/bnrrm_enriched_working.db")
db_dest_path = "scripts/matrix-map/_enrichment_working/bnrrm_clean_rebuild.db"
if os.path.exists(db_dest_path): os.remove(db_dest_path)
db_dest = sqlite3.connect(db_dest_path)
c_src = db_src.cursor()
c_dest = db_dest.cursor()

c_src.execute("SELECT sql FROM sqlite_master WHERE type IN ('table', 'index') AND sql IS NOT NULL")
for row in c_src.fetchall():
    c_dest.execute(row[0])

for t in ['sites', 'ra_documents']:
    c_src.execute(f"SELECT * FROM {t}")
    rows = c_src.fetchall()
    cols = [d[0] for d in c_src.description]
    c_dest.executemany(f"INSERT INTO {t} VALUES ({','.join(['?']*len(cols))})", rows)
db_dest.commit()

c_src.execute("SELECT DISTINCT s.site_id FROM stations s JOIN sampling_events se ON se.station_id = s.station_id WHERE se.date_sampled IS NOT NULL")
seed_sites = [r[0] for r in c_src.fetchall()]

for site_id in seed_sites:
    c_src.execute("SELECT * FROM stations WHERE site_id=?", (site_id,))
    st_rows = c_src.fetchall()
    if st_rows:
        cols = [d[0] for d in c_src.description]
        c_dest.executemany(f"INSERT INTO stations VALUES ({','.join(['?']*len(cols))})", st_rows)
        
    c_src.execute("SELECT se.* FROM sampling_events se JOIN stations st ON se.station_id = st.station_id WHERE st.site_id=?", (site_id,))
    se_rows = c_src.fetchall()
    if se_rows:
        cols = [d[0] for d in c_src.description]
        c_dest.executemany(f"INSERT INTO sampling_events VALUES ({','.join(['?']*len(cols))})", se_rows)

    for t in ['sediment_chemistry', 'toxicity_tests', 'benthic_community']:
        c_src.execute(f"SELECT tx.* FROM {t} tx JOIN sampling_events se ON tx.event_id = se.event_id JOIN stations st ON se.station_id = st.station_id WHERE st.site_id=?", (site_id,))
        rows = c_src.fetchall()
        if rows:
            cols = [d[0] for d in c_src.description]
            c_dest.executemany(f"INSERT INTO {t} VALUES ({','.join(['?']*len(cols))})", rows)
db_dest.commit()

c_dest.execute("SELECT MAX(station_id) FROM stations")
max_st = c_dest.fetchone()[0] or 0
c_dest.execute("SELECT MAX(event_id) FROM sampling_events")
max_ev = c_dest.fetchone()[0] or 0
c_dest.execute("SELECT MAX(id) FROM sediment_chemistry")
max_chem = c_dest.fetchone()[0] or 0
c_dest.execute("SELECT MAX(id) FROM toxicity_tests")
max_tox = c_dest.fetchone()[0] or 0
c_dest.execute("SELECT MAX(id) FROM benthic_community")
max_comm = c_dest.fetchone()[0] or 0

v_dir = "C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/__reextract_staging/"
files = glob.glob(os.path.join(v_dir, "*_VERBATIM_COMPLETE.json"))
report = {"docs_processed": 0, "docs_skipped": 0, "tables_skipped": 0}
rejected_stations = []

for f in files:
    try:
        data = json.load(open(f, 'r', encoding='utf-8'))
    except:
        report["docs_skipped"] += 1
        continue
        
    doc_id_str = data.get("extraction_metadata", {}).get("source_document_id")
    if not doc_id_str:
        report["docs_skipped"] += 1; continue
        
    db_doc_id, site_id = doc_id_str, None
    if isinstance(doc_id_str, str) and doc_id_str.startswith("SITE"):
        pts = doc_id_str.split('_', 1)
        if len(pts)>1:
            flike = '%' + pts[1].replace('_', '%') + '%'
            c_dest.execute("SELECT doc_id, site_id FROM ra_documents WHERE filename LIKE ? OR filepath LIKE ?", (flike, flike))
            res = c_dest.fetchone()
            if res: db_doc_id, site_id = res
            
    if not site_id:
        c_dest.execute("SELECT site_id FROM ra_documents WHERE doc_id=?", (db_doc_id,))
        res = c_dest.fetchone()
        if res: site_id = res[0]
        else:
            report["docs_skipped"] += 1; continue
            
    report["docs_processed"] += 1
    
    for tb in data.get("text_blocks", []):
        if tb.get("block_type") != "table": continue
        hdrs, rows = tb.get("headers", []), tb.get("rows", [])
        if not hdrs and not rows: continue
        
        lbl_r, lbl_c, lbl_idx = None, None, -1
        if hdrs:
            for i, cl in enumerate(hdrs):
                if 'sample id' in str(cl).lower() or 'station' in str(cl).lower() or 'location id' in str(cl).lower():
                    lbl_r, lbl_c, lbl_idx = hdrs, cl, i; break
        if not lbl_r:
            for r in rows[:3]:
                for i, cl in enumerate(r):
                    if 'sample id' in str(cl).lower() or 'station' in str(cl).lower() or 'location id' in str(cl).lower():
                        lbl_r, lbl_c, lbl_idx = r, cl, i; break
                if lbl_r: break
        if not lbl_r:
            report["tables_skipped"] += 1; continue
            
        h_pts = [p.strip() for p in str(lbl_c).split('.')]
        s_idx, d_idx, dp_idx = -1, -1, -1
        for i, p in enumerate(h_pts):
            pl = p.lower()
            if 'sample id' in pl: s_idx = i
            if 'date' in pl: d_idx = i
            if 'depth' in pl: dp_idx = i
            
        if s_idx == -1:
            for i, p in enumerate(h_pts):
                pl = p.lower()
                if 'station' in pl or 'location id' in pl:
                    s_idx = i
                    break
        if s_idx == -1: continue
        
        s_cols = {}
        for c_idx, cl in enumerate(lbl_r):
            if c_idx == lbl_idx: continue
            cs = str(cl)
            if not cs or cs=="None": continue
            c_pts = [p.strip() for p in cs.split('.')]
            if len(c_pts) > len(h_pts):
                c_pts[len(h_pts)-1] = ".".join(c_pts[len(h_pts)-1:])
                c_pts = c_pts[:len(h_pts)]
            while len(c_pts) < len(h_pts): c_pts.append("")
            
            s_raw = c_pts[s_idx] if s_idx < len(c_pts) else ""
            s_id = normalize_sample_id(s_raw)
            
            d_str = c_pts[d_idx] if d_idx >= 0 and d_idx < len(c_pts) else ""
            dt = parse_date(d_str)
            dp_str = c_pts[dp_idx] if dp_idx >= 0 and dp_idx < len(c_pts) else ""
            t_cm, b_cm = parse_depth(dp_str)
            if t_cm is not None and (t_cm < 0 or t_cm > 1000): t_cm, b_cm = None, None
            
            if not dt and t_cm is None:
                rejected_stations.append({"sample_id": s_raw, "doc_id": db_doc_id, "reason": "No date or depth"})
                continue
                
            passed, reason = passes_name_gate(s_raw)
            if not passed:
                rejected_stations.append({"sample_id": s_raw, "doc_id": db_doc_id, "reason": reason})
                continue
            
            s_cols[c_idx] = {"sid": s_id, "dt": dt, "t_cm": t_cm, "b_cm": b_cm}
            
        if not s_cols: continue
        
        for c_idx, s in s_cols.items():
            c_dest.execute("SELECT station_id FROM stations WHERE site_id=? AND name=?", (site_id, s["sid"]))
            res = c_dest.fetchone()
            if res: s["stid"] = res[0]
            else:
                max_st += 1; s["stid"] = max_st
                c_dest.execute("INSERT INTO stations (station_id, site_id, name) VALUES (?, ?, ?)", (max_st, site_id, s["sid"]))
                
            c_dest.execute("SELECT event_id FROM sampling_events WHERE station_id=? AND IFNULL(date_sampled,'')=? AND IFNULL(depth_top_cm,'')=? AND IFNULL(depth_bottom_cm,'')=?", 
                           (s["stid"], s["dt"] or '', s["t_cm"] or '', s["b_cm"] or ''))
            res = c_dest.fetchone()
            if res: s["evid"] = res[0]
            else:
                max_ev += 1; s["evid"] = max_ev
                prec = "exact" if s["dt"] else "undated"
                c_dest.execute("INSERT INTO sampling_events (event_id, station_id, date_sampled, depth_top_cm, depth_bottom_cm, media_type) VALUES (?, ?, ?, ?, ?, 'sediment')", 
                               (max_ev, s["stid"], s["dt"], s["t_cm"], s["b_cm"]))
        
        start_r = 0
        if lbl_r in rows: start_r = rows.index(lbl_r) + 1
        
        for r_idx in range(start_r, len(rows)):
            r = rows[r_idx]
            if not r or len(r) <= lbl_idx: continue
            
            p_raw = str(r[lbl_idx]).strip()
            if not p_raw or p_raw == "None": continue
            p_name, p_unit = parse_param_unit(p_raw)
            pl = p_name.lower()
            is_tox = any(x in pl for x in ['survival', 'amphipod', 'mortality', 'eohaustorius', 'hyalella'])
            is_comm = any(x in pl for x in ['abundance', 'richness', 'benthic', 'taxa', 'polychaeta'])
            
            for c_idx, s in s_cols.items():
                if c_idx >= len(r): continue
                v_str = str(r[c_idx]).strip()
                if not v_str or v_str in ("None", "-", "nd", "na", ""): continue
                try: v = float(v_str.replace(',', '').replace('<', '').replace('>', ''))
                except ValueError: v = None
                
                if is_tox:
                    c_dest.execute("INSERT OR IGNORE INTO toxicity_tests (event_id, test_type, result, unit) VALUES (?, ?, ?, ?)", (s["evid"], p_name, v, p_unit))
                elif is_comm:
                    if "abundance" in pl:
                        c_dest.execute("INSERT OR IGNORE INTO benthic_community (event_id, abundance) VALUES (?, ?)", (s["evid"], v))
                    elif "richness" in pl:
                        c_dest.execute("INSERT OR IGNORE INTO benthic_community (event_id, taxa_richness) VALUES (?, ?)", (s["evid"], v))
                    else:
                        c_dest.execute("INSERT OR IGNORE INTO benthic_community (event_id, notes) VALUES (?, ?)", (s["evid"], f"{p_name}: {v_str}"))
                else:
                    c_dest.execute("INSERT OR IGNORE INTO sediment_chemistry (event_id, parameter, value, unit) VALUES (?, ?, ?, ?)", (s["evid"], p_name, v, p_unit))
db_dest.commit()
db_dest.close()

with open("scripts/matrix-map/_enrichment_working/rebuild_report.json", "w") as f:
    json.dump(report, f, indent=2)

with open("scripts/matrix-map/_enrichment_working/rejected_stations.json", "w") as f:
    json.dump(rejected_stations, f, indent=2)
