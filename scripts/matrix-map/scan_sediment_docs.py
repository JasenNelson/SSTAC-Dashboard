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

    # DB connection
    conn = sqlite3.connect(args.db)
    cursor = conn.cursor()
    
    # Process NON-SEED docs only (site_id > 9) WITH a filepath
    cursor.execute("""
        SELECT doc_id, site_id, filepath, filename, title
        FROM ra_documents
        WHERE site_id > 9 AND filepath IS NOT NULL AND filepath != ''
    """)
    rows = cursor.fetchall()

    # Regexes
    re_sediment_station = re.compile(r"\b(?:sed\s?\d|sed\d{2}-|ss-|gs-)", re.IGNORECASE)
    re_soil_gw_station = re.compile(r"\b(?:bh\d|mw\d|th\d|rw\d)", re.IGNORECASE)
    
    re_sediment = re.compile(r"\bsediment\b", re.IGNORECASE)
    re_soil = re.compile(r"\bsoil\b", re.IGNORECASE)
    re_gw = re.compile(r"\bgroundwater\b|\bground\s+water\b", re.IGNORECASE)
    
    # mg/kg or ug/kg near sediment (within ~150 chars)
    re_table_signal = re.compile(r"(?:mg/kg|ug/kg|mg\s*/\s*kg|ug\s*/\s*kg).{0,150}?sediment|sediment.{0,150}?(?:mg/kg|ug/kg|mg\s*/\s*kg|ug\s*/\s*kg)", re.IGNORECASE | re.DOTALL)

    results = []
    
    counts = {
        "likely_sediment": 0,
        "not_sediment": 0,
        "image_only": 0
    }
    likely_sediment_doc_ids = []
    image_only_doc_ids = []
    
    for row in rows:
        doc_id, site_id, filepath, filename, title = row
        
        pdf_path = filepath
        # Only use os.path.join if filepath is not absolute
        if not os.path.isabs(pdf_path):
            pdf_path = os.path.join(args.pdf_base, filepath)
            
        text_layer = True
        full_text = ""
        
        try:
            doc = fitz.open(pdf_path)
            # read up to 60 pages
            num_pages = min(60, len(doc))
            text_chunks = []
            for i in range(num_pages):
                text_chunks.append(doc[i].get_text("text"))
            doc.close()
            full_text = " ".join(text_chunks)
            if len(full_text.strip()) < 100:
                text_layer = False
        except Exception as e:
            print(f"Failed to open/read {pdf_path}: {e}")
            text_layer = False
            
        if not text_layer:
            classification = "UNKNOWN_IMAGE_ONLY"
            counts["image_only"] += 1
            image_only_doc_ids.append(doc_id)
            
            results.append({
                "doc_id": doc_id,
                "site_id": site_id,
                "filename": filename,
                "class": classification,
                "sediment_station_hits": 0,
                "soil_gw_station_hits": 0,
                "sediment_word": 0,
                "soil_word": 0,
                "groundwater_word": 0,
                "table_signal": 0,
                "text_layer": False,
                "sediment_score": 0
            })
            continue

        lower_text = full_text.lower()
        
        sediment_station_hits = len(re_sediment_station.findall(lower_text))
        soil_gw_station_hits = len(re_soil_gw_station.findall(lower_text))
        
        sediment_word = len(re_sediment.findall(lower_text))
        soil_word = len(re_soil.findall(lower_text))
        groundwater_word = len(re_gw.findall(lower_text))
        
        table_signal = len(re_table_signal.findall(lower_text))
        
        sediment_signal = sediment_station_hits * 3 + sediment_word + table_signal
        nonsed_signal = soil_gw_station_hits * 3 + soil_word + groundwater_word
        
        # Classification logic
        classification = "NOT_SEDIMENT"
        is_likely = False
        if sediment_station_hits > 0:
            is_likely = True
        elif sediment_signal >= 5 and sediment_signal >= nonsed_signal:
            is_likely = True
            
        if is_likely:
            classification = "LIKELY_SEDIMENT"
            counts["likely_sediment"] += 1
            likely_sediment_doc_ids.append(doc_id)
        else:
            counts["not_sediment"] += 1
            
        results.append({
            "doc_id": doc_id,
            "site_id": site_id,
            "filename": filename,
            "class": classification,
            "sediment_station_hits": sediment_station_hits,
            "soil_gw_station_hits": soil_gw_station_hits,
            "sediment_word": sediment_word,
            "soil_word": soil_word,
            "groundwater_word": groundwater_word,
            "table_signal": table_signal,
            "text_layer": True,
            "sediment_score": sediment_signal
        })

    # Sort results to help with finding top 15
    results.sort(key=lambda x: x["sediment_score"], reverse=True)
    
    output = {
        "threshold_notes": "LIKELY if sediment_station_hits > 0 OR (sediment_signal >= 5 AND sediment_signal >= nonsed_signal)",
        "counts": counts,
        "likely_sediment_doc_ids": likely_sediment_doc_ids,
        "image_only_doc_ids": image_only_doc_ids,
        "per_doc": results
    }
    
    out_path = os.path.join("scripts", "matrix-map", "_enrichment_working", "mm_sediment_targets.json")
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, indent=2)

    print("DONE. Counts:", counts)

if __name__ == "__main__":
    main()
