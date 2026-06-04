"""IRIS orphan recon (Phase A) -- read-only analysis, NO catalog mutation.

Cross-walks the authoritative EPA IRIS export (Chemicals_Details (1).xlsx) against the
current References & Values catalog + the committed EPA IRIS canonical snapshot, and reports
which IRIS toxicity values are ORPHANS (present in the EPA source but not yet candidates in
the catalog). Produces:
  - .tmp/iris-orphan-recon.json   (structured data for Phase B generation)
  - docs/MATRIX_OPTIONS_IRIS_ORPHAN_RECON_2026_06_02.md   (owner-facing report)

It does NOT write the catalog, the snapshot, or any staging SQL. AI proposes; HITL disposes.
Plain ASCII only.

The catalog carries NO CAS field, so substance identity is matched via the snapshot's
excel_chemical[] names (which were CAS-matched when the snapshot was built). A minted key that
collides with an existing substance_key or display_name is flagged AMBIGUOUS for owner
adjudication (never silently merged or split).

Run with the catalog-overnight venv python (has openpyxl):
  C:\\Projects\\SSTAC-Dashboard\\scripts\\catalog-overnight\\.venv\\Scripts\\python.exe \\
    scripts/matrix-options/iris-orphan-recon.py
"""

import json
import os
import re
import sys
from collections import defaultdict

import openpyxl

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
EXCEL_PATH = r"C:\Users\jasen\Downloads\Chemicals_Details (1).xlsx"
CATALOG_DIR = os.path.join(REPO_ROOT, "matrix_research", "reference_catalog")
HH_TRV_FILE = os.path.join(CATALOG_DIR, "human_health_trv_values.json")
PV_FILE = os.path.join(CATALOG_DIR, "parameter_values.json")
SNAPSHOT_FILE = os.path.join(
    REPO_ROOT, "src", "lib", "matrix-options", "provenance", "__tests__",
    "epa_iris_canonical_snapshot.json",
)
TMP_OUT = os.path.join(REPO_ROOT, ".tmp", "iris-orphan-recon.json")
REPORT_OUT = os.path.join(REPO_ROOT, "docs", "MATRIX_OPTIONS_IRIS_ORPHAN_RECON_2026_06_02.md")

# EPA TOXICITY VALUE TYPE -> canonical catalog input_key (snapshot key) + the short
# staging-payload input_key the generator's INPUT_KEY_MAP expects + the canonical raw unit.
TYPE_MAP = {
    "RfD": ("rfd_oral_mg_per_kg_bw_day", "oral_rfd", "mg/kg-day", "Oral", "RfD"),
    "Oral Slope Factor": (
        "sf_oral_per_mg_per_kg_bw_per_day", "oral_slope_factor", "per mg/kg-day",
        "Oral", "Oral Slope Factor",
    ),
    "RfC": ("rfc_inhalation_mg_per_m3", "inhalation_rfc", "mg/m3", "Inhalation", "RfC"),
    "Inhalation Unit Risk": (
        "unit_risk_inhalation_per_ug_m3", "inhalation_unit_risk", "per ug/m3",
        "Inhalation", "Inhalation Unit Risk",
    ),
}

VALUE_RE = re.compile(r"^\s*([0-9.]+)\s*x\s*10\s*(-?\d+)\s*(.*)$", re.IGNORECASE)
LEAD_RE = re.compile(r"^\s*([0-9.]+)\s+(\S.*?)\s*$")
PLAIN_RE = re.compile(r"^\s*([0-9.]+)\s*$")


def parse_value(raw):
    """Parse 'N x 10 M unit', 'N unit' (implicit 10^0), or a plain number.

    Returns (value, unit_text) or (None, raw) when unparseable.
    """
    s = str(raw)
    m = VALUE_RE.match(s)
    if m:
        return float(m.group(1)) * (10 ** int(m.group(2))), m.group(3).strip()
    m = LEAD_RE.match(s)
    if m:
        return float(m.group(1)), m.group(2).strip()
    m = PLAIN_RE.match(s)
    if m:
        return float(m.group(1)), ""
    return None, s


# Builder-parity unit predicates: ported byte-for-byte from generate-catalog-records.mjs
# (canonUnit / numeratorPrefix / isReciprocalUnit / isPerDay / isDose / isAir) so the recon's
# accepted set is IDENTICAL to what the builder's normalizeToCanonical can convert. Greek mu
# (U+03BC) and the micro sign (U+00B5) map to 'ug' BEFORE lowercasing so a raw microgram symbol
# never collapses to 'g' (a 1000-fold error). Plain-ASCII source rule (CLAUDE.md 1.1): the two
# non-ASCII code points are written as escapes.
_RE_MU_G = re.compile(chr(0x03BC) + "g|" + chr(0x00B5) + "g", re.IGNORECASE)


def canon_unit(u):
    s = _RE_MU_G.sub("ug", str(u if u is not None else ""))
    s = s.lower()
    s = re.sub(r"\s+", "", s)
    s = re.sub(r"bw", "", s)
    s = re.sub(r"cu\.?m", "m3", s)
    s = re.sub(r"microg|mcg", "ug", s)
    return s


def numerator_prefix(u):
    """Mass prefix on the numerator (text before the first '/'); None unless exactly ng/ug/mg/g.

    Mirrors the builder's numeratorPrefix EXACTLY (anchored ^(ng|ug|mg|g)$), so a 'kg' numerator
    (which the old recon's endswith('g') wrongly accepted) returns None -> reject.
    """
    numerator = re.sub(r"[^a-z0-9]", "", u.split("/")[0])
    numerator = re.sub(r"^per", "", numerator)
    m = re.match(r"^(ng|ug|mg|g)$", numerator)
    return m.group(1) if m else None


def is_reciprocal_unit(u):
    return ("per" in u) or (")-1" in u) or ("^-1" in u) or u.endswith("-1")


def is_per_day(u):
    """A per-day RATE token: literal 'day' or a standalone 'd' (mirrors the builder's isDose 'd')."""
    return ("day" in u) or (re.search(r"(^|[^a-z])d($|[^a-z])", u) is not None)


def is_dose(u):
    return ("kg" in u) and is_per_day(u)


def is_air(u):
    return "m3" in u


def unit_consistent(unit_text, input_key):
    """The EPA cell's own unit must be one the builder's normalizeToCanonical can CONVERT.

    BUILDER PARITY (2026-06-03, F1): recon accepts a unit IFF generate-catalog-records.mjs
    normalizeToCanonical would convert it (not throw). The predicates above are ported byte-for-
    byte from the builder, so the recon's orphan (generatable) pool and the builder's accepted set
    cannot drift. Real-but-non-convertible units return False and route to data_quality (excluded),
    never the orphan pool:
      - a 'kg' numerator (numerator_prefix None -- the old endswith('g') wrongly accepted it),
      - an 'm2' / bare '/m' surface (is_air False -- the old '/m' clause wrongly accepted it),
      - a FIBER-count basis (f/mL, fiber/cc, 'fiber'): is_air False AND numerator_prefix None,
        so it falls out naturally (no special-case clause needed) -- e.g. the asbestos IUR
        '2.3 x 10^-1 per f/mL' is excluded,
      - a wrong reciprocal POLARITY for the type (RfD reciprocal, SF non-reciprocal, etc.),
      - an air RATE carrying a trailing /day (see below).
    Mass-scale variants (per mg/m3, per ug/m3, per ng/m3, per mcg/m3) stay ACCEPTED; the builder
    canonicalizes their magnitude (e.g. ETBE 'per mg/m3' -> per ug/m3, /1000).

    EMPTY/BARE cell -> REJECTED (data_quality). The builder THROWS on an empty unit (canonUnit('')
    has no air/dose/prefix), and build-iris-orphan-pass.mjs re-parses the CELL unit (not the type)
    before calling normalizeToCanonical -- so a bare-number row is NOT builder-convertible. Recon
    mirrors that and routes it to data_quality for HITL inspection. (Preflight: ZERO bare-number
    rows exist in the EPA export, so this drops no real data; it keeps the IFF parity exception-free
    -- empty rejects on BOTH sides. Was the codex-flagged F1 asymmetry, 2026-06-03.)

    /day RATE GUARD lives in the RfC/IUR branches ONLY, mirroring the builder which rejects an air
    RATE (trailing /day, e.g. 'mg/m3/day') inside its RfC/IUR branches but NOT globally: a dose unit
    legitimately carries /day, and a dose+m3 hybrid like 'mg/kg-day/m3' is ACCEPTED by the builder's
    RfD branch (it takes the mg numerator, ignores the stray m3). Putting the guard in only the air
    branches keeps strict parity (the codex-flagged F1 over-rejection, 2026-06-03). Preflight: zero
    EPA-export rows carry an air /day unit, so the guard is pure hardening.
    """
    raw = "" if unit_text is None else str(unit_text)
    if raw.strip() == "":
        return False  # bare/empty cell: builder throws -> route to data_quality (mirror)
    u = canon_unit(raw)
    recip = is_reciprocal_unit(u)
    dose = is_dose(u)
    air = is_air(u)
    prefix = numerator_prefix(u)
    if input_key == "rfd_oral_mg_per_kg_bw_day":
        return dose and (not recip) and (prefix is not None)
    if input_key == "sf_oral_per_mg_per_kg_bw_per_day":
        return dose and recip and (prefix is not None)
    if input_key == "rfc_inhalation_mg_per_m3":
        # /day guard HERE (air branch) only -- mirrors the builder (it never guards /day in the
        # RfD/SF dose branches, which legitimately carry /day).
        return air and (not recip) and (prefix is not None) and (not is_per_day(u))
    if input_key == "unit_risk_inhalation_per_ug_m3":
        return air and recip and (prefix is not None) and (not is_per_day(u))
    return False


def mint_key(name):
    """Mint a snake_case substance_key from an EPA chemical name (matches catalog style)."""
    k = name.strip().lower()
    k = k.replace("[", "_").replace("]", "_").replace("(", "_").replace(")", "_")
    k = re.sub(r"[^a-z0-9]+", "_", k)
    k = re.sub(r"_+", "_", k).strip("_")
    return k


def norm_name(name):
    """Normalize a name for collision detection (strip punctuation, qualifiers)."""
    n = str(name).lower()
    n = re.sub(r"\b(and compounds?|inorganic|, inorganic|compounds?)\b", "", n)
    n = re.sub(r"[^a-z0-9]+", "", n)
    return n


def norm_casrn(casrn):
    """Normalize a CASRN for the new-vs-new collision compare.

    Returns a stable string form (surrounding whitespace stripped; an int/float Excel cell
    coerced to str) or None for a blank/missing CASRN. A None CASRN is a sentinel that must
    NOT collide-merge: two rows with no CASRN cannot be asserted to be distinct substances,
    and a formatting variant of one CASRN must not mask -- nor false-trigger -- a real
    two-CASRN collision. The minted-key collision set drops None so blanks never inflate it.
    """
    if casrn is None:
        return None
    s = str(casrn).strip()
    return s or None


def is_iris(rec):
    dn = (rec.get("display_name") or "").lower()
    sid = " ".join(rec.get("source_ids") or []).lower()
    return "iris" in dn or "iris" in sid


def colliding_minted_keys(minted_cas):
    """Minted substance_keys that map to 2+ DISTINCT (normalized) CASRNs -> a new-vs-new collision.

    `minted_cas` maps minted substance_key -> set of normalized CASRNs (None/blanks already dropped
    by the caller). A key with 0 or 1 distinct CASRN is NOT a collision (a single substance spanning
    multiple input_keys under one CASRN, or a blank-CASRN-only key).
    """
    return {k for k, cas in minted_cas.items() if len(cas) > 1}


def exclude_colliding(entries, colliding_keys):
    """Drop every entry whose minted substance_key is in `colliding_keys`.

    Applied to BOTH minted-key buckets (orphan_new_substance AND ambiguous) so a 2-CASRN-same-key
    pair can never be staged in ANY generation mode. Non-colliding entries (incl. legitimately
    ambiguous ones whose minted key has < 2 CASRNs) are preserved.
    """
    return [e for e in entries if e["substance_key"] not in colliding_keys]


def main():
    wb = openpyxl.load_workbook(EXCEL_PATH, read_only=True, data_only=True)
    ws = wb["Chemicals_Details"]
    rows = list(ws.iter_rows(values_only=True))[1:]

    catalog = json.load(open(HH_TRV_FILE, encoding="utf-8"))
    pv = json.load(open(PV_FILE, encoding="utf-8"))
    all_records = catalog + pv
    snapshot = json.load(open(SNAPSHOT_FILE, encoding="utf-8"))
    snap_records = snapshot["records"]

    # Existing identity maps.
    all_sub_keys = {r["substance_key"] for r in all_records}
    norm_displayname_to_key = {}
    for r in all_records:
        norm_displayname_to_key.setdefault(norm_name(r.get("display_name", "")), r["substance_key"])
        norm_displayname_to_key.setdefault(norm_name(r["substance_key"]), r["substance_key"])

    # excel_chemical name -> substance_key (from the snapshot's CAS-matched mapping).
    excel_name_to_key = {}
    for r in snap_records:
        for nm in (r.get("excel_chemical") or []):
            excel_name_to_key[nm] = r["substance_key"]

    cat_iris = [r for r in all_records if is_iris(r) and r["input_key"] in {
        v[0] for v in TYPE_MAP.values()}]
    cat_pairs = {(r["substance_key"], r["input_key"]) for r in cat_iris}
    snap_pairs = {(r["substance_key"], r["input_key"]) for r in snap_records}

    # Collect Excel toxicity rows grouped by (resolved-or-minted substance_key, input_key).
    # Each group accumulates values (a substance may have multiple endpoint values per input).
    groups = defaultdict(lambda: {
        "excel_chemical": None, "casrn": None, "input_key": None, "short_input": None,
        "raw_unit": None, "exposure_route": None, "toxicity_value_type": None,
        "values": [], "raw": [], "known_key": None, "classification": None,
    })
    unparseable = []
    data_quality = []
    seen_value = set()
    # Raw-level minted-key -> CASRN/name accumulation for the collision guard. Tracked BEFORE
    # grouping + value-dedupe so two distinct CASRNs that mint the same key under the SAME input_key
    # (and whose values dedupe) are still detected (cursor HIGH 2026-06-02).
    minted_cas = defaultdict(set)
    minted_names = defaultdict(set)

    for r in rows:
        if not r or r[0] is None:
            continue
        name, casrn, route, atype, crit, woe, vtype, vraw = r
        vtype = str(vtype)
        if vtype not in TYPE_MAP:
            continue  # skips NA
        input_key, short_input, raw_unit, _route, _t = TYPE_MAP[vtype]
        val, cell_unit = parse_value(vraw)
        if val is None:
            unparseable.append({"chemical": name, "type": vtype, "raw": str(vraw)})
            continue
        if not unit_consistent(cell_unit, input_key):
            data_quality.append({
                "chemical": name, "casrn": casrn, "type": vtype, "raw": str(vraw),
                "cell_unit": cell_unit,
                "reason": "EPA cell unit contradicts its TOXICITY VALUE TYPE",
            })
            continue

        known_key = excel_name_to_key.get(name)
        if known_key:
            sub_key = known_key
        else:
            sub_key = mint_key(name)
            # Track every raw minted row's CASRN/name BEFORE grouping + value-dedupe, so a true
            # two-CASRN collision under one input_key cannot be hidden by the collapse below.
            # CASRN is normalized (whitespace stripped; blank -> None sentinel) so formatting
            # variants neither false-trigger KEY_COLLISION nor mask a real two-CASRN collision.
            ncas = norm_casrn(casrn)
            if ncas is not None:
                minted_cas[sub_key].add(ncas)
            minted_names[sub_key].add(name)

        gkey = (sub_key, input_key)
        # Dedup identical (substance, input, value).
        dkey = (sub_key, input_key, repr(round(val, 15)))
        if dkey in seen_value:
            continue
        seen_value.add(dkey)

        g = groups[gkey]
        g["excel_chemical"] = name
        g["casrn"] = casrn
        g["input_key"] = input_key
        g["short_input"] = short_input
        g["raw_unit"] = raw_unit
        g["exposure_route"] = route
        g["toxicity_value_type"] = vtype
        g["known_key"] = known_key
        g["values"].append(val)
        # ASCII-fold the cell text; the only expected non-ASCII byte is the micro sign,
        # which openpyxl may surface as U+FFFD. Normalize it to U+00B5 (micro) for epa_raw.
        g["raw"].append("".join(c if ord(c) < 128 else chr(0xB5) for c in str(vraw)))

    # Classify each group.
    covered, orphan_new_input, orphan_new_substance, ambiguous = [], [], [], []
    for (sub_key, input_key), g in groups.items():
        entry = {
            "substance_key": sub_key,
            "excel_chemical": g["excel_chemical"],
            "casrn": g["casrn"],
            "input_key": input_key,
            "short_input": g["short_input"],
            "raw_unit": g["raw_unit"],
            "exposure_route": g["exposure_route"],
            "toxicity_value_type": g["toxicity_value_type"],
            "epa_values": g["values"],
            "epa_raw": g["raw"],
            "has_snapshot_anchor": (sub_key, input_key) in snap_pairs,
        }
        if (sub_key, input_key) in cat_pairs:
            entry["classification"] = "ALREADY_COVERED"
            covered.append(entry)
        elif g["known_key"]:
            entry["classification"] = "ORPHAN_NEW_INPUT"
            orphan_new_input.append(entry)
        else:
            # Minted key. Check for collision with an existing (non-IRIS-mapped) substance.
            collide_key = sub_key in all_sub_keys
            collide_name = norm_name(g["excel_chemical"]) in norm_displayname_to_key
            if collide_key or collide_name:
                existing = (sub_key if collide_key
                            else norm_displayname_to_key.get(norm_name(g["excel_chemical"])))
                entry["classification"] = "AMBIGUOUS"
                entry["ambiguous_reason"] = (
                    "minted key collides with existing substance_key '" + existing + "'"
                    if collide_key else
                    "normalized name matches existing substance '" + existing + "'")
                entry["existing_substance_key"] = existing
                ambiguous.append(entry)
            else:
                entry["classification"] = "ORPHAN_NEW_SUBSTANCE"
                orphan_new_substance.append(entry)

    # Guardrail (cursor 2026-06-02; cross-bucket hardening 2026-06-03): new-vs-new minted-key
    # collision. Two DISTINCT EPA chemicals (different CASRN) that mint the same substance_key would
    # be silently merged. Detection uses the RAW-level minted_cas map (accumulated before
    # grouping/value-dedupe, with CASRN normalized), so a collision under the same input_key cannot
    # be hidden. A single substance spanning multiple input_keys under ONE (normalized) CASRN is NOT
    # a collision (its minted_cas set has size 1; a blank-CASRN-only key has size 0).
    #
    # CROSS-BUCKET EXCLUSION: a minted key lands in ORPHAN_NEW_SUBSTANCE (no existing-substance
    # collision) OR AMBIGUOUS (its minted key/name collides with an existing catalog substance).
    # BOTH carry the minted substance_key, and build-iris-orphan-pass.mjs feeds `ambiguous` into the
    # generation pool in newinput-ambiguous mode. So a colliding key must be partitioned OUT of EVERY
    # minted-key bucket -- not just orphan_new_substance -- or a 2-CASRN-same-key pair could still be
    # staged via the ambiguous path. Colliding entries move to key_collision for owner disambiguation;
    # legitimately-ambiguous-but-non-colliding entries (minted_cas size < 2) stay in `ambiguous`.
    colliding_keys = colliding_minted_keys(minted_cas)
    key_collision = []
    for k in sorted(colliding_keys):
        for cas in sorted(minted_cas[k]):
            key_collision.append({
                "substance_key": k,
                "casrn": cas,
                "excel_chemical": " / ".join(sorted(minted_names[k])),
                "short_input": "(multiple)",
                "classification": "KEY_COLLISION",
            })
    orphan_new_substance = exclude_colliding(orphan_new_substance, colliding_keys)
    ambiguous = exclude_colliding(ambiguous, colliding_keys)

    # Distinct-substance tallies.
    def subs(lst):
        return sorted({e["substance_key"] for e in lst})

    summary = {
        "generated_for": "2026-06-02 IRIS orphan recon (Phase A, read-only)",
        "excel_path": EXCEL_PATH,
        "totals": {
            "excel_toxicity_groups": len(groups),
            "already_covered_groups": len(covered),
            "orphan_new_input_groups": len(orphan_new_input),
            "orphan_new_substance_groups": len(orphan_new_substance),
            "ambiguous_groups": len(ambiguous),
            "key_collision_groups": len(key_collision),
            "data_quality_flagged_rows": len(data_quality),
            "unparseable_rows": len(unparseable),
            "orphan_new_substance_distinct_subs": len(subs(orphan_new_substance)),
            "orphan_new_input_distinct_subs": len(subs(orphan_new_input)),
            "ambiguous_distinct_subs": len(subs(ambiguous)),
        },
    }

    def by_input(lst):
        d = defaultdict(int)
        for e in lst:
            d[e["input_key"]] += 1
        return dict(d)

    summary["orphan_new_substance_by_input"] = by_input(orphan_new_substance)
    summary["orphan_new_input_by_input"] = by_input(orphan_new_input)

    os.makedirs(os.path.dirname(TMP_OUT), exist_ok=True)
    with open(TMP_OUT, "w", encoding="utf-8") as f:
        json.dump({
            "summary": summary,
            "orphan_new_substance": orphan_new_substance,
            "orphan_new_input": orphan_new_input,
            "ambiguous": ambiguous,
            "key_collision": key_collision,
            "already_covered_count": len(covered),
            "data_quality": data_quality,
            "unparseable": unparseable,
        }, f, indent=2)

    write_report(summary, orphan_new_substance, orphan_new_input, ambiguous,
                 key_collision, data_quality, unparseable)

    print("RECON SUMMARY")
    print(json.dumps(summary, indent=2))
    print("\nartifact ->", TMP_OUT)
    print("report   ->", REPORT_OUT)


def write_report(summary, new_sub, new_input, ambiguous, key_collision, data_quality, unparseable):
    t = summary["totals"]
    L = []
    L.append("# Matrix-Options IRIS orphan recon (2026-06-02)")
    L.append("")
    L.append("Status: Phase A recon output -- READ-ONLY analysis, no catalog/snapshot/SQL written.")
    L.append("Source of truth: EPA IRIS export `Chemicals_Details (1).xlsx` (authoritative; never AI memory).")
    L.append("AI proposes; HITL disposes. Every generated row would be default_status=available_option,")
    L.append("qa_status=needs_review. This report exists for the owner to approve scope before any generation.")
    L.append("")
    L.append("## Totals")
    L.append("")
    L.append("| Bucket | Groups (substance x input) | Distinct substances |")
    L.append("|---|---|---|")
    L.append("| Already covered (catalog has a candidate) | %d | -- |" % t["already_covered_groups"])
    L.append("| ORPHAN new-input (known substance, new input) | %d | %d |" % (
        t["orphan_new_input_groups"], t["orphan_new_input_distinct_subs"]))
    L.append("| ORPHAN new-substance (not in catalog) | %d | %d |" % (
        t["orphan_new_substance_groups"], t["orphan_new_substance_distinct_subs"]))
    L.append("| AMBIGUOUS (needs owner adjudication) | %d | %d |" % (
        t["ambiguous_groups"], t["ambiguous_distinct_subs"]))
    L.append("| KEY-COLLISION (excluded; 2 CASRN -> 1 minted key) | %d | -- |" % t["key_collision_groups"])
    L.append("| DATA-QUALITY flagged (cell unit vs type) | %d | -- |" % t["data_quality_flagged_rows"])
    L.append("| Unparseable EPA value rows | %d | -- |" % t["unparseable_rows"])
    L.append("")
    L.append("A 'group' is one (substance_key, input_key); a group may carry multiple EPA endpoint")
    L.append("values (each becomes a separate candidate record; the snapshot anchor holds all values).")
    L.append("")
    L.append("New-substance orphans by input: " + json.dumps(summary["orphan_new_substance_by_input"]))
    L.append("New-input orphans by input: " + json.dumps(summary["orphan_new_input_by_input"]))
    L.append("")
    L.append("## AMBIGUOUS -- owner must adjudicate before these are generated")
    L.append("")
    L.append("These EPA chemicals minted a key that collides with an existing catalog substance")
    L.append("(likely the same substance already present via a non-IRIS source, e.g. Health Canada).")
    L.append("Owner decides: attach the IRIS value to the existing substance_key, or treat as distinct.")
    L.append("")
    if ambiguous:
        L.append("| EPA chemical | CASRN | input | existing substance_key | reason |")
        L.append("|---|---|---|---|---|")
        for e in sorted(ambiguous, key=lambda x: x["excel_chemical"]):
            L.append("| %s | %s | %s | %s | %s |" % (
                e["excel_chemical"], e["casrn"], e["short_input"],
                e.get("existing_substance_key", ""), e["ambiguous_reason"]))
    else:
        L.append("(none)")
    L.append("")
    L.append("## ORPHAN new-input (known substance, EPA has an input the catalog lacks)")
    L.append("")
    if new_input:
        L.append("| substance_key | EPA chemical | input | values | snapshot anchor? |")
        L.append("|---|---|---|---|---|")
        for e in sorted(new_input, key=lambda x: x["substance_key"]):
            L.append("| %s | %s | %s | %s | %s |" % (
                e["substance_key"], e["excel_chemical"], e["short_input"],
                ", ".join(repr(v) for v in e["epa_values"]),
                "yes" if e["has_snapshot_anchor"] else "NO (add)"))
    else:
        L.append("(none)")
    L.append("")
    if key_collision:
        L.append("## KEY-COLLISION (excluded; two distinct CASRN minted the same substance_key)")
        L.append("")
        L.append("Guardrail: these EPA chemicals would silently merge into one substance_key. Excluded")
        L.append("from auto-generation; owner must disambiguate (rename one key) before they are added.")
        L.append("")
        L.append("| minted substance_key | CASRN | EPA chemical | input |")
        L.append("|---|---|---|---|")
        for e in sorted(key_collision, key=lambda x: (x["substance_key"], str(x["casrn"]))):
            L.append("| %s | %s | %s | %s |" % (
                e["substance_key"], e["casrn"], e["excel_chemical"], e["short_input"]))
        L.append("")
    L.append("## ORPHAN new-substance (full list)")
    L.append("")
    L.append("Proposed substance_key is minted snake_case from the EPA chemical name; owner may rename.")
    L.append("epa_raw is the verbatim EPA cell string -- the independent cross-check anchor for each")
    L.append("value (verify against epa.gov/iris; the 2% snapshot gate is consistency, not independence).")
    L.append("")
    L.append("| proposed substance_key | EPA chemical | CASRN | input | parsed value | epa_raw |")
    L.append("|---|---|---|---|---|---|")
    for e in sorted(new_sub, key=lambda x: (x["substance_key"], x["input_key"])):
        L.append("| %s | %s | %s | %s | %s | %s |" % (
            e["substance_key"], e["excel_chemical"], e["casrn"], e["short_input"],
            ", ".join(repr(v) for v in e["epa_values"]),
            " ; ".join(e["epa_raw"])))
    L.append("")
    if data_quality:
        L.append("## DATA-QUALITY flagged (excluded; cell unit contradicts its type)")
        L.append("")
        L.append("The EPA cell's own unit string disagrees with its TOXICITY VALUE TYPE column")
        L.append("(e.g. an Oral Slope Factor whose unit is the non-reciprocal 'mg/kg-day'). These")
        L.append("are excluded from generation and reported for owner/HITL inspection -- never coerced.")
        L.append("")
        L.append("| EPA chemical | CASRN | type | raw value | cell unit |")
        L.append("|---|---|---|---|---|")
        for u in sorted(data_quality, key=lambda x: x["chemical"]):
            L.append("| %s | %s | %s | %s | %s |" % (
                u["chemical"], u["casrn"], u["type"], u["raw"], u["cell_unit"]))
        L.append("")
    if unparseable:
        L.append("## Unparseable EPA value rows (excluded; reported, never staged)")
        L.append("")
        L.append("| EPA chemical | type | raw value |")
        L.append("|---|---|---|")
        for u in unparseable:
            L.append("| %s | %s | %s |" % (u["chemical"], u["type"], u["raw"]))
        L.append("")
    L.append("## Next step (owner gate)")
    L.append("")
    L.append("Confirm: (1) scope -- all orphans / a subset / a bounded pilot; (2) the AMBIGUOUS")
    L.append("adjudications above. Then Phase B extends the EPA snapshot, builds an orphan staging")
    L.append("pass, and runs `generate-catalog-records.mjs` (units normalized fail-closed; every")
    L.append("value validated vs the EPA snapshot at 2%).")
    L.append("")
    with open(REPORT_OUT, "w", encoding="utf-8") as f:
        f.write("\n".join(L))


if __name__ == "__main__":
    main()
