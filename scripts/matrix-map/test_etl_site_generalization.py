"""
test_etl_site_generalization.py -- stdlib unittest for the C3 all-345-sites
generalization of etl_bnrrm_to_supabase.py.

Exercises the new site/station resolvers and the dry-run SQL emission against a
synthetic temp SQLite DB + a tiny centroid CSV. The synthetic source is NOT
named like the canonical DB2, so decide_integrity_check() returns
should_check=False and the tests never touch the real 62 MB DB2 artifact.

Run from this folder:
    ../../.venv/Scripts/python.exe -m unittest test_etl_site_generalization

Plain ASCII only. Python 3.11+. Stdlib only.
"""

from __future__ import annotations

import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from db2_guard import decide_integrity_check, looks_like_db2  # noqa: E402
from etl_bnrrm_to_supabase import (  # noqa: E402
    TierBCentroid,
    build_sql,
    fetch_source_data,
    load_tier_b_centroids,
    resolve_site_ids,
    resolve_station_coord,
)


# ---------------------------------------------------------------------------
# Synthetic fixtures
# ---------------------------------------------------------------------------

# Minimal subset of the BN-RRM schema columns the ETL reads. Site 1 has a
# surveyed station (Tier-A path), a no-coords station (centroid fallback), and a
# no-coords station with NO centroid (skip path). Site 2 is a separate site for
# the SiteResolver tests.
_DDL = """
CREATE TABLE sites (
    site_id INTEGER PRIMARY KEY, registry_id TEXT, name TEXT,
    latitude REAL, longitude REAL, site_type TEXT, region TEXT,
    waterbody TEXT, waterbody_type TEXT, notes TEXT
);
CREATE TABLE stations (
    station_id INTEGER PRIMARY KEY, site_id INTEGER, name TEXT,
    station_type TEXT, latitude REAL, longitude REAL, depth_m REAL,
    habitat_type TEXT, notes TEXT
);
CREATE TABLE sampling_events (
    event_id INTEGER PRIMARY KEY, station_id INTEGER, date_sampled TEXT,
    media_type TEXT, pre_remediation INTEGER, sampling_method TEXT,
    depth_top_cm REAL, depth_bottom_cm REAL, notes TEXT
);
CREATE TABLE sediment_chemistry (
    id INTEGER PRIMARY KEY, event_id INTEGER, parameter TEXT,
    parameter_group TEXT, value REAL, unit TEXT, detection_limit REAL,
    qualifier TEXT, basis TEXT, analytical_method TEXT
);
CREATE TABLE toxicity_tests (
    id INTEGER PRIMARY KEY, event_id INTEGER, test_type TEXT, species TEXT,
    duration_days REAL, endpoint TEXT, result REAL, unit TEXT,
    control_result REAL, reference_result REAL, sig_different TEXT,
    stat_test TEXT, p_value REAL, percent_of_control REAL, lc50 REAL,
    ec50 REAL, ic25 REAL, notes TEXT
);
CREATE TABLE benthic_community (
    id INTEGER PRIMARY KEY, event_id INTEGER, replicate TEXT, abundance REAL,
    taxa_richness REAL, shannon_h REAL, simpson_d REAL, pielous_j REAL,
    bray_curtis REAL, ept_pct REAL, oligochaete_pct REAL, amphipod_pct REAL,
    polychaete_pct REAL, mollusc_pct REAL, biomass REAL, stress_index REAL,
    notes TEXT
);
CREATE TABLE env_modifiers (
    id INTEGER PRIMARY KEY, event_id INTEGER, parameter TEXT, value REAL,
    unit TEXT
);
CREATE TABLE ra_documents (
    doc_id INTEGER PRIMARY KEY, site_id INTEGER, filepath TEXT, filename TEXT,
    title TEXT, author TEXT, doc_date TEXT, doc_type TEXT, total_pages INTEGER,
    methodology_types TEXT, notes TEXT
);
"""


def _build_synthetic_db() -> Path:
    fh = tempfile.NamedTemporaryFile(delete=False, suffix=".db")
    fh.close()
    path = Path(fh.name)
    conn = sqlite3.connect(str(path))
    try:
        conn.executescript(_DDL)
        conn.executemany(
            "INSERT INTO sites (site_id, registry_id, name, region, waterbody, "
            "waterbody_type) VALUES (?,?,?,?,?,?)",
            [
                (1, "R1", "Site One", "Coast", "Harbour", "marine"),
                (2, "R2", "Site Two", "Interior", "Lake", "freshwater"),
            ],
        )
        conn.executemany(
            "INSERT INTO stations (station_id, site_id, name, station_type, "
            "latitude, longitude) VALUES (?,?,?,?,?,?)",
            [
                # surveyed -> high
                (10, 1, "ST-surveyed", "reference", 49.1, -123.1),
                # no coords, site 1 has a centroid -> medium fallback
                (11, 1, "ST-fallback", "exposure", None, None),
                # no coords, site 2 has NO centroid -> skip
                (20, 2, "ST-skip", "sampling", None, None),
            ],
        )
        conn.executemany(
            "INSERT INTO sampling_events (event_id, station_id, date_sampled, "
            "pre_remediation, depth_top_cm, depth_bottom_cm) VALUES (?,?,?,?,?,?)",
            [
                (100, 10, "2021-06-01", 0, 0.0, 10.0),   # dated -> loads
                (101, 10, None, 0, 0.0, 10.0),           # undated -> skipped
                (102, 11, "2022-07-15", 1, 0.0, 5.0),    # dated -> loads
            ],
        )
        conn.executemany(
            "INSERT INTO sediment_chemistry (id, event_id, parameter, "
            "parameter_group, value, unit) VALUES (?,?,?,?,?,?)",
            [
                (1000, 100, "Lead", "metal", 12.5, "mg/kg"),
                (1001, 101, "Zinc", "metal", 30.0, "mg/kg"),  # on undated event
                (1002, 102, "Copper", "metal", 5.0, "mg/kg"),
            ],
        )
        conn.commit()
    finally:
        conn.close()
    return path


def _build_centroid_csv() -> Path:
    fh = tempfile.NamedTemporaryFile(
        delete=False, suffix=".csv", mode="w", encoding="utf-8", newline=""
    )
    try:
        fh.write(
            "site_id,registry_id,latitude,longitude,coordinate_source,"
            "region,waterbody,bc_csr_site_name\n"
        )
        # Only site 1 has a centroid; site 2 deliberately has none.
        fh.write("1,R1,49.5,-123.5,bc_csr_centroid,Coast,Harbour,SITE ONE CSR\n")
    finally:
        fh.close()
    return Path(fh.name)


# ---------------------------------------------------------------------------
# SiteResolver
# ---------------------------------------------------------------------------


class SiteResolverTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db = _build_synthetic_db()
        self.conn = sqlite3.connect(str(self.db))

    def tearDown(self) -> None:
        self.conn.close()
        self.db.unlink(missing_ok=True)

    def test_explicit_subset_is_sorted_and_deduped(self) -> None:
        self.assertEqual(resolve_site_ids(self.conn, [2, 1, 2]), (1, 2))

    def test_explicit_single(self) -> None:
        self.assertEqual(resolve_site_ids(self.conn, [1]), (1,))

    def test_none_selects_all_sites_in_db(self) -> None:
        self.assertEqual(resolve_site_ids(self.conn, None), (1, 2))

    def test_explicit_empty_yields_empty_tuple(self) -> None:
        self.assertEqual(resolve_site_ids(self.conn, []), ())


# ---------------------------------------------------------------------------
# StationTierResolver
# ---------------------------------------------------------------------------


class StationTierResolverTest(unittest.TestCase):
    CENTROID = TierBCentroid(
        site_id=1, registry_id="R1", latitude=49.5, longitude=-123.5,
        region="Coast", waterbody="Harbour", bc_csr_site_name="SITE ONE CSR",
    )

    def test_surveyed_coords_resolve_high(self) -> None:
        coord = resolve_station_coord(
            {"latitude": 49.1, "longitude": -123.1}, self.CENTROID
        )
        assert coord is not None
        self.assertEqual((coord.tier, coord.source), ("high", "surveyed"))
        self.assertEqual((coord.latitude, coord.longitude), (49.1, -123.1))
        self.assertIsNone(coord.centroid)

    def test_surveyed_preferred_over_centroid(self) -> None:
        # Both present -> surveyed wins (most-specific).
        coord = resolve_station_coord(
            {"latitude": 1.0, "longitude": 2.0}, self.CENTROID
        )
        assert coord is not None
        self.assertEqual(coord.source, "surveyed")

    def test_missing_coords_fall_back_to_centroid_medium(self) -> None:
        coord = resolve_station_coord(
            {"latitude": None, "longitude": None}, self.CENTROID
        )
        assert coord is not None
        self.assertEqual((coord.tier, coord.source), ("medium", "bc_csr_centroid"))
        self.assertEqual((coord.latitude, coord.longitude), (49.5, -123.5))
        self.assertIs(coord.centroid, self.CENTROID)

    def test_no_coords_no_centroid_returns_none(self) -> None:
        self.assertIsNone(
            resolve_station_coord({"latitude": None, "longitude": None}, None)
        )

    def test_unparseable_coords_fall_back_to_centroid(self) -> None:
        coord = resolve_station_coord(
            {"latitude": "n/a", "longitude": "n/a"}, self.CENTROID
        )
        assert coord is not None
        self.assertEqual(coord.source, "bc_csr_centroid")


# ---------------------------------------------------------------------------
# DryRunEmit (end-to-end build_sql against the synthetic DB)
# ---------------------------------------------------------------------------


class DryRunEmitTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db = _build_synthetic_db()
        self.csv = _build_centroid_csv()
        self.centroids = load_tier_b_centroids(self.csv)
        conn = sqlite3.connect(str(self.db))
        try:
            self.site_ids = resolve_site_ids(conn, None)
            self.src = fetch_source_data(conn, self.site_ids)
        finally:
            conn.close()
        self.sql, self.counters = build_sql(
            self.src, self.centroids, self.db, self.csv, self.site_ids,
        )

    def tearDown(self) -> None:
        self.db.unlink(missing_ok=True)
        self.csv.unlink(missing_ok=True)

    def test_transaction_bracketed(self) -> None:
        self.assertIn("BEGIN;", self.sql)
        self.assertTrimmedEndsWithCommit()

    def assertTrimmedEndsWithCommit(self) -> None:
        self.assertEqual(self.sql.strip().splitlines()[-1], "COMMIT;")

    def test_per_station_inserts_emitted(self) -> None:
        # Surveyed station 10 + fallback station 11 INSERT; skip station 20.
        self.assertIn("bnrrm_station_id, station_id", self.sql)
        self.assertEqual(self.counters.samples, 2)

    def test_tier_counters_dynamic(self) -> None:
        # One surveyed (high) + one centroid fallback (medium).
        self.assertEqual(self.counters.tier_high_samples, 1)
        self.assertEqual(self.counters.tier_medium_samples, 1)

    def test_station_with_no_geom_skipped(self) -> None:
        # Station 20 (site 2, no centroid) is skipped, not emitted.
        self.assertEqual(self.counters.skipped_no_geom, 1)

    def test_undated_event_skipped(self) -> None:
        # event 101 is undated -> skipped by default; events 100 + 102 load.
        self.assertEqual(self.counters.skipped_no_event_date, 1)
        self.assertEqual(self.counters.sample_events, 2)
        self.assertEqual(self.counters.undated_events_emitted, 0)

    def test_default_emit_omits_date_precision(self) -> None:
        # Default build (allow_undated=False) is backwards-compatible with the
        # current committed schema: the sample_events INSERT must NOT name the
        # date_precision column (it does not exist until the nullable-event_date
        # migration is applied), and emits no 'undated' marker.
        self.assertNotIn("date_precision", self.sql)
        self.assertNotIn("'undated'", self.sql)

    def test_on_conflict_present(self) -> None:
        self.assertIn("ON CONFLICT (bnrrm_station_id) DO NOTHING", self.sql)
        self.assertIn("ON CONFLICT (bnrrm_event_id) DO NOTHING", self.sql)
        self.assertIn("ON CONFLICT (bnrrm_chemistry_id) DO NOTHING", self.sql)

    def test_no_apply_side_effect(self) -> None:
        # build_sql is pure string construction: re-running yields identical SQL
        # modulo the generated-at timestamp line, and never touches a database.
        sql2, counters2 = build_sql(
            self.src, self.centroids, self.db, self.csv, self.site_ids,
        )
        strip = lambda s: "\n".join(
            ln for ln in s.splitlines() if not ln.startswith("-- generated:")
            and '"generated_at_utc"' not in ln
        )
        self.assertEqual(strip(self.sql), strip(sql2))
        self.assertEqual(counters2.samples, self.counters.samples)

    def test_explicit_subset_limits_sites(self) -> None:
        conn = sqlite3.connect(str(self.db))
        try:
            subset = resolve_site_ids(conn, [2])
            src = fetch_source_data(conn, subset)
        finally:
            conn.close()
        _sql, counters = build_sql(src, self.centroids, self.db, self.csv, subset)
        # Site 2's only station has no coords + no centroid -> 0 samples.
        self.assertEqual(counters.samples, 0)
        self.assertEqual(counters.skipped_no_geom, 1)


# ---------------------------------------------------------------------------
# AllowUndatedEmit (C3.1 -- undated events emitted with NULL date under flag)
# ---------------------------------------------------------------------------


class AllowUndatedEmitTest(unittest.TestCase):
    def setUp(self) -> None:
        self.db = _build_synthetic_db()
        self.csv = _build_centroid_csv()
        self.centroids = load_tier_b_centroids(self.csv)
        conn = sqlite3.connect(str(self.db))
        try:
            self.site_ids = resolve_site_ids(conn, None)
            self.src = fetch_source_data(conn, self.site_ids)
        finally:
            conn.close()

    def tearDown(self) -> None:
        self.db.unlink(missing_ok=True)
        self.csv.unlink(missing_ok=True)

    def test_default_skips_undated(self) -> None:
        # Without --allow-undated the undated event 101 is skipped (regression
        # guard alongside DryRunEmitTest -- the default stays dated-only).
        _sql, counters = build_sql(
            self.src, self.centroids, self.db, self.csv, self.site_ids,
            allow_undated=False,
        )
        self.assertEqual(counters.undated_events_emitted, 0)
        self.assertEqual(counters.skipped_no_event_date, 1)
        self.assertEqual(counters.sample_events, 2)

    def test_allow_undated_emits_null_date_and_precision(self) -> None:
        # With --allow-undated the undated event 101 is EMITTED: all 3 events
        # become sample_events rows; none are skipped for missing date.
        sql, counters = build_sql(
            self.src, self.centroids, self.db, self.csv, self.site_ids,
            allow_undated=True,
        )
        self.assertEqual(counters.undated_events_emitted, 1)
        self.assertEqual(counters.skipped_no_event_date, 0)
        self.assertEqual(counters.sample_events, 3)
        # The undated row carries a NULL event_date + date_precision='undated';
        # dated rows carry date_precision='exact'.
        self.assertIn("date_precision", sql)
        self.assertIn("'undated'", sql)
        self.assertIn("'exact'", sql)
        # The undated event's INSERT SELECT must pass NULL for event_date next to
        # the 'undated' precision marker (no DATE literal for that row).
        self.assertIn("NULL, 'undated'", sql)

    def test_allow_undated_reflected_in_audit_args_summary(self) -> None:
        # The service_role_audit args_summary surfaces events_undated_emitted for
        # transparency.
        sql, _counters = build_sql(
            self.src, self.centroids, self.db, self.csv, self.site_ids,
            allow_undated=True,
        )
        self.assertIn("events_undated_emitted", sql)


# ---------------------------------------------------------------------------
# IntegritySeam
# ---------------------------------------------------------------------------


class IntegritySeamTest(unittest.TestCase):
    """A synthetic, non-DB2-named source must NOT arm the SHA check, so tests
    never need the real DB2 artifact."""

    def test_synthetic_source_not_db2(self) -> None:
        self.assertFalse(looks_like_db2(Path("/tmp/synthetic_etl_test.db")))

    def test_non_db2_source_skips_check(self) -> None:
        sha, size, should = decide_integrity_check(
            None, Path("/tmp/synthetic_etl_test.db"), default_enforce=False,
        )
        self.assertEqual((sha, size, should), (None, None, False))


if __name__ == "__main__":
    unittest.main()
