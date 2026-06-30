import os
import sqlite3
import json
import re
import math
import csv
import fitz
from pyproj import Transformer

# Helper functions from mm_loader_common
import sys
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import mm_loader_common as L

# Haversine distance formula
def haversine_distance(lat1, lon1, lat2, lon2):
    R = 6371000.0  # meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dlambda = math.radians(lon2 - lon1)
    a = (math.sin(dphi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * (math.sin(dlambda / 2.0) ** 2))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

# Load site centroids from geocoding CSV
def load_site_centroids(csv_path):
    centroids = {}
    if not os.path.exists(csv_path):
        print(f"WARNING: Geocoding CSV not found at {csv_path}")
        return centroids
    with open(csv_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                sid = int(row["site_id"])
                lat = float(row["latitude"])
                lon = float(row["longitude"])
                centroids[sid] = (lat, lon)
            except (ValueError, TypeError, KeyError):
                continue
    return centroids

# Parse DMS string or numbers to decimal degrees
def dms_to_dd(deg, m, s, direction="N"):
    try:
        abs_deg = abs(float(deg))
        dd = abs_deg + float(m)/60.0 + float(s)/3600.0
        if float(deg) < 0 or direction in ("S", "W") or (direction == "" and float(deg) > 100):
            dd = -dd
        return dd
    except (ValueError, TypeError):
        return None

# Perform doc-wide search for projection (datum + zone)
def detect_projection(pages_text):
    combined = " ".join(pages_text).lower()
    
    # 1. Check for native decimal Lat/Lon keywords (if no UTM zones are mentioned, we can skip UTM)
    has_lat_lon = bool(re.search(r"\blatitude\b|\blongitude\b", combined))
    
    # 2. Datum detection
    has_nad83 = bool(re.search(r"\bnad\s*1983\b|\bnad\s*83\b|\bcsrs\b", combined))
    has_nad27 = bool(re.search(r"\bnad\s*1927\b|\bnad\s*27\b", combined))
    has_wgs84 = bool(re.search(r"\bwgs\s*1984\b|\bwgs\s*84\b", combined))
    
    # Conflict check for datum
    datums_found = []
    if has_nad83: datums_found.append("NAD83")
    if has_nad27: datums_found.append("NAD27")
    if has_wgs84: datums_found.append("WGS84")
    
    if len(datums_found) > 1:
        return "conflict", None, f"Conflicting datums found: {datums_found}"
        
    datum = datums_found[0] if datums_found else None
        
    # 3. Zone/Albers detection
    has_albers = bool(re.search(r"\bbc\s*albers\b|\bbc-albers\b", combined))
    
    # Find all UTM zones mentioned (allow trailing zone letter suffix like 10N)
    zones_found = set()
    for m in re.finditer(r"\b(?:zone|utm)\s*(10|11|9|8|7)[a-z]?\b", combined):
        zones_found.add(int(m.group(1)))
        
    if has_albers and len(zones_found) > 0:
        return "conflict", None, f"Conflicting projections found: BC Albers and UTM zone(s) {zones_found}"

    if has_albers:
        if datum and datum != "NAD83":
            return "conflict", None, f"BC Albers implies NAD83 but conflicting datum found: {datum}"
        return "NAD83", "albers", None
        
    if len(zones_found) > 1:
        return "conflict", None, f"Conflicting UTM zones found: {zones_found}"
        
    zone = zones_found.pop() if zones_found else None
    
    if not datum and not zone:
        return "missing", None, "No projection datum or zone found doc-wide"
        
    if zone and not datum:
        return "missing_datum", zone, "UTM zone found but datum is unstated"
        
    if datum and not zone and datum != "albers":
        if has_lat_lon:
            # Lat/lon document, we don't strictly need a UTM zone
            return datum, "latlon", None
        return "missing_zone", None, "Datum found but UTM zone is unstated"
        
    return datum, zone, None

def get_epsg_code(datum, zone):
    if zone == "latlon" or (zone is None and datum in ("WGS84", "NAD83", "NAD27")):
        return 4326
    if zone == "albers":
        return 3005
    try:
        z = int(zone)
    except (ValueError, TypeError):
        return None
    if 7 <= z <= 12:
        if datum == "NAD83":
            return 26900 + z
        elif datum == "NAD27":
            return 26700 + z
        elif datum == "WGS84":
            return 32600 + z
    return None

def main():
    db_path = r"scripts/matrix-map/_enrichment_working/bnrrm_enhanced.db"
    ops_db_path = r"scripts/matrix-map/_enrichment_working/bnrrm_enhanced.ops.db"
    manifest_path = r"scripts/matrix-map/_enrichment_working/mm_coordinate_targets.json"
    geocoding_csv = r"docs/design/matrix-map/PR_MAP_8_GEOCODING_DATA_FULL.csv"
    pdf_base = r"G:/My Drive/Site_Remediation_Data/PDF_Archive/"

    print("STATION-COORDINATE ENRICHMENT LOADER")
    
    centroids = load_site_centroids(geocoding_csv)
    
    if not os.path.exists(manifest_path):
        print(f"ERROR: Manifest file not found at {manifest_path}. Run scan_coords.py first.")
        return

    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
        
    table_docs = manifest.get("has_coord_table_doc_ids", [])
    print(f"Processing {len(table_docs)} documents classified as HAS_COORD_TABLE...")

    # Clear prior progress in ops DB for fresh run
    ops_conn = sqlite3.connect(ops_db_path)
    ops_cur = ops_conn.cursor()
    ops_cur.execute("DROP TABLE IF EXISTS mm_coord_progress")
    ops_cur.execute("DROP TABLE IF EXISTS mm_coord_quarantine")
    ops_cur.execute("""
        CREATE TABLE mm_coord_progress (
            doc_id INTEGER PRIMARY KEY, status TEXT, attempts INTEGER,
            last_error TEXT, accepted INTEGER DEFAULT 0,
            quarantined INTEGER DEFAULT 0, updated_at TEXT)
    """)
    ops_cur.execute("""
        CREATE TABLE mm_coord_quarantine (
            id INTEGER PRIMARY KEY, doc_id INTEGER, site_id INTEGER,
            station_name TEXT, reason TEXT, detail TEXT, ts TEXT)
    """)
    ops_conn.commit()

    db = sqlite3.connect(db_path)
    cur = db.cursor()

    total_added = 0
    total_quarantined = 0
    total_skipped = 0

    for doc_id in table_docs:
        # Get filepath and site_id from ra_documents
        res = cur.execute("SELECT site_id, filepath, filename, title FROM ra_documents WHERE doc_id=?", (doc_id,)).fetchone()
        if not res:
            print(f"ERROR: doc_id {doc_id} not found in ra_documents.")
            continue
            
        site_id, filepath, filename, title = res
        site_name = cur.execute("SELECT name FROM sites WHERE site_id=?", (site_id,)).fetchone()
        site_name = site_name[0] if site_name else ""
        
        pdf_path = filepath
        if not os.path.isabs(pdf_path):
            pdf_path = os.path.join(pdf_base, filepath)
            
        print(f"\nProcessing Doc {doc_id} (Site {site_id}): {filename}")
        
        ops_cur.execute("""
            INSERT OR IGNORE INTO mm_coord_progress (doc_id, status, attempts)
            VALUES (?, 'pending', 0)
        """, (doc_id,))
        ops_conn.commit()
        
        ops_cur.execute("""
            UPDATE mm_coord_progress
            SET status='in_progress', attempts=attempts+1, updated_at=datetime('now')
            WHERE doc_id=?
        """, (doc_id,))
        ops_conn.commit()

        # 2. Extract full PDF text for doc-wide scan
        pages_text = []
        try:
            doc = fitz.open(pdf_path)
            # Scan all pages per doc
            num_pages = len(doc)
            for i in range(num_pages):
                try:
                    pages_text.append(doc[i].get_text("text"))
                except Exception:
                    pages_text.append("")
        except Exception as e:
            msg = f"Failed to open PDF: {e}"
            print(f"  {msg}")
            ops_cur.execute("UPDATE mm_coord_progress SET status='failed', last_error=? WHERE doc_id=?", (msg, doc_id))
            ops_conn.commit()
            continue

        # 3. Detect projection doc-wide
        datum, zone, err = detect_projection(pages_text)
        if err:
            print(f"  Projection Detection Failed: {err}")
            ops_cur.execute("""
                INSERT INTO mm_coord_quarantine (doc_id, site_id, station_name, reason, detail, ts)
                VALUES (?, ?, ?, 'unstated_projection', ?, datetime('now'))
            """, (doc_id, site_id, "ALL_STATIONS", err))
            ops_cur.execute("UPDATE mm_coord_progress SET status='failed', last_error=? WHERE doc_id=?", (err, doc_id))
            ops_conn.commit()
            doc.close()
            continue

        epsg = get_epsg_code(datum, zone)
        print(f"  Detected projection: Datum={datum}, Zone={zone} -> EPSG={epsg}")
        
        if not epsg:
            msg = f"Unsupported projection combination: Datum={datum}, Zone={zone}"
            print(f"  {msg}")
            ops_cur.execute("UPDATE mm_coord_progress SET status='failed', last_error=? WHERE doc_id=?", (msg, doc_id))
            ops_conn.commit()
            doc.close()
            continue

        # Prepare projection transformer
        transformer = Transformer.from_crs(f"epsg:{epsg}", "epsg:4326", always_xy=True)

        # 4. Load database stations for this site to build matching dictionary
        db_stations = cur.execute(
            "SELECT station_id, name, latitude, longitude FROM stations WHERE site_id=?", (site_id,)
        ).fetchall()
        
        station_map = {}
        for st_id, name, lat, lon in db_stations:
            norm_name = L.normalize_station_name(name)
            if norm_name:
                if norm_name in station_map:
                    station_map[norm_name] = "ambiguous"
                else:
                    station_map[norm_name] = (st_id, name, lat, lon)

        # Count stations for large-site divergence gate
        n_site_stations = len(db_stations)
        site_name_lower = site_name.lower() if site_name else ""
        is_large_site = n_site_stations >= 40 or "trail" in site_name_lower or "alcan" in site_name_lower
        divergence_limit = 10000.0 if is_large_site else 5000.0
        print(f"  Site details: {n_site_stations} stations. Large site? {is_large_site}. Limit = {divergence_limit/1000.0} km")

        doc_added = 0
        doc_quarantined = 0
        doc_skipped = 0

        # 5. Extract coordinates page by page
        for page_idx in range(len(pages_text)):
            p_text = pages_text[page_idx]
            p_text_lower = p_text.lower()
            
            # Check if page looks like a coordinate table
            if not (("easting" in p_text_lower and "northing" in p_text_lower) or 
                    ("latitude" in p_text_lower and "longitude" in p_text_lower)):
                continue
                
            # Reconstruct lines horizontally grouped by column block
            try:
                words = doc[page_idx].get_text("words")
            except Exception as e:
                print(f"  Warning: failed to extract words on page {page_idx+1}: {e}")
                continue
                
            lines = {}
            for w in words:
                x0, y0, x1, y1, text, block_no, line_no, word_no = w
                found = False
                for y_key in lines:
                    if abs(y0 - y_key) < 3.0:
                        lines[y_key].append(w)
                        found = True
                        break
                if not found:
                    lines[y0] = [w]
                    
            sorted_y = sorted(lines.keys())
            
            for y in sorted_y:
                line_words = sorted(lines[y], key=lambda x: x[0])
                tokens = [lw[4].strip() for lw in line_words if lw[4].strip()]
                if len(tokens) < 3:
                    continue
                    
                station_candidate = None
                for tok in tokens:
                    ok, _ = L.passes_name_gate(tok)
                    if ok:
                        station_candidate = tok
                        break
                        
                if not station_candidate:
                    continue
                    
                # Extract numbers excluding the station candidate token
                numbers = []
                for tok in tokens:
                    if tok == station_candidate:
                        continue
                    clean_tok = re.sub(r"[^\d\.\-]", "", tok)
                    try:
                        numbers.append(float(clean_tok))
                    except ValueError:
                        continue
                        
                coord_x = None
                coord_y = None
                
                # 1. Try DMS Parse (requires 6 numbers)
                if len(numbers) >= 6:
                    # Check if first 3 look like Lat (48-60) and next 3 look like Lon (114-139)
                    if (48.0 <= numbers[0] <= 60.0 and 0.0 <= numbers[1] < 60.0 and 0.0 <= numbers[2] < 60.0 and
                        114.0 <= abs(numbers[3]) <= 139.0 and 0.0 <= numbers[4] < 60.0 and 0.0 <= numbers[5] < 60.0):
                        coord_y = dms_to_dd(numbers[0], numbers[1], numbers[2], "N")
                        coord_x = dms_to_dd(numbers[3], numbers[4], numbers[5], "W")
                        
                # 2. Try standard UTM, Albers, or decimal Lat/Lon if DMS didn't match
                if coord_x is None or coord_y is None:
                    # Find coordinates left-to-right (stop at first match to prevent multi-column overwrites)
                    for i in range(len(numbers)):
                        num = numbers[i]
                        # BC Albers Case
                        if epsg == 3005:
                            if coord_x is None and 100000.0 <= num <= 1900000.0:
                                coord_x = num
                            elif coord_y is None and 300000.0 <= num <= 1700000.0:
                                coord_y = num
                        # UTM Case
                        elif epsg != 4326:
                            if coord_x is None and 200000.0 <= num <= 800000.0:
                                coord_x = num
                            elif coord_y is None and 5000000.0 <= num <= 6700000.0:
                                coord_y = num
                        # Lat/Lon Case
                        else:
                            if coord_y is None and 48.0 <= num <= 60.0:
                                coord_y = num
                            elif coord_x is None and (-139.0 <= num <= -114.0):
                                coord_x = num
                            elif coord_x is None and (114.0 <= num <= 139.0):
                                coord_x = -num
                                
                        if coord_x is not None and coord_y is not None:
                            break

                if coord_x is None or coord_y is None:
                    continue

                # 6. Matching to database station
                norm_parsed = L.normalize_station_name(station_candidate)
                match_res = station_map.get(norm_parsed)
                
                if match_res == "ambiguous":
                    detail = f"Normalized parsed name '{norm_parsed}' (raw: {station_candidate}) is ambiguous in DB."
                    ops_cur.execute("""
                        INSERT INTO mm_coord_quarantine (doc_id, site_id, station_name, reason, detail, ts)
                        VALUES (?, ?, ?, 'ambiguous_station_match', ?, datetime('now'))
                    """, (doc_id, site_id, station_candidate, detail))
                    doc_quarantined += 1
                    continue
                elif match_res is None:
                    detail = f"Normalized parsed name '{norm_parsed}' (raw: {station_candidate}) not found in DB stations for site {site_id}."
                    ops_cur.execute("""
                        INSERT INTO mm_coord_quarantine (doc_id, site_id, station_name, reason, detail, ts)
                        VALUES (?, ?, ?, 'unmatched_station_name', ?, datetime('now'))
                    """, (doc_id, site_id, station_candidate, detail))
                    doc_quarantined += 1
                    continue
                    
                st_id, db_name, db_lat, db_lon = match_res
                
                if db_lat is not None or db_lon is not None:
                    doc_skipped += 1
                    continue

                # 7. Convert coordinate
                try:
                    if epsg != 4326:
                        lon_dd, lat_dd = transformer.transform(coord_x, coord_y)
                    else:
                        lon_dd, lat_dd = coord_x, coord_y
                except Exception as e:
                    detail = f"Coordinate conversion failed for input ({coord_x}, {coord_y}): {e}"
                    ops_cur.execute("""
                        INSERT INTO mm_coord_quarantine (doc_id, site_id, station_name, reason, detail, ts)
                        VALUES (?, ?, ?, 'conversion_error', ?, datetime('now'))
                    """, (doc_id, site_id, station_candidate, detail))
                    doc_quarantined += 1
                    continue

                # 8. Quality Gates
                # Gate 1: BC Bounds
                if not (48.0 <= lat_dd <= 60.0 and -139.0 <= lon_dd <= -114.0):
                    detail = f"Converted WGS84 lat={lat_dd:.6f}, lon={lon_dd:.6f} out of BC bounds."
                    ops_cur.execute("""
                        INSERT INTO mm_coord_quarantine (doc_id, site_id, station_name, reason, detail, ts)
                        VALUES (?, ?, ?, 'out_of_bc_bounds', ?, datetime('now'))
                    """, (doc_id, site_id, station_candidate, detail))
                    doc_quarantined += 1
                    continue

                # Gate 2: Centroid divergence
                site_centroid = centroids.get(site_id)
                if site_centroid:
                    sc_lat, sc_lon = site_centroid
                    dist = haversine_distance(lat_dd, lon_dd, sc_lat, sc_lon)
                    if dist > divergence_limit:
                        detail = f"Divergence {dist:.2f} meters from site centroid ({sc_lat:.6f}, {sc_lon:.6f}) exceeds limit of {divergence_limit} meters."
                        ops_cur.execute("""
                            INSERT INTO mm_coord_quarantine (doc_id, site_id, station_name, reason, detail, ts)
                            VALUES (?, ?, ?, 'excessive_site_centroid_divergence', ?, datetime('now'))
                        """, (doc_id, site_id, station_candidate, detail))
                        doc_quarantined += 1
                        continue
                else:
                    s_centroid_res = cur.execute("SELECT latitude, longitude FROM sites WHERE site_id=?", (site_id,)).fetchone()
                    if s_centroid_res and s_centroid_res[0] is not None:
                        sc_lat, sc_lon = s_centroid_res
                        dist = haversine_distance(lat_dd, lon_dd, sc_lat, sc_lon)
                        if dist > divergence_limit:
                            detail = f"Divergence {dist:.2f} meters from sites table centroid ({sc_lat:.6f}, {sc_lon:.6f}) exceeds limit of {divergence_limit} meters."
                            ops_cur.execute("""
                                INSERT INTO mm_coord_quarantine (doc_id, site_id, station_name, reason, detail, ts)
                                VALUES (?, ?, ?, 'excessive_site_centroid_divergence', ?, datetime('now'))
                            """, (doc_id, site_id, station_candidate, detail))
                            doc_quarantined += 1
                            continue

                # 9. Write to Copy Database (Additive UPDATE)
                cur.execute("""
                    UPDATE stations
                    SET latitude=?, longitude=?
                    WHERE station_id=?
                """, (lat_dd, lon_dd, st_id))
                doc_added += 1

                # Update lookup cache to prevent duplicate updates in the same run
                station_map[norm_parsed] = (st_id, db_name, lat_dd, lon_dd)

        db.commit()
        doc.close()

        print(f"  Finished Doc {doc_id}: Converted={doc_added}, Quarantined={doc_quarantined}, Skipped={doc_skipped}")
        
        ops_cur.execute("""
            UPDATE mm_coord_progress
            SET status='done', accepted=?, quarantined=?, updated_at=datetime('now')
            WHERE doc_id=?
        """, (doc_added, doc_quarantined, doc_id))
        ops_conn.commit()

        total_added += doc_added
        total_quarantined += doc_quarantined
        total_skipped += doc_skipped

    db.close()
    ops_conn.close()

    print("\n========================================")
    print("ENRICHMENT PROCESSING COMPLETE")
    print(f"Total stations updated: {total_added}")
    print(f"Total rows quarantined: {total_quarantined}")
    print(f"Total rows skipped (already geocoded): {total_skipped}")
    print("========================================")

if __name__ == "__main__":
    main()
