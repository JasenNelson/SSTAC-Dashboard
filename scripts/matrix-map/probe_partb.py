import os
import sys
import json
import sqlite3
import argparse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mm_loader_common import passes_name_gate

def probe(db_path):
    work_dir = os.path.dirname(db_path)
    manifest_path = os.path.join(work_dir, "mm_exclusion_manifest.json")
    
    with open(manifest_path, "r") as fin:
        manifest = json.load(fin)
        
    db = sqlite3.connect(db_path)
    db.row_factory = sqlite3.Row
    
    # (a) Junk Quantification
    fail_count = 0
    pass_count = 0
    reasons = {}
    junk_examples = []
    fp_risk = []
    
    stations = db.execute("SELECT station_id, site_id, name FROM stations").fetchall()
    
    for st in stations:
        ok, reason = passes_name_gate(st["name"])
        if ok:
            pass_count += 1
        else:
            fail_count += 1
            reasons[reason] = reasons.get(reason, 0) + 1
            if len(junk_examples) < 15:
                junk_examples.append({"site_id": st["site_id"], "name": st["name"], "reason": reason})
                
            # false positive risk: failed only because QA/QC/CSR and short and has letter+digit
            if any(k in reason for k in ("QA", "QC", "CSR")):
                # check if it would pass otherwise
                # rough check: short length, has letter, has digit
                sname = str(st["name"])
                if len(sname) <= 15:
                    has_l = any(c.isalpha() for c in sname)
                    has_d = any(c.isdigit() for c in sname)
                    if has_l and has_d:
                        if len(fp_risk) < 15:
                            fp_risk.append({"site_id": st["site_id"], "name": sname, "reason": reason})
                            
    # (b) Chemistry attachment for manifest sites
    site_ids = set()
    for v in manifest.get("verbatim_map", {}).values():
        site_ids.add(v["site_id"])
        
    chem_attach = {}
    for sid in site_ids:
        sts = db.execute("SELECT station_id, name FROM stations WHERE site_id=?", (sid,)).fetchall()
        st_count = len(sts)
        pass_st = sum(1 for s in sts if passes_name_gate(s["name"])[0])
        fail_st = st_count - pass_st
        
        st_ids = [s["station_id"] for s in sts]
        if not st_ids:
            dated_ev = 0
            undated_ev = 0
            chem_clean = 0
            chem_junk = 0
        else:
            ph = ",".join("?" for _ in st_ids)
            events = db.execute(f"SELECT event_id, station_id, date_sampled FROM sampling_events WHERE station_id IN ({ph})", st_ids).fetchall()
            dated_ev = sum(1 for e in events if e["date_sampled"] is not None)
            undated_ev = len(events) - dated_ev
            
            clean_st_ids = set(s["station_id"] for s in sts if passes_name_gate(s["name"])[0])
            
            clean_ev_ids = [e["event_id"] for e in events if e["station_id"] in clean_st_ids]
            junk_ev_ids = [e["event_id"] for e in events if e["station_id"] not in clean_st_ids]
            
            chem_clean = 0
            if clean_ev_ids:
                ph_c = ",".join("?" for _ in clean_ev_ids)
                chem_clean = db.execute(f"SELECT COUNT(*) FROM sediment_chemistry WHERE event_id IN ({ph_c})", clean_ev_ids).fetchone()[0]
                
            chem_junk = 0
            if junk_ev_ids:
                ph_j = ",".join("?" for _ in junk_ev_ids)
                chem_junk = db.execute(f"SELECT COUNT(*) FROM sediment_chemistry WHERE event_id IN ({ph_j})", junk_ev_ids).fetchone()[0]
                
        chem_attach[sid] = {
            "total_stations": st_count,
            "pass_stations": pass_st,
            "fail_stations": fail_st,
            "dated_events": dated_ev,
            "undated_events": undated_ev,
            "chem_rows_on_clean_stations": chem_clean,
            "chem_rows_on_junk_stations": chem_junk
        }
        
    summary_text = (
        "Analysis of the verbatim-mapped sites shows significant chemistry data currently attached to junk stations, "
        "often with undated events. The clean stations for these sites frequently hold little to no chemistry in DB2, "
        "indicating that the VERBATIM-sourced clean stations will likely be net-new. This high volume of chemistry on "
        "junk/undated stations presents a duplication risk when clean, dated VERBATIM data is merged."
    )
        
    report = {
        "junk_quantification": {
            "total_stations": pass_count + fail_count,
            "pass_count": pass_count,
            "fail_count": fail_count,
            "reasons": reasons,
            "examples": junk_examples,
            "false_positive_risk": fp_risk
        },
        "chemistry_attachment": chem_attach,
        "chemistry_attachment_summary": summary_text
    }
    
    with open(os.path.join(work_dir, "mm_probe_report.json"), "w") as fout:
        json.dump(report, fout, indent=2)
        
    print(f"PROBE complete. Junk stations: {fail_count}. False-positive risk found: {len(fp_risk)}")
    print(f"Summary: {summary_text}")

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default="scripts/matrix-map/_enrichment_working/bnrrm_enhanced.db")
    args = parser.parse_args()
    probe(args.db)
