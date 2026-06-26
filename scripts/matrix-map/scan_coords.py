import sqlite3
import argparse
import fitz
import re
import json
import os

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", default=r"scripts/matrix-map/_enrichment_working/bnrrm_enhanced.db")
    parser.add_argument("--pdf-base", default=r"G:/My Drive/Site_Remediation_Data/PDF_Archive/")
    args = parser.parse_args()

    if not os.path.exists(args.db):
        print(f"ERROR: Database file not found: {args.db}")
        return

    # DB connection
    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()
    
    # Query all documents associated with the 70 sediment-bearing sites
    cursor.execute("""
        SELECT DISTINCT doc_id, site_id, filepath, filename, title
        FROM ra_documents
        WHERE site_id IN (
            SELECT DISTINCT site_id FROM stations
            JOIN sampling_events se ON se.station_id = stations.station_id
            JOIN sediment_chemistry sc ON sc.event_id = se.event_id
        ) AND filepath IS NOT NULL AND filepath != ''
    """)
    rows = cursor.fetchall()
    print(f"Found {len(rows)} candidate documents to scan at sediment sites.")

    results = []
    counts = {
        "HAS_COORD_TABLE": 0,
        "FIGURE_ONLY": 0,
        "NONE": 0,
        "IMAGE_ONLY": 0
    }
    
    table_docs = []
    figure_docs = []
    
    for row in rows:
        doc_id, site_id, filepath, filename, title = row
        
        pdf_path = filepath
        # Support absolute or relative paths
        if not os.path.isabs(pdf_path):
            pdf_path = os.path.join(args.pdf_base, filepath)
            
        has_table = False
        has_figure = False
        text_layer = True
        pages_scanned_count = 0
        total_len = 0
        
        try:
            doc = fitz.open(pdf_path)
            num_pages = len(doc)
            for i in range(num_pages):
                pages_scanned_count += 1
                try:
                    text = doc[i].get_text("text").lower()
                except Exception:
                    text = ""
                total_len += len(text)
                
                # Check for coordinate tables and figure patterns
                contains_e_n = "easting" in text and "northing" in text
                contains_lat_lon = "latitude" in text and "longitude" in text
                
                if contains_e_n or contains_lat_lon:
                    has_table = True
                    break
                    
                # Figure pattern: contains UTM/Albers/NAD keywords but not in a table layout
                contains_spatial_keywords = any(kw in text for kw in [
                    "zone 10", "zone 11", "utm zone", "nad83", "nad27", "bc albers", "projection"
                ])
                if contains_spatial_keywords:
                    has_figure = True
            doc.close()
            
            if not has_table and total_len < 100:
                text_layer = False
        except Exception as e:
            print(f"Failed to read doc {doc_id} at {pdf_path}: {e}")
            text_layer = False
            
        if not text_layer:
            classification = "IMAGE_ONLY"
            counts["IMAGE_ONLY"] += 1
            results.append({
                "doc_id": doc_id,
                "site_id": site_id,
                "filename": filename,
                "class": classification,
                "text_layer": False,
                "pages_scanned": pages_scanned_count
            })
            continue

        if has_table:
            classification = "HAS_COORD_TABLE"
            counts["HAS_COORD_TABLE"] += 1
            table_docs.append(doc_id)
        elif has_figure:
            classification = "FIGURE_ONLY"
            counts["FIGURE_ONLY"] += 1
            figure_docs.append(doc_id)
        else:
            classification = "NONE"
            counts["NONE"] += 1

        results.append({
            "doc_id": doc_id,
            "site_id": site_id,
            "filename": filename,
            "class": classification,
            "text_layer": True,
            "pages_scanned": pages_scanned_count
        })

    output = {
        "scan_metadata": "Targeting coordinate tables and figures at sediment-bearing sites.",
        "counts": counts,
        "has_coord_table_doc_ids": table_docs,
        "figure_only_doc_ids": figure_docs,
        "per_doc": results
    }
    
    out_path = os.path.join("scripts", "matrix-map", "_enrichment_working", "mm_coordinate_targets.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print("SCAN COMPLETE. Counts:", counts)
    conn.close()

if __name__ == "__main__":
    main()
