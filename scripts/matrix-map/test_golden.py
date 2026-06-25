import argparse
import sqlite3
import os

parser = argparse.ArgumentParser(description="Golden-set regression checks for the BN-RRM rebuild DB.")
parser.add_argument(
    "--db",
    default=r"C:\Projects\sstac-dashboard\scripts\matrix-map\_enrichment_working\bnrrm_clean_rebuild.db",
    help="Path to the SQLite DB to validate (default: bnrrm_clean_rebuild.db).",
)
args = parser.parse_args()

db_path = args.db
conn = sqlite3.connect(db_path)
cursor = conn.cursor()

site_id_row = cursor.execute("SELECT site_id FROM sites WHERE name='SITE0141' OR registry_id='0141'").fetchone()
if not site_id_row:
    print('SITE0141 not found')
else:
    site_id = site_id_row[0]
    st = cursor.execute("SELECT station_id FROM stations WHERE name='SED11-137A' AND site_id=?", (site_id,)).fetchone()
    if st:
        ev = cursor.execute("SELECT date_sampled, depth_top_cm, depth_bottom_cm FROM sampling_events WHERE station_id=?", (st[0],)).fetchone()
        print(f'SED11-137A: {ev}')
    else:
        print('SED11-137A not found')

junk_query = """
    SELECT name FROM stations
    WHERE name LIKE '%CSR%'
       OR name LIKE '%STANDARD%'
       OR name LIKE '%EVERGLADES%'
       OR name LIKE '%FISH%'
       OR name LIKE 'L%-%'
       OR length(name) > 20
"""
junk = cursor.execute(junk_query).fetchall()
print(f'Junk stations found: {len(junk)}')
if junk:
    print(f'Some junk: {junk[:10]}')
