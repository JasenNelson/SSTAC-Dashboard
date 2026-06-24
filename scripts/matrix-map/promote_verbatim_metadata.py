import argparse
import json
import sqlite3
import re
import os
import glob
import traceback
from datetime import datetime

def normalize_sample_id(s):
    if not s: return ""
    return re.sub(r'\s+', '', s).upper()

def parse_date(d_str):
    if not d_str:
        return None
    d_str = str(d_str).strip()
    formats = [
        "%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%Y%m%d",
        "%d-%b-%y", "%d-%b-%Y", "%d/%m/%Y", "%m/%d/%y"
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(d_str, fmt)
            return dt.strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None

def parse_depth(d_str):
    if not d_str:
        return None, None
    d_str = str(d_str).strip()
    match = re.match(r'([\d\.]+)\s*-\s*([\d\.]+)', d_str)
    if match:
        try:
            top = float(match.group(1)) * 100
            bot = float(match.group(2)) * 100
            return round(top), round(bot)
        except ValueError:
            return None, None
    match_single = re.match(r'^([\d\.]+)$', d_str)
    if match_single:
        try:
            val = float(match_single.group(1)) * 100
            return 0, round(val)
        except ValueError:
            return None, None
    return None, None

def process_file(file_path, db_conn):
    report_entry = {
        "file": os.path.basename(file_path),
        "doc_id": None,
        "samples_parsed": 0,
        "with_date": 0,
        "with_depth": 0,
        "matched": 0,
        "unmatched": 0,
        "samples": [],
        "skipped_tables": [],
        "skipped_reason": []
    }
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        doc_id = data.get("extraction_metadata", {}).get("source_document_id")
        if doc_id is None:
            report_entry["skipped_reason"].append("No source_document_id")
            return report_entry
        
        report_entry["doc_id"] = doc_id
        
        candidate_events = []
        if db_conn:
            c = db_conn.cursor()
            # Try to map string doc_id (e.g. SITE0141_5_PSI2_Wharves_Sediment_Hemmera_2011) to integer doc_id
            db_doc_id = doc_id
            if isinstance(doc_id, str) and doc_id.startswith("SITE"):
                parts = doc_id.split('_', 1)
                if len(parts) > 1:
                    filename_like = '%' + parts[1].replace('_', '%') + '%'
                    c.execute("SELECT doc_id FROM ra_documents WHERE filename LIKE ? OR filepath LIKE ?", (filename_like, filename_like))
                    res = c.fetchone()
                    if res:
                        db_doc_id = res[0]

            c.execute("""
                SELECT se.event_id, st.name 
                FROM sampling_events se 
                JOIN stations st ON st.station_id = se.station_id 
                WHERE se.source_table_ref LIKE ?
            """, (f"d{db_doc_id}|%",))
            for row in c.fetchall():
                candidate_events.append({"event_id": row[0], "name": normalize_sample_id(row[1])})

        text_blocks = data.get("text_blocks", [])
        
        for table_idx, block in enumerate(text_blocks):
            if block.get("block_type") != "table":
                continue
                
            headers = block.get("headers", [])
            rows = block.get("rows", [])
            
            if not rows and not headers:
                report_entry["skipped_tables"].append({"table_idx": table_idx, "reason": "No rows and no headers"})
                continue
                
            label_row = None
            label_cell = None
            
            # Check headers first
            if headers:
                for cell in headers:
                    cell_str = str(cell).lower()
                    if 'sample id' in cell_str or 'station' in cell_str or 'location id' in cell_str:
                        label_row = headers
                        label_cell = cell
                        break
                        
            # If not in headers, check first 3 rows
            if not label_row:
                for r in rows[:3]:
                    for cell in r:
                        cell_str = str(cell).lower()
                        if 'sample id' in cell_str or 'station' in cell_str or 'location id' in cell_str:
                            label_row = r
                            label_cell = cell
                            break
                    if label_row:
                        break
                        
            if not label_row:
                report_entry["skipped_tables"].append({"table_idx": table_idx, "reason": "No label row found"})
                continue
                
            header_parts = [p.strip() for p in str(label_cell).split('.')]
            
            sample_id_idx = -1
            date_idx = -1
            depth_idx = -1
            
            for i, p in enumerate(header_parts):
                plower = p.lower()
                if 'sample id' in plower:
                    sample_id_idx = i
                if 'date' in plower:
                    date_idx = i
                if 'depth' in plower:
                    depth_idx = i
                    
            if sample_id_idx == -1:
                for i, p in enumerate(header_parts):
                    plower = p.lower()
                    if 'station' in plower or 'location id' in plower:
                        sample_id_idx = i
                        break
                    
            if sample_id_idx == -1:
                report_entry["skipped_tables"].append({"table_idx": table_idx, "reason": "No sample ID in header"})
                continue
            if date_idx == -1 and depth_idx == -1:
                report_entry["skipped_tables"].append({"table_idx": table_idx, "reason": "Neither date nor depth in header"})
                continue
                
            for cell in label_row:
                if cell == label_cell:
                    continue
                    
                cell_str = str(cell)
                if not cell_str or cell_str == "None": continue
                
                cell_parts = [p.strip() for p in cell_str.split('.')]
                
                # If there are extra parts due to dots in the depth value, merge them into the last field
                if len(cell_parts) > len(header_parts):
                    cell_parts[len(header_parts)-1] = ".".join(cell_parts[len(header_parts)-1:])
                    cell_parts = cell_parts[:len(header_parts)]
                
                # pad if necessary
                while len(cell_parts) < len(header_parts):
                    cell_parts.append("")
                    
                sample_id_raw = cell_parts[sample_id_idx] if sample_id_idx >= 0 and sample_id_idx < len(cell_parts) else ""
                sample_id = normalize_sample_id(sample_id_raw)
                
                # skip if sample ID is purely numeric (plausibility gate)
                if not any(c.isalpha() for c in sample_id):
                    continue
                    
                date_str = cell_parts[date_idx] if date_idx >= 0 and date_idx < len(cell_parts) else ""
                parsed_date = parse_date(date_str)
                
                depth_str = cell_parts[depth_idx] if depth_idx >= 0 and depth_idx < len(cell_parts) else ""
                top_cm, bot_cm = parse_depth(depth_str)
                
                if top_cm is not None and (top_cm < 0 or top_cm > 1000):
                    top_cm, bot_cm = None, None
                if bot_cm is not None and (bot_cm < 0 or bot_cm > 1000):
                    top_cm, bot_cm = None, None
                    
                if not parsed_date and top_cm is None:
                    continue # nothing useful
                    
                matched_event = None
                for ev in candidate_events:
                    if ev["name"] == sample_id:
                        matched_event = ev["event_id"]
                        break
                        
                sample_entry = {
                    "sample_id_raw": sample_id_raw,
                    "sample_id": sample_id,
                    "date": parsed_date,
                    "depth_top_cm": top_cm,
                    "depth_bottom_cm": bot_cm,
                    "matched_event_id": matched_event
                }
                report_entry["samples"].append(sample_entry)
                report_entry["samples_parsed"] += 1
                if parsed_date: report_entry["with_date"] += 1
                if top_cm is not None: report_entry["with_depth"] += 1
                if matched_event: report_entry["matched"] += 1
                else: report_entry["unmatched"] += 1
                    
    except Exception as e:
        report_entry["skipped_reason"].append(f"Error: {str(e)}")
        
    return report_entry

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true", default=True)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=None)
    parser.add_argument("--db", type=str, required=True)
    parser.add_argument("--verbatim-dir", type=str, required=True)
    parser.add_argument("--report", type=str, default="report.json")
    parser.add_argument("--include", type=str, default=None)
    
    args = parser.parse_args()
    if args.apply:
        args.dry_run = False
        
    db_conn = None
    if os.path.exists(args.db):
        db_conn = sqlite3.connect(args.db)
        
    files = sorted(glob.glob(os.path.join(args.verbatim_dir, "*_VERBATIM_COMPLETE.json")), reverse=True)
    
    if args.include:
        include_files = [f for f in files if args.include in f]
        other_files = [f for f in files if args.include not in f]
        files = include_files + other_files
        
    if args.limit:
        files = files[:args.limit]
        
    report = []
    
    for f in files:
        rep = process_file(f, db_conn)
        report.append(rep)
        
    with open(args.report, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2)
        
    if db_conn:
        db_conn.close()

if __name__ == "__main__":
    main()
