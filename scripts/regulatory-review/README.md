# Regulatory Review Data Scripts

This folder contains scripts and data files for policy source inventory and taxonomy mapping.

## Data files
- `data/policy_source_urls.json`: URL overrides and citation label hints keyed by `source_documents.id`.
- `data/policy_sources.csv`: Exported policy source inventory (generated).
- `data/taxonomy_mapping.csv`: Exported taxonomy mapping (generated).

## Scripts
- `export_policy_sources.py`:
  - Reads policy sources from the engine DB and applies URL overrides.
  - Writes `data/policy_sources.csv`.
- `export_taxonomy_mapping.py`:
  - Builds the mapping from policy statements to stage/topic labels.
  - Writes `data/taxonomy_mapping.csv`.
- `load_policy_data.py`:
  - Loads CSVs into a target SQLite DB (dashboard DB by default).

## Usage (PowerShell)
```powershell
python scripts/regulatory-review/export_policy_sources.py --db "F:\Regulatory-Review\engine\data\rraa_v3_2.db"
python scripts/regulatory-review/export_taxonomy_mapping.py --db "F:\Regulatory-Review\engine\data\rraa_v3_2.db"
python scripts/regulatory-review/load_policy_data.py --db "F:\sstac-dashboard\src\data\regulatory-review.db"
```

Notes:
- If URLs are missing, update `data/policy_source_urls.json` and re-run the export.
- `load_policy_data.py` will truncate and reload taxonomy mappings by default.
