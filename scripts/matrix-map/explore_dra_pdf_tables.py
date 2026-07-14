import argparse
import inspect
import json
import re
import sys
import time
import traceback
from datetime import datetime

try:
    from docling.document_converter import DocumentConverter
except ImportError:
    DocumentConverter = None

def get_timestamp():
    return datetime.now().isoformat()

def main():
    parser = argparse.ArgumentParser(description="Probe candidate-1 DRA PDF's table structure using docling.")
    parser.add_argument("--pdf", required=True, help="Path to the input PDF.")
    parser.add_argument("--report", required=True, help="Path to the output JSON report.")
    parser.add_argument("--max-pages", type=int, default=30, help="Maximum number of pages to process.")
    parser.add_argument("--time-budget-sec", type=int, default=600, help="Time budget in seconds.")
    args = parser.parse_args()

    report = {
        "pdf": args.pdf,
        "max_pages_applied": args.max_pages,
        "page_limit_supported": False,
        "convert_seconds": 0,
        "table_count": 0,
        "tables": [],
        "status": "OK",
        "error": None
    }

    start_time = time.time()

    try:
        if DocumentConverter is None:
            raise ImportError("docling is not installed or import failed.")

        print(f"[{get_timestamp()}] PHASE init", flush=True)

        page_limit_supported = False
        convert_kwargs = {}
        format_options = None

        convert_sig = inspect.signature(DocumentConverter.convert)
        # Prefer page_range: it CONVERTS pages 1..N (a real bound). max_num_pages is a
        # reject-if-over-limit guard (it fails a 1234-page doc rather than converting the first N),
        # so it is only a fallback for older docling APIs lacking page_range (codex 2026-07-14).
        if 'page_range' in convert_sig.parameters:
            convert_kwargs['page_range'] = (1, args.max_pages)
            page_limit_supported = True
        elif 'max_num_pages' in convert_sig.parameters:
            convert_kwargs['max_num_pages'] = args.max_pages
            page_limit_supported = True
        elif 'max_pages' in convert_sig.parameters:
            convert_kwargs['max_pages'] = args.max_pages
            page_limit_supported = True

        if not page_limit_supported:
            try:
                from docling.datamodel.pipeline_options import PdfPipelineOptions
                from docling.datamodel.document import InputFormat
                from docling.document_converter import PdfFormatOption

                pipeline_options = PdfPipelineOptions()
                if hasattr(pipeline_options, 'page_range'):
                    pipeline_options.page_range = (1, args.max_pages)
                    page_limit_supported = True
                elif hasattr(pipeline_options, 'max_pages'):
                    pipeline_options.max_pages = args.max_pages
                    page_limit_supported = True

                if page_limit_supported:
                    format_options = {
                        InputFormat.PDF: PdfFormatOption(pipeline_options=pipeline_options)
                    }
            except Exception as e:
                print(f"[{get_timestamp()}] INFO: Could not configure PdfPipelineOptions: {e}", flush=True)

        report['page_limit_supported'] = page_limit_supported

        # Fail-safe: refuse to convert if NO page-limit knob (max_num_pages / page_range) could be
        # applied. Without a bound, converter.convert() would run a full unbounded conversion of a
        # potentially huge document (the candidate PDF is 1234 pages) -- a heavy/OOM risk (L0 1.7).
        if not page_limit_supported:
            raise RuntimeError(
                "Refusing to convert: no docling page-limit knob (max_num_pages/page_range) could "
                "be applied, so a full unbounded conversion would run. Bound the run externally or "
                "update this script to the current docling page-limit API."
            )

        if format_options:
            converter = DocumentConverter(format_options=format_options)
        else:
            converter = DocumentConverter()

        print(f"[{get_timestamp()}] PHASE converting (max_pages={args.max_pages})", flush=True)

        convert_start = time.time()
        result = converter.convert(args.pdf, **convert_kwargs)
        convert_seconds = time.time() - convert_start
        report['convert_seconds'] = convert_seconds

        print(f"[{get_timestamp()}] PHASE converted in {convert_seconds:.2f}s", flush=True)
        print(f"[{get_timestamp()}] PHASE extracting tables", flush=True)

        doc = result.document
        tables = []
        if hasattr(doc, 'tables') and doc.tables:
            tables = doc.tables
        elif hasattr(doc, 'iterate_items'):
            try:
                tables = [item for item in doc.iterate_items() if 'table' in str(type(item)).lower()]
            except Exception:
                pass

        report['table_count'] = len(tables)
        if len(tables) == 0:
            report['status'] = 'NO_TABLES'

        coord_keywords_exact = ["lat", "lon", "long", "x", "y", "utm"]
        coord_keywords_sub = ["station", "sample", "latitude", "longitude", "easting", "northing", "coordinate"]

        for i, table in enumerate(tables):
            page = None
            if hasattr(table, 'prov') and table.prov and len(table.prov) > 0:
                page = getattr(table.prov[0], 'page_no', None)
            if page is None:
                page = getattr(table, 'page_no', None)

            headers = []
            sample_rows = []
            n_rows = 0

            if hasattr(table, 'export_to_dataframe'):
                try:
                    df = table.export_to_dataframe()
                    headers = list(df.columns.astype(str))
                    n_rows = len(df)
                    for _, row in df.head(3).iterrows():
                        sample_rows.append([str(val) for val in row.values])
                except Exception as e:
                    print(f"[{get_timestamp()}] WARNING: Table {i} export_to_dataframe failed: {e}", flush=True)
            else:
                try:
                    cells = table.data.table_cells
                    max_row = max((c.start_row_offset_idx for c in cells), default=-1)
                    max_col = max((c.start_col_offset_idx for c in cells), default=-1)
                    if max_row >= 0 and max_col >= 0:
                        n_rows = max_row + 1
                        grid = [["" for _ in range(max_col + 1)] for _ in range(max_row + 1)]
                        for c in cells:
                            grid[c.start_row_offset_idx][c.start_col_offset_idx] = c.text
                        if len(grid) > 0:
                            headers = grid[0]
                        sample_rows = grid[1:4]
                except Exception as e:
                    print(f"[{get_timestamp()}] WARNING: Table {i} fallback cell extraction failed: {e}", flush=True)

            coord_candidate = False
            for header in headers:
                h_lower = header.lower()
                for kw in coord_keywords_exact:
                    if re.search(rf'\b{kw}\b', h_lower):
                        coord_candidate = True
                        break
                if not coord_candidate:
                    for kw in coord_keywords_sub:
                        if kw in h_lower:
                            coord_candidate = True
                            break
                if coord_candidate:
                    break

            report['tables'].append({
                "page": page,
                "headers": headers,
                "n_rows": n_rows,
                "sample_rows": sample_rows,
                "coord_candidate": coord_candidate
            })

        print(f"[{get_timestamp()}] PHASE done", flush=True)

    except Exception as e:
        report['status'] = 'ERROR'
        report['error'] = str(e) + "\n" + traceback.format_exc()
        print(f"[{get_timestamp()}] ERROR: {str(e)}", file=sys.stderr, flush=True)

    finally:
        report_written = False
        try:
            with open(args.report, 'w', encoding='utf-8') as f:
                json.dump(report, f, indent=2)
            report_written = True
        except Exception as e:
            print(f"[{get_timestamp()}] Failed to write report: {e}", file=sys.stderr, flush=True)

        elapsed = time.time() - start_time
        if elapsed > args.time_budget_sec:
            print(f"[{get_timestamp()}] WARNING: Elapsed time {elapsed:.2f}s exceeded budget {args.time_budget_sec}s", flush=True)

        # Exit nonzero if the run errored OR the report (the only intended output) could not be
        # written -- so automation never treats a report-less run as success (codex 2026-07-14).
        if report['status'] == 'ERROR' or not report_written:
            sys.exit(1)

if __name__ == "__main__":
    main()
