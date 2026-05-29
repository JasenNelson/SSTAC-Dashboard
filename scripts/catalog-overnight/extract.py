"""Catalog extraction library -- Docling table extraction + staging row builder + JSON proposals writer.

This is a THIN LIBRARY, not a CLI. It is imported by an autonomous Claude Code
session (spawned by `.claude/scripts/launch_catalog_extraction.ps1` via
`claude -p` headless mode); the session orchestrates the per-item processing
loop directly. No main(), no argparse, no CLI flags.

Scope (in):
- Docling-first PDF table extraction with chunked fallback for long documents.
- Staging row builder with strict schema validation matching the
  catalog_extraction_staging CHECK constraints.
- JSON proposals writer: appends StagingRow proposals to a local JSON file
  for manual owner review and import to Supabase (no database connection).
- Python-side breadcrumb emitter for the wrapper's watchdog.

Scope (out, vs the prior scaffold):
- Ollama / any external LLM client. Claude Code itself is the reasoner over
  Docling output; no LlmClient protocol seam.
- CLI / main() / dry-run mode. The wrapper handles dry-run; the library is
  always called from within a Python -c invocation by Claude Code.
- run_pass orchestrator. The session's starter prompt owns orchestration.
- Database connections of any kind. No psycopg, no DSN, no Supabase writes.

Design reference: STREAM_D_REDESIGN_2026_05_28.md v0.3.1 (cursor-agent GREEN
at round 5, mutual-agreement methodology).

Tuning constants mirror BN-RRM extract_tables_docling.py for cross-project
consistency:
  C:\\Projects\\Regulatory-Review\\2026_Database_Development\\data_acquisition\\bnrrm_extraction\\extract_tables_docling.py

Safety:
- The agent NEVER connects to any database and NEVER uses psycopg or a DSN.
- Proposed rows are written to a local JSON file only; the owner imports
  approved rows to Supabase manually via the Studio SQL Editor.

Authored by Stream D autonomous session (Opus 4.7) 2026-05-27; refactored to
thin library 2026-05-28 per Phase 3 commit 2 of the redesign.
"""

from __future__ import annotations

import dataclasses
import gc
import json
import os
import re
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Sequence

# Optional imports -- tests do not require Docling installed.
try:
    from docling.document_converter import DocumentConverter, PdfFormatOption
    from docling.datamodel.pipeline_options import PdfPipelineOptions, TableFormerMode
    HAS_DOCLING = True
except ImportError:
    HAS_DOCLING = False

try:
    import fitz  # PyMuPDF
    HAS_PYMUPDF = True
except ImportError:
    HAS_PYMUPDF = False


# -- Chunked extraction tuning (mirror BN-RRM extract_tables_docling.py) ------
MAX_PAGES_FOR_OCR = 200
MAX_PAGES_FOR_ACCURATE = 500
PROACTIVE_CHUNK_THRESHOLD = 200
DEFAULT_CHUNK_SIZE = 50

# -- Domain enums (match catalog_extraction_staging migration) ---------------
PROPOSED_KIND_VALUES = ('parameter_value', 'evidence_item', 'source_lead')
HITL_STATUS_VALUES = ('pending', 'approved', 'rejected', 'superseded')

# -- Service-role discriminator (match catalog_extraction_staging schema) ----
AGENT_PRINCIPAL = 'agent_service_role'

# -- Per-kind payload schema (proposal reviewability + promote-time safety) ---
# Each proposed_payload must carry the target table's NOT NULL, no-DEFAULT
# columns for its proposed_kind. catalog_approve_staging_row builds its INSERT
# column list from the intersection of (target columns) and (payload keys), so
# a payload that omits a NOT NULL no-DEFAULT column makes the RPC INSERT fail at
# HITL approve time with a cryptic Postgres error. Validating here catches the
# bad proposal before it ever lands in staging. Sourced from the target table
# migrations:
#   parameter_value -> promoted_parameter_values (20260527000003)
#   evidence_item   -> catalog_evidence_items     (20260527000007)
#   source_lead     -> source_lead_triage         (20260527000008)
PAYLOAD_REQUIRED_KEYS = {
    'parameter_value': ('parameter_value_id', 'display_name', 'candidate_group_id'),
    'evidence_item': ('parameter_value_id', 'source_id', 'locator', 'locator_type'),
    'source_lead': ('lead_set_id',),
}

# Provenance keys required in EVERY payload so the HITL reviewer always has
# verbatim grounding + the source doc id. These are NOT target-table columns
# (catalog_approve_staging_row ignores keys with no matching column at promote
# time) but they are preserved in the staging proposed_payload JSONB for review.
PROVENANCE_REQUIRED_KEYS = ('source_excerpt', 'source_doc_id')


# ============================================================================
# Staging row dataclass + builder
# ============================================================================

@dataclasses.dataclass
class StagingRow:
    """In-memory representation of one proposed catalog row.

    Field set matches the catalog_extraction_staging column shape. DB-defaulted
    columns (id, hitl_status, hitl_reviewed_*, promoted_to_id, created_by,
    created_by_role, created_at) are omitted; they receive their DB defaults when
    the owner manually imports approved rows via Supabase Studio SQL Editor.
    """

    source_zotero_key: str
    source_attachment_path: str | None
    extraction_pass_id: uuid.UUID
    extraction_pass_started_at: datetime
    extraction_pass_finished_at: datetime | None
    extracted_at: datetime
    proposed_kind: str
    proposed_payload: dict
    confidence: float | None
    extraction_notes: str | None
    extraction_model: str

    def to_dict(self) -> dict:
        """Return a JSON-serializable dict of all row fields.

        Datetime values are serialized to ISO 8601 strings with UTC offset.
        UUID values are serialized to str. proposed_payload is kept as a dict
        (json.dumps will handle it at the file-write boundary in save_proposals).
        """
        return {
            'source_zotero_key': self.source_zotero_key,
            'source_attachment_path': self.source_attachment_path,
            'extraction_pass_id': str(self.extraction_pass_id),
            'extraction_pass_started_at': (
                self.extraction_pass_started_at.isoformat()
                if self.extraction_pass_started_at is not None else None
            ),
            'extraction_pass_finished_at': (
                self.extraction_pass_finished_at.isoformat()
                if self.extraction_pass_finished_at is not None else None
            ),
            'extracted_at': (
                self.extracted_at.isoformat()
                if self.extracted_at is not None else None
            ),
            'proposed_kind': self.proposed_kind,
            'proposed_payload': self.proposed_payload,
            'confidence': self.confidence,
            'extraction_notes': self.extraction_notes,
            'extraction_model': self.extraction_model,
        }


def build_staging_row(
    *,
    zotero_key: str,
    attachment_path: str | None,
    pass_id: uuid.UUID,
    pass_started_at: datetime,
    proposal: dict,
    extraction_model: str,
    extracted_at: datetime | None = None,
    pass_finished_at: datetime | None = None,
) -> StagingRow:
    """Convert one proposal dict (produced by the Claude Code session) into a StagingRow.

    Validates the proposal shape against the catalog_extraction_staging CHECK
    constraints (proposed_kind enum, confidence in [0,1], JSON-serializable
    payload). Raises ValueError on validation failure so bad rows are caught
    before being written to the proposals file.
    """
    if not zotero_key:
        raise ValueError('zotero_key is required (NOT NULL on staging row)')

    kind = proposal.get('proposed_kind')
    if kind not in PROPOSED_KIND_VALUES:
        raise ValueError(
            f'Unknown proposed_kind: {kind!r}; '
            f'expected one of {PROPOSED_KIND_VALUES}'
        )

    payload = proposal.get('proposed_payload')
    if not isinstance(payload, dict):
        raise ValueError(
            'proposed_payload must be a dict; '
            f'got {type(payload).__name__}'
        )
    if not payload:
        # Empty dict satisfies the staging table's NOT NULL constraint but
        # `catalog_approve_staging_row` RPC raises P0001 at HITL approve time
        # because jsonb_object_keys('{}') returns no rows. Catch here so the
        # bad row never lands in staging.
        raise ValueError(
            'proposed_payload must be a non-empty dict; '
            'empty payloads fail at HITL approve (RPC P0001)'
        )
    try:
        json.dumps(payload)
    except (TypeError, ValueError) as je:
        raise ValueError(
            f'proposed_payload must be JSON-serializable: {je}'
        )

    # Provenance + per-kind required keys must live INSIDE proposed_payload.
    # The staging table has no source_excerpt / source_doc_id columns, so
    # grounding can only be carried (and reviewed) via the payload. The per-kind
    # keys are the target table's NOT NULL no-DEFAULT columns; omitting them
    # would make catalog_approve_staging_row's INSERT fail at HITL approve time.
    # A key counts as missing if absent or set to None / empty string.
    def _is_blank(v: Any) -> bool:
        return v is None or (isinstance(v, str) and v.strip() == '')

    required_keys = (*PROVENANCE_REQUIRED_KEYS, *PAYLOAD_REQUIRED_KEYS.get(kind, ()))
    missing = [k for k in required_keys if k not in payload or _is_blank(payload[k])]
    if missing:
        raise ValueError(
            f'proposed_payload for proposed_kind {kind!r} is missing required '
            f'key(s): {missing}. Provenance keys {PROVENANCE_REQUIRED_KEYS} are '
            f'required for every kind; per-kind keys '
            f'{PAYLOAD_REQUIRED_KEYS.get(kind, ())} match the target table NOT '
            f'NULL columns the approve RPC promotes.'
        )

    confidence_raw = proposal.get('confidence')
    confidence: float | None
    if confidence_raw is None:
        confidence = None
    elif isinstance(confidence_raw, bool):
        raise ValueError(
            f'confidence must be float or None; got bool ({confidence_raw!r})'
        )
    elif isinstance(confidence_raw, (int, float)):
        c = float(confidence_raw)
        if not (0.0 <= c <= 1.0):
            raise ValueError(
                f'confidence out of [0, 1] range: {confidence_raw!r}'
            )
        confidence = c
    else:
        raise ValueError(
            'confidence must be number or None; '
            f'got {type(confidence_raw).__name__}'
        )

    notes_raw = proposal.get('extraction_notes')
    notes: str | None
    if notes_raw is None:
        notes = None
    elif isinstance(notes_raw, str):
        notes = notes_raw
    else:
        raise ValueError(
            'extraction_notes must be str or None; '
            f'got {type(notes_raw).__name__}'
        )

    return StagingRow(
        source_zotero_key=zotero_key,
        source_attachment_path=attachment_path,
        extraction_pass_id=pass_id,
        extraction_pass_started_at=pass_started_at,
        extraction_pass_finished_at=pass_finished_at,
        extracted_at=extracted_at or datetime.now(timezone.utc),
        proposed_kind=kind,
        proposed_payload=payload,
        confidence=confidence,
        extraction_notes=notes,
        extraction_model=extraction_model,
    )


# ============================================================================
# Docling table extraction (mirror of BN-RRM pattern, scoped to one PDF)
# ============================================================================

def get_page_count(pdf_path: str) -> int:
    """Return PDF page count using PyMuPDF. Returns 0 if PyMuPDF unavailable."""
    if not HAS_PYMUPDF:
        return 0
    try:
        doc = fitz.open(pdf_path)
        try:
            return len(doc)
        finally:
            doc.close()
    except Exception:
        return 0


def configure_docling_converter(page_count: int):
    """Create a DocumentConverter with OCR + table mode scaled to page count.

    Mirrors BN-RRM extract_tables_docling.py._configure_converter() with the
    same tuning constants. The CATALOG_AGENT_FORCE_OCR env var (1/true/yes)
    forces OCR on regardless of page count.
    """
    if not HAS_DOCLING:
        raise ImportError('docling not installed. Run: pip install docling')

    force_ocr = os.environ.get('CATALOG_AGENT_FORCE_OCR', '').lower() in ('1', 'true', 'yes')
    use_ocr = force_ocr or (page_count <= MAX_PAGES_FOR_OCR)
    use_accurate = page_count <= MAX_PAGES_FOR_ACCURATE
    mode = TableFormerMode.ACCURATE if use_accurate else TableFormerMode.FAST

    pipeline_options = PdfPipelineOptions()
    pipeline_options.do_table_structure = True
    pipeline_options.table_structure_options.mode = mode
    pipeline_options.do_ocr = use_ocr
    return DocumentConverter(
        format_options={'pdf': PdfFormatOption(pipeline_options=pipeline_options)}
    )


def _extract_tables_from_doc(
    doc,
    *,
    start_index: int,
    current_section: str | None,
    current_subsection: str | None,
) -> tuple[list[dict], str | None, str | None]:
    """Walk a Docling document and pull tables with section heading context.

    Forked from BN-RRM's _extract_tables_from_doc(); kept verbatim because
    the section-heading state machine has subtle behavior around all-caps
    headings vs numbered headings.
    """
    table_contexts: dict[int, tuple[str | None, str | None]] = {}
    table_order: list[int] = []

    try:
        item_iter: Iterable = doc.iterate_items()
    except Exception:
        item_iter = []

    for item in item_iter:
        if isinstance(item, tuple):
            element = item[0]
        else:
            element = item

        type_name = type(element).__name__.lower()
        text = (getattr(element, 'text', '') or '').strip()

        if 'heading' in type_name or 'title' in type_name:
            if not text:
                continue
            if re.match(r'^\d+\.?\s', text) or re.match(r'^[A-Z][A-Z\s]{5,}', text):
                current_section = text
            current_subsection = text
        elif 'table' in type_name:
            table_contexts[id(element)] = (current_section, current_subsection)
            table_order.append(id(element))

    tables: list[dict] = []
    for i, table in enumerate(doc.tables):
        ctx = table_contexts.get(id(table), (None, None))
        section_ctx, subsection_ctx = ctx

        table_data: dict[str, Any] = {
            'table_index': start_index + i,
            'page': getattr(table.prov[0], 'page_no', None)
                    if hasattr(table, 'prov') and table.prov else None,
            'caption': getattr(table, 'caption', None),
            'section_context': section_ctx,
            'subsection_context': subsection_ctx,
            'headers': [],
            'rows': [],
        }

        try:
            df = table.export_to_dataframe()
            table_data['headers'] = list(df.columns)
            table_data['rows'] = df.values.tolist()
            table_data['num_rows'] = len(df)
            table_data['num_cols'] = len(df.columns)
        except Exception as exc:
            table_data['extraction_error'] = str(exc)
            try:
                grid = table.export_to_grid()
                if grid:
                    table_data['headers'] = grid[0] if grid else []
                    table_data['rows'] = grid[1:] if len(grid) > 1 else []
                    table_data['num_rows'] = len(table_data['rows'])
                    table_data['num_cols'] = len(table_data['headers'])
            except Exception:
                pass

        tables.append(table_data)

    return tables, current_section, current_subsection


def extract_tables_from_pdf(
    pdf_path: str,
    *,
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    heartbeat_callback: Callable[[str], None] | None = None,
    stop_check: Callable[[], bool] | None = None,
) -> list[dict]:
    """Extract tables from one PDF using Docling.

    For PDFs over PROACTIVE_CHUNK_THRESHOLD pages, uses chunked extraction
    to prevent OOM. The heartbeat_callback is invoked with a label string
    between chunks; stop_check terminates the loop cleanly if it returns True.
    """
    if not HAS_DOCLING:
        raise ImportError('docling not installed. Run: pip install docling')

    page_count = get_page_count(pdf_path) or 0
    converter = configure_docling_converter(page_count)

    if page_count > PROACTIVE_CHUNK_THRESHOLD:
        return _extract_tables_chunked(
            pdf_path,
            converter,
            page_count=page_count,
            chunk_size=chunk_size,
            heartbeat_callback=heartbeat_callback,
            stop_check=stop_check,
        )

    result = converter.convert(str(pdf_path))
    tables, _, _ = _extract_tables_from_doc(
        result.document,
        start_index=0,
        current_section=None,
        current_subsection=None,
    )
    return tables


def _extract_tables_chunked(
    pdf_path: str,
    converter,
    *,
    page_count: int,
    chunk_size: int,
    heartbeat_callback: Callable[[str], None] | None,
    stop_check: Callable[[], bool] | None,
) -> list[dict]:
    """Chunked extraction wrapper for large PDFs."""
    all_tables: list[dict] = []
    current_section: str | None = None
    current_subsection: str | None = None
    chunks = [
        (start, min(start + chunk_size - 1, page_count))
        for start in range(1, page_count + 1, chunk_size)
    ]

    for ci, (pg_start, pg_end) in enumerate(chunks, start=1):
        if stop_check is not None and stop_check():
            break

        label = f'chunk {ci}/{len(chunks)}: pages {pg_start}-{pg_end}'
        if heartbeat_callback is not None:
            try:
                heartbeat_callback(label)
            except Exception:
                pass

        try:
            doc_result = converter.convert(str(pdf_path), page_range=(pg_start, pg_end))
            chunk_tables, current_section, current_subsection = _extract_tables_from_doc(
                doc_result.document,
                start_index=len(all_tables),
                current_section=current_section,
                current_subsection=current_subsection,
            )
            all_tables.extend(chunk_tables)
        except Exception as exc:
            if heartbeat_callback is not None:
                try:
                    heartbeat_callback(f'{label} FAILED: {exc}')
                except Exception:
                    pass
        gc.collect()

    return all_tables


# ============================================================================
# JSON proposals writer (no database; no psycopg; no DSN)
# ============================================================================

def save_proposals(rows: Sequence[StagingRow], out_path: 'str | Path') -> int:
    """Append StagingRow proposals to a JSON file at out_path.

    If out_path already exists, the existing JSON array is loaded and the new
    rows are appended so multiple items in one pass accumulate. If out_path
    does not exist, a new array is started.

    Write is atomic: content is written to a UNIQUE sibling temp file first,
    then os.replace() moves it over the target. The temp filename includes the
    pid + a random suffix so two writers never collide on one fixed .tmp path.
    This prevents a partial write from corrupting the proposals file if the
    process is interrupted. (The read-modify-write cycle itself is not lock-
    protected; in practice each pass owns its own proposals/<PassId>.json file,
    so there is a single writer per file.)

    Recovery: if an existing proposals file is unreadable (malformed JSON or a
    well-formed value that is not a JSON array), it is quarantined by renaming
    it to <name>.corrupt-<UTC timestamp> and a fresh array is started, so the
    current pass can still record its work instead of crashing. The owner can
    inspect the quarantined file.

    Returns the total number of rows now in the file (existing + new).

    Args:
        rows: sequence of StagingRow instances to append.
        out_path: path to the proposals JSON file (str or Path).
    """
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    existing: list = []
    if out_path.exists():
        existing_text = out_path.read_text(encoding='utf-8')
        quarantine_reason = ''
        try:
            loaded = json.loads(existing_text)
        except json.JSONDecodeError as jde:
            quarantine_reason = f'malformed JSON ({jde})'
        else:
            if isinstance(loaded, list):
                existing = loaded
            else:
                quarantine_reason = (
                    f'not a JSON array (found {type(loaded).__name__})'
                )
        if quarantine_reason:
            stamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
            # pid + random suffix so two corruptions in the same second do not
            # overwrite each other's quarantine file.
            quarantine = out_path.with_name(
                f'{out_path.name}.corrupt-{stamp}.{os.getpid()}-{uuid.uuid4().hex[:8]}'
            )
            os.replace(out_path, quarantine)
            existing = []

    for row in rows:
        existing.append(row.to_dict())

    serialized = json.dumps(existing, indent=2, ensure_ascii=True)

    tmp_path = out_path.with_name(
        f'{out_path.name}.{os.getpid()}-{uuid.uuid4().hex[:8]}.tmp'
    )
    tmp_path.write_text(serialized, encoding='utf-8')
    os.replace(tmp_path, out_path)

    return len(existing)


# ============================================================================
# Owner-reviewable staging SQL generator (staging table ONLY; never production)
# ============================================================================

# Columns the generator emits for an INSERT into catalog_extraction_staging.
# Mirrors StagingRow.to_dict() / the staging migration (20260527000004).
# extracted_at IS emitted (the row's real extraction time, more useful than the
# now() default). id, hitl_* and created_by_role are deliberately OMITTED so the
# table DEFAULTs fire (id -> gen_random_uuid(), hitl_status -> 'pending',
# created_by_role -> 'agent_service_role').
_STAGING_SQL_COLUMNS = (
    'source_zotero_key',
    'source_attachment_path',
    'extraction_pass_id',
    'extraction_pass_started_at',
    'extraction_pass_finished_at',
    'extracted_at',
    'proposed_kind',
    'proposed_payload',
    'confidence',
    'extraction_notes',
    'extraction_model',
)


def _dollar_quote(s: str) -> str:
    """Return s as a Postgres dollar-quoted string literal with a safe tag.

    Dollar quoting sidesteps single-quote escaping entirely, so arbitrary text
    (including quotes, backslashes, JSON) is injection-safe. The tag is chosen
    so it does not appear in the content.
    """
    for tag in ('$cat$', '$cat0$', '$cat1$', '$catx$', '$catalog_sql$'):
        if tag not in s:
            return f'{tag}{s}{tag}'
    # Extremely unlikely fallback: build a tag guaranteed absent.
    n = 0
    while True:
        tag = f'$cat{n}x$'
        if tag not in s:
            return f'{tag}{s}{tag}'
        n += 1


def _sql_text(value: Any) -> str:
    """SQL literal for a TEXT column: NULL or a dollar-quoted string."""
    if value is None:
        return 'NULL'
    return _dollar_quote(str(value))


def _sql_ts(value: Any, cast: str) -> str:
    """SQL literal for a UUID / TIMESTAMPTZ column: NULL or quoted + cast."""
    if value is None:
        return 'NULL'
    return f'{_dollar_quote(str(value))}::{cast}'


def _sql_numeric(value: Any) -> str:
    """SQL literal for a NUMERIC column: NULL or a bare number."""
    if value is None:
        return 'NULL'
    return repr(float(value))


def _sql_jsonb(value: Any) -> str:
    """SQL literal for a JSONB column: dollar-quoted JSON text + ::jsonb."""
    return f'{_dollar_quote(json.dumps(value, ensure_ascii=True))}::jsonb'


def _one_line(value: Any, limit: int = 100) -> str:
    """Collapse arbitrary text to a single safe line for a SQL `--` comment.

    Strips ALL control characters (including CR / LF) and collapses runs of
    whitespace. This is a SECURITY control, not cosmetics: a `--` comment runs
    to end-of-line, so an un-stripped newline in payload-derived comment text
    would terminate the comment and turn the rest of the line into executable
    SQL in the packet the owner pastes into the SQL Editor.
    """
    s = re.sub(r'[\x00-\x1f\x7f]', ' ', str(value))
    s = re.sub(r'\s+', ' ', s).strip()
    if len(s) > limit:
        s = s[:limit - 3] + '...'
    return s


def _row_summary(row: dict) -> str:
    """One-line, control-char-stripped human summary for the SQL review header."""
    payload = row.get('proposed_payload') or {}
    kind = _one_line(row.get('proposed_kind', '?'), 40)
    label = _one_line(
        payload.get('display_name')
        or payload.get('substance_key')
        or payload.get('lead_set_id')
        or payload.get('parameter_value_id')
        or '(no label)',
        80,
    )
    parts = [f'{kind}: {label}']
    if payload.get('value') is not None:
        parts.append(f'value={_one_line(payload.get("value"), 40)}')
    excerpt = _one_line(payload.get('source_excerpt', ''), 80)
    if excerpt:
        parts.append(f'excerpt="{excerpt}"')
    # Final guard: the joined summary must itself be a single line.
    return _one_line(' | '.join(parts), 240)


def generate_staging_sql(
    proposals_path: 'str | Path',
    out_sql_path: 'str | Path',
) -> int:
    """Read a proposals JSON file and emit owner-reviewable INSERT statements.

    The generated SQL targets ONLY public.catalog_extraction_staging. Each row
    is inserted with hitl_status defaulting to 'pending'. The generator NEVER
    emits INSERTs into the production tables (promoted_parameter_values,
    catalog_evidence_items, source_lead_triage) -- promotion is the exclusive
    job of the catalog_approve_staging_row RPC under HITL authority. The owner
    pastes this file into the Supabase SQL Editor to load the pending rows, then
    reviews each in the CatalogStagingReview UI and approves selected rows via
    the RPC.

    Values are emitted as dollar-quoted literals (injection-safe), with explicit
    ::uuid / ::timestamptz / ::jsonb casts. The proposed_payload is a JSONB
    literal carrying the full proposal (including provenance keys).

    Returns the number of INSERT statements written.
    """
    proposals_path = Path(proposals_path)
    out_sql_path = Path(out_sql_path)

    rows = json.loads(proposals_path.read_text(encoding='utf-8'))
    if not isinstance(rows, list):
        raise ValueError(
            f'Proposals file at {proposals_path} is not a JSON array; '
            f'found {type(rows).__name__}.'
        )

    lines: list[str] = [
        '-- =====================================================================',
        '-- Catalog staging proposals -- paste into the Supabase Studio SQL Editor.',
        f'-- Generated from: {proposals_path.name}',
        f'-- Proposal rows: {len(rows)}',
        '--',
        '-- These INSERTs target ONLY public.catalog_extraction_staging. Every row',
        "-- lands with hitl_status = 'pending'. Nothing is promoted to a production",
        '-- table here. After pasting, review each row in the CatalogStagingReview',
        '-- UI (admin) and approve the ones you accept; approval calls',
        '-- catalog_approve_staging_row(id, notes), which promotes the payload into',
        '-- the target table (promoted_parameter_values / catalog_evidence_items /',
        '-- source_lead_triage) under your HITL authority. AI never approves.',
        '-- =====================================================================',
        '',
        'BEGIN;',
        '',
    ]

    for i, row in enumerate(rows, start=1):
        values = {
            'source_zotero_key': _sql_text(row.get('source_zotero_key')),
            'source_attachment_path': _sql_text(row.get('source_attachment_path')),
            'extraction_pass_id': _sql_ts(row.get('extraction_pass_id'), 'uuid'),
            'extraction_pass_started_at': _sql_ts(
                row.get('extraction_pass_started_at'), 'timestamptz'),
            'extraction_pass_finished_at': _sql_ts(
                row.get('extraction_pass_finished_at'), 'timestamptz'),
            'extracted_at': _sql_ts(row.get('extracted_at'), 'timestamptz'),
            'proposed_kind': _sql_text(row.get('proposed_kind')),
            'proposed_payload': _sql_jsonb(row.get('proposed_payload') or {}),
            'confidence': _sql_numeric(row.get('confidence')),
            'extraction_notes': _sql_text(row.get('extraction_notes')),
            'extraction_model': _sql_text(row.get('extraction_model')),
        }
        col_list = ', '.join(_STAGING_SQL_COLUMNS)
        val_list = ',\n    '.join(values[c] for c in _STAGING_SQL_COLUMNS)
        lines.append(f'-- Row {i}: {_row_summary(row)}')
        lines.append(
            f'INSERT INTO public.catalog_extraction_staging ({col_list})\n'
            f'VALUES (\n    {val_list}\n);'
        )
        lines.append('')

    lines.append('COMMIT;')
    lines.append('')

    out_sql_path.parent.mkdir(parents=True, exist_ok=True)
    out_sql_path.write_text('\n'.join(lines), encoding='utf-8')
    return len(rows)


# ============================================================================
# Breadcrumb emission (companion to the wrapper watchdog)
# ============================================================================

def write_breadcrumb(
    *,
    breadcrumb_dir: Path,
    pass_id: uuid.UUID | str,
    status: str,
    note: str = '',
    current_zotero_key: str = '',
    output_artifacts: Sequence[str] = (),
) -> Path:
    """Emit a breadcrumb JSON file at the path scheme the wrapper watchdog filters on.

    Filename: <pass_id>-<YYYYMMDDTHHMMSSZ>-py.json. Timestamp is Windows-safe
    basic ISO format (no colons; colons are invalid in Windows filenames and
    would cause silent write failures, triggering false STALLED watchdog kills).

    The pass-scoped filename prefix ($PassId) lets the wrapper filter
    breadcrumbs to this run only, ignoring stale prior-pass crumbs.
    """
    breadcrumb_dir.mkdir(parents=True, exist_ok=True)
    now_safe = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    crumb = {
        'pass_id': str(pass_id),
        'status': status,
        'last_progress_at': datetime.now(timezone.utc).isoformat(),
        'current_zotero_key': current_zotero_key,
        'output_artifacts': list(output_artifacts),
        'note': note,
        'source': 'extract.py',
    }
    out = breadcrumb_dir / f'{pass_id}-{now_safe}-py.json'
    out.write_text(
        json.dumps(crumb, indent=2, ensure_ascii=True),
        encoding='utf-8',
    )
    return out


# ============================================================================
# Public surface (for smoke import test)
# ============================================================================

__all__ = [
    'MAX_PAGES_FOR_OCR',
    'MAX_PAGES_FOR_ACCURATE',
    'PROACTIVE_CHUNK_THRESHOLD',
    'DEFAULT_CHUNK_SIZE',
    'PROPOSED_KIND_VALUES',
    'HITL_STATUS_VALUES',
    'AGENT_PRINCIPAL',
    'PAYLOAD_REQUIRED_KEYS',
    'PROVENANCE_REQUIRED_KEYS',
    'StagingRow',
    'build_staging_row',
    'save_proposals',
    'generate_staging_sql',
    'get_page_count',
    'configure_docling_converter',
    'extract_tables_from_pdf',
    'write_breadcrumb',
]
