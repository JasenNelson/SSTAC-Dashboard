"""DEPRECATED standalone validation loader -- the CANONICAL load path is
mm_batch_runner.load_single_doc (which uses mm_loader_common). Kept for the one-off
4-doc validation flow; rewired to the shared, correctness-fixed helpers so it no
longer carries the null-unit-drop / zero-depth-dup / silent-reject bugs."""
import json
import sqlite3
import os
import sys
import glob

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import mm_loader_common as L

normalize_ascii = L.normalize_ascii
passes_name_gate = L.passes_name_gate


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

    quarantine = []

    files = glob.glob("C:/Projects/sstac-dashboard/scripts/matrix-map/_enrichment_working/mm_*.json")
    for f in files:
        # Runner emits mm_<doc>.json; legacy was mm_doc<doc>.json. Handle both.
        base = os.path.basename(f)
        doc_id_str = base.replace("mm_doc", "").replace("mm_", "").replace(".json", "")
        try:
            doc_id = int(doc_id_str)
        except ValueError:
            print(f"Skipping {f}, invalid doc_id format {doc_id_str}")
            continue

        res = c_dest.execute("SELECT site_id FROM ra_documents WHERE doc_id=?", (doc_id,)).fetchone()
        if not res:
            print(f"Skipping {f}, no site_id found for doc_id {doc_id}")
            continue
        site_id = res[0]

        with open(f, 'r', encoding='utf-8') as fp:
            try:
                data = json.load(fp)
            except json.JSONDecodeError:
                continue
            if not isinstance(data, list):
                continue

            for row in data:
                if not isinstance(row, dict):
                    continue
                station_id_raw = row.get("station_id")
                date_sampled = row.get("date_sampled")
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
                    quarantine.append({"doc_id": doc_id, "station_id": station_id_raw, "reason": reason})
                    continue

                st_id = L.find_or_create_station(c_dest, site_id, station_id_raw)
                ev_id = L.find_or_create_event(c_dest, st_id, date_sampled, depth_top,
                                               depth_bottom, row.get("media_type") or "sediment")
                for param in row.get("parameters", []) or []:
                    L.insert_chemistry(c_dest, ev_id, param.get("name"),
                                       L.coerce_value(param.get("value")), param.get("unit"),
                                       quarantine, doc_id=doc_id, source="mm_db_load")

    db_dest.commit()
    db_dest.close()
    
    with open("C:/Projects/sstac-dashboard/scripts/matrix-map/_enrichment_working/mm_quarantine.json", "w") as f:
        json.dump(quarantine, f, indent=2)
        
    print(f"Loaded {len(files)} files into bnrrm_multimodal_validation.db")
    print(f"Quarantined {len(quarantine)} samples")

if __name__ == "__main__":
    load_mm_results()
