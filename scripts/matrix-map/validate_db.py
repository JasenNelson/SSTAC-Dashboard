import argparse
import sqlite3
import json

parser = argparse.ArgumentParser(description="Validate the BN-RRM rebuild DB against the enriched source DB.")
parser.add_argument(
    "--src-db",
    default="scripts/matrix-map/_enrichment_working/bnrrm_enriched_working.db",
    help="Path to the source/enriched DB to compare from (default: bnrrm_enriched_working.db).",
)
parser.add_argument(
    "--db",
    default="scripts/matrix-map/_enrichment_working/bnrrm_clean_rebuild.db",
    help="Path to the destination/rebuilt DB to validate (default: bnrrm_clean_rebuild.db).",
)
args = parser.parse_args()

db_src = sqlite3.connect(args.src_db)
db_dest = sqlite3.connect(args.db)

counts = {}
for t in ['stations', 'sampling_events', 'sediment_chemistry', 'toxicity_tests', 'benthic_community']:
    src_cnt = db_src.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    dest_cnt = db_dest.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0]
    counts[t] = {"src": src_cnt, "dest": dest_cnt}

events_dated = db_dest.execute("SELECT COUNT(*) FROM sampling_events WHERE date_sampled IS NOT NULL").fetchone()[0]
events_depth = db_dest.execute("SELECT COUNT(*) FROM sampling_events WHERE depth_top_cm IS NOT NULL").fetchone()[0]

# SITE0141 acceptance checks
# doc_id 28 -> site_id
site_0141_id = db_dest.execute("SELECT site_id FROM ra_documents WHERE doc_id=28").fetchone()[0]

checks = {}

# have REAL stations SED11-137A, SED11-145A, ... (NOT "Everglades"/"Large Fish"/"BC Standard").
c1 = db_dest.execute("SELECT COUNT(*) FROM stations WHERE site_id=? AND name IN ('SED11-137A', 'SED11-145A')", (site_0141_id,)).fetchone()[0]
checks["Has REAL stations SED11-137A, SED11-145A"] = "PASS" if c1 >= 2 else f"FAIL (found {c1})"

# SED11-137A event: date_sampled='2011-06-16', depth_top_cm=0, depth_bottom_cm=30.
ev_check = db_dest.execute("SELECT date_sampled, depth_top_cm, depth_bottom_cm FROM sampling_events se JOIN stations st ON se.station_id = st.station_id WHERE st.site_id=? AND st.name='SED11-137A'", (site_0141_id,)).fetchone()
if ev_check and ev_check[0] == '2011-06-16' and ev_check[1] == 0 and ev_check[2] == 30:
    checks["SED11-137A exact event match"] = "PASS"
else:
    checks["SED11-137A exact event match"] = f"FAIL (got {ev_check})"

# have sediment_chemistry rows for those stations
chem_check = db_dest.execute("SELECT COUNT(*) FROM sediment_chemistry sc JOIN sampling_events se ON sc.event_id=se.event_id JOIN stations st ON se.station_id=st.station_id WHERE st.site_id=? AND st.name='SED11-137A' AND sc.parameter IS NOT NULL AND sc.value IS NOT NULL", (site_0141_id,)).fetchone()[0]
checks["Chemistry rows for SED11-137A"] = "PASS" if chem_check > 0 else "FAIL"

# ZERO stations named like 'Everglades%', etc
bad_names = ['Everglades%', 'Large Fish%', 'BC Standard%', 'CSR %', 'All OUs', 'Laboratory%']
q = " OR ".join([f"name LIKE '{b}'" for b in bad_names])
bad_count = db_dest.execute(f"SELECT COUNT(*) FROM stations WHERE site_id=? AND ({q})", (site_0141_id,)).fetchone()[0]
checks["ZERO junk stations"] = "PASS" if bad_count == 0 else f"FAIL (found {bad_count})"

with open("scripts/matrix-map/_enrichment_working/rebuild_report.json", "r") as f:
    report = json.load(f)

print("=== COUNTS ===")
for t, c in counts.items():
    print(f"{t}: {c['src']} -> {c['dest']}")
print(f"Events with date: {events_dated}")
print(f"Events with depth: {events_depth}")
print("\n=== DOCS ===")
print(f"Processed: {report['docs_processed']}")
print(f"Skipped: {report['docs_skipped']}")
print(f"Tables Skipped: {report.get('tables_skipped', 0)}")
print("\n=== SITE0141 CHECKS ===")
for k, v in checks.items():
    print(f"{k}: {v}")
