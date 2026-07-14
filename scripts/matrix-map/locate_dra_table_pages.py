import argparse
import json
import re
import sys
from pypdf import PdfReader

def get_snippet(text, keywords):
    text_lower = text.lower()
    first_idx = -1
    for kw in keywords:
        idx = text_lower.find(kw)
        if idx != -1:
            if first_idx == -1 or idx < first_idx:
                first_idx = idx
    if first_idx == -1:
        return ""
    start = max(0, first_idx - 150)
    end = min(len(text), first_idx + 150)
    return text[start:end].replace('\n', ' ').strip()

def main():
    parser = argparse.ArgumentParser(description="Locate pages with station coordinates in a PDF")
    parser.add_argument("--pdf", required=True, help="Path to input PDF")
    parser.add_argument("--report", required=True, help="Path to output JSON report")
    args = parser.parse_args()

    report = {
        "pdf": args.pdf,
        "total_pages": 0,
        "pages_with_text": 0,
        "text_layer_present": False,
        "candidate_pages": [],
        "candidate_count": 0,
        "status": "OK",
        "error": None
    }

    try:
        reader = PdfReader(args.pdf)
        total_pages = len(reader.pages)
        report["total_pages"] = total_pages

        loc_words = ['station', 'sample id', 'sample location', 'monitoring']
        coord_words = ['latitude', 'longitude', 'lat ', 'long ', 'easting', 'northing', 'utm', 'coordinate', 'coordinates']
        lat_pattern = re.compile(r'4[89]\.[0-9]{2,}')
        lon_pattern = re.compile(r'-1[12][0-9]\.[0-9]{2,}')

        all_keywords = loc_words + coord_words

        for i in range(total_pages):
            page = reader.pages[i]
            try:
                text = page.extract_text()
            except Exception:
                text = ""

            if text:
                text = str(text)
            else:
                text = ""

            if text.strip():
                report["pages_with_text"] += 1

            text_lower = text.lower()

            has_loc = any(w in text_lower for w in loc_words)
            has_coord = any(w in text_lower for w in coord_words)

            signals = []
            if has_loc and has_coord:
                signals.append("keyword_match")

            lat_matches = lat_pattern.findall(text_lower)
            lon_matches = lon_pattern.findall(text_lower)

            if len(lat_matches) + len(lon_matches) >= 3:
                signals.append("regex_match")

            if signals:
                snippet = get_snippet(text, all_keywords)
                if not snippet and "regex_match" in signals:
                    snippet = text[:300].replace('\n', ' ').strip()
                report["candidate_pages"].append({
                    "page": i + 1,
                    "signals": signals,
                    "snippet": snippet
                })

            if (i + 1) % 100 == 0:
                print(f"scanned {i + 1}/{total_pages} ...", flush=True)

        report["candidate_count"] = len(report["candidate_pages"])
        report["text_layer_present"] = report["pages_with_text"] > 0

        if report["candidate_count"] == 0:
            report["status"] = "NO_CANDIDATES"
            if not report["text_layer_present"]:
                report["status"] = "NO_TEXT_LAYER"

    except Exception as e:
        report["status"] = "ERROR"
        report["error"] = str(e)

    try:
        with open(args.report, 'w', encoding='ascii', errors='ignore') as f:
            json.dump(report, f, indent=2)
    except Exception as e:
        print(f"Failed to write report: {e}", file=sys.stderr)
        sys.exit(1)

    if report["status"] == "ERROR":
        sys.exit(1)

if __name__ == "__main__":
    main()
