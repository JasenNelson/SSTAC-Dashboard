"""Split a large ETL output SQL file into Studio-pasteable chunks.

The full v1.0.0 ETL output file is ~5 MB which exceeds Supabase Studio
SQL Editor's paste limit. This splitter:

  1. Preserves the file-level header comments in EVERY chunk (audit trail).
  2. Wraps each chunk in its own BEGIN; / COMMIT; transaction with the
     SET LOCAL search_path = matrix_map, public, extensions; prologue.
  3. Splits at statement boundaries (lines ending with ';') so no INSERT
     is broken across files.
  4. Targets ~700 KB per chunk to stay comfortably under Studio's limit.
  5. Emits chunks at scripts/matrix-map/etl_output_chunks/NN_<purpose>.sql

Idempotency: every INSERT in the source uses ON CONFLICT DO NOTHING, so
re-running any chunk is safe. Order matters for FK chains (dras before
samples, samples before sample_events, etc.) so we KEEP the existing
statement order and just bucket by size.

Plain ASCII only.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path


SOURCE = Path(__file__).resolve().parent / "etl_bnrrm_to_supabase_output.sql"
OUT_DIR = Path(__file__).resolve().parent / "etl_output_chunks"
TARGET_BYTES = 700_000  # 700 KB target per chunk
MAX_BYTES = 1_500_000   # hard cap; if a single INSERT exceeds this we keep it whole


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Split the BN-RRM ETL output SQL into paste-sized chunks.",
    )
    parser.add_argument(
        "--source",
        type=Path,
        default=SOURCE,
        help="Path to the ETL output .sql to split "
             "(default: etl_bnrrm_to_supabase_output.sql).",
    )
    args = parser.parse_args()
    source = args.source

    if not source.exists():
        print(f"Source not found: {source}", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    # Clear prior chunks
    for old in OUT_DIR.glob("*.sql"):
        old.unlink()

    text = source.read_text(encoding="utf-8")
    lines = text.split("\n")

    # Extract the file-level header comment block (top of file up to first BEGIN;)
    header_lines: list[str] = []
    body_start = 0
    for i, line in enumerate(lines):
        stripped = line.strip()
        if stripped.startswith("BEGIN;"):
            body_start = i + 1  # skip the BEGIN itself; we'll re-add per chunk
            break
        header_lines.append(line)

    # Skip the SET LOCAL search_path line that follows BEGIN; in the source
    while body_start < len(lines) and lines[body_start].strip().startswith("SET LOCAL"):
        body_start += 1

    header = "\n".join(header_lines).rstrip() + "\n"

    # Group remaining lines into statements (each statement ends with ';')
    statements: list[str] = []
    buf: list[str] = []
    for raw in lines[body_start:]:
        line = raw
        if line.strip() == "COMMIT;":
            # Drop the file-level COMMIT; we'll add per-chunk COMMITs
            continue
        buf.append(line)
        stripped = line.rstrip()
        if stripped.endswith(";") and not stripped.startswith("--"):
            statements.append("\n".join(buf))
            buf = []
    if buf:
        # trailing fragment (likely empty or trailing comments)
        leftover = "\n".join(buf).strip()
        if leftover:
            statements.append("\n".join(buf))

    # Bucket statements into chunks at TARGET_BYTES
    chunks: list[list[str]] = []
    current: list[str] = []
    current_size = 0
    for stmt in statements:
        size = len(stmt.encode("utf-8"))
        if current and current_size + size > TARGET_BYTES:
            chunks.append(current)
            current = []
            current_size = 0
        current.append(stmt)
        current_size += size
    if current:
        chunks.append(current)

    # Emit each chunk
    summary = []
    for idx, chunk_stmts in enumerate(chunks, start=1):
        body = "\n\n".join(chunk_stmts).rstrip()
        chunk_text = (
            header
            + f"\n-- Chunk {idx} of {len(chunks)}\n\n"
            + "BEGIN;\n\n"
            + "SET LOCAL search_path = matrix_map, public, extensions;\n\n"
            + body
            + "\n\nCOMMIT;\n"
        )
        # Guess a purpose tag from the first INSERT INTO target in the chunk
        purpose = "other"
        for stmt in chunk_stmts:
            stripped = stmt.strip()
            if stripped.startswith("INSERT INTO matrix_map."):
                # extract table name
                rest = stripped[len("INSERT INTO matrix_map.") :]
                end = 0
                while end < len(rest) and rest[end].isalnum() or (end < len(rest) and rest[end] == "_"):
                    end += 1
                table = rest[:end] or "unknown"
                purpose = table
                break
        out_path = OUT_DIR / f"{idx:02d}_{purpose}.sql"
        out_path.write_text(chunk_text, encoding="utf-8")
        size_kb = len(chunk_text.encode("utf-8")) / 1024
        summary.append(
            f"  {out_path.name}: {len(chunk_stmts)} stmts, {size_kb:.1f} KB, "
            f"purpose-hint={purpose}"
        )

    print(f"Source: {source} ({source.stat().st_size / 1024:.1f} KB)")
    print(f"Total statements: {len(statements)}")
    print(f"Chunks emitted: {len(chunks)}")
    print(f"Output dir: {OUT_DIR}")
    for line in summary:
        print(line)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
