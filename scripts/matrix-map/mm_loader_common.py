"""Shared, correctness-fixed loader helpers for the BN-RRM enrichment pipeline.

Single source of truth for station/event/chemistry loading so the AGY runner
(mm_batch_runner.load_single_doc), the VERBATIM merge adapter, and mm_db_load all
behave identically. Authored to fix the silent-data-loss defects surfaced by the
codex-review of the enrichment plan (2026-06-24):

  - P1-1 null-unit chemistry was silently dropped by `INSERT OR IGNORE` into a
    NOT NULL `unit` column. Here a missing unit is recorded as 'unknown' + flagged,
    never dropped.
  - P1-4 event dedup compared `depth_top or ''`, so a valid 0 cm top depth (the
    golden case is 0-30 cm) was treated as empty and never matched -> duplicate
    events. Here the comparison is NULL-safe and distinguishes 0 from NULL.
  - P2-1 station_id allocation mixed `MAX(id)+1` and bare-insert `lastrowid`. Here
    there is ONE strategy: never specify station_id/event_id on insert; let SQLite
    assign the rowid and use cursor.lastrowid. Single-writer.
  - P2-3 / P3-2 / P3-4: rejected rows, value conflicts, and implausible depths are
    QUARANTINED (row-level, with reason), never silently discarded; an implausible
    depth_top does not null out a valid depth_bottom.

All inserts assume the canonical BN-RRM schema (stations / sampling_events /
sediment_chemistry with UNIQUE(site_id,name) and UNIQUE(event_id,parameter)).
Plain ASCII only.
"""

import re
import sqlite3
from datetime import datetime

DEPTH_MIN_CM = 0
DEPTH_MAX_CM = 1000


def normalize_ascii(text):
    """Collapse to ASCII (code point <= 127); micro-sign -> 'u'. None passes through."""
    if text is None:
        return None
    # micro sign (U+00B5) and Greek mu (U+03BC) -> 'u'; built via chr() so this
    # source file itself stays plain ASCII (code point <= 127).
    t = str(text).replace(chr(0x00B5), "u").replace(chr(0x03BC), "u")
    return "".join(c for c in t if ord(c) <= 127)


def normalize_station_name(name):
    """Normalize station names consistently: strip non-alphanumeric characters and uppercase."""
    if name is None:
        return ""
    return re.sub(r"[^A-Z0-9]", "", str(name).upper())


# The station-name gate is intentionally IDENTICAL to the gate the rebuild/runner
# already used, so the golden-set behavior is preserved exactly. (The substring
# rules over-reject some real codes -- a reporting caveat, not changed here.)
_CONTAINS_BAD = [
    "STANDARD", "GUIDELINE", "CRITERIA", "CSR", "BCCSR", "SEDQC", "SEDQL", "ISQG",
    "PEL", "TEL", "AWF", "AWM", "DRINKINGWATER", "RPD", "QA", "QC", "DUPLICATE",
    "BLANK", "MSVC", "BACKGROUND", "TYPICAL", "MEAN", "MEDIAN", "AVERAGE",
    "MAXIMUM", "MINIMUM", "DETECTION", "METHOD", "REPORTINGLIMIT", "REFERENCE",
    "COMMERCIAL", "INDUSTRIAL", "RESIDENTIAL", "AQUATICLIFE",
]
_IS_BAD = [
    "UNITS", "SAMPLE", "SAMPLEID", "SAMPLEDATE", "SAMPLELOCATION", "DESCRIPTION",
    "LOCATION", "LOCATIONID", "PARAMETER", "ANALYTE", "RESULT", "OF", "NA", "ND",
]


def passes_name_gate(sid_raw):
    """Return (ok: bool, reason: str). True only for plausible station codes."""
    sid_norm = re.sub(r"[^A-Z0-9]", "", str(sid_raw).upper())
    if not sid_norm:
        return False, "Empty or punctuation only"
    for bad in _CONTAINS_BAD:
        if bad in sid_norm:
            return False, f"Contains {bad}"
    if sid_norm in _IS_BAD:
        return False, f"Is {sid_norm}"
    if sid_norm.isnumeric():
        return False, "Purely numeric"
    has_letter = any(c.isalpha() for c in sid_norm)
    has_digit = any(c.isdigit() for c in sid_norm)
    if not (has_letter and has_digit):
        return False, "No alphanumeric structure (missing letter or digit)"
    return True, ""


def is_sediment(media_type):
    """Media gate for the SEDIMENT BN-RRM DB (owner 2026-06-25): accept only sediment
    samples; quarantine soil / groundwater / surface-water / tissue / etc. (the HHERA
    docs carry mostly soil+GW, and this schema has no soil/GW table). A missing/blank
    media_type defaults to sediment (sediment tables commonly omit it); anything
    explicitly named that is not sediment is rejected."""
    if media_type is None:
        return True
    m = str(media_type).strip().lower()
    if not m:
        return True
    return "sediment" in m


def coerce_depth(raw):
    """Return (depth_float_or_None, reason_or_None). Out-of-range -> (None, reason)."""
    if raw is None:
        return None, None
    try:
        d = float(raw)
    except (ValueError, TypeError):
        return None, f"non-numeric depth {raw!r}"
    if d < DEPTH_MIN_CM or d > DEPTH_MAX_CM:
        return None, f"implausible depth {d}"
    return d, None


def coerce_value(raw):
    """Best-effort numeric parse of a measurement value; None if unparseable."""
    if raw is None:
        return None
    try:
        return float(str(raw).replace(",", "").replace("<", "").replace(">", ""))
    except (ValueError, TypeError):
        return None


def parse_date(d_str):
    """Parse a variety of date formats to ISO 8601; None if unrecognized."""
    if not d_str:
        return None
    s = str(d_str).strip()
    for fmt in ("%m/%d/%Y", "%m-%d-%Y", "%Y-%m-%d", "%Y%m%d", "%d-%b-%y",
                "%d-%b-%Y", "%d/%m/%Y", "%m/%d/%y"):
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%d")
        except ValueError:
            continue
    return None


def find_or_create_station(cur, site_id, name):
    """Get-or-create a station by (site_id, name). Single allocation strategy:
    never specify station_id -- let SQLite assign the rowid (lastrowid)."""
    row = cur.execute(
        "SELECT station_id FROM stations WHERE site_id=? AND name=?", (site_id, name)
    ).fetchone()
    if row:
        return row[0]
    cur.execute(
        "INSERT INTO stations (site_id, name) VALUES (?, ?)", (site_id, name)
    )
    return cur.lastrowid


def find_or_create_event(cur, station_id, date_sampled, depth_top, depth_bottom,
                         media_type="sediment"):
    """Get-or-create a sampling_event with NULL-SAFE dedup. 0 cm is a real value,
    distinct from NULL (fixes the P1-4 duplicate-event bug). A blank/whitespace date
    is normalized to NULL so '' and None collapse to one undated event (codex P2) --
    consistent with the seed rows, which store NULL for undated."""
    if isinstance(date_sampled, str):
        date_sampled = date_sampled.strip() or None
    elif date_sampled is not None and not date_sampled:
        date_sampled = None
    # Normalize recognized date formats to ISO-8601 so "6/16/2011" and "2011-06-16"
    # dedup to one event (vision returns mixed formats). Unrecognized -> kept raw.
    if date_sampled is not None:
        iso = parse_date(date_sampled)
        if iso:
            date_sampled = iso
    row = cur.execute(
        """
        SELECT event_id FROM sampling_events
        WHERE station_id = ?
          AND ((date_sampled    IS NULL AND ? IS NULL) OR date_sampled    = ?)
          AND ((depth_top_cm    IS NULL AND ? IS NULL) OR depth_top_cm    = ?)
          AND ((depth_bottom_cm IS NULL AND ? IS NULL) OR depth_bottom_cm = ?)
        """,
        (station_id, date_sampled, date_sampled, depth_top, depth_top,
         depth_bottom, depth_bottom),
    ).fetchone()
    if row:
        return row[0]
    cur.execute(
        """INSERT INTO sampling_events
           (station_id, date_sampled, media_type, depth_top_cm, depth_bottom_cm)
           VALUES (?, ?, ?, ?, ?)""",
        (station_id, date_sampled, media_type or "sediment", depth_top, depth_bottom),
    )
    return cur.lastrowid


def insert_chemistry(cur, event_id, parameter, value, unit, quarantine, *, doc_id=None,
                     source=None):
    """Insert one sediment_chemistry row WITHOUT silent loss.

    - Missing/blank unit -> stored as 'unknown' and flagged (NOT NULL constraint
      would otherwise make INSERT OR IGNORE drop the row).
    - A (event_id, parameter) that already exists with a DIFFERENT (value, unit)
      is a CONFLICT: quarantined, not first-write-wins-dropped. A true duplicate
      (identical value+unit) is skipped silently (idempotent).

    Returns one of: 'inserted', 'inserted_unitless', 'duplicate', 'conflict'.
    Appends a quarantine record for unitless + conflict cases.
    """
    param = normalize_ascii(parameter)
    if not param:
        quarantine.append({"doc_id": doc_id, "source": source, "event_id": event_id,
                           "reason": "empty_parameter", "raw_unit": unit})
        return "conflict"
    u = normalize_ascii(unit)
    unitless = u is None or str(u).strip() == ""
    if unitless:
        u = "unknown"

    existing = cur.execute(
        "SELECT value, unit FROM sediment_chemistry WHERE event_id=? AND parameter=?",
        (event_id, param),
    ).fetchone()
    if existing is not None:
        ex_val, ex_unit = existing
        if (ex_val, ex_unit) != (value, u):
            quarantine.append({
                "doc_id": doc_id, "source": source, "event_id": event_id,
                "parameter": param, "reason": "value_conflict",
                "existing": {"value": ex_val, "unit": ex_unit},
                "incoming": {"value": value, "unit": u},
            })
            return "conflict"
        return "duplicate"

    cur.execute(
        "INSERT INTO sediment_chemistry (event_id, parameter, value, unit) VALUES (?, ?, ?, ?)",
        (event_id, param, value, u),
    )
    if unitless:
        quarantine.append({"doc_id": doc_id, "source": source, "event_id": event_id,
                           "parameter": param, "reason": "missing_unit_stored_as_unknown",
                           "value": value})
        return "inserted_unitless"
    return "inserted"
