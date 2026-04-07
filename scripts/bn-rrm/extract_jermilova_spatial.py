"""
Extract Jermilova 2025 FRDR spatial layers to GeoJSON for the BN-RRM Mackenzie Hg pack.

Reads the ESRI File Geodatabase at:
  C:/Users/jasen/Downloads/frdr_extracted/ManuscriptData/UJermilova_SpatialData.gdb

Writes 12 GeoJSON files plus MAP_LAYERS_MANIFEST.json into:
  C:/Projects/SSTAC-Dashboard/public/bn-rrm/packs/bnrrm-casestudy-jermilova2025-mackenzie-hg/map/

Reprojects everything to EPSG:4326 (two layers are already 4326 and are passed through).
Strips Z from Thaw_Slump_Impacted_Waters. Decodes the latin-1 Metis field cleanly.
Idempotent: rerunning overwrites outputs and rewrites the manifest.

Plain ASCII only. No external network access.
"""

from __future__ import annotations

import json
import math
import os
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable

import fiona
from pyproj import Transformer
from shapely.geometry import mapping, shape
from shapely.ops import transform as shp_transform


GDB_PATH = r"C:\Users\jasen\Downloads\frdr_extracted\ManuscriptData\UJermilova_SpatialData.gdb"
OUT_DIR = Path(
    r"C:\Projects\SSTAC-Dashboard\public\bn-rrm\packs"
    r"\bnrrm-casestudy-jermilova2025-mackenzie-hg\map"
)
MANIFEST_PATH = OUT_DIR / "MAP_LAYERS_MANIFEST.json"

TARGET_CRS = "EPSG:4326"

# Per-layer configuration. simplify_deg is applied to reprojected (lat/lon)
# geometry using shapely.simplify(preserve_topology=True). Tolerances were
# chosen to keep total directory size under 3 MB while preserving shape.
LAYERS: list[dict[str, Any]] = [
    {
        "layer": "GreatSlaveLake_Buffer50km",
        "out_file": "gsl_basins.geojson",
        "out_id": "basins_gsl",
        "category": "basins",
        "fields": {
            "GSL_Region": "region",
            "Area_calc": "area_km2",
        },
        "sort_key": "region",
        "simplify_deg": 0.002,
    },
    {
        "layer": "GBS1to4",
        "out_file": "gbs_basins.geojson",
        "out_id": "basins_gbs",
        "category": "basins",
        "fields": {
            "Regions": "region",
            "Subbasin": "subbasin",
            "WSCSSDANAM": "wsc_name",
        },
        "sort_key": "region",
        "simplify_deg": 0.01,
    },
    {
        "layer": "Lakes_with_Consumption_Advisories",
        "out_file": "advisory_lakes.geojson",
        "out_id": "advisory_lakes",
        "category": "advisories",
        "fields": {
            "Location": "location",
            "Latitude": "lat",
            "Longitude": "lon",
            "Fish_Species": "species",
            "Pregnant_women": "advisory_pregnant_servings_per_wk",
            "Child__5_11_": "advisory_child_5_11",
            "Child__1_4_": "advisory_child_1_4",
            "Adult": "advisory_adult",
            "Size_______cm_": "fish_size_cm",
            "Serving_size__g_": "serving_size_g",
        },
        "sort_key": "location",
        "simplify_deg": None,
    },
    {
        "layer": "NWT_Commercial_Fisheries",
        "out_file": "commercial_fisheries.geojson",
        "out_id": "commercial_fisheries",
        "category": "fisheries",
        "fields": {
            "Name": "name",
            "Location": "location",
            "Latitude": "lat",
            "Longitude": "lon",
            # Species_1..4 collected separately into a list
            "Catch_quota__kg__LT_and_LW_only": "quota_kg",
            "Quota_category": "quota_category",
            "Subsubbasin": "subsubbasin",
            "Subbasin": "subbasin",
        },
        "species_array": ["Species_1", "Species_2", "Species_3", "Species_4"],
        "sort_key": "name",
        "simplify_deg": None,
    },
    {
        "layer": "Historic_Mining_NWT",
        "out_file": "historic_mines.geojson",
        "out_id": "historic_mines",
        "category": "mining",
        "fields": {
            "Name": "name",
            "Primary_Co": "primary_commodity",
            "Lat": "lat_str",
            "Long": "lon_str",
            "Y": "y",
            "X": "x",
            "Stage_of_D": "stage",
            "Years_of_P": "years_production",
            "Mine_Devel": "development",
            "Prod_num": "prod_num",
        },
        "sort_key": "name",
        "simplify_deg": None,
    },
    {
        "layer": "Large_Mining_Operations",
        "out_file": "large_mines.geojson",
        "out_id": "large_mines",
        "category": "mining",
        "fields": {
            "Mine_Label": "name",
            "Latitude": "lat",
            "Longitude": "lon",
            "Metal": "metal",
        },
        "sort_key": "name",
        "simplify_deg": None,
    },
    {
        "layer": "Active_Mineral_Claims",
        "out_file": "mineral_claims.geojson",
        "out_id": "mineral_claims",
        "category": "mining",
        "fields": {
            "CLAIM_NUM": "claim_num",
            "CLAIM_STAT": "claim_status",
            "CLAIM_NAME": "claim_name",
            "OWNERS": "owners",
            "ANNIV_DT": "anniversary_date",
            "AREA_HA": "area_ha",
            "LAND_CLAIM": "land_claim",
        },
        "sort_key": "claim_num",
        "simplify_deg": 0.005,
    },
    {
        "layer": "Active_Oil_and_Natural_Gas_Claim_50km",
        "out_file": "oil_gas_claims.geojson",
        "out_id": "oil_gas_claims",
        "category": "energy",
        "fields": {
            "LAND_ID": "land_id",
            "COMPANY_NM": "company",
            "SHORT_DESC": "description",
            "AGREETYP": "agreement_type",
            "STATUS_E": "status",
            "ISSUE_DTE": "issue_date",
            "EXPIRY_DTE": "expiry_date",
            "REGION_E": "region",
            "CURR_HECT": "current_hectares",
        },
        "sort_key": "land_id",
        "simplify_deg": 0.002,
    },
    {
        "layer": "Hydroelectric_Facilities",
        "out_file": "hydro_facilities.geojson",
        "out_id": "hydro_facilities",
        "category": "energy",
        "fields": {
            "Name": "name",
            "Location": "location",
            "Latitude": "lat",
            "Longitude": "lon",
            "Capacity__MW_": "capacity_mw",
            "Community_population__2016_survey_": "community_population",
        },
        "sort_key": "name",
        "simplify_deg": None,
    },
    {
        "layer": "NWT_PopulationEstimate_2021",
        "out_file": "communities.geojson",
        "out_id": "communities",
        "category": "communities",
        "fields": {
            "Community": "community",
            "Latitude": "lat",
            "Longitude": "lon",
            "Total": "population_total",
            "Dene": "pop_dene",
            # Metis field name is mojibake from latin-1; handled specially.
            "Inuit": "pop_inuit",
            "Non__Indigenous": "pop_non_indigenous",
            "Ratio_Indigenous_to_non": "ratio_indigenous_to_non",
        },
        "metis_out_key": "pop_metis",
        "sort_key": "community",
        "simplify_deg": None,
    },
    {
        "layer": "Climate_Stations_Modern",
        "out_file": "climate_stations.geojson",
        "out_id": "climate_stations",
        "category": "climate",
        "fields": {
            "Station_name": "name",
            "Latitude": "lat",
            "Longitude": "lon",
            "Elevation": "elevation_m",
            "Annual_Precipitation__mm_": "precipitation_mm",
            "R_index": "r_index",
            "Year": "year",
        },
        "sort_key": "name",
        "simplify_deg": None,
    },
    {
        "layer": "Thaw_Slump_Impacted_Waters",
        "out_file": "thaw_slumps.geojson",
        "out_id": "thaw_slumps",
        "category": "permafrost",
        "fields": {
            "nid": "id",
            "WorkUnit": "work_unit",
            "Reference": "reference",
            "BUFF_DIST": "buffer_distance_m",
        },
        "sort_key": "id",
        "simplify_deg": 0.015,
        "strip_z": True,
    },
]


def log(msg: str) -> None:
    print(f"[extract_jermilova] {msg}", flush=True)


def to_jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8")
        except UnicodeDecodeError:
            return value.decode("latin-1", errors="replace")
    # Dates, times, etc.
    return str(value)


def safe_str(value: Any) -> str | None:
    v = to_jsonable(value)
    if v is None:
        return None
    return str(v)


def find_metis_key(props_keys: list[str]) -> str | None:
    """Find the mojibake Metis field key (e.g., 'M\\ufffdtis' or 'M\\xe9tis')."""
    for k in props_keys:
        if k == "Metis":
            return k
        if len(k) == 5 and k.startswith("M") and k.endswith("tis"):
            return k
    return None


def make_reprojector(src_crs: Any) -> Callable[[float, float, float | None], tuple]:
    """Return a function (x, y, z=None) -> (lon, lat[, z])."""
    src_str = src_crs.to_string() if hasattr(src_crs, "to_string") else str(src_crs)
    if "4326" in src_str:
        def passthrough(x, y, z=None):
            if z is None:
                return (x, y)
            return (x, y, z)
        return passthrough
    transformer = Transformer.from_crs(src_str, TARGET_CRS, always_xy=True)

    def project(x, y, z=None):
        lon, lat = transformer.transform(x, y)
        if z is None:
            return (lon, lat)
        return (lon, lat, z)

    return project


def reproject_geom(geom_dict: dict, projector: Callable, strip_z: bool) -> Any:
    geom = shape(geom_dict)
    if strip_z:
        def drop_z(x, y, z=None):
            return projector(x, y, None)
        return shp_transform(drop_z, geom)
    return shp_transform(projector, geom)


def round_coords(obj: Any, ndigits: int = 5) -> Any:
    """Recursively round numeric coordinates in a GeoJSON geometry mapping."""
    if isinstance(obj, list):
        return [round_coords(v, ndigits) for v in obj]
    if isinstance(obj, tuple):
        return tuple(round_coords(v, ndigits) for v in obj)
    if isinstance(obj, float):
        return round(obj, ndigits)
    return obj


def compute_bbox(geom) -> list[float]:
    minx, miny, maxx, maxy = geom.bounds
    return [minx, miny, maxx, maxy]


def extend_bbox(global_bbox: list[float] | None, bbox: list[float]) -> list[float]:
    if global_bbox is None:
        return list(bbox)
    return [
        min(global_bbox[0], bbox[0]),
        min(global_bbox[1], bbox[1]),
        max(global_bbox[2], bbox[2]),
        max(global_bbox[3], bbox[3]),
    ]


def spot_check_latlon(features: list[dict], lat_key: str, lon_key: str, label: str) -> list[dict]:
    """For point layers, verify geometry coords match stored lat/lon for first 3 features."""
    notes = []
    sample = features[:3]
    for feat in sample:
        coords = feat["geometry"]["coordinates"]
        # GeoJSON coords are [lon, lat]
        glon, glat = coords[0], coords[1]
        props = feat["properties"]
        plat = props.get(lat_key)
        plon = props.get(lon_key)
        if isinstance(plat, str):
            try:
                plat = float(plat)
            except ValueError:
                plat = None
        if isinstance(plon, str):
            try:
                plon = float(plon)
            except ValueError:
                plon = None
        if plat is None or plon is None:
            notes.append({"feature": props.get("name") or props.get("location") or props.get("community"),
                          "issue": "missing lat/lon property"})
            continue
        dlat = abs(plat - glat)
        dlon = abs(plon - glon)
        if dlat > 0.01 or dlon > 0.01:
            notes.append({
                "feature": props.get("name") or props.get("location") or props.get("community"),
                "geom": [glon, glat],
                "props": [plon, plat],
                "delta": [dlon, dlat],
            })
    if notes:
        log(f"  spot-check WARNING [{label}]: {notes}")
    return notes


def process_layer(cfg: dict[str, Any]) -> dict[str, Any]:
    layer_name = cfg["layer"]
    out_path = OUT_DIR / cfg["out_file"]
    log(f"Processing {layer_name} -> {cfg['out_file']}")
    field_map: dict[str, str] = cfg["fields"]
    sort_key: str = cfg["sort_key"]
    simplify_deg = cfg.get("simplify_deg")
    strip_z = bool(cfg.get("strip_z", False))
    species_array = cfg.get("species_array")
    metis_out_key = cfg.get("metis_out_key")

    features_in = 0
    features_out = 0
    dropped = 0
    geom_drops = 0

    out_features: list[dict] = []
    global_bbox: list[float] | None = None

    with fiona.open(GDB_PATH, layer=layer_name) as src:
        src_crs = src.crs
        projector = make_reprojector(src_crs)

        # Determine the Metis source key once.
        sample_keys: list[str] = list(src.schema["properties"].keys())
        metis_src_key = find_metis_key(sample_keys) if metis_out_key else None

        for rec in src:
            features_in += 1
            geom = rec.get("geometry")
            if geom is None:
                dropped += 1
                geom_drops += 1
                continue
            try:
                proj_geom = reproject_geom(geom, projector, strip_z)
            except Exception as exc:
                log(f"  reprojection failure on feature {features_in}: {exc}")
                dropped += 1
                geom_drops += 1
                continue
            if simplify_deg is not None:
                proj_geom = proj_geom.simplify(simplify_deg, preserve_topology=True)
            if proj_geom.is_empty:
                dropped += 1
                geom_drops += 1
                continue

            src_props = rec["properties"]
            out_props: dict[str, Any] = {}
            for src_field, out_key in field_map.items():
                out_props[out_key] = to_jsonable(src_props.get(src_field))

            # Cast known numeric fields where source uses strings (Total, Dene, Metis, etc.)
            for k in (
                "population_total",
                "pop_dene",
                "pop_metis",
                "pop_inuit",
                "pop_non_indigenous",
                "ratio_indigenous_to_non",
            ):
                if k in out_props and isinstance(out_props[k], str):
                    try:
                        out_props[k] = int(out_props[k])
                    except ValueError:
                        try:
                            out_props[k] = float(out_props[k])
                        except ValueError:
                            pass

            if species_array:
                species_list = []
                for sf in species_array:
                    val = src_props.get(sf)
                    sval = safe_str(val)
                    if sval and sval.strip():
                        species_list.append(sval.strip())
                out_props["species"] = species_list

            if metis_out_key and metis_src_key is not None:
                metis_val = to_jsonable(src_props.get(metis_src_key))
                if isinstance(metis_val, str):
                    try:
                        metis_val = int(metis_val)
                    except ValueError:
                        try:
                            metis_val = float(metis_val)
                        except ValueError:
                            pass
                out_props[metis_out_key] = metis_val

            geom_mapping = mapping(proj_geom)
            # Round coordinates to 5 decimals (~1m at NWT latitudes) to shrink JSON.
            geom_mapping["coordinates"] = round_coords(geom_mapping["coordinates"], 5)
            bbox = compute_bbox(proj_geom)
            global_bbox = extend_bbox(global_bbox, bbox)

            feature = {
                "type": "Feature",
                "geometry": geom_mapping,
                "properties": out_props,
            }
            out_features.append(feature)
            features_out += 1

    # Sort features for stable diffs.
    def sort_value(f):
        v = f["properties"].get(sort_key)
        if v is None:
            return (1, "")
        return (0, str(v))

    out_features.sort(key=sort_value)

    # Spot-check lat/lon vs geometry for point layers that carry lat/lon props.
    spot_notes: list[dict] = []
    if out_features and out_features[0]["geometry"]["type"] == "Point":
        props = out_features[0]["properties"]
        if "lat" in props and "lon" in props:
            spot_notes = spot_check_latlon(out_features, "lat", "lon", layer_name)

    fc = {
        "type": "FeatureCollection",
        "name": cfg["out_id"],
        "crs": {"type": "name", "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"}},
        "bbox": [round(c, 6) for c in (global_bbox or [0, 0, 0, 0])],
        "features": out_features,
    }

    # Pretty-print first; if any single file blows past a soft cap we still
    # write pretty here. Final size discipline is enforced via the simplify
    # tolerances above and confirmed in the directory total at the end.
    out_path.write_text(json.dumps(fc, indent=2, ensure_ascii=False), encoding="utf-8")
    size = out_path.stat().st_size

    log(
        f"  in={features_in} out={features_out} dropped={dropped} "
        f"size={size} bytes file={out_path.name}"
    )

    return {
        "id": cfg["out_id"],
        "layer": layer_name,
        "file": cfg["out_file"],
        "category": cfg["category"],
        "geometry_type": (out_features[0]["geometry"]["type"] if out_features else None),
        "features_in": features_in,
        "features_out": features_out,
        "dropped": dropped,
        "geom_drops": geom_drops,
        "simplify_tolerance_deg": simplify_deg,
        "file_size_bytes": size,
        "crs": TARGET_CRS,
        "bbox": fc["bbox"],
        "spot_check_notes": spot_notes,
    }


def repack_compact_if_needed(target_total_bytes: int = 3 * 1024 * 1024) -> dict[str, int]:
    """If pretty-printed total exceeds target, rewrite the largest files in compact form."""
    files = sorted(
        [p for p in OUT_DIR.glob("*.geojson")],
        key=lambda p: p.stat().st_size,
        reverse=True,
    )
    total = sum(p.stat().st_size for p in files)
    repacked: dict[str, int] = {}
    if total <= target_total_bytes:
        return repacked
    log(f"Total {total} bytes exceeds target {target_total_bytes}; recompacting largest files.")
    for p in files:
        if total <= target_total_bytes:
            break
        before = p.stat().st_size
        data = json.loads(p.read_text(encoding="utf-8"))
        p.write_text(json.dumps(data, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        after = p.stat().st_size
        repacked[p.name] = after
        total = total - before + after
        log(f"  recompact {p.name}: {before} -> {after}")
    return repacked


def main() -> int:
    if not Path(GDB_PATH).exists():
        log(f"GDB not found: {GDB_PATH}")
        return 2
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    # Schema drift check: confirm all required source fields exist on each layer.
    drift: list[str] = []
    for cfg in LAYERS:
        with fiona.open(GDB_PATH, layer=cfg["layer"]) as src:
            avail = set(src.schema["properties"].keys())
        required = set(cfg["fields"].keys())
        if cfg.get("species_array"):
            required.update(cfg["species_array"])
        missing = sorted(required - avail)
        if missing:
            drift.append(f"{cfg['layer']}: missing {missing}")
        # Metis field is allowed to be encoded; verify a Metis-like key exists.
        if cfg.get("metis_out_key"):
            if find_metis_key(list(avail)) is None:
                drift.append(f"{cfg['layer']}: no Metis-like field found")
    if drift:
        log("SCHEMA DRIFT detected; aborting before any writes:")
        for d in drift:
            log(f"  - {d}")
        return 3

    summaries: list[dict] = []
    for cfg in LAYERS:
        summaries.append(process_layer(cfg))

    repacked = repack_compact_if_needed()
    # Refresh sizes if any files were recompacted.
    if repacked:
        for s in summaries:
            p = OUT_DIR / s["file"]
            s["file_size_bytes"] = p.stat().st_size

    total = sum(s["file_size_bytes"] for s in summaries)

    manifest = {
        "generated_utc": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source_gdb": GDB_PATH,
        "target_crs": TARGET_CRS,
        "total_bytes": total,
        "total_mb": round(total / (1024 * 1024), 3),
        "layers": summaries,
        "recompacted": list(repacked.keys()),
        "notes": [
            "Geometries reprojected to EPSG:4326 before simplification.",
            "Simplification tolerances are in degrees (Douglas-Peucker, preserve_topology=True).",
            "Thaw_Slump_Impacted_Waters Z dimension stripped.",
            "NWT_PopulationEstimate_2021 Metis field decoded from mojibake source key.",
            "Sorted features per layer by sort_key for stable diffs.",
        ],
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False), encoding="utf-8")
    log(f"Wrote manifest: {MANIFEST_PATH}")
    log(f"Total directory size: {total} bytes ({manifest['total_mb']} MB)")
    if total > 3 * 1024 * 1024:
        log("WARNING: total exceeds 3 MB cap. Tighten simplify tolerances and rerun.")
        return 4
    return 0


if __name__ == "__main__":
    sys.exit(main())
