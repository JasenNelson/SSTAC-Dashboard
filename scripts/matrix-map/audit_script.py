import argparse
import sqlite3
import json
from collections import Counter
import re

parser = argparse.ArgumentParser(description="Audit counts and station-name quality for the BN-RRM rebuild DB.")
parser.add_argument(
    "--db",
    default="scripts/matrix-map/_enrichment_working/bnrrm_clean_rebuild.db",
    help="Path to the SQLite DB to audit (default: bnrrm_clean_rebuild.db).",
)
args = parser.parse_args()

db_path = args.db
conn = sqlite3.connect(db_path)
c = conn.cursor()

c.execute('SELECT COUNT(*) FROM stations')
stations_count = c.fetchone()[0]

c.execute('SELECT COUNT(*) FROM sampling_events')
events_count = c.fetchone()[0]

c.execute('SELECT COUNT(*) FROM sediment_chemistry')
sediment_count = c.fetchone()[0]

c.execute('SELECT COUNT(*) FROM toxicity_tests')
tox_count = c.fetchone()[0]

c.execute('SELECT COUNT(*) FROM benthic_community')
comm_count = c.fetchone()[0]

c.execute('SELECT COUNT(*) FROM sampling_events WHERE date_sampled IS NOT NULL AND date_sampled != ""')
events_with_date = c.fetchone()[0]

c.execute('SELECT COUNT(*) FROM sampling_events WHERE depth_top_cm IS NOT NULL AND depth_top_cm != ""')
events_with_depth = c.fetchone()[0]

c.execute('SELECT name FROM stations')
station_names = [r[0] for r in c.fetchall()]

well_like = 0
suspect = []
for n in station_names:
    norm = re.sub(r'[^A-Z0-9]', '', str(n).upper())
    has_l = any(ch.isalpha() for ch in norm)
    has_d = any(ch.isdigit() for ch in norm)
    if has_l and has_d:
        well_like += 1
    else:
        suspect.append(n)

suspect_counter = Counter(suspect)
top_suspects = suspect_counter.most_common(20)

c.execute("SELECT site_id FROM sites WHERE name LIKE '%SITE0141%' OR registry_id='SITE0141' OR site_id='SITE0141'")
site_id_res = c.fetchone()
site_id = site_id_res[0] if site_id_res else 'SITE0141'

c.execute("SELECT name FROM stations WHERE site_id=?", (site_id,))
s141_stations = [r[0] for r in c.fetchall()]

s141_events = []
c.execute("SELECT date_sampled, depth_top_cm, depth_bottom_cm FROM sampling_events se JOIN stations st ON se.station_id = st.station_id WHERE st.site_id=?", (site_id,))
s141_events = c.fetchall()

print('Counts:')
print(f'  Stations: {stations_count}')
print(f'  Events: {events_count}')
print(f'  Sediment: {sediment_count}')
print(f'  Toxicity: {tox_count}')
print(f'  Community: {comm_count}')
print(f'  Events w/ Date: {events_with_date}')
print(f'  Events w/ Depth: {events_with_depth}')
print('\nStation Names:')
pct_well = well_like / stations_count * 100 if stations_count else 0
print(f'  Well-like: {well_like} ({pct_well:.1f}%)')
print(f'  Suspect: {len(suspect)} ({(100 - pct_well):.1f}%)')
print('  Top 20 Suspects:')
for s, c_ in top_suspects: print(f'    {s}: {c_}')

print('\nSITE0141:')
print(f'  Stations: {s141_stations}')
print(f'  Events: {s141_events}')

try:
    with open('scripts/matrix-map/_enrichment_working/rejected_stations.json') as f:
        rj = json.load(f)
    print(f'\nRejected Stations: {len(rj)}')
    rs_reasons = Counter([r["reason"] for r in rj])
    print('  Top reasons:')
    for reason, count in rs_reasons.most_common(10):
        print(f'    {reason}: {count}')
except Exception as e:
    print(f'Error reading rejected_stations.json: {e}')
