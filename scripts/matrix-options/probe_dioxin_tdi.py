# Primary-source probe: search HC TRV v4.0 (2025) PDF for dioxin-like TEQ oral TDI value.
# Plain ASCII only. Run: .venv/Scripts/python.exe scripts/matrix-options/probe_dioxin_tdi.py
import fitz
import re
import sys
import io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

PDF_PATH = r"G:\My Drive\SABCS - Sediment Project\References\HC 2025 - Toxicological Reference Values TRV.pdf"

KEYWORDS = [
    "dioxin",
    "teq",
    "toxic equivalen",
    "tolerable daily intake",
    " tdi",
    "pg/kg",
    "pg tdi",
]

# Numeric-ish pattern: digits, decimal point, optional exponent, optional x10^-n forms.
NUM_PATTERN = re.compile(
    r"(\d+(\.\d+)?\s*[xX]\s*10\s*[-\u2212]?\s*\d+|\d+(\.\d+)?[eE][-\u2212]?\d+|\d+(\.\d+)?)"
)


def norm(s):
    return (s or "").replace("\n", " ").strip()


def main():
    doc = fitz.open(PDF_PATH)
    print(f"Opened PDF: {PDF_PATH}")
    print(f"Total pages: {len(doc)}")
    print("=" * 80)

    hits = 0
    for pidx in range(len(doc)):
        page = doc[pidx]
        text = page.get_text("text") or ""
        low = text.lower()

        # Check if page mentions dioxin/TEQ context at all.
        if not any(kw in low for kw in ["dioxin", "teq", "toxic equivalen"]):
            continue

        # Look for TDI-like keyword clusters combined with a nearby number.
        for kw in ["tolerable daily intake", " tdi", "toxic equivalen", "dioxin-like", "teq"]:
            for m in re.finditer(re.escape(kw), low):
                start = max(0, m.start() - 150)
                end = min(len(text), m.end() + 200)
                snippet = norm(text[start:end])
                # Only print snippets that also contain a number (candidate TDI value).
                if NUM_PATTERN.search(snippet):
                    hits += 1
                    print(f"[PDF page {pidx + 1}] keyword='{kw.strip()}'")
                    print(f"  ...{snippet}...")
                    print("-" * 80)

    print("=" * 80)
    print(f"Total candidate hits: {hits}")

    # Second pass: specifically search for "2.3" near dioxin/TEQ terms anywhere in doc.
    print("=" * 80)
    print("Second pass: searching for '2.3' occurrences near dioxin/TEQ context")
    for pidx in range(len(doc)):
        page = doc[pidx]
        text = page.get_text("text") or ""
        low = text.lower()
        if "dioxin" not in low and "teq" not in low:
            continue
        for m in re.finditer(r"2\.3\b", text):
            start = max(0, m.start() - 200)
            end = min(len(text), m.end() + 200)
            snippet = norm(text[start:end])
            print(f"[PDF page {pidx + 1}] '2.3' context:")
            print(f"  ...{snippet}...")
            print("-" * 80)


def dump_summary_table_pages():
    # Third pass: dump full text of any page whose text contains a line starting with
    # "Dioxins" / "Dibenzo-p-dioxin" / "2,3,7,8-T" near a TDI-style numeric column,
    # to find the main TRV summary table row for dioxin-like TEQ.
    doc = fitz.open(PDF_PATH)
    print("=" * 80)
    print("Third pass: pages with 'dioxin' AND a TDI-shaped number (mg/kg-bw/day, pg/kg, or 10^-)")
    tdi_shape = re.compile(r"10\s*[-\u2212]\s*\d|[eE][-\u2212]\d|pg/kg|\u03bcg/kg|ug/kg|mg/kg")
    for pidx in range(len(doc)):
        page = doc[pidx]
        text = page.get_text("text") or ""
        low = text.lower()
        if "dioxin" not in low:
            continue
        if not tdi_shape.search(text):
            continue
        print(f"--- PDF page {pidx + 1} (dioxin + TDI-shaped number) ---")
        print(text)
        print("=" * 80)


if __name__ == "__main__":
    main()
    dump_summary_table_pages()
