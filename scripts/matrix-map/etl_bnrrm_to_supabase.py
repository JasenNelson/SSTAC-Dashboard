"""
PR-MAP-1 ETL -- migrate BN-RRM training SQLite -> Supabase matrix_map schema.

Reads the BN-RRM source database (bnrrm_training.db) for the v1 seed of 9
approved sites (site_ids 1..9 per .tmp_seed_station_list_v1.md) and emits a
transaction-bracketed SQL artifact suitable for `psql` execution against the
Supabase project that holds the matrix_map schema.

PREREQUISITES (BOTH migrations must be applied before --apply):
  1. supabase/migrations/20260519000001_matrix_map_schema.sql -- tables + indexes
  2. supabase/migrations/20260519000002_matrix_map_rls.sql    -- helpers + RLS
RLS is required because the ETL writes one matrix_map.service_role_audit row;
that table is RLS-forced with admin-only SELECT (per codex PR-MAP-1 R1 P1-2).
service_role bypasses RLS so the INSERT itself works, but the table must exist
and be RLS-armed before the ETL runs.

The script defaults to dry-run mode -- it always emits the .sql artifact so a
reviewer can audit the exact statements before they touch the database. With
--apply the script will additionally execute the artifact:
  * preferred path: psycopg2 + DATABASE_URL env var (single transaction);
  * fallback path: shell out to `psql` from PATH using DATABASE_URL.

Idempotent: every INSERT uses ON CONFLICT DO NOTHING keyed on the relevant
UNIQUE constraint:
  substances              -- key
  dras                    -- bnrrm_doc_id
  samples                 -- bnrrm_station_id
  sample_events           -- bnrrm_event_id
  measurements (sediment) -- bnrrm_chemistry_id (PR-MAP-1 R1 P2-1)
  measurements (toxicity) -- bnrrm_toxicity_id (multi-medium extension)
  measurements (community)-- (bnrrm_community_id, substance_id) composite
  measurements (modifier) -- bnrrm_env_modifier_id (multi-medium extension)
so re-running over an already-populated schema is safe and does NOT duplicate
rows. Re-running does NOT update existing rows; that is a v1.x concern.

Multi-medium mapping (added 2026-05-20):
  toxicity_tests -> measurements (medium='toxicity'); substance key is
    a synthetic slug "tox_<test_type>_<endpoint>" with contaminant_class
    'toxicity_test'; result -> value; supporting fields (species,
    duration_days, control_result, p_value, percent_of_control,
    sig_different, stat_test, LC50/EC50/IC25) folded into notes JSON.
  benthic_community -> measurements (medium='community'); one row PER
    non-null metric column (shannon_h, simpson_d, pielous_j, bray_curtis,
    abundance, taxa_richness, ept_pct, oligochaete_pct, amphipod_pct,
    polychaete_pct, mollusc_pct, biomass, stress_index); substance key
    "comm_<metric>" with contaminant_class 'community_metric'; replicate
    + source row id captured in notes.
  env_modifiers -> measurements (medium='sediment'); substance key
    "envmod_<parameter>" with contaminant_class 'env_modifier'; value ->
    value; notes='env_modifier' tag so downstream queries can split env
    modifiers from sediment chemistry within the 'sediment' medium.

Q12 classification rules (plan v3.4.2 R-1):
  station_type = 'reference'                          -> classification='reference'
  station_type in ('exposure','near_field','far_field') -> classification='impacted'
  station_type = 'sampling' or NULL/empty             -> classification='unknown'
classification_source is always 'station_type' for the seed migration (steward
overrides land via classification_overrides downstream).

Coordinate provenance (PR-MAP-0):
  Tier A sites (2, 5, 6, 8) -- per-station surveyed lat/lon from stations.* ;
    coordinate_quality_tier='high', coordinate_source='surveyed'.
  Tier B sites (1, 3, 4, 7, 9) -- single BC CSR centroid from the
    PR-MAP-0 geocoding CSV; fanned out to every station in the site;
    coordinate_quality_tier='medium', coordinate_source='bc_csr_centroid';
    registry_id is the BC Site Registry ID (joined into samples.notes so
    downstream queries can still attribute the centroid source).

All samples + DRAs default to public=false (plan v3.4.2 R-10).

The script writes a single service_role_audit INSERT recording rpc_name,
args_summary (JSONB with seed site count + per-table row tallies), and the
sum of affected_rows estimated from the COUNT(*) probes done up front.

Plain ASCII only. Python 3.11+. Stdlib + optional psycopg2.

Usage:
  # dry-run -> emits .sql + prints summary
  python scripts/matrix-map/etl_bnrrm_to_supabase.py

  # custom paths
  python scripts/matrix-map/etl_bnrrm_to_supabase.py \
    --source-db C:/path/to/bnrrm_training.db \
    --out-sql scripts/matrix-map/out.sql

  # apply against Supabase (requires DATABASE_URL env var)
  DATABASE_URL=postgresql://... python scripts/matrix-map/etl_bnrrm_to_supabase.py --apply
"""

# v1.1.0 restored to main 2026-06-06 from commit 2e1da4c on the UNMERGED branch
# feat/matrix-map-etl-multi-medium-extension (2026-05-20) -- the multimedium
# version was committed there but never merged, so main stayed on v1.0.0 while
# the v1.1.0 OUTPUT (..._output_v1_1_0_multimedium_PATH_B.sql, an UNCOMMITTED
# artifact in the primary checkout) was generated and loaded live. Validation
# 2026-06-06: regenerating against bnrrm_training.db reproduces that Path B SQL
# byte-for-byte except the generated-at timestamp and the two re-applied fixes
# noted below (9521/9521 lines; counters substances=194 dras=19 samples=290
# events=302 measurements=7508 tox=334 community=175 env_modifiers=658).
# TWO fixes from main's 22c51bd (which postdates the 2e1da4c branch point) are
# RE-APPLIED on top of the restored version -- they are deliberate diffs vs the
# committed Path B output: (1) search_path includes 'extensions' so PostGIS
# ST_SetSRID/ST_MakePoint resolve on canonical environments; (2) the
# service_role_audit INSERT supplies the NOT NULL invoked_by_role column
# (current_user), matching the v1.0.0 form on main.
# SCHEMA DEPENDENCY: the toxicity/community ON CONFLICT keys require the
# bnrrm_toxicity_id / bnrrm_community_id columns + unique indexes captured in
# supabase/migrations/20260606000002_* (PR #260) -- already applied LIVE;
# fresh environments must apply that migration before running this ETL.
# 2026-06-06: --include-env-modifiers flag added (default OFF). The owner
# excluded env_modifiers as a map medium on 2026-06-05: grain size/TOC/pH etc.
# are sediment-characterization metadata, not contaminant layers. The column
# bnrrm_env_modifier_id does not exist in the live/canonical schema; emitting
# those INSERTs without an owner-approved migration would fail at apply time.


from __future__ import annotations

import argparse
import datetime as dt
import json
import logging
import os
import shutil
import sqlite3
import subprocess
import sys
import urllib.parse
from collections import defaultdict
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any, Iterable

# Sibling module (script dir is on sys.path when run as a script). Single source
# of the canonical DB2 SHA-256 + the pre-flight guards.
from db2_guard import (
    Db2IntegrityError,
    check_venv,
    decide_integrity_check,
    looks_like_db2,
    verify_db2_integrity,
)
import mm_loader_common as L


# ---------------------------------------------------------------------------
# Constants (load-bearing decisions)
# ---------------------------------------------------------------------------

# C3 (2026-06-20): default source repointed to the canonical DB2 in owner-managed
# Google Drive custody (per docs/design/matrix-map/DB2_ADOPTION.md). Because this
# filename is the canonical DB2 (looks_like_db2() True), the SHA-256 integrity
# pre-flight now ARMS automatically on a default-path run.
DEFAULT_SOURCE_DB = Path(__file__).resolve().parent / "_enrichment_working" / "bnrrm_enhanced.db"

DEFAULT_OUT_SQL = Path(__file__).resolve().parent / "etl_bnrrm_to_supabase_output.sql"

# C3 (2026-06-20): default geocoding CSV repointed to the committed FULL coverage
# CSV (343 bc_csr_centroid rows). Surveyed (Tier A) coords now come from DB2
# stations.lat/lon, NOT the CSV -- so the CSV is centroid-only by design.
DEFAULT_GEOCODING_CSV = (
    Path(__file__).resolve().parents[2]
    / "docs" / "design" / "matrix-map" / "PR_MAP_8_GEOCODING_DATA_FULL.csv"
)

# Seed v1 site_ids (1..9). Retained for documentation/back-compat but build_sql
# no longer reads this global -- the site set is resolved via resolve_site_ids()
# and threaded through as a parameter (C3 all-345-sites generalization).
SEED_SITE_IDS: tuple[int, ...] = (1, 2, 3, 4, 5, 6, 7, 8, 9)
# Legacy v1 hard-coded coordinate tiers. C3 replaces this frozenset logic with the
# per-station resolve_station_coord() resolver (surveyed -> high; centroid ->
# medium; else skip), which generalizes cleanly to all 345 sites.
TIER_A_SITE_IDS: frozenset[int] = frozenset({2, 5, 6, 8})
TIER_B_SITE_IDS: frozenset[int] = frozenset({1, 3, 4, 7, 9})

REFERENCE_TYPES: frozenset[str] = frozenset({"reference"})
IMPACTED_TYPES: frozenset[str] = frozenset({"exposure", "near_field", "far_field"})
# Anything else (including 'sampling', empty string, NULL) -> 'unknown'.

RPC_NAME = "etl_bnrrm_to_supabase"
SCRIPT_VERSION = "1.1.0"

# Benthic community metric columns + units. Each non-null metric in a
# benthic_community row becomes a separate matrix_map.measurements row
# under medium='community' with a synthetic substance key.
BENTHIC_METRICS: tuple[tuple[str, str], ...] = (
    ("abundance",        "count_per_sample"),
    ("taxa_richness",    "count"),
    ("shannon_h",        "dimensionless"),
    ("simpson_d",        "dimensionless"),
    ("pielous_j",        "dimensionless"),
    ("bray_curtis",      "dimensionless"),
    ("ept_pct",          "percent"),
    ("oligochaete_pct",  "percent"),
    ("amphipod_pct",     "percent"),
    ("polychaete_pct",   "percent"),
    ("mollusc_pct",      "percent"),
    ("biomass",          "g_per_m2"),
    ("stress_index",     "dimensionless"),
)


# ---------------------------------------------------------------------------
# Logging (one JSON line per phase to stdout)
# ---------------------------------------------------------------------------


def log_phase(phase: str, **fields: Any) -> None:
    """Emit a single structured log line to stdout."""
    payload = {
        "ts": dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds"),
        "script": "etl_bnrrm_to_supabase",
        "version": SCRIPT_VERSION,
        "phase": phase,
    }
    payload.update(fields)
    sys.stdout.write(json.dumps(payload, default=str) + "\n")
    sys.stdout.flush()


# ---------------------------------------------------------------------------
# SQL literal helpers (avoid third-party deps; we only emit literals from
# trusted internal data so a simple quoter is sufficient and auditable).
# ---------------------------------------------------------------------------


def sql_text(value: Any) -> str:
    """Render a value as a SQL literal. NULL for None; quoted string otherwise."""
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "TRUE" if value else "FALSE"
    if isinstance(value, (int, float)):
        # NaN / inf would corrupt the SQL; reject explicitly.
        if isinstance(value, float) and (value != value or value in (float("inf"), float("-inf"))):
            return "NULL"
        return repr(value)
    s = str(value).replace("'", "''")
    return "'" + s + "'"


def sql_jsonb(obj: Any) -> str:
    """Render a Python object as a Postgres JSONB literal."""
    if obj is None:
        return "NULL"
    text = json.dumps(obj, separators=(",", ":"), default=str)
    return sql_text(text) + "::jsonb"


def sql_date(text: str | None) -> str:
    """Render a YYYY-MM-DD date literal; NULL if blank/unparseable."""
    if not text:
        return "NULL"
    # Accept already-ISO dates; otherwise try common BN-RRM variants.
    candidate = text.strip()
    if not candidate:
        return "NULL"
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m", "%Y"):
        try:
            d = dt.datetime.strptime(candidate, fmt).date()
            return f"DATE '{d.isoformat()}'"
        except ValueError:
            continue
    return "NULL"


def sql_point(lon: float, lat: float) -> str:
    """Render a PostGIS geography(Point,4326) literal from lon/lat."""
    # ST_MakePoint takes (x=lon, y=lat). ::geography sets SRID 4326 from geometry.
    return f"ST_SetSRID(ST_MakePoint({lon!r}, {lat!r}), 4326)::geography"


# ---------------------------------------------------------------------------
# Geocoding CSV (PR-MAP-0 output) -- Tier B centroids only
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class TierBCentroid:
    site_id: int
    registry_id: str | None
    latitude: float
    longitude: float
    region: str | None
    waterbody: str | None
    bc_csr_site_name: str | None


def load_tier_b_centroids(csv_path: Path) -> dict[int, TierBCentroid]:
    """Parse the PR-MAP-0 geocoding CSV; return Tier B centroids keyed by site_id."""
    import csv

    result: dict[int, TierBCentroid] = {}
    with csv_path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            source = (row.get("coordinate_source") or "").strip()
            if source != "bc_csr_centroid":
                continue
            try:
                site_id = int(row["site_id"])
                lat = float(row["latitude"])
                lon = float(row["longitude"])
            except (KeyError, TypeError, ValueError):
                continue
            result[site_id] = TierBCentroid(
                site_id=site_id,
                registry_id=(row.get("registry_id") or "").strip() or None,
                latitude=lat,
                longitude=lon,
                region=(row.get("region") or "").strip() or None,
                waterbody=(row.get("waterbody") or "").strip() or None,
                bc_csr_site_name=(row.get("bc_csr_site_name") or "").strip() or None,
            )
    return result


# ---------------------------------------------------------------------------
# Site + per-station coordinate resolution (C3 all-345-sites generalization)
# ---------------------------------------------------------------------------


def resolve_site_ids(
    conn: sqlite3.Connection, explicit: Iterable[int] | None = None,
) -> tuple[int, ...]:
    """Resolve the set of site_ids to process.

    - ``explicit`` (a non-None iterable) -> exactly those ids, de-duplicated and
      sorted (the test/CLI subset seam).
    - else -> every site_id in the source ``sites`` table (the all-345-sites
      default), sorted ascending.

    Pure resolution of which sites to load -- no chemistry/skip decisions here.
    """
    if explicit is not None:
        return tuple(sorted({int(s) for s in explicit}))
    cur = conn.execute("SELECT site_id FROM sites ORDER BY site_id ASC")
    return tuple(int(row[0]) for row in cur.fetchall())


@dataclass(frozen=True)
class StationCoord:
    """Resolved coordinate for one station: lat/lon + provenance tier/source.

    A None result (returned as None, not a StationCoord) means the station has
    neither surveyed coords nor a site centroid and must be SKIPPED.
    """
    latitude: float
    longitude: float
    tier: str  # 'high' (surveyed) | 'medium' (centroid)
    source: str  # 'surveyed' | 'bc_csr_centroid'
    centroid: TierBCentroid | None  # set only for centroid resolutions


def resolve_station_coord(
    station: dict[str, Any], centroid: TierBCentroid | None,
) -> StationCoord | None:
    """Per-station coordinate tier resolver (generalizes TIER_A/B frozenset logic).

    Resolution order (most-specific wins):
      1. surveyed station lat/lon present -> tier 'high', source 'surveyed';
      2. else a site centroid is available -> tier 'medium', source
         'bc_csr_centroid' (the coordinate is the site centroid fanned out);
      3. else -> None (caller skips + tallies skipped_no_geom).

    BEHAVIOR CHANGE vs v1 (flag for review): a station that the v1 frozenset
    treated as Tier A (surveyed) but which is MISSING surveyed coords now FALLS
    BACK to the site centroid (medium) instead of being skipped, when a centroid
    exists. Recommended: a medium-tier centroid point is more useful on the map
    than dropping the station entirely; the tier/source columns keep the
    provenance honest.
    """
    lat = station.get("latitude")
    lon = station.get("longitude")
    if lat is not None and lon is not None:
        try:
            return StationCoord(
                latitude=float(lat), longitude=float(lon),
                tier="high", source="surveyed", centroid=None,
            )
        except (TypeError, ValueError):
            pass
    if centroid is not None:
        return StationCoord(
            latitude=centroid.latitude, longitude=centroid.longitude,
            tier="medium", source="bc_csr_centroid", centroid=centroid,
        )
    return None


# ---------------------------------------------------------------------------
# Q12 classification (plan v3.4.2 R-1)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Classification:
    value: str  # 'reference' | 'impacted' | 'unknown'
    source: str  # 'station_type' | 'data_unknown'
    rationale: str
    confidence: str  # 'high' | 'medium' | 'low'


def classify_station(station_type: str | None, dra_citation: str | None) -> Classification:
    """Apply Q12/R-1 classification rules."""
    raw = (station_type or "").strip().lower()
    citation = (dra_citation or "source DRA unrecorded").strip() or "source DRA unrecorded"
    if raw in REFERENCE_TYPES:
        return Classification(
            value="reference",
            source="station_type",
            rationale=(
                f"BN-RRM station_type='{raw}' from {citation}; mapped to 'reference' per "
                "plan v3.4.2 R-1 (Q12 classification)."
            ),
            confidence="high",
        )
    if raw in IMPACTED_TYPES:
        return Classification(
            value="impacted",
            source="station_type",
            rationale=(
                f"BN-RRM station_type='{raw}' from {citation}; mapped to 'impacted' per "
                "plan v3.4.2 R-1 (exposure/near_field/far_field all imply impacted)."
            ),
            confidence="high",
        )
    label = raw if raw else "<null>"
    # 'sampling' and any unknown/blank station_type are NOT impacted; flagged unknown.
    return Classification(
        value="unknown",
        source="station_type",
        rationale=(
            f"BN-RRM station_type='{label}' from {citation}; mapped to 'unknown' per "
            "plan v3.4.2 R-1 (excluded from UTL pending steward override)."
        ),
        confidence="low",
    )


# ---------------------------------------------------------------------------
# Substance key normalization
# ---------------------------------------------------------------------------

_KEY_TRANSLATE = str.maketrans({
    " ": "_", "/": "_", "\\": "_", "(": "", ")": "",
    "[": "", "]": "", ",": "", ".": "_", "'": "",
    '"': "", "+": "plus", ":": "_", ";": "_",
})


def substance_key(parameter: str) -> str:
    """Normalize a chemistry parameter name into a unique slug for substances.key."""
    text = (parameter or "").strip().lower()
    text = text.translate(_KEY_TRANSLATE)
    # Collapse repeated underscores; strip leading/trailing.
    while "__" in text:
        text = text.replace("__", "_")
    return text.strip("_") or "unknown_substance"


# Curated canonical-key -> CAS map + raw-alias overrides + junk-param excludes.
# CAS numbers are objective identifiers (verified against PubChem/EPA/NIST), NOT
# value/policy judgments -- so AI may supply/verify them; owner/HITL reviews. The
# map is intentionally PARTIAL: substances not listed resolve to their slug key
# with cas_number=null and are reported as needs_review (no fuzzy auto-merge).
_CAS_MAP_PATH = Path(__file__).resolve().parent / "substance_cas_map.json"


def _parse_cas_map(
    data: Any,
) -> tuple[dict[str, str], dict[str, str], frozenset[str]]:
    """Parse a loaded CAS-map JSON value into (cas_by_key, alias_overrides,
    exclude_params), tolerating imperfect inputs (wrong root/section types,
    null/blank values) by degrading rather than raising. A null or blank CAS is
    treated as MISSING (the substance stays unmatched -> needs_review), never
    emitted as the string 'None'.
    """
    if not isinstance(data, dict):
        return {}, {}, frozenset()
    raw_cas = data.get("cas_by_key")
    raw_cas = raw_cas if isinstance(raw_cas, dict) else {}
    cas_by_key = {
        str(k): str(v).strip()
        for k, v in raw_cas.items()
        if v is not None and str(v).strip()
    }
    raw_alias = data.get("alias_overrides")
    raw_alias = raw_alias if isinstance(raw_alias, dict) else {}
    alias_overrides = {
        str(k): str(v).strip()
        for k, v in raw_alias.items()
        if v is not None and str(v).strip()
    }
    raw_exclude = data.get("exclude_params")
    raw_exclude = raw_exclude if isinstance(raw_exclude, (list, tuple)) else []
    exclude = frozenset(str(p) for p in raw_exclude)
    return cas_by_key, alias_overrides, exclude


@lru_cache(maxsize=1)
def _load_cas_map() -> tuple[dict[str, str], dict[str, str], frozenset[str]]:
    """Load (cas_by_key, alias_overrides, exclude_params) from the curated JSON.

    Missing/malformed file degrades to empty maps so the ETL still runs (every
    substance then resolves to its slug with cas=None) rather than crashing.
    """
    try:
        data = json.loads(_CAS_MAP_PATH.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return {}, {}, frozenset()
    return _parse_cas_map(data)


def resolve_substance(parameter: str) -> tuple[str | None, str | None, bool]:
    """Resolve a raw chemistry parameter to (canonical_key, cas_number, matched).

    - A parameter in exclude_params -> (None, None, False): the caller SKIPS it
      (e.g. the '- Paramete' header-leak artifact in DB2).
    - alias_overrides remap a raw spelling to a canonical key BEFORE slugging
      (for the rare case the slug would not already canonicalize it); otherwise
      the canonical key is substance_key(parameter) (the slug already normalizes
      punctuation/case, so most synonyms collapse without an override).
    - cas_number comes from cas_by_key[canonical_key] when present; matched is
      True only when a CAS was found (drives the needs_review CAS-coverage report).

    Pure + deterministic; no fuzzy matching (never guess a merge).
    """
    cas_by_key, alias_overrides, exclude = _load_cas_map()
    raw = (parameter or "").strip()
    if raw in exclude:
        return None, None, False
    canonical = alias_overrides.get(raw) or substance_key(parameter)
    cas = cas_by_key.get(canonical)
    return canonical, cas, cas is not None


# ---------------------------------------------------------------------------
# Source database read
# ---------------------------------------------------------------------------


@dataclass
class SourceData:
    sites: dict[int, dict[str, Any]]
    stations: dict[int, dict[str, Any]]
    sampling_events: dict[int, dict[str, Any]]
    sediment_chemistry: list[dict[str, Any]]
    ra_documents: dict[int, dict[str, Any]]
    # Per-site default DRA (first ra_documents row by doc_id ASC) for citation
    site_default_doc: dict[int, int] = field(default_factory=dict)
    # Multi-medium extension (2026-05-20)
    toxicity_tests: list[dict[str, Any]] = field(default_factory=list)
    benthic_community: list[dict[str, Any]] = field(default_factory=list)
    env_modifiers: list[dict[str, Any]] = field(default_factory=list)


def fetch_source_data(
    conn: sqlite3.Connection,
    site_ids: Iterable[int],
    include_env_modifiers: bool = False,
) -> SourceData:
    """Pull rows for the seed sites in a single read pass each (no per-row queries)."""
    site_ids = tuple(site_ids)
    placeholders = ",".join("?" for _ in site_ids)
    conn.row_factory = sqlite3.Row

    sites: dict[int, dict[str, Any]] = {}
    cur = conn.execute(
        f"SELECT site_id, registry_id, name, latitude, longitude, site_type, region, "
        f"waterbody, waterbody_type, notes FROM sites WHERE site_id IN ({placeholders})",
        site_ids,
    )
    for row in cur:
        sites[row["site_id"]] = dict(row)

    stations: dict[int, dict[str, Any]] = {}
    cur = conn.execute(
        f"SELECT station_id, site_id, name, station_type, latitude, longitude, depth_m, "
        f"habitat_type, notes FROM stations WHERE site_id IN ({placeholders})",
        site_ids,
    )
    for row in cur:
        stations[row["station_id"]] = dict(row)
    station_ids = tuple(stations.keys())

    sampling_events: dict[int, dict[str, Any]] = {}
    if station_ids:
        # SQLite has a 999-host-parameter default cap; chunk the station_ids the
        # same way event_ids is chunked below. With all 345 sites the station set
        # is far larger than 9-site seed runs, so a single IN(...) would overflow.
        STATION_CHUNK = 800
        for start in range(0, len(station_ids), STATION_CHUNK):
            chunk = station_ids[start:start + STATION_CHUNK]
            evt_placeholders = ",".join("?" for _ in chunk)
            cur = conn.execute(
                f"SELECT event_id, station_id, date_sampled, media_type, pre_remediation, "
                f"sampling_method, depth_top_cm, depth_bottom_cm, notes "
                f"FROM sampling_events WHERE station_id IN ({evt_placeholders})",
                chunk,
            )
            for row in cur:
                sampling_events[row["event_id"]] = dict(row)
    event_ids = tuple(sampling_events.keys())

    sediment_chemistry: list[dict[str, Any]] = []
    if event_ids:
        # SQLite has a 999-host-parameter default cap; chunk if very large.
        CHUNK = 800
        for start in range(0, len(event_ids), CHUNK):
            chunk = event_ids[start:start + CHUNK]
            chem_placeholders = ",".join("?" for _ in chunk)
            cur = conn.execute(
                f"SELECT id, event_id, parameter, parameter_group, value, unit, "
                f"detection_limit, qualifier, basis, analytical_method "
                f"FROM sediment_chemistry WHERE event_id IN ({chem_placeholders})",
                chunk,
            )
            for row in cur:
                sediment_chemistry.append(dict(row))

    # Multi-medium extension: toxicity_tests, benthic_community,
    # env_modifiers. All keyed on event_id; chunked the same way as
    # sediment_chemistry to respect SQLite's 999-host-parameter cap.
    toxicity_tests: list[dict[str, Any]] = []
    benthic_community: list[dict[str, Any]] = []
    env_modifiers: list[dict[str, Any]] = []
    if event_ids:
        CHUNK = 800
        for start in range(0, len(event_ids), CHUNK):
            chunk = event_ids[start:start + CHUNK]
            ph = ",".join("?" for _ in chunk)
            cur = conn.execute(
                f"SELECT id, event_id, test_type, species, duration_days, endpoint, "
                f"result, unit, control_result, reference_result, sig_different, "
                f"stat_test, p_value, percent_of_control, lc50, ec50, ic25, notes "
                f"FROM toxicity_tests WHERE event_id IN ({ph})",
                chunk,
            )
            for row in cur:
                toxicity_tests.append(dict(row))
            cur = conn.execute(
                f"SELECT id, event_id, replicate, abundance, taxa_richness, shannon_h, "
                f"simpson_d, pielous_j, bray_curtis, ept_pct, oligochaete_pct, "
                f"amphipod_pct, polychaete_pct, mollusc_pct, biomass, stress_index, "
                f"notes FROM benthic_community WHERE event_id IN ({ph})",
                chunk,
            )
            for row in cur:
                benthic_community.append(dict(row))
            if include_env_modifiers:
                cur = conn.execute(
                    f"SELECT id, event_id, parameter, value, unit "
                    f"FROM env_modifiers WHERE event_id IN ({ph})",
                    chunk,
                )
                for row in cur:
                    env_modifiers.append(dict(row))

    ra_documents: dict[int, dict[str, Any]] = {}
    cur = conn.execute(
        f"SELECT doc_id, site_id, filepath, filename, title, author, doc_date, doc_type, "
        f"total_pages, methodology_types, notes FROM ra_documents "
        f"WHERE site_id IN ({placeholders}) ORDER BY doc_id ASC",
        site_ids,
    )
    site_default_doc: dict[int, int] = {}
    for row in cur:
        d = dict(row)
        ra_documents[d["doc_id"]] = d
        if d["site_id"] not in site_default_doc:
            site_default_doc[d["site_id"]] = d["doc_id"]

    return SourceData(
        sites=sites,
        stations=stations,
        sampling_events=sampling_events,
        sediment_chemistry=sediment_chemistry,
        ra_documents=ra_documents,
        site_default_doc=site_default_doc,
        toxicity_tests=toxicity_tests,
        benthic_community=benthic_community,
        env_modifiers=env_modifiers,
    )


# ---------------------------------------------------------------------------
# SQL emission
# ---------------------------------------------------------------------------


@dataclass
class EmitCounters:
    substances: int = 0
    dras: int = 0
    samples: int = 0
    sample_events: int = 0
    measurements: int = 0
    toxicity_measurements: int = 0
    community_measurements: int = 0
    env_modifier_measurements: int = 0
    # C3: dynamic per-station coordinate-tier tallies (replace the static
    # frozenset-derived tier_a/tier_b site-id reporting).
    tier_high_samples: int = 0
    tier_medium_samples: int = 0
    skipped_no_geom: int = 0
    skipped_no_event_date: int = 0
    # C3.1 (2026-06-20): undated events EMITTED with event_date NULL +
    # date_precision='undated' under --allow-undated (opt-in; gated on the
    # nullable-event_date migration). Counts only the undated rows that were
    # emitted (NOT the default-skip path, which still increments
    # skipped_no_event_date).
    undated_events_emitted: int = 0
    skipped_no_value: int = 0
    skipped_no_tox_value: int = 0
    skipped_no_community_metric: int = 0
    skipped_no_env_modifier_value: int = 0
    junk_filtered_stations: int = 0


def build_sql(
    src: SourceData,
    centroids: dict[int, TierBCentroid],
    source_db: Path,
    geocoding_csv: Path,
    site_ids: Iterable[int],
    include_env_modifiers: bool = False,
    allow_undated: bool = False,
) -> tuple[str, EmitCounters]:
    """Construct the transaction-bracketed SQL artifact.

    ``site_ids`` is the resolved site set (resolve_site_ids()): the explicit
    subset for tests/CLI, else all sites in the source DB. The build iterates
    THIS set, not the SEED_SITE_IDS global (C3 generalization).

    ``allow_undated`` (default False) controls how events whose date does not
    parse are handled (C3.1):
      - False (default, backwards-compatible) -> undated events are SKIPPED and
        tallied in skipped_no_event_date (the historical dated-only emit);
      - True -> undated events are EMITTED with event_date NULL and
        date_precision='undated', tallied in undated_events_emitted. Requires
        the nullable-event_date migration to be applied before --apply, since
        event_date is otherwise NOT NULL.
    Dated events always emit date_precision='exact'.
    """
    site_ids = tuple(site_ids)
    counters = EmitCounters()
    out: list[str] = []

    # Pre-calculate valid stations and emitted events to avoid junk references in substances
    valid_station_ids = set()
    for site_id in site_ids:
        centroid = centroids.get(site_id)
        for st in src.stations.values():
            if st["site_id"] != site_id:
                continue
            ok, reason = L.passes_name_gate(st.get("name"))
            if not ok:
                continue
            coord = resolve_station_coord(st, centroid)
            if coord is None:
                continue
            valid_station_ids.add(st["station_id"])

    emitted_event_ids = set()
    for event_id, evt in src.sampling_events.items():
        if evt["station_id"] not in valid_station_ids:
            continue
        date_lit = sql_date(evt.get("date_sampled"))
        if date_lit == "NULL" and not allow_undated:
            continue
        emitted_event_ids.add(event_id)

    timestamp = dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")
    out.append("-- PR-MAP-1 BN-RRM -> matrix_map ETL (auto-generated; DO NOT hand-edit)")
    out.append(f"-- script:  scripts/matrix-map/etl_bnrrm_to_supabase.py v{SCRIPT_VERSION}")
    out.append(f"-- generated: {timestamp}")
    out.append(f"-- source_db: {source_db}")
    out.append(f"-- geocoding_csv: {geocoding_csv}")
    out.append(f"-- sites: {len(site_ids)} resolved (first 20: {list(site_ids[:20])})")
    out.append("-- Idempotent: each INSERT uses ON CONFLICT DO NOTHING.")
    out.append("")
    out.append("BEGIN;")
    out.append("SET LOCAL search_path = matrix_map, public, extensions;")
    out.append("SET LOCAL statement_timeout = '10min';")
    out.append("")

    # -- substances --------------------------------------------------------
    out.append("-- ===================== substances =====================")
    seen_substances: dict[str, dict[str, Any]] = {}
    # Track real chemistry substances that resolved with NO CAS, for the
    # needs_review CAS-coverage report (synthetic tox/community/envmod
    # substances are CAS-less by design and are NOT tracked here).
    chem_without_cas: set[str] = set()
    for row in src.sediment_chemistry:
        if row["event_id"] not in emitted_event_ids:
            continue
        param = (row.get("parameter") or "").strip()
        if not param:
            continue
        canonical, cas, matched = resolve_substance(param)
        if canonical is None:
            # Excluded param (e.g. the '- Paramete' header-leak artifact).
            continue
        if not matched:
            chem_without_cas.add(canonical)
        if canonical in seen_substances:
            seen_substances[canonical].setdefault("aliases", set()).add(param)
            continue
        seen_substances[canonical] = {
            "key": canonical,
            "display_name": param,
            "contaminant_class": row.get("parameter_group"),
            "aliases": {param},
            "cas_number": cas,
        }

    # Multi-medium extension: synthetic substances for toxicity tests,
    # benthic community metrics, and env modifiers. Each uses a namespaced
    # key prefix so they cannot collide with real chemistry substances.
    for tox in src.toxicity_tests:
        if tox["event_id"] not in emitted_event_ids:
            continue
        test_type = (tox.get("test_type") or "").strip()
        endpoint = (tox.get("endpoint") or "").strip()
        if not test_type or not endpoint:
            continue
        display = f"{test_type} / {endpoint}"
        key = substance_key(f"tox_{test_type}_{endpoint}")
        if key in seen_substances:
            seen_substances[key].setdefault("aliases", set()).add(display)
            continue
        seen_substances[key] = {
            "key": key,
            "display_name": display,
            "contaminant_class": "toxicity_test",
            "aliases": {display},
        }

    for metric, _unit in BENTHIC_METRICS:
        key = substance_key(f"comm_{metric}")
        display = f"Benthic community: {metric}"
        if key in seen_substances:
            continue
        seen_substances[key] = {
            "key": key,
            "display_name": display,
            "contaminant_class": "community_metric",
            "aliases": {display},
        }

    if include_env_modifiers:
        for em in src.env_modifiers:
            if em["event_id"] not in emitted_event_ids:
                continue
            param = (em.get("parameter") or "").strip()
            if not param:
                continue
            key = substance_key(f"envmod_{param}")
            if key in seen_substances:
                seen_substances[key].setdefault("aliases", set()).add(param)
                continue
            seen_substances[key] = {
                "key": key,
                "display_name": f"Env modifier: {param}",
                "contaminant_class": "env_modifier",
                "aliases": {param},
            }

    for key in sorted(seen_substances):
        rec = seen_substances[key]
        aliases = sorted(rec["aliases"])
        cas_val = rec.get("cas_number")
        out.append(
            "INSERT INTO matrix_map.substances "
            "(key, display_name, cas_number, aliases, contaminant_class) VALUES ("
            f"{sql_text(rec['key'])}, "
            f"{sql_text(rec['display_name'])}, "
            f"{sql_text(cas_val) if cas_val else 'NULL'}, "
            f"{sql_jsonb(aliases)}, "
            f"{sql_text(rec['contaminant_class'])}"
            ") ON CONFLICT (key) DO NOTHING;"
        )
        counters.substances += 1
    out.append("")
    # needs_review CAS-coverage report (real chemistry substances only).
    if chem_without_cas:
        log_phase(
            "cas_coverage.needs_review",
            chem_substances_without_cas=len(chem_without_cas),
            keys=sorted(chem_without_cas),
        )

    # -- dras --------------------------------------------------------------
    out.append("-- ===================== dras =====================")
    for doc_id in sorted(src.ra_documents):
        rec = src.ra_documents[doc_id]
        title = (rec.get("title") or rec.get("filename") or f"BN-RRM doc {doc_id}").strip()
        if not title:
            title = f"BN-RRM doc {doc_id}"
        # citation: prefer 'Author (year) Title' if year-extractable; else title only.
        year_val: int | None = None
        date_text = (rec.get("doc_date") or "").strip()
        if date_text:
            for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y-%m", "%Y"):
                try:
                    year_val = dt.datetime.strptime(date_text, fmt).year
                    break
                except ValueError:
                    continue
        author = (rec.get("author") or "").strip()
        citation_parts: list[str] = []
        if author:
            citation_parts.append(author)
        if year_val is not None:
            citation_parts.append(f"({year_val})")
        citation_parts.append(title)
        citation = " ".join(citation_parts).strip()
        if not citation:
            citation = title

        out.append(
            "INSERT INTO matrix_map.dras "
            "(bnrrm_doc_id, title, agency, year, site_id, citation, document_url, public, "
            "confidentiality_notes) VALUES ("
            f"{sql_text(doc_id)}, "
            f"{sql_text(title)}, "
            f"{sql_text(author or None)}, "
            f"{sql_text(year_val)}, "
            f"{sql_text(str(rec['site_id']) if rec.get('site_id') is not None else None)}, "
            f"{sql_text(citation)}, "
            "NULL, "
            "FALSE, "
            f"{sql_text('Default public=false per plan v3.4.2 R-10; matrix_admin to review per-DRA.')}"
            ") ON CONFLICT (bnrrm_doc_id) DO NOTHING;"
        )
        counters.dras += 1
    out.append("")

    # -- samples (stations) -----------------------------------------------
    out.append("-- ===================== samples =====================")
    # Group stations by site for tidy SQL.
    stations_by_site: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for st in src.stations.values():
        stations_by_site[st["site_id"]].append(st)

    for site_id in site_ids:
        if site_id not in src.sites:
            log_phase("warn", message=f"site {site_id} not present in source DB; skipping")
            continue
        site = src.sites[site_id]
        default_doc_id = src.site_default_doc.get(site_id)
        default_citation = None
        if default_doc_id is not None:
            doc = src.ra_documents[default_doc_id]
            default_citation = (doc.get("title") or doc.get("filename")
                                or f"BN-RRM doc {default_doc_id}")
        # C3: per-station tier is resolved by resolve_station_coord(); the site
        # may have a centroid (used as a per-station fallback when a station has
        # no surveyed coords).
        centroid = centroids.get(site_id)

        out.append(f"-- site {site_id}: {site['name']}")

        for st in sorted(stations_by_site.get(site_id, []), key=lambda s: s["station_id"]):
            station_id_int = st["station_id"]
            raw_name = st.get("name")

            # Junk filter gate (load-bearing)
            ok, reason = L.passes_name_gate(raw_name)
            if not ok:
                counters.junk_filtered_stations += 1
                continue

            display_name = (raw_name or f"station-{station_id_int}").strip()

            classification = classify_station(st.get("station_type"), default_citation)

            # Coordinate resolution (per-station tier resolver). surveyed -> high;
            # else site centroid -> medium; else skip (no geometry available).
            coord = resolve_station_coord(st, centroid)
            if coord is None:
                counters.skipped_no_geom += 1
                log_phase(
                    "warn",
                    message="station has no surveyed coords and no site centroid; skipping",
                    site_id=site_id,
                    station_id=station_id_int,
                )
                continue
            lat = coord.latitude
            lon = coord.longitude
            tier = coord.tier
            source = coord.source
            registry_note: str | None = None
            if coord.tier == "high":
                counters.tier_high_samples += 1
            else:
                counters.tier_medium_samples += 1
            if coord.centroid is not None and coord.centroid.registry_id:
                registry_note = (
                    f"Coordinate inherited from BC Site Registry centroid "
                    f"(registry_id={coord.centroid.registry_id}, "
                    f"name='{coord.centroid.bc_csr_site_name or site['name']}'). "
                    f"Approximate location only -- not surveyed."
                )

            # Receptor metadata (per-station: station_type + depth + habitat)
            receptor_meta: dict[str, Any] = {
                "bnrrm_station_type": st.get("station_type"),
                "bnrrm_depth_m": st.get("depth_m"),
                "bnrrm_habitat_type": st.get("habitat_type"),
                "bnrrm_site_id": site_id,
                "bnrrm_site_registry_id": site.get("registry_id"),
            }

            notes_parts: list[str] = []
            if st.get("notes"):
                notes_parts.append(str(st["notes"]).strip())
            if registry_note:
                notes_parts.append(registry_note)
            notes_text = " | ".join(p for p in notes_parts if p) or None

            # Source DRA UUID resolved via subquery (handles ON CONFLICT inserts).
            if default_doc_id is not None:
                source_dra_clause = (
                    f"(SELECT id FROM matrix_map.dras WHERE bnrrm_doc_id = {default_doc_id})"
                )
            else:
                source_dra_clause = "NULL"

            out.append(
                "INSERT INTO matrix_map.samples ("
                "bnrrm_station_id, station_id, display_name, geometry, "
                "coordinate_quality_tier, coordinate_source, classification, "
                "classification_source, classification_rationale, classification_confidence, "
                "receptor_metadata, source_site_id, bc_region, waterbody, waterbody_type, "
                "source_dra_id, public, notes) VALUES ("
                f"{sql_text(station_id_int)}, "
                f"{sql_text(str(station_id_int))}, "
                f"{sql_text(display_name)}, "
                f"{sql_point(lon, lat)}, "
                f"{sql_text(tier)}, "
                f"{sql_text(source)}, "
                f"{sql_text(classification.value)}, "
                f"{sql_text(classification.source)}, "
                f"{sql_text(classification.rationale)}, "
                f"{sql_text(classification.confidence)}, "
                f"{sql_jsonb(receptor_meta)}, "
                f"{sql_text(site_id)}, "
                f"{sql_text(site.get('region'))}, "
                f"{sql_text(site.get('waterbody'))}, "
                f"{sql_text(site.get('waterbody_type'))}, "
                f"{source_dra_clause}, "
                "FALSE, "
                f"{sql_text(notes_text)}"
                ") ON CONFLICT (bnrrm_station_id) DO NOTHING;"
            )
            counters.samples += 1
            valid_station_ids.add(station_id_int)
    out.append("")

    # -- sample_events -----------------------------------------------------
    out.append("-- ===================== sample_events =====================")
    # Build event->station->site lookup so we can skip orphan events.
    for event_id in sorted(src.sampling_events):
        evt = src.sampling_events[event_id]
        if evt["station_id"] not in valid_station_ids:
            continue
        date_lit = sql_date(evt.get("date_sampled"))
        if date_lit == "NULL":
            # Undated / unparseable event_date. Default (backwards-compatible):
            # SKIP, because event_date is NOT NULL until the nullable-event_date
            # migration is applied. With --allow-undated, EMIT the row with
            # event_date NULL + date_precision='undated' (opt-in load).
            if not allow_undated:
                counters.skipped_no_event_date += 1
                continue
            counters.undated_events_emitted += 1
            date_precision = "undated"
        else:
            date_precision = "exact"
        pre_rem = evt.get("pre_remediation")
        if pre_rem is None:
            pre_rem_lit = "NULL"
        else:
            pre_rem_lit = "TRUE" if int(pre_rem) else "FALSE"
        # depth: BN-RRM stores depth in cm; matrix_map stores metres.
        def cm_to_m(x: Any) -> Any:
            try:
                return float(x) / 100.0 if x is not None else None
            except (TypeError, ValueError):
                return None
        depth_min = cm_to_m(evt.get("depth_top_cm"))
        depth_max = cm_to_m(evt.get("depth_bottom_cm"))

        sample_clause = (
            f"(SELECT id FROM matrix_map.samples WHERE bnrrm_station_id = {evt['station_id']})"
        )

        if allow_undated:
            # date_precision column exists only after the nullable-event_date
            # migration (20260620000001) is applied, which --allow-undated implies.
            out.append(
                "INSERT INTO matrix_map.sample_events ("
                "bnrrm_event_id, sample_id, event_date, date_precision, pre_remediation, "
                "depth_min_m, depth_max_m, sampling_method, notes) "
                f"SELECT {sql_text(event_id)}, {sample_clause}, {date_lit}, "
                f"{sql_text(date_precision)}, {pre_rem_lit}, "
                f"{sql_text(depth_min)}, {sql_text(depth_max)}, "
                f"{sql_text(evt.get('sampling_method'))}, {sql_text(evt.get('notes'))} "
                f"WHERE {sample_clause} IS NOT NULL "
                "ON CONFLICT (bnrrm_event_id) DO NOTHING;"
            )
        else:
            # Default (backwards-compatible) emit: omit date_precision so the SQL
            # applies against the current committed schema (event_date NOT NULL,
            # no date_precision column). Only dated events reach here.
            out.append(
                "INSERT INTO matrix_map.sample_events ("
                "bnrrm_event_id, sample_id, event_date, pre_remediation, "
                "depth_min_m, depth_max_m, sampling_method, notes) "
                f"SELECT {sql_text(event_id)}, {sample_clause}, {date_lit}, "
                f"{pre_rem_lit}, "
                f"{sql_text(depth_min)}, {sql_text(depth_max)}, "
                f"{sql_text(evt.get('sampling_method'))}, {sql_text(evt.get('notes'))} "
                f"WHERE {sample_clause} IS NOT NULL "
                "ON CONFLICT (bnrrm_event_id) DO NOTHING;"
            )
        counters.sample_events += 1
        emitted_event_ids.add(event_id)
    out.append("")

    # -- measurements ------------------------------------------------------
    out.append("-- ===================== measurements =====================")
    for chem in src.sediment_chemistry:
        if chem["event_id"] not in emitted_event_ids:
            continue
        param = (chem.get("parameter") or "").strip()
        value = chem.get("value")
        if not param:
            counters.skipped_no_value += 1
            continue
        if value is None:
            # value is NOT NULL in matrix_map.measurements; treat censored DL-only
            # rows as the DL value when qualifier='<' and detection_limit present.
            dl = chem.get("detection_limit")
            if dl is not None and (chem.get("qualifier") or "").strip() == "<":
                value = dl
            else:
                counters.skipped_no_value += 1
                continue
        # Canonical key MUST match the substances-loop resolution (same FK).
        key, _cas, _matched = resolve_substance(param)
        if key is None:
            # Excluded param (e.g. '- Paramete'); no substance row exists for it.
            counters.skipped_no_value += 1
            continue
        qualifier = (chem.get("qualifier") or "").strip() or None
        censored = qualifier == "<"

        substance_clause = (
            f"(SELECT id FROM matrix_map.substances WHERE key = {sql_text(key)})"
        )
        event_clause = (
            f"(SELECT id FROM matrix_map.sample_events "
            f"WHERE bnrrm_event_id = {chem['event_id']})"
        )

        chem_id = chem.get("id")
        if chem_id is None:
            # Source row without sediment_chemistry.id -- defensive: skip
            # rather than INSERT without idempotency key. Counts toward
            # skipped_no_value so the audit row reflects reality.
            counters.skipped_no_value += 1
            continue
        # ON CONFLICT (bnrrm_chemistry_id) DO NOTHING per codex PR-MAP-1 R1
        # P2-1: makes the measurement insert pass idempotent. UNIQUE
        # constraint on matrix_map.measurements.bnrrm_chemistry_id lives in
        # the schema migration; re-runs are safe and do NOT duplicate rows.
        out.append(
            "INSERT INTO matrix_map.measurements ("
            "bnrrm_chemistry_id, sample_event_id, substance_id, medium, value, unit, "
            "raw_value, raw_unit, detection_limit, qualifier, censored, "
            "method, lab, notes) "
            f"SELECT {int(chem_id)}, {event_clause}, {substance_clause}, 'sediment', "
            f"{sql_text(value)}, {sql_text(chem.get('unit'))}, "
            f"{sql_text(chem.get('value'))}, {sql_text(chem.get('unit'))}, "
            f"{sql_text(chem.get('detection_limit'))}, {sql_text(qualifier)}, "
            f"{'TRUE' if censored else 'FALSE'}, "
            f"{sql_text(chem.get('analytical_method'))}, NULL, "
            f"{sql_text(chem.get('basis'))} "
            f"WHERE {event_clause} IS NOT NULL AND {substance_clause} IS NOT NULL "
            "ON CONFLICT (bnrrm_chemistry_id) DO NOTHING;"
        )
        counters.measurements += 1
    out.append("")

    # -- toxicity measurements --------------------------------------------
    out.append("-- ===================== toxicity measurements =====================")
    for tox in src.toxicity_tests:
        if tox["event_id"] not in emitted_event_ids:
            continue
        test_type = (tox.get("test_type") or "").strip()
        endpoint = (tox.get("endpoint") or "").strip()
        if not test_type or not endpoint:
            counters.skipped_no_tox_value += 1
            continue
        value = tox.get("result")
        if value is None:
            counters.skipped_no_tox_value += 1
            continue
        tox_id = tox.get("id")
        if tox_id is None:
            counters.skipped_no_tox_value += 1
            continue
        key = substance_key(f"tox_{test_type}_{endpoint}")
        unit = (tox.get("unit") or "dimensionless").strip() or "dimensionless"

        # Fold supporting fields into a structured notes payload so the
        # bridge-audit snapshot can reproduce the source reading.
        notes_payload = {
            "source": "toxicity_tests",
            "species": tox.get("species"),
            "duration_days": tox.get("duration_days"),
            "control_result": tox.get("control_result"),
            "reference_result": tox.get("reference_result"),
            "sig_different": tox.get("sig_different"),
            "stat_test": tox.get("stat_test"),
            "p_value": tox.get("p_value"),
            "percent_of_control": tox.get("percent_of_control"),
            "lc50": tox.get("lc50"),
            "ec50": tox.get("ec50"),
            "ic25": tox.get("ic25"),
            "notes": tox.get("notes"),
        }
        notes_payload = {k: v for k, v in notes_payload.items() if v is not None}
        notes_text = json.dumps(notes_payload, separators=(",", ":"), default=str)

        substance_clause = (
            f"(SELECT id FROM matrix_map.substances WHERE key = {sql_text(key)})"
        )
        event_clause = (
            f"(SELECT id FROM matrix_map.sample_events "
            f"WHERE bnrrm_event_id = {tox['event_id']})"
        )
        out.append(
            "INSERT INTO matrix_map.measurements ("
            "bnrrm_toxicity_id, sample_event_id, substance_id, medium, value, unit, "
            "raw_value, raw_unit, detection_limit, qualifier, censored, "
            "method, lab, notes) "
            f"SELECT {int(tox_id)}, {event_clause}, {substance_clause}, 'toxicity', "
            f"{sql_text(value)}, {sql_text(unit)}, "
            f"{sql_text(value)}, {sql_text(unit)}, "
            "NULL, NULL, FALSE, "
            f"{sql_text(tox.get('stat_test'))}, NULL, "
            f"{sql_text(notes_text)} "
            f"WHERE {event_clause} IS NOT NULL AND {substance_clause} IS NOT NULL "
            "ON CONFLICT (bnrrm_toxicity_id) DO NOTHING;"
        )
        counters.toxicity_measurements += 1
    out.append("")

    # -- community measurements -------------------------------------------
    out.append("-- ===================== community measurements =====================")
    for bc in src.benthic_community:
        if bc["event_id"] not in emitted_event_ids:
            continue
        bc_id = bc.get("id")
        if bc_id is None:
            counters.skipped_no_community_metric += 1
            continue
        replicate = bc.get("replicate")
        any_metric_emitted = False
        for metric, unit in BENTHIC_METRICS:
            value = bc.get(metric)
            if value is None:
                continue
            any_metric_emitted = True
            key = substance_key(f"comm_{metric}")

            notes_payload = {
                "source": "benthic_community",
                "metric": metric,
                "replicate": replicate,
                "notes": bc.get("notes"),
            }
            notes_payload = {k: v for k, v in notes_payload.items() if v is not None}
            notes_text = json.dumps(notes_payload, separators=(",", ":"), default=str)

            substance_clause = (
                f"(SELECT id FROM matrix_map.substances WHERE key = {sql_text(key)})"
            )
            event_clause = (
                f"(SELECT id FROM matrix_map.sample_events "
                f"WHERE bnrrm_event_id = {bc['event_id']})"
            )
            out.append(
                "INSERT INTO matrix_map.measurements ("
                "bnrrm_community_id, sample_event_id, substance_id, medium, value, unit, "
                "raw_value, raw_unit, detection_limit, qualifier, censored, "
                "method, lab, notes) "
                f"SELECT {int(bc_id)}, {event_clause}, {substance_clause}, 'community', "
                f"{sql_text(value)}, {sql_text(unit)}, "
                f"{sql_text(value)}, {sql_text(unit)}, "
                "NULL, NULL, FALSE, NULL, NULL, "
                f"{sql_text(notes_text)} "
                f"WHERE {event_clause} IS NOT NULL AND {substance_clause} IS NOT NULL "
                "ON CONFLICT (bnrrm_community_id, substance_id) DO NOTHING;"
            )
            counters.community_measurements += 1
        if not any_metric_emitted:
            counters.skipped_no_community_metric += 1
    out.append("")

    # -- env_modifier measurements ----------------------------------------
    # Tagged medium='sediment' (sediment-pathway bioavailability controls);
    # notes='env_modifier' lets downstream queries split env modifiers
    # from sediment chemistry. matrix_map.measurements.medium has no
    # 'env_modifier' enum value so the notes tag is the only distinguisher.
    # Gated on --include-env-modifiers (default OFF): the owner excluded
    # env_modifiers as a map medium on 2026-06-05; bnrrm_env_modifier_id does
    # not exist in the live/canonical schema.
    out.append("-- ===================== env_modifier measurements =====================")
    if include_env_modifiers:
        for em in src.env_modifiers:
            if em["event_id"] not in emitted_event_ids:
                continue
            em_id = em.get("id")
            if em_id is None:
                counters.skipped_no_env_modifier_value += 1
                continue
            param = (em.get("parameter") or "").strip()
            value = em.get("value")
            if not param or value is None:
                counters.skipped_no_env_modifier_value += 1
                continue
            key = substance_key(f"envmod_{param}")
            unit = (em.get("unit") or "dimensionless").strip() or "dimensionless"

            substance_clause = (
                f"(SELECT id FROM matrix_map.substances WHERE key = {sql_text(key)})"
            )
            event_clause = (
                f"(SELECT id FROM matrix_map.sample_events "
                f"WHERE bnrrm_event_id = {em['event_id']})"
            )
            out.append(
                "INSERT INTO matrix_map.measurements ("
                "bnrrm_env_modifier_id, sample_event_id, substance_id, medium, value, unit, "
                "raw_value, raw_unit, detection_limit, qualifier, censored, "
                "method, lab, notes) "
                f"SELECT {int(em_id)}, {event_clause}, {substance_clause}, 'sediment', "
                f"{sql_text(value)}, {sql_text(unit)}, "
                f"{sql_text(value)}, {sql_text(unit)}, "
                "NULL, NULL, FALSE, NULL, NULL, "
                f"{sql_text('env_modifier')} "
                f"WHERE {event_clause} IS NOT NULL AND {substance_clause} IS NOT NULL "
                "ON CONFLICT (bnrrm_env_modifier_id) DO NOTHING;"
            )
            counters.env_modifier_measurements += 1
    out.append("")

    # -- service_role_audit ------------------------------------------------
    out.append("-- ===================== service_role_audit =====================")
    args_summary = {
        "script": "etl_bnrrm_to_supabase",
        "script_version": SCRIPT_VERSION,
        "source_db": str(source_db),
        "geocoding_csv": str(geocoding_csv),
        "site_count": len(site_ids),
        "site_ids": list(site_ids),
        "tier_high_samples": counters.tier_high_samples,
        "tier_medium_samples": counters.tier_medium_samples,
        "row_counts": {
            "substances": counters.substances,
            "dras": counters.dras,
            "samples": counters.samples,
            "sample_events": counters.sample_events,
            "events_undated_emitted": counters.undated_events_emitted,
            "measurements": counters.measurements,
            "toxicity_measurements": counters.toxicity_measurements,
            "community_measurements": counters.community_measurements,
            "env_modifier_measurements": counters.env_modifier_measurements,
        },
        "skipped": {
            "stations_missing_geom": counters.skipped_no_geom,
            "events_missing_date": counters.skipped_no_event_date,
            "measurements_missing_value": counters.skipped_no_value,
            "toxicity_missing_value": counters.skipped_no_tox_value,
            "community_missing_metric": counters.skipped_no_community_metric,
            "env_modifier_missing_value": counters.skipped_no_env_modifier_value,
            "stations_junk_filtered": counters.junk_filtered_stations,
        },
        "generated_at_utc": timestamp,
    }
    affected = (
        counters.substances + counters.dras + counters.samples
        + counters.sample_events + counters.measurements
        + counters.toxicity_measurements + counters.community_measurements
        + counters.env_modifier_measurements
    )
    out.append(
        "INSERT INTO matrix_map.service_role_audit (rpc_name, invoked_by_role, args_summary, affected_rows) "
        f"VALUES ({sql_text(RPC_NAME)}, current_user, {sql_jsonb(args_summary)}, {sql_text(affected)});"
    )
    out.append("")
    out.append("COMMIT;")
    out.append("")

    return "\n".join(out), counters


# ---------------------------------------------------------------------------
# Apply path (optional)
# ---------------------------------------------------------------------------


def apply_with_psycopg2(sql_text_body: str, database_url: str) -> None:
    """Run the SQL artifact via psycopg2 in a single connection/transaction."""
    try:
        import psycopg2  # type: ignore
    except ImportError as exc:
        raise RuntimeError(
            "psycopg2 is not installed; install it OR rerun without --apply and "
            "execute the emitted .sql file via psql."
        ) from exc
    log_phase("apply.psycopg2.connect", database_url_set=True)
    # The SQL artifact already wraps everything in BEGIN/COMMIT; psycopg2 will
    # also open an implicit transaction. Use autocommit=True so the embedded
    # BEGIN/COMMIT are the authoritative transaction boundaries.
    conn = psycopg2.connect(database_url)
    try:
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute(sql_text_body)
        log_phase("apply.psycopg2.done")
    finally:
        conn.close()


def apply_with_psql(sql_path: Path, database_url: str) -> None:
    """Shell out to psql; SQL artifact carries its own BEGIN/COMMIT."""
    psql = shutil.which("psql")
    if psql is None:
        raise RuntimeError(
            "psql is not on PATH and psycopg2 is not installed; cannot --apply. "
            "Install one or execute the emitted .sql file manually."
        )
    log_phase("apply.psql.invoke", psql=psql, sql_path=str(sql_path))
    cmd = [psql, database_url, "-v", "ON_ERROR_STOP=1", "-f", str(sql_path)]
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        log_phase("apply.psql.failed", returncode=proc.returncode,
                  stderr=proc.stderr[-2000:])
        raise RuntimeError(f"psql exited {proc.returncode}: {proc.stderr.strip()}")
    log_phase("apply.psql.done")


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Migrate BN-RRM training SQLite into Supabase matrix_map schema.",
    )
    parser.add_argument(
        "--source-db",
        type=Path,
        default=DEFAULT_SOURCE_DB,
        help="Path to bnrrm_training.db (default: BN-RRM canonical location).",
    )
    parser.add_argument(
        "--geocoding-csv",
        type=Path,
        default=DEFAULT_GEOCODING_CSV,
        help="Path to PR-MAP-0 geocoding CSV (default: SSTAC-Dashboard repo root).",
    )
    parser.add_argument(
        "--out-sql",
        type=Path,
        default=DEFAULT_OUT_SQL,
        help="Output path for the transaction-bracketed .sql artifact.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=True,
        help="Emit the .sql artifact only (default).",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        default=False,
        help=(
            "Execute the SQL artifact against the database identified by the "
            "DATABASE_URL env var (psycopg2 preferred; psql fallback)."
        ),
    )
    parser.add_argument(
        "--site-ids",
        default=None,
        help=(
            "Comma-separated explicit subset of site_ids to process (e.g. "
            "'1,2,3'). Default (omitted) = ALL sites in the source DB "
            "(all-345-sites generalization). Mainly a test/CLI seam."
        ),
    )
    parser.add_argument(
        "--include-env-modifiers",
        action="store_true",
        default=False,
        help=(
            "Include env_modifier rows (medium tagged sediment). Default OFF: "
            "the bnrrm_env_modifier_id column does not exist in the live/canonical "
            "schema -- the owner excluded env_modifiers as a map medium "
            "(characterization metadata, not a contaminant layer). Requires an "
            "owner-approved migration before use."
        ),
    )
    parser.add_argument(
        "--allow-undated",
        action="store_true",
        default=False,
        help=(
            "Emit sample_events rows for events whose date does not parse, with "
            "event_date NULL and date_precision='undated' (default OFF: undated "
            "events are skipped, matching the historical dated-only emit). "
            "REQUIRES the nullable-event_date migration to be applied before an "
            "--allow-undated --apply load, since event_date is otherwise NOT NULL."
        ),
    )
    parser.add_argument(
        "--expected-sha256",
        default=None,
        help=(
            "If set, verify --source-db against this SHA-256 and hard-fail on "
            "mismatch. When omitted, the integrity check runs ONLY if --source-db "
            "is the canonical DB2 (verified against the recorded DB2 hash); a "
            "non-DB2 source is skipped with a log line."
        ),
    )
    parser.add_argument(
        "--skip-sha-check",
        action="store_true",
        help="skip the DB2 integrity pre-flight entirely (NOT recommended).",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    log_phase(
        "start",
        source_db=str(args.source_db),
        geocoding_csv=str(args.geocoding_csv),
        out_sql=str(args.out_sql),
        dry_run=not args.apply,
        apply=args.apply,
        include_env_modifiers=args.include_env_modifiers,
        allow_undated=args.allow_undated,
    )

    check_venv(log=log_phase)

    if not args.source_db.exists():
        log_phase("error", message=f"source DB not found: {args.source_db}")
        return 2

    # Integrity pre-flight. The historical default source is the stale DB1, so
    # enforce only when the source IS the canonical DB2 (or the caller pins an
    # explicit --expected-sha256) -- default_enforce=False. A non-DB2 source is
    # skipped with a log line so existing DB1 dry-runs are not broken; once the
    # source repoints to DB2 (C3), enforcement becomes automatic.
    if not args.skip_sha_check:
        expected_sha, expected_size, should_check = decide_integrity_check(
            args.expected_sha256, args.source_db, default_enforce=False,
        )
        if should_check:
            try:
                verify_db2_integrity(
                    args.source_db,
                    expected_sha256=expected_sha,
                    expected_size=expected_size,
                    log=log_phase,
                )
            except Db2IntegrityError:
                return 4
        else:
            log_phase(
                "db2_integrity_skipped",
                reason="source is not the canonical DB2; no SHA check",
                path=str(args.source_db),
            )

    if not args.geocoding_csv.exists():
        log_phase("error", message=f"geocoding CSV not found: {args.geocoding_csv}")
        return 2

    centroids = load_tier_b_centroids(args.geocoding_csv)
    log_phase("geocoding.loaded", centroid_sites=sorted(centroids.keys()),
              centroid_count=len(centroids))

    explicit_site_ids: list[int] | None = None
    if args.site_ids is not None:
        explicit_site_ids = [
            int(tok) for tok in str(args.site_ids).split(",") if tok.strip()
        ]

    # Open the source DB read-only: the ETL only ever reads it. The canonical
    # DB2 lives on a read-only Google Drive (G:) custody path where a plain
    # read/write connect raises OperationalError, so it also needs immutable=1
    # (mirrors geocode_bc_csr.py). Reserve immutable=1 for the canonical DB2
    # ONLY -- on a custom --source-db that can still change, immutable=1 would
    # skip locking/change-detection and risk a stale snapshot; plain mode=ro is
    # correct there.
    ro_params = "mode=ro&immutable=1" if looks_like_db2(args.source_db) else "mode=ro"
    source_uri = "file:" + urllib.parse.quote(str(args.source_db)) + "?" + ro_params
    conn = sqlite3.connect(source_uri, uri=True)
    try:
        site_ids = resolve_site_ids(conn, explicit_site_ids)
        log_phase(
            "sites.resolved",
            mode="explicit" if explicit_site_ids is not None else "all",
            site_count=len(site_ids),
        )
        src = fetch_source_data(conn, site_ids,
                                include_env_modifiers=args.include_env_modifiers)
    finally:
        conn.close()
    log_phase(
        "source.fetched",
        sites=len(src.sites),
        stations=len(src.stations),
        sampling_events=len(src.sampling_events),
        sediment_chemistry_rows=len(src.sediment_chemistry),
        toxicity_tests_rows=len(src.toxicity_tests),
        benthic_community_rows=len(src.benthic_community),
        env_modifiers_rows=len(src.env_modifiers),
        ra_documents=len(src.ra_documents),
    )

    sql_body, counters = build_sql(
        src, centroids, args.source_db, args.geocoding_csv, site_ids,
        include_env_modifiers=args.include_env_modifiers,
        allow_undated=args.allow_undated,
    )
    args.out_sql.parent.mkdir(parents=True, exist_ok=True)
    args.out_sql.write_text(sql_body, encoding="utf-8", newline="\n")
    log_phase(
        "sql.emitted",
        path=str(args.out_sql),
        bytes=args.out_sql.stat().st_size,
        substances=counters.substances,
        dras=counters.dras,
        samples=counters.samples,
        sample_events=counters.sample_events,
        undated_events_emitted=counters.undated_events_emitted,
        measurements=counters.measurements,
        toxicity_measurements=counters.toxicity_measurements,
        community_measurements=counters.community_measurements,
        env_modifier_measurements=counters.env_modifier_measurements,
        tier_high_samples=counters.tier_high_samples,
        tier_medium_samples=counters.tier_medium_samples,
        skipped_no_geom=counters.skipped_no_geom,
        skipped_no_event_date=counters.skipped_no_event_date,
        skipped_no_value=counters.skipped_no_value,
        skipped_no_tox_value=counters.skipped_no_tox_value,
        skipped_no_community_metric=counters.skipped_no_community_metric,
        skipped_no_env_modifier_value=counters.skipped_no_env_modifier_value,
        junk_filtered_stations=counters.junk_filtered_stations,
    )

    if args.apply:
        database_url = os.environ.get("DATABASE_URL")
        if not database_url:
            log_phase("error", message="--apply set but DATABASE_URL env var is missing")
            return 3
        try:
            apply_with_psycopg2(sql_body, database_url)
        except RuntimeError as exc:
            log_phase("apply.psycopg2.unavailable", reason=str(exc))
            try:
                apply_with_psql(args.out_sql, database_url)
            except RuntimeError as exc2:
                log_phase("error", message=str(exc2))
                return 4

    # Final summary line
    summary = {
        "substances": counters.substances,
        "dras": counters.dras,
        "samples": counters.samples,
        "sample_events": counters.sample_events,
        "undated_events_emitted": counters.undated_events_emitted,
        "measurements": counters.measurements,
        "toxicity_measurements": counters.toxicity_measurements,
        "community_measurements": counters.community_measurements,
        "env_modifier_measurements": counters.env_modifier_measurements,
        "tier_high_samples": counters.tier_high_samples,
        "tier_medium_samples": counters.tier_medium_samples,
        "skipped_no_geom": counters.skipped_no_geom,
        "skipped_no_event_date": counters.skipped_no_event_date,
        "skipped_no_value": counters.skipped_no_value,
        "skipped_no_tox_value": counters.skipped_no_tox_value,
        "skipped_no_community_metric": counters.skipped_no_community_metric,
        "skipped_no_env_modifier_value": counters.skipped_no_env_modifier_value,
        "junk_filtered_stations": counters.junk_filtered_stations,
    }
    log_phase("done", mode="apply" if args.apply else "dry-run", **summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
