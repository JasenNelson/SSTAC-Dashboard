"""Unit tests for scripts/catalog-overnight/extract.py (thin-library form).

After the Phase 3 commit 2 refactor, extract.py is a LIBRARY (no main, no CLI,
no LlmClient protocol). These tests cover the public surface:
  - build_staging_row validation (proposed_kind enum, confidence type+range,
    JSON-serializable payload, notes type, empty zotero_key)
  - StagingRow.to_db_tuple shape + ordering vs the INSERT SQL
  - write_breadcrumb (filename format, JSON validity, no colons)
  - Tuning constants mirror BN-RRM
  - Public surface __all__ stable (smoke import test)

Tests do NOT require docling, psycopg, or ollama installed.

Run from the catalog-overnight venv:
    pytest scripts/catalog-overnight/tests -v --maxfail=1
"""

from __future__ import annotations

import json
import sys
import uuid
from datetime import datetime, timezone
from pathlib import Path

# Make the package directory importable without installing it.
_HERE = Path(__file__).resolve().parent
_PKG = _HERE.parent
if str(_PKG) not in sys.path:
    sys.path.insert(0, str(_PKG))

import extract  # noqa: E402


# ---------------------------------------------------------------------------
# Smoke import test (public surface)
# ---------------------------------------------------------------------------

def test_public_surface_exports_match_all():
    """Every name in __all__ exists as an attribute on the module."""
    for name in extract.__all__:
        assert hasattr(extract, name), f'extract.{name} missing despite being in __all__'


def test_public_surface_includes_load_bearing_names():
    """The following public names MUST be exported (used by the autonomous session)."""
    required = {
        'StagingRow',
        'StagingWriter',
        'build_staging_row',
        'extract_tables_from_pdf',
        'write_breadcrumb',
        'PROPOSED_KIND_VALUES',
        'HITL_STATUS_VALUES',
        'AGENT_PRINCIPAL',
    }
    missing = required - set(extract.__all__)
    assert not missing, f'extract.__all__ missing required names: {missing}'


def test_no_main_function():
    """The library form does not have a main() (per Phase 3 commit 2 refactor)."""
    assert not hasattr(extract, 'main'), 'extract.main should not exist in the library form'


def test_no_llm_client_protocol():
    """The LlmClient Protocol was dropped in the Phase 3 commit 2 refactor."""
    assert not hasattr(extract, 'LlmClient'), 'extract.LlmClient should not exist'


def test_no_run_pass_orchestrator():
    """run_pass orchestration moved to the session starter prompt."""
    assert not hasattr(extract, 'run_pass'), 'extract.run_pass should not exist'


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


# ---------------------------------------------------------------------------
# build_staging_row() validation
# ---------------------------------------------------------------------------

def test_build_staging_row_happy_path():
    pass_id = uuid.uuid4()
    pass_started = datetime(2026, 5, 28, 23, 30, 0, tzinfo=timezone.utc)
    row = extract.build_staging_row(
        zotero_key='ZK123',
        attachment_path='C:/tmp/zotero/abc.pdf',
        pass_id=pass_id,
        pass_started_at=pass_started,
        proposal=_proposal(),
        extraction_model='claude-opus-4-7',
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
    assert row.extraction_model == 'claude-opus-4-7'
    assert row.extracted_at.tzinfo is not None  # tz-aware


def test_build_staging_row_accepts_null_confidence():
    row = extract.build_staging_row(
        zotero_key='ZK',
        attachment_path=None,
        pass_id=uuid.uuid4(),
        pass_started_at=datetime.now(timezone.utc),
        proposal=_proposal(confidence=None),
        extraction_model='claude-opus-4-7',
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
            extraction_model='claude-opus-4-7',
        )
        assert row.confidence == c


def test_build_staging_row_rejects_unknown_kind():
    try:
        extract.build_staging_row(
            zotero_key='ZK',
            attachment_path=None,
            pass_id=uuid.uuid4(),
            pass_started_at=datetime.now(timezone.utc),
            proposal=_proposal(kind='evidence_value'),
            extraction_model='claude-opus-4-7',
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
            extraction_model='claude-opus-4-7',
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
        'pathways': {'eco-direct', 'eco-food-web'},  # set not JSON-serializable
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
            extraction_model='claude-opus-4-7',
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
                extraction_model='claude-opus-4-7',
            )
        except ValueError as ve:
            assert 'confidence' in str(ve)
        else:
            raise AssertionError(f'expected ValueError for confidence={bad}')


def test_build_staging_row_rejects_boolean_confidence():
    # bool subclasses int; reject so True/False does not silently coerce.
    try:
        extract.build_staging_row(
            zotero_key='ZK',
            attachment_path=None,
            pass_id=uuid.uuid4(),
            pass_started_at=datetime.now(timezone.utc),
            proposal=_proposal(confidence=True),  # type: ignore[arg-type]
            extraction_model='claude-opus-4-7',
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
            extraction_model='claude-opus-4-7',
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
            extraction_model='claude-opus-4-7',
        )
    except ValueError as ve:
        assert 'zotero_key' in str(ve)
    else:
        raise AssertionError('expected ValueError for empty zotero_key')


def test_to_db_tuple_shape_matches_insert_sql():
    pass_id = uuid.uuid4()
    started = datetime(2026, 5, 28, 23, 30, 0, tzinfo=timezone.utc)
    row = extract.build_staging_row(
        zotero_key='ZK',
        attachment_path='/a.pdf',
        pass_id=pass_id,
        pass_started_at=started,
        proposal=_proposal(),
        extraction_model='claude-opus-4-7',
    )
    tup = row.to_db_tuple()
    # The INSERT statement has 11 parameter placeholders; the tuple must match.
    assert len(tup) == 11
    # proposed_payload must be JSON-serialized text (psycopg casts to jsonb).
    assert isinstance(tup[7], str)
    assert json.loads(tup[7]) == row.proposed_payload


# ---------------------------------------------------------------------------
# write_breadcrumb (filename format + JSON validity)
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
    # Windows file system rejects ':' in filenames; the writer must use the
    # basic ISO timestamp format (no colons) per design lock.
    out = extract.write_breadcrumb(
        breadcrumb_dir=tmp_path,
        pass_id=uuid.uuid4(),
        status='STARTED',
    )
    assert ':' not in out.name


def test_write_breadcrumb_filename_has_py_suffix(tmp_path: Path):
    # The wrapper watchdog filters to "$PassId-*-py.json"; the Python-side
    # emitter must produce that exact suffix so the filter matches.
    out = extract.write_breadcrumb(
        breadcrumb_dir=tmp_path,
        pass_id=uuid.uuid4(),
        status='STARTED',
    )
    assert out.name.endswith('-py.json')


def test_write_breadcrumb_filename_is_pass_scoped(tmp_path: Path):
    pass_id = uuid.uuid4()
    out = extract.write_breadcrumb(
        breadcrumb_dir=tmp_path,
        pass_id=pass_id,
        status='STARTED',
    )
    assert out.name.startswith(str(pass_id) + '-')


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


# ---------------------------------------------------------------------------
# StagingWriter DSN handling (no-connect; just constructor validation)
# ---------------------------------------------------------------------------

def test_staging_writer_requires_dsn(monkeypatch):
    # Remove env var if present
    monkeypatch.delenv('CATALOG_DSN', raising=False)
    if not extract.HAS_PSYCOPG:
        # If psycopg isn't installed the ImportError fires first; skip.
        return
    try:
        extract.StagingWriter()
    except RuntimeError as re:
        assert 'CATALOG_DSN' in str(re)
    else:
        raise AssertionError('expected RuntimeError when CATALOG_DSN unset and no dsn arg')


def test_staging_writer_accepts_env_dsn(monkeypatch):
    monkeypatch.setenv('CATALOG_DSN', 'postgresql://test:test@localhost/test')
    if not extract.HAS_PSYCOPG:
        return
    # Construct without connecting (constructor does not connect; __enter__ does).
    writer = extract.StagingWriter()
    assert writer.dsn == 'postgresql://test:test@localhost/test'
    assert writer.conn is None  # not yet entered
