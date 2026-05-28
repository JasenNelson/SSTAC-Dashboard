"""Unit tests for scripts/catalog-overnight/extract.py.

These tests do NOT require docling, psycopg, or ollama. The LlmClient
protocol, table extractor, and StagingWriter are all mocked or injected.

Run from the catalog-overnight venv:
    pytest scripts/catalog-overnight/tests -v --maxfail=1

These tests cover:
  - build_staging_row() input validation (proposed_kind enum, confidence range,
    extraction_notes type, missing zotero_key)
  - StagingRow.to_db_tuple() shape + ordering matches the INSERT SQL
  - run_pass() orchestrator: happy path, bad proposal isolation, missing
    attachment counts as failed, stop_check terminates cleanly
  - write_breadcrumb() emits valid JSON to the right path
"""

from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

# Make the package directory importable without installing it.
_HERE = Path(__file__).resolve().parent
_PKG = _HERE.parent
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

import extract  # noqa: E402 (sys.path manipulation above)


# ---------------------------------------------------------------------------
# Test helpers
# ---------------------------------------------------------------------------

def _proposal(
    kind: str = 'parameter_value',
    *,
    payload: dict | None = None,
    confidence: float | None = 0.42,
    notes: str | None = 'extracted from Table 3',
) -> dict:
    return {
        'proposed_kind': kind,
        'proposed_payload': payload if payload is not None else {
            'substance_key': 'cadmium',
            'value': '0.6',
            'unit': 'mg/kg dw',
        },
        'confidence': confidence,
        'extraction_notes': notes,
    }


class _MockLlm:
    """Mock LlmClient capturing call args and returning canned proposals."""

    def __init__(self, proposals_per_call: list[list[dict]]) -> None:
        self._queue = list(proposals_per_call)
        self.calls: list[dict[str, Any]] = []

    def extract_proposals(
        self,
        *,
        zotero_key: str,
        attachment_path: str | None,
        table_data: list[dict],
        model: str,
    ) -> list[dict]:
        self.calls.append(
            {
                'zotero_key': zotero_key,
                'attachment_path': attachment_path,
                'table_data': table_data,
                'model': model,
            }
        )
        if not self._queue:
            return []
        return self._queue.pop(0)


class _MockWriter:
    """Mock StagingWriter capturing batches written."""

    def __init__(self) -> None:
        self.batches: list[list[extract.StagingRow]] = []

    def write_batch(self, rows):  # type: ignore[no-untyped-def]
        self.batches.append(list(rows))
        return [uuid.uuid4() for _ in rows]


# ---------------------------------------------------------------------------
# build_staging_row() validation
# ---------------------------------------------------------------------------

def test_build_staging_row_happy_path():
    pass_id = uuid.uuid4()
    pass_started = datetime(2026, 5, 27, 12, 0, 0, tzinfo=timezone.utc)
    row = extract.build_staging_row(
        zotero_key='ZK123',
        attachment_path='C:/tmp/zotero/abc.pdf',
        pass_id=pass_id,
        pass_started_at=pass_started,
        proposal=_proposal(),
        extraction_model='gemma3:12b',
    )
    assert row.source_zotero_key == 'ZK123'
    assert row.source_attachment_path == 'C:/tmp/zotero/abc.pdf'
    assert row.extraction_pass_id == pass_id
    assert row.extraction_pass_started_at == pass_started
    assert row.proposed_kind == 'parameter_value'
    assert row.proposed_payload == {
        'substance_key': 'cadmium',
        'value': '0.6',
        'unit': 'mg/kg dw',
    }
    assert row.confidence == 0.42
    assert row.extraction_notes == 'extracted from Table 3'
    assert row.extraction_model == 'gemma3:12b'
    assert row.extracted_at.tzinfo is not None  # always tz-aware


def test_build_staging_row_accepts_null_confidence():
    row = extract.build_staging_row(
        zotero_key='ZK',
        attachment_path=None,
        pass_id=uuid.uuid4(),
        pass_started_at=datetime.now(timezone.utc),
        proposal=_proposal(confidence=None),
        extraction_model='gemma3:12b',
    )
    assert row.confidence is None


def test_build_staging_row_accepts_zero_and_one_confidence():
    pass_id = uuid.uuid4()
    started = datetime.now(timezone.utc)
    for c in (0.0, 1.0):
        row = extract.build_staging_row(
            zotero_key='ZK',
            attachment_path=None,
            pass_id=pass_id,
            pass_started_at=started,
            proposal=_proposal(confidence=c),
            extraction_model='gemma3:12b',
        )
        assert row.confidence == c


def test_build_staging_row_rejects_unknown_kind():
    try:
        extract.build_staging_row(
            zotero_key='ZK',
            attachment_path=None,
            pass_id=uuid.uuid4(),
            pass_started_at=datetime.now(timezone.utc),
            proposal=_proposal(kind='evidence_value'),  # not in enum
            extraction_model='gemma3:12b',
        )
    except ValueError as ve:
        assert 'proposed_kind' in str(ve)
    else:
        raise AssertionError('expected ValueError for bad proposed_kind')


def test_build_staging_row_rejects_non_dict_payload():
    try:
        extract.build_staging_row(
            zotero_key='ZK',
            attachment_path=None,
            pass_id=uuid.uuid4(),
            pass_started_at=datetime.now(timezone.utc),
            proposal={
                'proposed_kind': 'parameter_value',
                'proposed_payload': '{not a dict}',
                'confidence': 0.5,
                'extraction_notes': None,
            },
            extraction_model='gemma3:12b',
        )
    except ValueError as ve:
        assert 'proposed_payload' in str(ve)
    else:
        raise AssertionError('expected ValueError for non-dict payload')


def test_build_staging_row_rejects_non_json_serializable_payload():
    # A payload that is a dict but contains a non-JSON-serializable value
    # (e.g., a set) must be rejected at build time, not at INSERT time.
    bad_payload = {
        'substance_key': 'cadmium',
        'pathways': {'eco-direct', 'eco-food-web'},  # set is not JSON-serializable
    }
    try:
        extract.build_staging_row(
            zotero_key='ZK',
            attachment_path=None,
            pass_id=uuid.uuid4(),
            pass_started_at=datetime.now(timezone.utc),
            proposal={
                'proposed_kind': 'parameter_value',
                'proposed_payload': bad_payload,
                'confidence': 0.5,
                'extraction_notes': None,
            },
            extraction_model='gemma3:12b',
        )
    except ValueError as ve:
        assert 'JSON-serializable' in str(ve)
    else:
        raise AssertionError('expected ValueError for non-JSON-serializable payload')


def test_build_staging_row_rejects_out_of_range_confidence():
    for bad in (-0.1, 1.0001, 5.0):
        try:
            extract.build_staging_row(
                zotero_key='ZK',
                attachment_path=None,
                pass_id=uuid.uuid4(),
                pass_started_at=datetime.now(timezone.utc),
                proposal=_proposal(confidence=bad),
                extraction_model='gemma3:12b',
            )
        except ValueError as ve:
            assert 'confidence' in str(ve)
        else:
            raise AssertionError(f'expected ValueError for confidence={bad}')


def test_build_staging_row_rejects_boolean_confidence():
    # bool subclasses int; reject it so True/False does not silently coerce.
    try:
        extract.build_staging_row(
            zotero_key='ZK',
            attachment_path=None,
            pass_id=uuid.uuid4(),
            pass_started_at=datetime.now(timezone.utc),
            proposal=_proposal(confidence=True),  # type: ignore[arg-type]
            extraction_model='gemma3:12b',
        )
    except ValueError as ve:
        assert 'bool' in str(ve)
    else:
        raise AssertionError('expected ValueError for boolean confidence')


def test_build_staging_row_rejects_non_string_notes():
    try:
        extract.build_staging_row(
            zotero_key='ZK',
            attachment_path=None,
            pass_id=uuid.uuid4(),
            pass_started_at=datetime.now(timezone.utc),
            proposal=_proposal(notes=12345),  # type: ignore[arg-type]
            extraction_model='gemma3:12b',
        )
    except ValueError as ve:
        assert 'extraction_notes' in str(ve)
    else:
        raise AssertionError('expected ValueError for non-string notes')


def test_build_staging_row_requires_zotero_key():
    try:
        extract.build_staging_row(
            zotero_key='',
            attachment_path=None,
            pass_id=uuid.uuid4(),
            pass_started_at=datetime.now(timezone.utc),
            proposal=_proposal(),
            extraction_model='gemma3:12b',
        )
    except ValueError as ve:
        assert 'zotero_key' in str(ve)
    else:
        raise AssertionError('expected ValueError for empty zotero_key')


def test_to_db_tuple_shape_matches_insert_sql():
    pass_id = uuid.uuid4()
    started = datetime(2026, 5, 27, 12, 0, 0, tzinfo=timezone.utc)
    row = extract.build_staging_row(
        zotero_key='ZK',
        attachment_path='/a.pdf',
        pass_id=pass_id,
        pass_started_at=started,
        proposal=_proposal(),
        extraction_model='gemma3:12b',
    )
    tup = row.to_db_tuple()
    # The INSERT statement has 11 parameter placeholders; the tuple must match.
    assert len(tup) == 11
    # proposed_payload must be JSON-serialized text (psycopg casts to jsonb).
    assert isinstance(tup[7], str)
    assert json.loads(tup[7]) == row.proposed_payload


# ---------------------------------------------------------------------------
# run_pass() orchestrator
# ---------------------------------------------------------------------------

def test_run_pass_happy_path_inserts_rows():
    proposals = [_proposal(), _proposal(kind='evidence_item', payload={'note': 'x'})]
    llm = _MockLlm([proposals])
    writer = _MockWriter()
    tables_seen: list[str] = []

    def fake_extractor(pdf_path: str) -> list[dict]:
        tables_seen.append(pdf_path)
        return [{'table_index': 0, 'rows': [['a', 'b']]}]

    result = extract.run_pass(
        zotero_items=[('ZK001', '/path/to.pdf')],
        llm_client=llm,
        writer=writer,
        model='gemma3:12b',
        table_extractor=fake_extractor,
    )

    assert result.pdfs_processed == 1
    assert result.pdfs_failed == 0
    assert result.rows_emitted == 2
    assert result.rows_inserted == 2
    assert result.finished_at is not None
    assert len(writer.batches) == 1
    assert len(writer.batches[0]) == 2
    assert tables_seen == ['/path/to.pdf']
    assert llm.calls[0]['zotero_key'] == 'ZK001'
    assert llm.calls[0]['model'] == 'gemma3:12b'


def test_run_pass_skips_items_without_attachment():
    llm = _MockLlm([])
    writer = _MockWriter()

    result = extract.run_pass(
        zotero_items=[('ZK_NoPdf', None), ('ZK_OK', '/a.pdf')],
        llm_client=llm,
        writer=writer,
        model='gemma3:4b',
        table_extractor=lambda _p: [],
    )

    # First item has no attachment -> counted as failed, LLM not called for it.
    assert result.pdfs_failed == 1
    assert result.pdfs_processed == 1
    # LLM was called once (only for ZK_OK).
    assert len(llm.calls) == 1
    assert llm.calls[0]['zotero_key'] == 'ZK_OK'


def test_run_pass_isolates_bad_proposals_without_halting():
    # First proposal is valid; second is bad (unknown kind) -> skipped, not raised.
    good = _proposal()
    bad = {
        'proposed_kind': 'NOT_A_KIND',
        'proposed_payload': {'x': 1},
        'confidence': 0.5,
        'extraction_notes': None,
    }
    llm = _MockLlm([[good, bad, good]])
    writer = _MockWriter()

    result = extract.run_pass(
        zotero_items=[('ZK', '/a.pdf')],
        llm_client=llm,
        writer=writer,
        model='gemma3:12b',
        table_extractor=lambda _p: [],
    )

    assert result.pdfs_processed == 1
    assert result.pdfs_failed == 0
    assert result.rows_emitted == 2  # the 2 good ones
    assert result.rows_inserted == 2
    assert len(writer.batches) == 1
    assert len(writer.batches[0]) == 2


def test_run_pass_dry_run_writer_is_none():
    llm = _MockLlm([[_proposal()]])
    result = extract.run_pass(
        zotero_items=[('ZK', '/a.pdf')],
        llm_client=llm,
        writer=None,  # dry-run
        model='gemma3:12b',
        table_extractor=lambda _p: [],
    )
    assert result.pdfs_processed == 1
    assert result.rows_emitted == 1
    assert result.rows_inserted == 0  # writer was None


def test_run_pass_stop_check_terminates_cleanly():
    llm = _MockLlm([[_proposal()], [_proposal()]])
    writer = _MockWriter()

    stop_after_first = {'count': 0}

    def stop_check() -> bool:
        stop_after_first['count'] += 1
        # Trigger stop on the second iteration of the outer for-loop.
        return stop_after_first['count'] >= 2

    result = extract.run_pass(
        zotero_items=[('A', '/a.pdf'), ('B', '/b.pdf'), ('C', '/c.pdf')],
        llm_client=llm,
        writer=writer,
        model='gemma3:12b',
        table_extractor=lambda _p: [],
        stop_check=stop_check,
    )
    # First iteration: stop_check returns False (count -> 1), process A fully.
    # Second iteration: stop_check returns True (count -> 2), break.
    # Result: exactly 1 PDF processed, 1 LLM call, 1 batch written.
    assert result.pdfs_processed == 1
    assert result.pdfs_failed == 0
    assert len(llm.calls) == 1
    assert llm.calls[0]['zotero_key'] == 'A'
    assert len(writer.batches) == 1


def test_run_pass_per_pdf_exception_isolated():
    # Extractor raises for one PDF; pass should continue with the next.
    llm = _MockLlm([[_proposal()]])
    writer = _MockWriter()
    extracted: list[str] = []

    def explode_then_ok(path: str) -> list[dict]:
        if not extracted:
            extracted.append(path)
            raise RuntimeError('docling crash on first item')
        extracted.append(path)
        return []

    result = extract.run_pass(
        zotero_items=[('Bad', '/x.pdf'), ('Good', '/y.pdf')],
        llm_client=llm,
        writer=writer,
        model='gemma3:12b',
        table_extractor=explode_then_ok,
    )
    assert result.pdfs_failed == 1
    assert result.pdfs_processed == 1


# ---------------------------------------------------------------------------
# write_breadcrumb()
# ---------------------------------------------------------------------------

def test_write_breadcrumb_creates_valid_json(tmp_path: Path):
    pass_id = uuid.uuid4()
    crumb_dir = tmp_path / 'breadcrumbs'
    out = extract.write_breadcrumb(
        breadcrumb_dir=crumb_dir,
        pass_id=pass_id,
        status='IN_PROGRESS',
        note='processed zotero item',
        current_zotero_key='ZK_42',
        output_artifacts=['a.log', 'b.log'],
    )
    assert out.exists()
    payload = json.loads(out.read_text(encoding='utf-8'))
    assert payload['pass_id'] == str(pass_id)
    assert payload['status'] == 'IN_PROGRESS'
    assert payload['current_zotero_key'] == 'ZK_42'
    assert payload['output_artifacts'] == ['a.log', 'b.log']
    assert payload['note'] == 'processed zotero item'
    # ASCII-safe JSON serialization.
    raw = out.read_text(encoding='utf-8')
    assert all(ord(c) <= 127 for c in raw)


def test_write_breadcrumb_filename_has_no_colons(tmp_path: Path):
    # Windows file system rejects ':' in filenames; ensure the writer strips them.
    out = extract.write_breadcrumb(
        breadcrumb_dir=tmp_path,
        pass_id=uuid.uuid4(),
        status='STARTED',
    )
    assert ':' not in out.name


# ---------------------------------------------------------------------------
# CLI argument parsing
# ---------------------------------------------------------------------------

def test_main_requires_dsn_unless_dry_run():
    rc = extract.main(['--zotero-collection', 'COL_X'])
    # Missing --dsn without --dry-run -> non-zero exit.
    assert rc == 2


def test_main_dry_run_returns_scaffold_deferred_exit_code():
    rc = extract.main(['--zotero-collection', 'COL_X', '--dry-run'])
    # Scaffold returns 3 (SILENT_BAIL / scaffold-deferred): distinguishable from
    # real success (0) and from real failure (1, 2). This makes the harness
    # write COMPLETED_RED so latest-breadcrumb consumers see a true signal that
    # no Zotero / Ollama work actually happened.
    assert rc == 3


# ---------------------------------------------------------------------------
# Tuning constants invariant (mirror BN-RRM)
# ---------------------------------------------------------------------------

def test_tuning_constants_mirror_bnrrm_pattern():
    assert extract.MAX_PAGES_FOR_OCR == 200
    assert extract.MAX_PAGES_FOR_ACCURATE == 500
    assert extract.PROACTIVE_CHUNK_THRESHOLD == 200
    assert extract.DEFAULT_CHUNK_SIZE == 50


def test_domain_enums_match_migration():
    assert extract.PROPOSED_KIND_VALUES == (
        'parameter_value', 'evidence_item', 'source_lead',
    )
    assert extract.HITL_STATUS_VALUES == (
        'pending', 'approved', 'rejected', 'superseded',
    )
    assert extract.AGENT_PRINCIPAL == 'agent_service_role'
