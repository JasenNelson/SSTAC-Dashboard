"""Unit tests for scripts/catalog-overnight/extract.py (thin-library form).

After the Phase 3 commit 2 refactor, extract.py is a LIBRARY (no main, no CLI,
no LlmClient protocol, no database). These tests cover the public surface:
  - build_staging_row validation (proposed_kind enum, confidence type+range,
    JSON-serializable payload, notes type, empty zotero_key)
  - StagingRow.to_dict shape and JSON-serializability
  - save_proposals (write, append, atomic-write, JSON array of dicts)
  - write_breadcrumb (filename format, JSON validity, no colons)
  - Tuning constants mirror BN-RRM
  - Public surface __all__ stable (smoke import test)

Tests do NOT require docling or ollama installed.

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
        'build_staging_row',
        'save_proposals',
        'extract_tables_from_pdf',
        'write_breadcrumb',
        'PROPOSED_KIND_VALUES',
        'HITL_STATUS_VALUES',
        'AGENT_PRINCIPAL',
    }
    missing = required - set(extract.__all__)
    assert not missing, f'extract.__all__ missing required names: {missing}'


def test_staging_writer_not_exported():
    """StagingWriter must NOT be in __all__ (DB path removed)."""
    assert 'StagingWriter' not in extract.__all__


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


def test_build_staging_row_rejects_empty_payload():
    # Empty `{}` would pass the staging table's NOT NULL constraint but the
    # approve RPC raises P0001 at HITL approve time (jsonb_object_keys('{}')
    # returns no rows). Reject at Python validation so the bad row never
    # lands in staging.
    try:
        extract.build_staging_row(
            zotero_key='ZK',
            attachment_path=None,
            pass_id=uuid.uuid4(),
            pass_started_at=datetime.now(timezone.utc),
            proposal={
                'proposed_kind': 'parameter_value',
                'proposed_payload': {},
                'confidence': 0.5,
                'extraction_notes': None,
            },
            extraction_model='claude-opus-4-7',
        )
    except ValueError as ve:
        assert 'non-empty' in str(ve)
    else:
        raise AssertionError('expected ValueError for empty proposed_payload')


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


def test_to_dict_shape_and_json_serializable():
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
    d = row.to_dict()
    # Must be JSON-serializable with no errors.
    serialized = json.dumps(d, ensure_ascii=True)
    assert isinstance(serialized, str)
    # Round-trip: proposed_payload preserved as dict.
    roundtripped = json.loads(serialized)
    assert roundtripped['proposed_payload'] == row.proposed_payload
    # UUID serialized to str.
    assert roundtripped['extraction_pass_id'] == str(pass_id)
    # Datetime serialized to str (ISO format).
    assert isinstance(roundtripped['extraction_pass_started_at'], str)
    assert isinstance(roundtripped['extracted_at'], str)
    # Spot-check key presence.
    for key in (
        'source_zotero_key', 'source_attachment_path', 'extraction_pass_id',
        'extraction_pass_started_at', 'extraction_pass_finished_at',
        'extracted_at', 'proposed_kind', 'proposed_payload',
        'confidence', 'extraction_notes', 'extraction_model',
    ):
        assert key in d, f'to_dict() missing key: {key}'


def test_to_dict_null_fields_serialize():
    """None fields (attachment_path, pass_finished_at, confidence, notes) round-trip as null."""
    row = extract.build_staging_row(
        zotero_key='ZK',
        attachment_path=None,
        pass_id=uuid.uuid4(),
        pass_started_at=datetime.now(timezone.utc),
        proposal=_proposal(confidence=None, notes=None),
        extraction_model='claude-opus-4-7',
    )
    d = row.to_dict()
    assert d['source_attachment_path'] is None
    assert d['extraction_pass_finished_at'] is None
    assert d['confidence'] is None
    assert d['extraction_notes'] is None
    # Must still be JSON-serializable.
    json.dumps(d, ensure_ascii=True)


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
# save_proposals() -- write, append, atomic-write, JSON array of dicts
# ---------------------------------------------------------------------------

def _make_row(zotero_key: str = 'ZK1', kind: str = 'parameter_value') -> extract.StagingRow:
    return extract.build_staging_row(
        zotero_key=zotero_key,
        attachment_path='/tmp/test.pdf',
        pass_id=uuid.uuid4(),
        pass_started_at=datetime.now(timezone.utc),
        proposal=_proposal(kind=kind),
        extraction_model='claude-opus-4-7',
    )


def test_save_proposals_creates_json_file(tmp_path: Path):
    """save_proposals writes a JSON array file when out_path does not exist."""
    out = tmp_path / 'proposals' / 'pass1.json'
    row = _make_row()
    total = extract.save_proposals([row], out)
    assert total == 1
    assert out.exists()
    data = json.loads(out.read_text(encoding='utf-8'))
    assert isinstance(data, list)
    assert len(data) == 1
    assert data[0]['source_zotero_key'] == 'ZK1'
    assert data[0]['proposed_kind'] == 'parameter_value'


def test_save_proposals_appends_on_second_call(tmp_path: Path):
    """Second call appends to the existing array; does not overwrite."""
    out = tmp_path / 'pass1.json'
    row1 = _make_row(zotero_key='ZK1')
    row2 = _make_row(zotero_key='ZK2')
    total1 = extract.save_proposals([row1], out)
    assert total1 == 1
    total2 = extract.save_proposals([row2], out)
    assert total2 == 2
    data = json.loads(out.read_text(encoding='utf-8'))
    assert len(data) == 2
    keys = [d['source_zotero_key'] for d in data]
    assert 'ZK1' in keys
    assert 'ZK2' in keys


def test_save_proposals_file_is_json_array_of_dicts(tmp_path: Path):
    """Each element in the file is a dict matching StagingRow.to_dict()."""
    out = tmp_path / 'pass1.json'
    row = _make_row()
    extract.save_proposals([row], out)
    data = json.loads(out.read_text(encoding='utf-8'))
    assert isinstance(data, list)
    element = data[0]
    assert isinstance(element, dict)
    expected = row.to_dict()
    for key, val in expected.items():
        assert key in element, f'key {key!r} missing from saved element'
        assert element[key] == val, f'key {key!r}: {element[key]!r} != {val!r}'


def test_save_proposals_atomic_write_leaves_valid_json(tmp_path: Path):
    """The file must be valid JSON immediately after save_proposals returns.

    The atomic write (tmp -> os.replace) ensures the file is never in a
    partially-written state from the reader's perspective.
    """
    out = tmp_path / 'pass1.json'
    rows = [_make_row(zotero_key=f'ZK{i}') for i in range(5)]
    extract.save_proposals(rows, out)
    # Immediately parse; must not raise.
    data = json.loads(out.read_text(encoding='utf-8'))
    assert len(data) == 5


def test_save_proposals_creates_parent_directory(tmp_path: Path):
    """Parent directories are created automatically if they do not exist."""
    out = tmp_path / 'nested' / 'deep' / 'pass1.json'
    assert not out.parent.exists()
    extract.save_proposals([_make_row()], out)
    assert out.exists()


def test_save_proposals_empty_sequence_creates_empty_array(tmp_path: Path):
    """Passing an empty sequence creates a file with an empty JSON array."""
    out = tmp_path / 'pass1.json'
    total = extract.save_proposals([], out)
    assert total == 0
    data = json.loads(out.read_text(encoding='utf-8'))
    assert data == []


def test_save_proposals_output_is_ascii_safe(tmp_path: Path):
    """JSON output must be ASCII-safe (ensure_ascii=True enforced)."""
    out = tmp_path / 'pass1.json'
    extract.save_proposals([_make_row()], out)
    raw = out.read_text(encoding='utf-8')
    assert all(ord(c) <= 127 for c in raw), 'non-ASCII character found in proposals JSON'


def test_save_proposals_returns_cumulative_count(tmp_path: Path):
    """Return value is the total count of rows in the file after the call."""
    out = tmp_path / 'pass1.json'
    assert extract.save_proposals([_make_row()], out) == 1
    assert extract.save_proposals([_make_row(), _make_row()], out) == 3
    assert extract.save_proposals([], out) == 3


def test_save_proposals_no_psycopg_import():
    """save_proposals must not import or reference psycopg in any way."""
    import inspect
    src = inspect.getsource(extract.save_proposals)
    assert 'psycopg' not in src
    assert 'CATALOG_DSN' not in src
