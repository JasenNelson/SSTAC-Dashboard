import sqlite3
import pandas as pd

mm_conn = sqlite3.connect("C:/Projects/sstac-dashboard/scripts/matrix-map/_enrichment_working/bnrrm_multimodal_validation.db")
v_conn = sqlite3.connect("C:/Projects/sstac-dashboard/scripts/matrix-map/_enrichment_working/bnrrm_clean_rebuild.db")

print("--- MULTIMODAL DB SUMMARY ---")
mm_df = pd.read_sql_query("SELECT doc_id, COUNT(DISTINCT station_id) as stations, COUNT(*) as params FROM mm_results GROUP BY doc_id", mm_conn)
print(mm_df)

print("\n--- VERBATIM DB SUMMARY ---")
q = """
SELECT r.filename, COUNT(DISTINCT st.station_id) as stations, COUNT(sc.id) as chem_records
FROM ra_documents r
LEFT JOIN stations st ON r.site_id = st.site_id
LEFT JOIN sampling_events se ON st.station_id = se.station_id
LEFT JOIN sediment_chemistry sc ON se.event_id = sc.event_id
WHERE r.filename LIKE '%17098 241108 HHERA%' 
   OR r.filename LIKE '%13Jun04 Response%' 
   OR r.filename LIKE '%2022-08-26%' 
   OR r.filename LIKE '%Lot C_Addendum%'
GROUP BY r.filename
"""
try:
    v_df = pd.read_sql_query(q, v_conn)
    print(v_df)
except Exception as e:
    print(f"Error querying verbatim db: {e}")

