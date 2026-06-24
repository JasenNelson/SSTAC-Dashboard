import json
import sqlite3
import os
import glob

def load_mm_results():
    db_path = "C:/Projects/sstac-dashboard/scripts/matrix-map/_enrichment_working/bnrrm_multimodal_validation.db"
    if os.path.exists(db_path):
        os.remove(db_path)
    
    conn = sqlite3.connect(db_path)
    c = conn.cursor()
    
    c.execute('''
        CREATE TABLE mm_results (
            doc_id TEXT,
            station_id TEXT,
            date_sampled TEXT,
            depth_top_cm INTEGER,
            depth_bottom_cm INTEGER,
            media_type TEXT,
            parameter TEXT,
            value TEXT,
            unit TEXT
        )
    ''')
    
    files = glob.glob("C:/Projects/sstac-dashboard/scripts/matrix-map/_enrichment_working/mm_*.json")
    for f in files:
        doc_id = os.path.basename(f).replace("mm_", "").replace(".json", "")
        with open(f, 'r') as fp:
            data = json.load(fp)
            for row in data:
                station_id = row.get("station_id")
                date_sampled = row.get("date_sampled")
                depth_top = row.get("depth_top_cm")
                depth_bottom = row.get("depth_bottom_cm")
                media_type = row.get("media_type")
                
                for param in row.get("parameters", []):
                    c.execute('''
                        INSERT INTO mm_results 
                        (doc_id, station_id, date_sampled, depth_top_cm, depth_bottom_cm, media_type, parameter, value, unit)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ''', (doc_id, station_id, date_sampled, depth_top, depth_bottom, media_type, param.get("name"), param.get("value"), param.get("unit")))
                    
    conn.commit()
    conn.close()
    print(f"Loaded {len(files)} files into bnrrm_multimodal_validation.db")

if __name__ == "__main__":
    load_mm_results()
