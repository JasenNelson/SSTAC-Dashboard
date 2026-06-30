"""Verify the additive VERBATIM merge produced a strict, same-schema, INSERT-ONLY superset.

Compares the merged bnrrm_enhanced.db against the PRISTINE DB2 reference and applies the
codex-agreed acceptance gates (codex-R2/R3/R4):
  - SAME-SCHEMA: sqlite_master(enhanced) == sqlite_master(pristine).
  - EXISTING ROWS UNCHANGED (additive proof): for every table, (pristine EXCEPT enhanced) == 0 rows,
    i.e. nothing was removed or mutated -- merge was INSERT-only. Row counts only grow.
  - FK INTEGRITY: PRAGMA foreign_key_check(enhanced) == 0 violations.
  - GOLDEN: SITE0141 SED11-137A has an event 2011-06-16 / 0-30 cm.
  - NO DUPLICATION: no (site, normalized-station, parameter, value) appears under two events.
  - date coverage rose well above the 304 baseline.

Usage: python scripts/matrix-map/verify_merge.py
       [--enhanced <path>] [--pristine <path>]
Exit 0 only if ALL gates pass.
"""
import argparse
import re
import sqlite3
import sys

WD = "scripts/matrix-map/_enrichment_working"
PASS, FAIL = [], []


def ok(name, cond, detail=""):
    (PASS if cond else FAIL).append(name + (f" -- {detail}" if detail else ""))
    print(("  PASS  " if cond else "  FAIL  ") + name + (f" :: {detail}" if detail else ""))


def norm(s):
    return re.sub(r"[^a-z0-9]", "", str(s or "").lower())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--enhanced", default=f"{WD}/bnrrm_enhanced.db")
    ap.add_argument("--pristine", default=f"{WD}/bnrrm_enriched_working.db")
    args = ap.parse_args()

    db = sqlite3.connect(args.enhanced)
    db.execute("ATTACH DATABASE ? AS pristine", (args.pristine,))
    c = db.cursor()

    # 1. same-schema
    def schema(prefix):
        rows = c.execute(
            f"SELECT type,name,sql FROM {prefix}sqlite_master "
            "WHERE name NOT LIKE 'sqlite_%' ORDER BY type,name").fetchall()
        return rows
    ok("same-schema (sqlite_master == pristine)", schema("") == schema("pristine."))

    # tables to check (user tables present in pristine)
    tables = [r[0] for r in c.execute(
        "SELECT name FROM pristine.sqlite_master WHERE type='table' "
        "AND name NOT LIKE 'sqlite_%' ORDER BY name").fetchall()]

    # 2. existing rows unchanged + counts only grow (INSERT-only proof)
    for t in tables:
        removed = c.execute(
            f"SELECT COUNT(*) FROM (SELECT * FROM pristine.{t} EXCEPT SELECT * FROM main.{t})"
        ).fetchone()[0]
        pcount = c.execute(f"SELECT COUNT(*) FROM pristine.{t}").fetchone()[0]
        ecount = c.execute(f"SELECT COUNT(*) FROM main.{t}").fetchone()[0]
        ok(f"[{t}] existing rows unchanged (pristine EXCEPT enhanced == 0)", removed == 0,
           f"removed/changed={removed}")
        ok(f"[{t}] count only grew ({pcount} -> {ecount})", ecount >= pcount)

    # 3. FK integrity
    fk = c.execute("PRAGMA foreign_key_check").fetchall()
    ok("foreign_key_check == 0 violations", len(fk) == 0, f"violations={len(fk)}" if fk else "")

    # 4. golden set
    g = c.execute(
        "SELECT se.date_sampled, se.depth_top_cm, se.depth_bottom_cm "
        "FROM stations st JOIN sampling_events se ON se.station_id=st.station_id "
        "JOIN sites s ON s.site_id=st.site_id "
        "WHERE st.name='SED11-137A' AND (s.registry_id='141' OR s.name LIKE '%141%')").fetchall()
    golden_ok = any(r[0] == "2011-06-16" and r[1] == 0 and r[2] == 30 for r in g)
    ok("golden SED11-137A = 2011-06-16 / 0-30cm", golden_ok, str(g[:3]))

    # 5. date coverage grew
    dated = c.execute(
        "SELECT COUNT(*) FROM sampling_events WHERE date_sampled IS NOT NULL "
        "AND date_sampled != ''").fetchone()[0]
    ok("dated events well above 304 baseline", dated > 304, f"dated={dated}")

    # 6. no duplication: (site, normalized-station, parameter, value) under >1 event
    rows = c.execute(
        "SELECT st.site_id, st.name, sc.parameter, sc.value, se.event_id "
        "FROM sediment_chemistry sc "
        "JOIN sampling_events se ON sc.event_id=se.event_id "
        "JOIN stations st ON se.station_id=st.station_id").fetchall()
    seen = {}
    dups = 0
    for site_id, name, param, value, ev in rows:
        key = (site_id, norm(name), param, value)
        if key in seen and seen[key] != ev:
            dups += 1
        else:
            seen[key] = ev
    ok("no (site,station,param,value) under two events", dups == 0, f"dups={dups}")

    print(f"\n{len(PASS)} passed, {len(FAIL)} failed")
    if FAIL:
        print("FAILURES:")
        for f in FAIL:
            print("  -", f)
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
