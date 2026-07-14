#!/usr/bin/env python3
# DRY-RUN extraction for owner review. Does NOT apply coordinates; no Supabase/catalog/DRA write.
import argparse
import json
import os
import sys
import re

def get_well_id(line):
    # Strip leading markdown heading/list markers ("## ", "- ", "* ") -- OCR output renders the
    # well-id line as a markdown heading, e.g. "## MONITORING WELL ID: MW08-3".
    line = line.strip().lstrip('#').lstrip('*').lstrip('-').strip()
    prefixes = [
        "MONITORING WELL ID:",
        "Well/SV:",
        "Soil Vapour/Monitoring Well:",
        "Well:"
    ]
    for p in prefixes:
        if line.lower().startswith(p.lower()):
            val = line[len(p):].strip()
            if val:
                return val
    
    # Bare ID match
    bare_pattern = r'^(?:MW|BH|SS|MW/SV)[\s]*[0-9A-Za-z/-]+$'
    if re.match(bare_pattern, line, re.IGNORECASE):
        if len(line) < 20:
            return line
            
    return None

# A numeric field: digits with optional '.'/',' groupings INSIDE (thousands separators + a decimal),
# but NEVER whitespace, so two space-separated numbers are never merged into a synthesized value
# (codex P1 anti-fabrication). Handles comma-grouped UTM values like "5,503,598". _to_float strips
# commas (thousands) and keeps the decimal point.
_NUM = r'([0-9][0-9.,]*[0-9])'

def _to_float(s):
    try:
        return float(s.replace(',', ''))
    except (ValueError, AttributeError):
        return None

def _bound_values(text):
    """Values EXPLICITLY bound to a direction -- the only source for HIGH confidence. Two bindings:
    a directional suffix (`<num> N` / `<num> E`) or an inline label (`Northing: <num>` / `Easting: <num>`).
    An unrelated number (e.g. a project number) that is NOT suffix/label-bound is never taken as a
    coordinate here, so it cannot become a high-confidence mis-assignment (codex P2)."""
    norths = [_to_float(x) for x in re.findall(_NUM + r'\s*N\b', text)]
    norths += [_to_float(x) for x in re.findall(r'north[a-z]*[:\s]+' + _NUM, text, re.IGNORECASE)]
    easts = [_to_float(x) for x in re.findall(_NUM + r'\s*E\b', text)]
    easts += [_to_float(x) for x in re.findall(r'east[a-z]*[:\s]+' + _NUM, text, re.IGNORECASE)]
    norths = [v for v in norths if v is not None and 5000000 <= v <= 6000000]
    easts = [v for v in easts if v is not None and 300000 <= v <= 800000]
    return norths, easts

def _band_scan(text):
    """All UTM-band numbers regardless of binding -- the LOW-confidence proximity fallback only."""
    norths = []
    easts = []
    for t in re.findall(r'[0-9]+(?:[.,][0-9]+)*', text):
        val = _to_float(t)
        if val is None:
            continue
        if 5000000 <= val <= 6000000:
            norths.append(val)
        elif 300000 <= val <= 800000:
            easts.append(val)
    return norths, easts

def main():
    parser = argparse.ArgumentParser(description="Parse DRA well coordinates (dry-run)")
    parser.add_argument("--in", dest="in_file", required=True, help="Input text/markdown file")
    parser.add_argument("--report", required=True, help="Path to output JSON report")
    parser.add_argument("--csv", required=False, help="Path to output CSV report")
    parser.add_argument("--source-label", required=False, help="Free-text label")
    args = parser.parse_args()

    report = {
        "source_label": args.source_label,
        "input_file": args.in_file,
        "record_count": 0,
        "records": [],
        "unresolved": [],
        "status": "OK",
        "error": None
    }
    
    try:
        in_path = os.path.normcase(os.path.realpath(args.in_file))
        out_path = os.path.normcase(os.path.realpath(args.report))
        same_path = (in_path == out_path)
    except Exception:
        same_path = False
        
    if not same_path and os.path.exists(args.report):
        try:
            same_path = os.path.samefile(args.in_file, args.report)
        except Exception:
            same_path = False
            
    if args.csv:
        try:
            csv_path = os.path.normcase(os.path.realpath(args.csv))
            if in_path == csv_path:
                same_path = True
            elif not same_path and os.path.exists(args.csv):
                if os.path.samefile(args.in_file, args.csv):
                    same_path = True
        except Exception:
            pass

    if same_path:
        sys.stderr.write("Refusing to run: --report or --csv resolves to the input file.\n")
        sys.exit(2)
        
    try:
        with open(args.in_file, 'r', encoding='ascii', errors='ignore') as f:
            lines = f.readlines()
            
        blocks = []
        current_block = None
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            wid = get_well_id(line)
            if wid:
                current_block = {
                    "well_id": wid,
                    "lines": []
                }
                blocks.append(current_block)
            else:
                if current_block is not None:
                    current_block["lines"].append(line)
                    
        for block in blocks:
            well_id = block["well_id"]
            datum = None
            raw_coords = []
            
            block_lines = block["lines"]
            coord_idx = []
            for i, line in enumerate(block_lines):
                if not datum:
                    m = re.search(r'Datum:\s*(.+)', line, re.IGNORECASE)
                    if m:
                        datum = m.group(1).strip()
                # Broad enough to catch OCR variants of "co-ordinate" (e.g. "Co-ordinales").
                if re.search(r'(co-?ordina|easting|northing)', line, re.IGNORECASE):
                    coord_idx.append(i)
                    raw_coords.append(line)

            if not coord_idx:
                report["unresolved"].append(well_id)
                continue

            # INLINE candidates = band numbers ON a coordinate-keyword line (the combined
            # "Co-ordinates: <N> N, <E> E" format, or a label line carrying its value). PROXIMITY
            # candidates = band numbers within +/-WINDOW lines of a keyword line (covers text-extraction
            # reorderings where the value sits a few lines from its "Easting:"/"Northing:" label).
            WINDOW = 6
            keep = set()
            for i in coord_idx:
                for j in range(max(0, i - WINDOW), min(len(block_lines), i + WINDOW + 1)):
                    keep.add(j)
            prox_text = " | ".join(block_lines[j] for j in sorted(keep))

            # HIGH confidence requires each value to be DIRECTION-BOUND (a `<num> N`/`<num> E` suffix
            # or a `Northing:/Easting: <num>` label) AND unambiguous (exactly one distinct bound value
            # per band). An unrelated number collapsed onto a coordinate line (e.g. a project number)
            # is NOT direction-bound, so it can never yield a high-confidence coordinate (codex P2).
            bound_n, bound_e = _bound_values(prox_text)
            scan_n, scan_e = _band_scan(prox_text)

            if len(set(bound_n)) == 1 and len(set(bound_e)) == 1:
                northing, easting, confidence = bound_n[0], bound_e[0], "high"
            else:
                # LOW fallback: prefer a bound value, else any UTM-band number in the coordinate window.
                northing = bound_n[0] if bound_n else (scan_n[0] if scan_n else None)
                easting = bound_e[0] if bound_e else (scan_e[0] if scan_e else None)
                confidence = "low"

            if northing is None or easting is None:
                report["unresolved"].append(well_id)
                continue

            unit = None
            prox_lower = prox_text.lower()
            if re.search(r'\bm\b', prox_text) or 'meter' in prox_lower or 'metre' in prox_lower:
                unit = 'm'

            report["records"].append({
                "well_id": well_id,
                "northing": northing,
                "easting": easting,
                "datum": datum,
                "unit": unit,
                "confidence": confidence,
                "raw": " | ".join(raw_coords)[:300]
            })
            
        report["record_count"] = len(report["records"])
        
    except Exception as e:
        report["status"] = "ERROR"
        report["error"] = str(e)
        
    try:
        with open(args.report, 'w', encoding='ascii', errors='ignore') as f:
            json.dump(report, f, indent=2)
            
        if args.csv and report["status"] != "ERROR":
            import csv
            with open(args.csv, 'w', newline='', encoding='ascii', errors='ignore') as f:
                writer = csv.writer(f)
                # confidence is the safety flag -- always carry it into the CSV review path.
                writer.writerow(["well_id", "northing", "easting", "datum", "unit", "confidence", "source_hint"])
                for r in report["records"]:
                    writer.writerow([r.get("well_id"), r.get("northing"), r.get("easting"), r.get("datum"), r.get("unit"), r.get("confidence"), args.source_label])
    except Exception as e:
        print(f"Failed to write output: {e}", file=sys.stderr)
        sys.exit(1)
        
    print(f"parsed={report['record_count']} unresolved={len(report['unresolved'])} status={report['status']} -> {args.report}")
    
    if report["status"] == "ERROR":
        sys.exit(1)

if __name__ == "__main__":
    main()
