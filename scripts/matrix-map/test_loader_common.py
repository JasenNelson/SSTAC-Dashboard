"""Regression tests for mm_loader_common -- proves the codex-flagged silent-loss
bugs are fixed. Run: python scripts/matrix-map/test_loader_common.py"""

import sqlite3
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
import mm_loader_common as L

SCHEMA = """
CREATE TABLE sites (site_id INTEGER PRIMARY KEY, name TEXT);
CREATE TABLE stations (
    station_id INTEGER PRIMARY KEY,
    site_id INTEGER NOT NULL REFERENCES sites(site_id),
    name TEXT NOT NULL,
    station_type TEXT, latitude REAL, longitude REAL, depth_m REAL,
    habitat_type TEXT, notes TEXT,
    UNIQUE(site_id, name)
);
CREATE TABLE sampling_events (
    event_id INTEGER PRIMARY KEY,
    station_id INTEGER NOT NULL REFERENCES stations(station_id),
    date_sampled TEXT, media_type TEXT NOT NULL, pre_remediation INTEGER DEFAULT 1,
    sampling_method TEXT, depth_top_cm REAL, depth_bottom_cm REAL, notes TEXT,
    source_table_ref TEXT
);
CREATE TABLE sediment_chemistry (
    id INTEGER PRIMARY KEY,
    event_id INTEGER NOT NULL REFERENCES sampling_events(event_id),
    parameter TEXT NOT NULL, parameter_group TEXT, value REAL,
    unit TEXT NOT NULL, detection_limit REAL, qualifier TEXT,
    basis TEXT DEFAULT 'dry', analytical_method TEXT,
    UNIQUE(event_id, parameter)
);
"""

PASS, FAIL = 0, 0


def check(name, cond):
    global PASS, FAIL
    if cond:
        PASS += 1
        print(f"  PASS  {name}")
    else:
        FAIL += 1
        print(f"  FAIL  {name}")


def fresh():
    db = sqlite3.connect(":memory:")
    db.executescript(SCHEMA)
    db.execute("INSERT INTO sites (site_id, name) VALUES (1, 'SITE0141')")
    return db


def main():
    print("test_loader_common")

    # --- P1-4: 0 cm top depth must dedup to the SAME event (golden 0-30 cm) ---
    db = fresh(); c = db.cursor()
    st = L.find_or_create_station(c, 1, "SED11-137A")
    e1 = L.find_or_create_event(c, st, "2011-06-16", 0.0, 30.0)
    e2 = L.find_or_create_event(c, st, "2011-06-16", 0.0, 30.0)
    check("0 cm event dedups to one event (no duplicate)", e1 == e2)
    n_events = c.execute("SELECT COUNT(*) FROM sampling_events").fetchone()[0]
    check("exactly one event row for repeated 0-30cm", n_events == 1)

    # NULL depth distinct from 0 cm depth
    e3 = L.find_or_create_event(c, st, "2011-06-16", None, None)
    check("NULL depth is a DISTINCT event from 0 cm", e3 != e1)

    # blank/whitespace date collapses to NULL -> dedups with a None-date event (codex P2)
    db2 = fresh(); c2 = db2.cursor()
    s2 = L.find_or_create_station(c2, 1, "S2")
    en = L.find_or_create_event(c2, s2, None, 5.0, 10.0)
    eb = L.find_or_create_event(c2, s2, "   ", 5.0, 10.0)
    check("blank-string date dedups with None date (no dup undated event)", en == eb)
    check("only one undated event row", c2.execute("SELECT COUNT(*) FROM sampling_events").fetchone()[0] == 1)

    # station get-or-create idempotent (single allocation)
    st2 = L.find_or_create_station(c, 1, "SED11-137A")
    check("station get-or-create idempotent", st2 == st)

    # --- P1-1: missing unit is stored as 'unknown' + flagged, NOT dropped ---
    db = fresh(); c = db.cursor()
    st = L.find_or_create_station(c, 1, "S1")
    ev = L.find_or_create_event(c, st, "2020-01-01", 0.0, 10.0)
    q = []
    r = L.insert_chemistry(c, ev, "Lead", 12.5, None, q, doc_id=1)
    check("missing-unit chemistry inserted (not dropped)", r == "inserted_unitless")
    row = c.execute("SELECT value, unit FROM sediment_chemistry WHERE parameter='Lead'").fetchone()
    check("missing unit stored as 'unknown'", row == (12.5, "unknown"))
    check("missing unit flagged to quarantine", len(q) == 1 and q[0]["reason"].startswith("missing_unit"))
    n_chem = c.execute("SELECT COUNT(*) FROM sediment_chemistry").fetchone()[0]
    check("chemistry row actually persisted", n_chem == 1)

    # --- normal insert + idempotent duplicate ---
    q = []
    r1 = L.insert_chemistry(c, ev, "Copper", 5.0, "mg/kg", q)
    r2 = L.insert_chemistry(c, ev, "Copper", 5.0, "mg/kg", q)
    check("first copper inserted", r1 == "inserted")
    check("identical copper is duplicate (skipped, not error)", r2 == "duplicate")
    check("no quarantine for true duplicate", len(q) == 0)

    # --- P3-2: value conflict quarantined, not silently dropped ---
    q = []
    rc = L.insert_chemistry(c, ev, "Copper", 9.9, "mg/kg", q)
    check("conflicting copper value -> conflict", rc == "conflict")
    check("conflict recorded to quarantine", len(q) == 1 and q[0]["reason"] == "value_conflict")
    val = c.execute("SELECT value FROM sediment_chemistry WHERE parameter='Copper'").fetchone()[0]
    check("original copper value preserved (not overwritten)", val == 5.0)

    # --- P3-4: implausible top depth does not null a valid bottom depth ---
    dt, reason = L.coerce_depth(99999)
    check("implausible depth -> None + reason", dt is None and reason is not None)
    dgood, _ = L.coerce_depth(0)
    check("0 cm is a valid depth (not None)", dgood == 0.0)

    print(f"\n{PASS} passed, {FAIL} failed")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
