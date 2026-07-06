import fitz
import json
import re
import os
from collections import defaultdict

pdf_path = r"C:\Users\jasen\Downloads\HC 2025 - Toxicological Reference Values TRV.pdf"
doc = fitz.open(pdf_path)

valid_types = ["Oral TDI", "Oral RfD", "Oral SF", "Risk-specific dose", "UL", "Inhalation TC", "Inhalation UR"]

def parse_trv_type(t_str):
    if not t_str: return None
    t_str = t_str.replace('\n', ' ').strip()
    for vt in valid_types:
        if t_str.lower().startswith(vt.lower()):
            return vt, t_str
    return None, None

def clean_unit(unit_raw, trv_type):
    u = unit_raw.replace('\n', '').replace(' ', '')
    if 'SF' in trv_type: return '(mg/kgBW-day)-1'
    if 'UR' in trv_type: return '(mg/m3)-1'
    if 'TDI' in trv_type or 'RfD' in trv_type or 'UL' in trv_type or 'dose' in trv_type.lower(): return 'mg/kgBW-day'
    if 'TC' in trv_type: return 'mg/m3'
    if 'mg/kg' in u and 'BW' in u and 'day' in u:
        if '1' in u: return '(mg/kgBW-day)-1'
        return 'mg/kgBW-day'
    if 'mg/m' in u:
        if '1' in u: return '(mg/m3)-1'
        return 'mg/m3'
    return u

def extract_qualifier_from_unit_raw(unit_raw):
    cleaned = unit_raw
    for remove_term in ['(mg/kg', '-day)', '1', 'BW', 'mg/m3', 'mg/m', '3', 'mg/kg', '-day', '\n', '\ufffd']:
        cleaned = cleaned.replace(remove_term, ' ')
    cleaned = re.sub(r'[\(\)]', ' ', cleaned)
    cleaned = re.sub(r'\s+', ' ', cleaned).strip()
    return cleaned

rows_extracted = []

for page_idx in range(17, 52):
    page = doc[page_idx]
    tabs = page.find_tables()
    current_substance = None
    current_t_str = None
    
    for tab in tabs.tables:
        df = tab.extract()
        for row in df:
            if len(row) < 3: continue
            
            sub = row[0]
            if sub and str(sub).strip():
                sub = str(sub).replace('\n', ' ').strip()
                if sub.lower() != 'substance':
                    current_substance = sub
                    current_t_str = None
            
            t_str = row[1]
            if t_str and str(t_str).strip():
                current_t_str = str(t_str)
            else:
                t_str = current_t_str
                
            val_str = row[2]
            if val_str is not None:
                val_str = str(val_str)
            
            if not current_substance or not t_str or not val_str:
                continue
                
            trv_type, raw_trv_type = parse_trv_type(t_str)
            if not trv_type:
                continue
                
            pattern = r'(\d+\.\d+(?:E[+-]\d+)?)'
            parts = re.split(pattern, val_str)
            
            if len(parts) > 1:
                for i in range(1, len(parts), 2):
                    val_raw = parts[i]
                    unit_raw = parts[i+1] if i+1 < len(parts) else ""
                    
                    try:
                        val_float = float(val_raw)
                    except ValueError:
                        val_float = None
                        
                    unit = clean_unit(unit_raw, trv_type)
                    if not unit or len(unit) < 2: 
                        unit = clean_unit(parts[0], trv_type)
                    
                    qualifier = raw_trv_type[len(trv_type):].strip()
                    if qualifier.startswith('(') and qualifier.endswith(')'):
                        pass
                        
                    extra_qualifier = extract_qualifier_from_unit_raw(unit_raw)
                    if extra_qualifier:
                        if qualifier:
                            qualifier += " " + extra_qualifier
                        else:
                            qualifier = extra_qualifier
                            
                    qualifier = qualifier.replace('\ufffd', '').replace('', '').strip()
                    
                    if not qualifier or qualifier.isdigit():
                        study_details = row[3] if len(row) > 3 and row[3] else ""
                        sd_lower = study_details.lower()
                        hints = []
                        if "sensitive" in sd_lower: hints.append("(sensitive)")
                        if "general adult" in sd_lower: hints.append("(general adult)")
                        elif "adult" in sd_lower: hints.append("(adult)")
                        if "from birth" in sd_lower: hints.append("(from birth)")
                        if hints:
                            if qualifier.isdigit():
                                qualifier = " ".join(hints)
                            else:
                                qualifier = " ".join(hints)
                    
                    rows_extracted.append({
                        "substance": current_substance,
                        "type_of_trv": trv_type,
                        "value": val_float,
                        "value_raw_text": val_raw,
                        "unit": unit,
                        "qualifier_hint": qualifier,
                        "page_1indexed": page_idx + 1
                    })

os.makedirs(r"scripts\matrix-options\data", exist_ok=True)
output_path = r"scripts\matrix-options\data\hc_trv_v4_table1_extracted.json"
with open(output_path, "w", encoding="utf-8") as f:
    json.dump(rows_extracted, f, indent=2)

print(f"Extracted {len(rows_extracted)} rows.")

type_counts = {}
substance_types = defaultdict(list)
for r in rows_extracted:
    tc = r["type_of_trv"]
    type_counts[tc] = type_counts.get(tc, 0) + 1
    substance_types[r["substance"]].append(tc)

print("Counts per TRV Type:")
for tc, count in type_counts.items():
    print(f"  {tc}: {count}")

pages_with_rows = set(r["page_1indexed"] for r in rows_extracted)
zero_row_pages = [p for p in range(18, 53) if p not in pages_with_rows]
print(f"Pages with ZERO rows: {zero_row_pages}")

print("Verification:")
for r in rows_extracted:
    if "Arsenic" in r["substance"] or "Chlorobenzene" in r["substance"]:
        print(f"{r['substance']} | {r['type_of_trv']} | {r['value']} | {r['unit']} | Hint: {r['qualifier_hint']}")

print("Substances with 2+ same-type rows:")
for sub, types in substance_types.items():
    from collections import Counter
    c = Counter(types)
    for t, count in c.items():
        if count >= 2:
            print(f"  {sub}: {count}x {t}")
