import os
import re
import json
import sqlite3
import argparse
import difflib

def normalize_text(t):
    if not t: return ""
    t = re.sub(r'[^a-z0-9]', ' ', t.lower())
    return " ".join(t.split())

def calc_score(frag, filename):
    f_norm = normalize_text(frag)
    d_norm = normalize_text(filename)
    if f_norm == d_norm: return 1.0
    if f_norm and d_norm and (f_norm in d_norm or d_norm in f_norm): return 0.95
    
    f_flat = f_norm.replace(" ", "")
    d_flat = d_norm.replace(" ", "")
    if f_flat and d_flat and (f_flat == d_flat): return 0.93
    if f_flat and d_flat and (f_flat in d_flat or d_flat in f_flat): return 0.9
    
    frag_tokens = set(f_norm.split())
    fn_tokens = set(d_norm.split())
    overlap = len(frag_tokens.intersection(fn_tokens)) / float(max(len(frag_tokens), len(fn_tokens))) if frag_tokens and fn_tokens else 0
    sm = difflib.SequenceMatcher(None, f_norm, d_norm).ratio()
    return overlap * 0.5 + sm * 0.5

def build_manifest(db_path):
    staging_dir = "C:/Projects/Regulatory-Review/2026_Database_Development/data_acquisition/bnrrm_extraction/__reextract_staging"
    
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    
    # 1. Map registry_id -> site_id
    sites_map = {}
    for row in db.execute("SELECT site_id, registry_id FROM sites WHERE registry_id IS NOT NULL"):
        reg = row["registry_id"].strip()
        sites_map[reg] = row["site_id"]
        sites_map[reg.lstrip('0')] = row["site_id"]
        sites_map[reg.zfill(4)] = row["site_id"]

    # 2. Get all docs per site_id
    site_docs = {}
    for row in db.execute("SELECT doc_id, site_id, filename FROM ra_documents"):
        sid = row["site_id"]
        if sid not in site_docs:
            site_docs[sid] = []
        site_docs[sid].append({"doc_id": row["doc_id"], "filename": row["filename"] or ""})
        
    resolved = 0
    unresolved = []
    verbatim_map = {}
    verbatim_docs_list = []
    
    files = [f for f in os.listdir(staging_dir) if f.endswith("_VERBATIM_COMPLETE.json")]
    
    # group files by site_id
    site_files = {}
    for f in files:
        m = re.match(r'^SITE0*(\d+)_(.*)_VERBATIM_COMPLETE\.json$', f)
        if not m:
            m = re.match(r'^SITE(\d+)_(.*)_VERBATIM_COMPLETE\.json$', f)
        if not m:
            unresolved.append({"file": f, "reason": "Regex mismatch"})
            continue
            
        reg_id = m.group(1)
        fragment = m.group(2)
        site_id = sites_map.get(reg_id) or sites_map.get(reg_id.lstrip('0'))
        if not site_id:
            unresolved.append({"file": f, "reason": f"site_id not found for registry_id {reg_id}"})
            continue
            
        if site_id not in site_files:
            site_files[site_id] = []
        site_files[site_id].append((f, fragment))
        
    for site_id, f_list in site_files.items():
        docs = site_docs.get(site_id, [])
        if not docs:
            for f, _ in f_list:
                unresolved.append({"file": f, "reason": "No documents for site"})
            continue
            
        # calculate all pairwise scores
        pairs = []
        for f, frag in f_list:
            for d in docs:
                sc = calc_score(frag, d["filename"])
                pairs.append((sc, f, d))
        
        # sort pairs descending by score
        pairs.sort(key=lambda x: x[0], reverse=True)
        
        assigned_files = set()
        assigned_docs = set()
        
        # greedy assignment
        for sc, f, d in pairs:
            if f in assigned_files or d["doc_id"] in assigned_docs:
                continue
            if sc < 0.6:  # threshold
                continue
            
            assigned_files.add(f)
            assigned_docs.add(d["doc_id"])
            verbatim_map[f] = {"doc_id": d["doc_id"], "site_id": site_id}
            verbatim_docs_list.append(d["doc_id"])
            resolved += 1
            
        for f, _ in f_list:
            if f not in assigned_files:
                unresolved.append({"file": f, "reason": "No good match or document already taken"})

    # 4. Seed site docs
    seed_sites = []
    seed_docs = []
    for row in db.execute("""
        SELECT DISTINCT d.doc_id, s.site_id 
        FROM ra_documents d
        JOIN sites s ON d.site_id = s.site_id
        JOIN stations st ON s.site_id = st.site_id
        JOIN sampling_events se ON st.station_id = se.station_id
        WHERE se.date_sampled IS NOT NULL
    """):
        if row["site_id"] not in seed_sites:
            seed_sites.append(row["site_id"])
        seed_docs.append(row["doc_id"])

    out_dir = os.path.dirname(db_path)
    os.makedirs(out_dir, exist_ok=True)
    
    with open(os.path.join(out_dir, "mm_exclusion_manifest.json"), "w") as fout:
        json.dump({
            "seed_site_docs": seed_docs,
            "verbatim_docs": verbatim_docs_list,
            "verbatim_map": verbatim_map
        }, fout, indent=2)
        
    with open(os.path.join(out_dir, "mm_manifest_report.json"), "w") as fout:
        json.dump({
            "verbatim_total": len(files),
            "resolved": resolved,
            "unresolved": unresolved,
            "seed_sites": seed_sites,
            "seed_site_docs": seed_docs
        }, fout, indent=2)
        
    print(f"MANIFEST resolved {resolved}/{len(files)}, seed_site_docs={len(seed_docs)}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="scripts/matrix-map/_enrichment_working/bnrrm_enhanced.db")
    args = parser.parse_args()
    build_manifest(args.db)
