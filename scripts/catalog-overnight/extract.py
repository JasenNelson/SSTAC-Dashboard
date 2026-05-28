"""Catalog Extraction Agent -- Docling -> Ollama -> catalog_extraction_staging.

Forks the BN-RRM extract_tables_docling.py pattern (Docling-first, chunked,
heartbeat-aware) but scoped to producing rows for the catalog_extraction_staging
HITL queue. The agent NEVER writes to production catalog tables; the only
catalog surface it may populate is the staging table, which is the HITL
approval queue.

Pattern source:
  C:\\Projects\\Regulatory-Review\\2026_Database_Development\\data_acquisition\\bnrrm_extraction\\extract_tables_docling.py
Tuning constants (MAX_PAGES_FOR_OCR, MAX_PAGES_FOR_ACCURATE,
PROACTIVE_CHUNK_THRESHOLD, DEFAULT_CHUNK_SIZE) intentionally mirror that
file for cross-project consistency. Do not diverge without owner approval.

Safety:
  - Local Ollama only (per cross_project_local_ollama_only_for_ingestion_pipelines.md).
  - No paid LLM APIs.
  - Service-role DSN is read from --dsn arg only; never logged. Vault / env-var
    handling is owner-driven first-real-run work (see README.md scheduling
    section); this scaffold does not implement env-var DSN fallback.
  - LLM client is INJECTED via the LlmClient protocol; this scaffold does not
    invoke Ollama end-to-end. The real Ollama wiring lands at owner-driven
    first-real-run time. Tests mock the protocol.

Authored by Stream D autonomous session (Opus 4.7) 2026-05-27.
"""

from __future__ import annotations

import argparse
import dataclasses
import gc
import json
import os
import re
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterable, Iterator, Protocol, Sequence

# Optional imports -- the scaffold runs without them so tests do not need
# Docling/psycopg installed. Real runs require the full requirements.txt.
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
# LLM client interface (Protocol; mocked in tests)
# ============================================================================

class LlmClient(Protocol):
    """LLM client for catalog extraction.

    Implementations call local Ollama or a test mock. The agent NEVER calls a
    paid LLM API. The real Ollama wiring is owner-driven first-real-run work,
    NOT part of this scaffold (per Sub-task 4 spec).
    """

    def extract_proposals(
        self,
        *,
        zotero_key: str,
        attachment_path: str | None,
        table_data: list[dict],
        model: str,
    ) -> list[dict]:
        """Given Docling-extracted tables from one PDF, return a list of
        proposed catalog row dicts.

        Each dict MUST have keys:
          - proposed_kind: one of PROPOSED_KIND_VALUES
          - proposed_payload: JSON-serializable dict
          - confidence: float in [0, 1] or None
          - extraction_notes: str or None
        """
        ...


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
    """Convert one LLM proposal dict into a StagingRow.

    Validates the proposal shape against the catalog_extraction_staging
    CHECK constraints (proposed_kind enum, confidence in [0,1]).

    Raises ValueError on validation failure so the agent does not insert
    rows that would violate the schema.
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
    # Fail fast on non-JSON-serializable payloads so the row is rejected
    # at validation time rather than blowing up mid-INSERT in to_db_tuple().
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
        # Guard: bool is a subclass of int; reject silently-true confidence.
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

    Connection is service-role (bypasses RLS). The created_by column is left
    null (DB allows null when created_by_role = 'agent_service_role', which
    is the column DEFAULT).

    Use as a context manager; the connection is opened on __enter__ and
    closed on __exit__.
    """

    def __init__(self, dsn: str):
        if not HAS_PSYCOPG:
            raise ImportError('psycopg not installed. Run: pip install psycopg')
        self.dsn = dsn
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
        rolls back the transaction and re-raises so the caller can recover
        without a half-committed batch or an aborted connection state.
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
                # Best-effort rollback; if the connection itself is broken
                # we still want to re-raise the original exception.
                pass
            raise


# ============================================================================
# Pass orchestration
# ============================================================================

@dataclasses.dataclass
class ExtractionPass:
    """One agent run = one extraction pass."""

    pass_id: uuid.UUID = dataclasses.field(default_factory=uuid.uuid4)
    started_at: datetime = dataclasses.field(
        default_factory=lambda: datetime.now(timezone.utc)
    )
    finished_at: datetime | None = None
    model: str = 'gemma3:12b'  # default per LOCKED Path Y v3
    pdfs_processed: int = 0
    pdfs_failed: int = 0
    rows_emitted: int = 0
    rows_inserted: int = 0


def run_pass(
    *,
    zotero_items: Sequence[tuple[str, str | None]],
    llm_client: LlmClient,
    writer: StagingWriter | None,
    model: str = 'gemma3:12b',
    heartbeat_callback: Callable[[str], None] | None = None,
    stop_check: Callable[[], bool] | None = None,
    table_extractor: Callable[[str], list[dict]] | None = None,
) -> ExtractionPass:
    """Process a batch of Zotero items. Returns the ExtractionPass record.

    For each item:
      1. Extract tables from the attached PDF (table_extractor; defaults to
         extract_tables_from_pdf).
      2. Prompt the LLM client for catalog proposals.
      3. Build StagingRow objects (build_staging_row validates each).
      4. Write the batch to the staging table (skipped if writer is None;
         useful for --dry-run and tests).

    Errors per-PDF are isolated (one bad PDF does not halt the pass).
    """
    pass_state = ExtractionPass(model=model)

    table_fn: Callable[[str], list[dict]] = (
        table_extractor if table_extractor is not None
        else (lambda p: extract_tables_from_pdf(
            p,
            heartbeat_callback=heartbeat_callback,
            stop_check=stop_check,
        ))
    )

    for zotero_key, attachment_path in zotero_items:
        if stop_check is not None and stop_check():
            break

        if heartbeat_callback is not None:
            try:
                heartbeat_callback(f'zotero_key={zotero_key}')
            except Exception:
                pass

        try:
            if attachment_path is None:
                pass_state.pdfs_failed += 1
                continue

            tables = table_fn(attachment_path)

            proposals = llm_client.extract_proposals(
                zotero_key=zotero_key,
                attachment_path=attachment_path,
                table_data=tables,
                model=model,
            )

            rows: list[StagingRow] = []
            for proposal in proposals:
                try:
                    rows.append(
                        build_staging_row(
                            zotero_key=zotero_key,
                            attachment_path=attachment_path,
                            pass_id=pass_state.pass_id,
                            pass_started_at=pass_state.started_at,
                            proposal=proposal,
                            extraction_model=model,
                        )
                    )
                except ValueError as ve:
                    # Skip bad proposals; continue with the rest of the batch.
                    if heartbeat_callback is not None:
                        try:
                            heartbeat_callback(f'rejected proposal for {zotero_key}: {ve}')
                        except Exception:
                            pass

            if writer is not None and rows:
                inserted_ids = writer.write_batch(rows)
                pass_state.rows_inserted += len(inserted_ids)

            pass_state.rows_emitted += len(rows)
            pass_state.pdfs_processed += 1
        except Exception as exc:
            pass_state.pdfs_failed += 1
            if heartbeat_callback is not None:
                try:
                    heartbeat_callback(f'ERROR processing {zotero_key}: {exc}')
                except Exception:
                    pass
        finally:
            gc.collect()

    pass_state.finished_at = datetime.now(timezone.utc)

    # Backfill extraction_pass_finished_at on every row this pass wrote.
    # Rows are inserted as they are produced (one at a time), so
    # `extraction_pass_finished_at` is NULL on insert. Once the pass ends we
    # know the timestamp; one UPDATE closes out all rows in this pass.
    if writer is not None and pass_state.rows_inserted > 0:
        try:
            with writer.conn.cursor() as cur:  # type: ignore[union-attr]
                cur.execute(
                    'UPDATE public.catalog_extraction_staging '
                    'SET extraction_pass_finished_at = %s '
                    'WHERE extraction_pass_id = %s '
                    '  AND extraction_pass_finished_at IS NULL',
                    (pass_state.finished_at, str(pass_state.pass_id)),
                )
            writer.conn.commit()  # type: ignore[union-attr]
        except Exception as exc:
            # Best-effort backfill; the pass already wrote its rows so we
            # log and continue rather than re-raising. Roll back the failed
            # transaction so a subsequent write_batch (or any other psycopg
            # call sharing this connection) does not inherit an aborted
            # transaction state.
            try:
                writer.conn.rollback()  # type: ignore[union-attr]
            except Exception:
                # Best-effort rollback; if the connection itself is broken
                # the caller's next connection attempt will surface that.
                pass
            if heartbeat_callback is not None:
                try:
                    heartbeat_callback(
                        f'WARN: pass_finished_at backfill failed: {exc}'
                    )
                except Exception:
                    pass
    return pass_state


# ============================================================================
# Breadcrumb emission (companion to run.ps1)
# ============================================================================

def write_breadcrumb(
    *,
    breadcrumb_dir: Path,
    pass_id: uuid.UUID,
    status: str,
    note: str = '',
    current_zotero_key: str = '',
    output_artifacts: Sequence[str] = (),
) -> Path:
    """Emit a breadcrumb JSON file at the path scheme run.ps1 watches.

    Filename includes pass_id and a timestamp (colons replaced with dashes
    so Windows accepts the path).
    """
    breadcrumb_dir.mkdir(parents=True, exist_ok=True)
    now_iso = datetime.now(timezone.utc).isoformat()
    safe_iso = now_iso.replace(':', '-')
    crumb = {
        'pass_id': str(pass_id),
        'status': status,
        'last_progress_at': now_iso,
        'current_zotero_key': current_zotero_key,
        'output_artifacts': list(output_artifacts),
        'note': note,
        'source': 'extract.py',
    }
    out = breadcrumb_dir / f'{pass_id}-{safe_iso}-py.json'
    out.write_text(
        json.dumps(crumb, indent=2, ensure_ascii=True),
        encoding='utf-8',
    )
    return out


# ============================================================================
# CLI entry point
# ============================================================================

def _parse_args(argv: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            'Catalog Extraction Agent: extract structured proposals from '
            'Zotero PDFs into catalog_extraction_staging.'
        ),
    )
    parser.add_argument(
        '--zotero-collection',
        required=True,
        help='Zotero collection key or saved-search id to query.',
    )
    parser.add_argument(
        '--model',
        default='gemma3:12b',
        help='Ollama model name (default: gemma3:12b per LOCKED Path Y v3).',
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Process PDFs and prompt LLM but do not write to staging table.',
    )
    parser.add_argument(
        '--dsn',
        help='psycopg DSN for service-role Supabase connection. Required unless --dry-run.',
    )
    parser.add_argument(
        '--pass-id',
        help='UUID for this pass (run.ps1 passes one in; otherwise auto-generated).',
    )
    parser.add_argument(
        '--breadcrumb-dir',
        help='Directory for breadcrumb JSON files (run.ps1 sets this).',
    )
    return parser.parse_args(argv)


def main(argv: Sequence[str] | None = None) -> int:
    args = _parse_args(argv)

    if not args.dry_run and not args.dsn:
        print('error: --dsn is required unless --dry-run', file=sys.stderr)
        return 2

    pass_id = uuid.UUID(args.pass_id) if args.pass_id else uuid.uuid4()
    breadcrumb_dir = Path(args.breadcrumb_dir) if args.breadcrumb_dir else None

    def emit(status: str, note: str = '', current: str = '') -> None:
        if breadcrumb_dir is not None:
            try:
                write_breadcrumb(
                    breadcrumb_dir=breadcrumb_dir,
                    pass_id=pass_id,
                    status=status,
                    note=note,
                    current_zotero_key=current,
                )
            except Exception:
                # Best-effort; do not crash extract.py if breadcrumbs fail.
                pass

    emit('STARTED', f'pass_id={pass_id}, model={args.model}, dry_run={args.dry_run}')

    # The scaffold does NOT wire real Zotero querying or Ollama. Both are
    # owner-driven first-real-run work. Emit SILENT_BAIL with a clear note
    # and exit non-zero so the harness writes COMPLETED_RED rather than
    # COMPLETED_GREEN -- consumers of the latest breadcrumb get a true
    # signal that no work happened.
    emit(
        'SILENT_BAIL',
        note=(
            'Catalog Extraction Agent scaffold landed but Zotero query and '
            'Ollama client wiring are deferred to first-real-run (Stream D '
            'Sub-task 4 deliverable is the harness; Sub-task 4 design doc '
            'lands in docs/STREAM_D_AUTONOMOUS_AGENT.md per Sub-task 7).'
        ),
    )
    print(
        'Catalog Extraction Agent scaffold present; Zotero + Ollama wiring '
        'deferred to first-real-run (see scripts/catalog-overnight/README.md).',
        file=sys.stderr,
    )
    # Exit code 3 = scaffold-deferred. Distinguishable from real failures
    # (exit 1, 2) and from a successful real run (exit 0).
    return 3


if __name__ == '__main__':
    sys.exit(main())
