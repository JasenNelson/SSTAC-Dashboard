import json
import sqlite3
import re
import os
from datetime import datetime

MEDIA_KEYWORDS = ["SEDIMENT", "SOIL", "GROUNDWATER", "SW", "GW", "SUBSLAB", "VAPOUR", "AIR", "TISSUE", "POREWATER"]

def parse_date(d):
    d = d.upper()
    months = {'JAN':'01', 'FEB':'02', 'MAR':'03', 'APR':'04', 'MAY':'05', 'JUN':'06',
              'JUL':'07', 'AUG':'08', 'SEP':'09', 'OCT':'10', 'NOV':'11', 'DEC':'12'}
    
    m = re.match(r'^(\d{1,2})-(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-(\d{2,4})$', d)
    if m:
        day, mon, yr = m.groups()
        yr = '20' + yr if len(yr) == 2 else yr
        return f"{yr}-{months[mon]}-{int(day):02d}"
    
    m = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{2,4})$', d)
    if m:
        mon, day, yr = m.groups()
        if int(mon) > 12:
            mon, day = day, mon
        yr = '20' + yr if len(yr) == 2 else yr
        return f"{yr}-{int(mon):02d}-{int(day):02d}"
        
    m = re.match(r'^(JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-?(\d{2})$', d)
    if m:
        mon, yr = m.groups()
        return f"20{yr}-{months[mon]}-01"
        
    m = re.match(r'^(\d{6})$', d)
    if m:
        val = m.group(1)
        if not val.startswith('00') and val != '000000':
            yy, mm, dd = int(val[0:2]), int(val[2:4]), int(val[4:6])
            if 1 <= mm <= 12 and 1 <= dd <= 31:
                return f"20{yy:02d}-{mm:02d}-{dd:02d}"
            dd, mm, yy = int(val[0:2]), int(val[2:4]), int(val[4:6])
            if 1 <= mm <= 12 and 1 <= dd <= 31:
                return f"20{yy:02d}-{mm:02d}-{dd:02d}"

    m = re.match(r'^(\d{4})-(\d{2})-(\d{2})$', d)
    if m:
        return d
    return None

def salvage_record(text):
    original_text = text
    text = re.sub(r'\s+', ' ', text).strip()
    
    lab_ids = list(set(re.findall(r'\bL\d{6,}(?:-\d+)?\b', text, re.I)))
    for l in lab_ids: text = text.replace(l, '')
    
    media_found = []
    for m in MEDIA_KEYWORDS:
        if re.search(r'\b' + m + r'\b', text, re.I):
            media_found.append(m)
            text = re.sub(r'\b' + m + r'\b', '', text, flags=re.I)
    
    date_patterns = [
        r'\b\d{1,2}-(?:JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV|DEC)-\d{2,4}\b',
        r'\b\d{1,2}/\d{1,2}/\d{2,4}\b',
        r'\b\d{4}-\d{2}-\d{2}\b',
        r'\b\d{6}\b'
    ]
    dates_found = []
    for p in date_patterns:
        matches = re.findall(p, text, re.I)
        for m in matches:
            if p == r'\b\d{6}\b' and (m.startswith('00') or m == '000000'): continue
            parsed = parse_date(m)
            if parsed:
                dates_found.append(parsed)
                text = text.replace(m, '')

    ignore = ['CSR', 'STANDARD', 'RPD', 'QA', 'DUPLICATE', 'EVERGLADES', 'LARGE FISH']
    for i in ignore:
        text = re.sub(r'\b' + i + r'\b', '', text, flags=re.I)

    # Fix wandering hyphens
    text = re.sub(r'-\s*(\d+[A-Z]?)\s+([A-Z]{2,5})\b', r'\2-\1', text)
    text = re.sub(r'([a-zA-Z0-9])\s+-\s+([a-zA-Z0-9])', r'\1-\2', text)
    
    text = text.replace(',', ' ')
    tokens = [t.strip() for t in text.split() if t.strip() and t.strip() != '-']
    stations = []
    for t in tokens:
        if re.match(r'^L\d{5,}-?\d*(?:N/A)?$', t, re.I):
            continue
        if re.match(r'^[A-Z]{1,6}(?:-[A-Z]{1,5})?\d*-\d+[A-Z\d]*$', t, re.I) or re.match(r'^[A-Z]{2,6}\d+[A-Z]?$', t, re.I):
            stations.append(t.upper())
            
    filtered_stations = []
    for s in stations:
        has_fuller = False
        for other in stations:
            if other != s and other.startswith(s + '-'):
                has_fuller = True
                break
        if not has_fuller:
            filtered_stations.append(s)
    stations = filtered_stations
            
    dates = list(set(dates_found))
    date_val = dates[0] if dates else None
    media_val = media_found[0].lower() if media_found else 'unknown'
    
    if not stations:
        return {'status': 'quarantine', 'reason': 'No station code found', 'original': original_text}
        
    lower_words = [w for w in original_text.split() if w.islower()]
    is_narrative = len(lower_words) > 5 or bool(re.search(r'\b(?:the|was|were|selected|investigate|location)\b', original_text, re.I))
        
    return {'status': 'salvaged', 'stations': list(set(stations)), 'date': date_val, 'media': media_val, 'lab_ids': lab_ids, 'original': original_text, 'is_narrative': is_narrative}

def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    work_dir = os.path.join(base_dir, '_enrichment_working')
    
    with open(os.path.join(work_dir, 'rejected_stations.json'), 'r') as f:
        rejected = json.load(f)
        
    conn = sqlite3.connect(os.path.join(work_dir, 'bnrrm_clean_rebuild.db'))
    cursor = conn.cursor()
    
    doc_to_site = {}
    for row in cursor.execute("SELECT doc_id, site_id FROM ra_documents"):
        doc_to_site[row[0]] = row[1]
        
    existing_stations = {}
    lab_ids_removed = 0
    bare_prefixes_removed = 0
    
    # Pre-load all stations by site to find bare prefixes
    all_stations = cursor.execute("SELECT station_id, site_id, name FROM stations").fetchall()
    by_site = {}
    for st_id, site_id, name in all_stations:
        by_site.setdefault(site_id, []).append((st_id, name))
        
    for st_id, site_id, name in all_stations:
        if re.match(r'^L\d{5,}-?\d*(?:N/A)?$', name, re.I):
            cursor.execute("DELETE FROM sampling_events WHERE station_id=?", (st_id,))
            cursor.execute("DELETE FROM stations WHERE station_id=?", (st_id,))
            lab_ids_removed += 1
            continue
            
        # Check if it's a bare prefix
        is_bare = False
        for other_id, other_name in by_site[site_id]:
            if other_id != st_id and other_name.startswith(name + '-'):
                is_bare = True
                break
                
        if is_bare:
            cursor.execute("DELETE FROM sampling_events WHERE station_id=?", (st_id,))
            cursor.execute("DELETE FROM stations WHERE station_id=?", (st_id,))
            bare_prefixes_removed += 1
        else:
            existing_stations[(site_id, name.upper())] = st_id
            
    conn.commit()
        
    quarantine = []
    salvaged_count = 0
    added_events = 0
    
    # Track test doc stats
    # 15853 240709 HHERA Report -> doc_id needs to be found
    # 01_20240913_511068_RPT_Nordel 6 HHERA_FINAL -> doc_id needs to be found
    test_docs = {}
    for row in cursor.execute("SELECT doc_id, title, filename FROM ra_documents"):
        title = (row[1] or '').lower()
        filename = (row[2] or '').lower()
        if '15853 240709 hhera' in title or '15853 240709 hhera' in filename:
            test_docs[row[0]] = 'SITE0804'
        if 'nordel 6' in title or 'nordel 6' in filename:
            test_docs[row[0]] = 'Nordel 6'
            
    test_doc_before = {d: 0 for d in test_docs}
    for d in test_docs:
        c = cursor.execute("SELECT COUNT(*) FROM stations WHERE site_id=?", (doc_to_site.get(d),)).fetchone()[0]
        test_doc_before[d] = c
        
    salvaged_samples = []

    for item in rejected:
        if item.get('reason') != 'No date or depth':
            continue
            
        doc_id = item.get('doc_id')
        site_id = doc_to_site.get(doc_id)
        if not site_id:
            quarantine.append({'original': item.get('sample_id'), 'reason': 'No site_id for doc'})
            continue
            
        res = salvage_record(item.get('sample_id', ''))
        
        if res['status'] == 'quarantine':
            quarantine.append({'original': res['original'], 'reason': res['reason']})
            continue
            
        added_any_for_this = False
        for st in res['stations']:
            if (site_id, st) in existing_stations:
                continue
                
            if res.get('is_narrative'):
                quarantine.append({'original': res['original'], 'reason': f'Narrative-only mention of {st}'})
                continue
                
            is_bare = False
            for existing_site, existing_st in existing_stations.keys():
                if existing_site == site_id and existing_st.startswith(st + '-'):
                    is_bare = True
                    break
            if is_bare:
                quarantine.append({'original': res['original'], 'reason': f'Bare prefix {st}'})
                continue
                
            cursor.execute("INSERT INTO stations (site_id, name) VALUES (?, ?)", (site_id, st))
            station_id = cursor.lastrowid
            existing_stations[(site_id, st)] = station_id
            salvaged_count += 1
            added_any_for_this = True
            
            notes = "Salvaged from merged cell"
            if res['lab_ids']:
                notes += f"; Lab IDs: {', '.join(res['lab_ids'])}"
                
            cursor.execute("""
                INSERT INTO sampling_events (station_id, date_sampled, media_type, notes)
                VALUES (?, ?, ?, ?)
            """, (station_id, res['date'], res['media'], notes))
            added_events += 1
            
        if added_any_for_this and len(salvaged_samples) < 15:
            salvaged_samples.append(res)
            
    conn.commit()
    
    with open(os.path.join(work_dir, 'quarantine.json'), 'w') as f:
        json.dump(quarantine, f, indent=2)
        
    test_doc_after = {}
    for d in test_docs:
        c = cursor.execute("SELECT COUNT(*) FROM stations WHERE site_id=?", (doc_to_site.get(d),)).fetchone()[0]
        test_doc_after[d] = c
        
    total_stations = cursor.execute("SELECT COUNT(*) FROM stations").fetchone()[0]
    total_events = cursor.execute("SELECT COUNT(*) FROM sampling_events").fetchone()[0]
    total_dated = cursor.execute("SELECT COUNT(*) FROM sampling_events WHERE date_sampled IS NOT NULL").fetchone()[0]
    
    print(f"Salvaged stations: {salvaged_count}")
    print(f"Added events: {added_events}")
    print(f"Quarantined: {len(quarantine)}")
    print(f"Total stations in DB: {total_stations}")
    print(f"Total events in DB: {total_events}")
    print(f"Total dated events: {total_dated}")
    
    print("\nTest Docs Before/After:")
    for d, name in test_docs.items():
        print(f"  {name} (doc {d}): {test_doc_before[d]} -> {test_doc_after[d]}")
        
    print("\nSample Salvaged:")
    for s in salvaged_samples:
        print(f"  {s['original']} -> {s['stations']} / {s['date']} / {s['media']}")
        
    # Write stats to a json for closeout
    stats = {
        'salvaged_stations': salvaged_count,
        'added_events': added_events,
        'quarantined': len(quarantine),
        'total_stations': total_stations,
        'total_events': total_events,
        'total_dated': total_dated,
        'lab_ids_removed': lab_ids_removed,
        'bare_prefixes_removed': bare_prefixes_removed,
        'test_docs': {name: {'before': test_doc_before[d], 'after': test_doc_after[d]} for d, name in test_docs.items()},
        'samples': salvaged_samples
    }
    with open(os.path.join(work_dir, 'salvage_stats.json'), 'w') as f:
        json.dump(stats, f, indent=2)
        
if __name__ == '__main__':
    main()
