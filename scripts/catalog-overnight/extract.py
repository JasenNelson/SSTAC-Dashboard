"""Catalog extraction library -- Docling table extraction + staging row builder + psycopg writer.

This is a THIN LIBRARY, not a CLI. It is imported by an autonomous Claude Code
session (spawned by `.claude/scripts/launch_catalog_extraction.ps1` via
`claude -p` headless mode); the session orchestrates the per-item processing
loop directly. No main(), no argparse, no CLI flags.

Scope (in):
- Docling-first PDF table extraction with chunked fallback for long documents.
- Staging row builder with strict schema validation matching the
  catalog_extraction_staging migration's CHECK constraints.
- psycopg StagingWriter context manager.
- Python-side breadcrumb emitter for the wrapper's watchdog.

Scope (out, vs the prior scaffold):
- Ollama / any external LLM client. Claude Code itself is the reasoner over
  Docling output; no LlmClient protocol seam.
- CLI / main() / dry-run mode. The wrapper handles dry-run; the library is
  always called from within a Python -c invocation by Claude Code.
- run_pass orchestrator. The session's starter prompt owns orchestration.

Design reference: STREAM_D_REDESIGN_2026_05_28.md v0.3.1 (cursor-agent GREEN
at round 5, mutual-agreement methodology).

Tuning constants mirror BN-RRM extract_tables_docling.py for cross-project
consistency:
  C:\\Projects\\Regulatory-Review\\2026_Database_Development\\data_acquisition\\bnrrm_extraction\\extract_tables_docling.py

Safety:
- The agent NEVER writes to production catalog tables. Only catalog_extraction_staging.
- DSN is read from process env CATALOG_DSN by the StagingWriter; never logged.

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

# Optional imports -- tests do not require Docling / psycopg installed.
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

try:
    import psycopg
    HAS_PSYCOPG = True
except ImportError:
    HAS_PSYCOPG = False


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


# ============================================================================
# Staging row dataclass + builder
# ============================================================================

@dataclasses.dataclass
class StagingRow:
    """In-memory representation of a row destined for catalog_extraction_staging.

    Field set matches the migration column shape. DB-defaulted columns
    (id, hitl_status, hitl_reviewed_*, promoted_to_id, created_by,
    created_by_role, created_at) are omitted; psycopg INSERTs without them
    so DB defaults apply (created_by_role defaults to 'agent_service_role').
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

    def to_db_tuple(self) -> tuple:
        """Return positional values for the INSERT statement in StagingWriter."""
        return (
            self.source_zotero_key,
            self.source_attachment_path,
            self.extraction_pass_id,
            self.extraction_pass_started_at,
            self.extraction_pass_finished_at,
            self.extracted_at,
            self.proposed_kind,
            json.dumps(self.proposed_payload),
            self.confidence,
            self.extraction_notes,
            self.extraction_model,
        )


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
    before INSERT.
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
    try:
        json.dumps(payload)
    except (TypeError, ValueError) as je:
        raise ValueError(
            f'proposed_payload must be JSON-serializable: {je}'
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
# Staging writer (psycopg, service-role)
# ============================================================================

_INSERT_SQL = """
INSERT INTO public.catalog_extraction_staging (
    source_zotero_key,
    source_attachment_path,
    extraction_pass_id,
    extraction_pass_started_at,
    extraction_pass_finished_at,
    extracted_at,
    proposed_kind,
    proposed_payload,
    confidence,
    extraction_notes,
    extraction_model
) VALUES (%s, %s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s, %s)
RETURNING id;
"""


class StagingWriter:
    """Writes StagingRow records to catalog_extraction_staging via psycopg.

    DSN is read from process env CATALOG_DSN (set by the wrapper from Windows
    Credential Manager). The connection runs as service-role and bypasses
    RLS in Supabase. The created_by column is left null (DB default
    created_by_role = 'agent_service_role' fires).

    Use as a context manager.
    """

    def __init__(self, dsn: str | None = None):
        if not HAS_PSYCOPG:
            raise ImportError('psycopg not installed. Run: pip install psycopg[binary]')
        self.dsn = dsn or os.environ.get('CATALOG_DSN')
        if not self.dsn:
            raise RuntimeError(
                'No DSN supplied (constructor arg) and CATALOG_DSN env var unset. '
                'The wrapper should set CATALOG_DSN before invoking the Python step.'
            )
        self.conn = None

    def __enter__(self) -> 'StagingWriter':
        self.conn = psycopg.connect(self.dsn)
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> None:
        if self.conn is not None:
            try:
                self.conn.close()
            finally:
                self.conn = None

    def write_batch(self, rows: Sequence[StagingRow]) -> list[uuid.UUID]:
        """Insert a batch of staging rows atomically. Returns the new row ids.

        Wraps the inserts in a transaction: on any error inside the batch,
        rolls back and re-raises so the caller can recover without a
        half-committed batch or an aborted connection state.
        """
        if self.conn is None:
            raise RuntimeError(
                'StagingWriter is not connected (use as context manager)'
            )

        ids: list[uuid.UUID] = []
        try:
            with self.conn.cursor() as cur:
                for row in rows:
                    cur.execute(_INSERT_SQL, row.to_db_tuple())
                    fetched = cur.fetchone()
                    if fetched is not None:
                        ids.append(fetched[0])
            self.conn.commit()
            return ids
        except Exception:
            try:
                self.conn.rollback()
            except Exception:
                # Best-effort; if the connection itself is broken
                # we still want to re-raise the original exception.
                pass
            raise


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
    'StagingRow',
    'StagingWriter',
    'build_staging_row',
    'get_page_count',
    'configure_docling_converter',
    'extract_tables_from_pdf',
    'write_breadcrumb',
]
