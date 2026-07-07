# Extract HC TRV v4.0 (2025) Table 4 -- DeVito et al. (2024) / WHO-2022 Toxic Equivalency Factors (TEFs)
# for the 29 dioxin-like congeners (7 PCDD + 10 PCDF + 4 non-ortho PCB + 8 mono-ortho PCB).
#
# Source: HC 2025 Toxicological Reference Values (TRVs) v4.0, Table 4 "Source: DeVito et al., 2024",
# printed pp. 54-55 (PDF pages 54-55; 0-indexed 53-54). The TEF sub-table has header
# ['Substance', 'CAS No.', 'TEF1'] and spans two PDF pages; section-header rows (PCDD / PCDF /
# Non-ortho / Mono-ortho) carry an empty CAS + TEF and are skipped.
#
# This is the A1 primary-source extraction for tefTable.ts's who-2022-devito-2024 edition column.
# Plain ASCII only. Run: .venv/Scripts/python.exe scripts/matrix-options/hc_trv_v4_table4_devito_tef_extract.py
import fitz
import json
import os

PDF_PATH = r"G:\My Drive\SABCS - Sediment Project\References\HC 2025 - Toxicological Reference Values TRV.pdf"
OUT_PATH = r"scripts\matrix-options\data\hc_trv_v4_table4_devito_tef_extracted.json"
TEF_HEADER = ["Substance", "CAS No.", "TEF1"]

# Section labels (rows where CAS + TEF are blank) -> the congener class the following rows belong to.
SECTION_MAP = {
    "Polychlorinated Dibenzo-p-dioxins": "PCDD",
    "Polychlorinated Dibenzofurans": "PCDF",
    "Non-ortho Substituted PCB Congeners": "PCB_non_ortho",
    "Mono-ortho Substituted PCB Congeners": "PCB_mono_ortho",
}


def norm(s):
    return (s or "").replace("\n", " ").strip()


def main():
    doc = fitz.open(PDF_PATH)
    rows = []
    section = None
    for pidx in (53, 54):  # 0-indexed pp. 54-55
        page = doc[pidx]
        for tab in page.find_tables().tables:
            df = tab.extract()
            if not df:
                continue
            header = [norm(c) for c in df[0]]
            if header != TEF_HEADER:
                continue
            for r in df[1:]:
                sub, cas, tef = norm(r[0]), norm(r[1]), norm(r[2])
                if not sub:
                    continue
                if not cas and not tef:
                    section = SECTION_MAP.get(sub, sub)
                    continue
                rows.append({
                    "congener": sub,
                    "cas": cas,
                    "tef": float(tef),
                    "tef_raw": tef,
                    "section": section,
                    "edition": "who-2022-devito-2024",
                    "source": "HC TRV v4.0 (2025) Table 4 (DeVito et al., 2024)",
                    "pdf_page_1indexed": pidx + 1,
                })
    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as f:
        json.dump(rows, f, indent=2)

    counts = {}
    for r in rows:
        counts[r["section"]] = counts.get(r["section"], 0) + 1
    print(f"Extracted {len(rows)} congener TEF rows -> {OUT_PATH}")
    print("Per-section counts:", counts)
    # Sanity: known DeVito-2024 deltas vs WHO-2005.
    by_name = {r["congener"]: r["tef"] for r in rows}
    checks = [
        ("PCB 126", 0.05),
        ("1,2,3,7,8- Pentachlorodibenzo-p-dioxin (PeCDD)", 0.4),
        ("2,3,7,8- Tetrachlorodibenzo-p-dioxin (TCDD)", 1.0),
        ("Octachlorodibenzo-p-dioxin (OCDD)", 0.001),
    ]
    for name, expected in checks:
        got = by_name.get(name)
        status = "OK" if got == expected else "MISMATCH"
        print(f"  [{status}] {name}: got={got} expected={expected}")


if __name__ == "__main__":
    main()
