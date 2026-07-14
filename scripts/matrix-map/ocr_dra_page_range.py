import argparse
import json
import os
import sys
import tempfile
import shutil
import time
import re
import ctypes
from ctypes import wintypes
import multiprocessing
import psutil
import fitz

# Required RapidOCR model files (docling OCR backend). The harness fails closed if these are
# absent rather than letting RapidOCR/docling auto-download assets (a write outside allowed outputs).
_REQUIRED_OCR_MODELS = [
    "PP-OCRv6_det_small.onnx",
    "PP-OCRv6_rec_small.onnx",
    "ch_ppocr_mobile_v2.0_cls_mobile.onnx",
]

def _ocr_models_present():
    """True only if all required RapidOCR model files already exist locally (no download needed)."""
    try:
        import rapidocr
        mdir = os.path.join(os.path.dirname(rapidocr.__file__), "models")
        return all(os.path.exists(os.path.join(mdir, n)) for n in _REQUIRED_OCR_MODELS)
    except Exception:
        return False

def _create_kill_on_close_job():
    """Windows Job object with KILL_ON_JOB_CLOSE. While the returned handle stays open (parent
    alive) the assigned OCR child + any grandchildren live; when the parent dies/closes the handle,
    the OS kills the whole job -> no owned orphan can survive even a force-kill of the parent."""
    if os.name != "nt":
        return None
    try:
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.CreateJobObjectW.restype = wintypes.HANDLE
        k32.CreateJobObjectW.argtypes = [wintypes.LPVOID, wintypes.LPCWSTR]
        k32.SetInformationJobObject.restype = wintypes.BOOL
        JobObjectExtendedLimitInformation = 9
        JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE = 0x2000

        class BASIC(ctypes.Structure):
            _fields_ = [
                ("PerProcessUserTimeLimit", ctypes.c_int64),
                ("PerJobUserTimeLimit", ctypes.c_int64),
                ("LimitFlags", wintypes.DWORD),
                ("MinimumWorkingSetSize", ctypes.c_size_t),
                ("MaximumWorkingSetSize", ctypes.c_size_t),
                ("ActiveProcessLimit", wintypes.DWORD),
                ("Affinity", ctypes.c_size_t),
                ("PriorityClass", wintypes.DWORD),
                ("SchedulingClass", wintypes.DWORD),
            ]

        class IOC(ctypes.Structure):
            _fields_ = [(n, ctypes.c_uint64) for n in
                        ("r_ops", "w_ops", "o_ops", "r_xfer", "w_xfer", "o_xfer")]

        class EXT(ctypes.Structure):
            _fields_ = [
                ("BasicLimitInformation", BASIC),
                ("IoInfo", IOC),
                ("ProcessMemoryLimit", ctypes.c_size_t),
                ("JobMemoryLimit", ctypes.c_size_t),
                ("PeakProcessMemoryUsed", ctypes.c_size_t),
                ("PeakJobMemoryUsed", ctypes.c_size_t),
            ]

        h_job = k32.CreateJobObjectW(None, None)
        if not h_job:
            return None
        info = EXT()
        info.BasicLimitInformation.LimitFlags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
        if not k32.SetInformationJobObject(h_job, JobObjectExtendedLimitInformation,
                                           ctypes.byref(info), ctypes.sizeof(info)):
            k32.CloseHandle(h_job)
            return None
        return h_job
    except Exception:
        return None

def _assign_to_job(h_job, pid):
    if not h_job or os.name != "nt":
        return
    try:
        k32 = ctypes.WinDLL("kernel32", use_last_error=True)
        k32.OpenProcess.restype = wintypes.HANDLE
        k32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        PROCESS_SET_QUOTA = 0x0100
        PROCESS_TERMINATE = 0x0001
        h_proc = k32.OpenProcess(PROCESS_SET_QUOTA | PROCESS_TERMINATE, False, pid)
        if h_proc:
            k32.AssignProcessToJobObject(h_job, h_proc)
            k32.CloseHandle(h_proc)
    except Exception:
        pass

def _is_same_path(path1, path2):
    if not path1 or not path2:
        return False
    try:
        if os.path.normcase(os.path.realpath(path1)) == os.path.normcase(os.path.realpath(path2)):
            return True
    except Exception:
        pass
    if os.path.exists(path2):
        try:
            if os.path.samefile(path1, path2):
                return True
        except Exception:
            pass
    return False

def _child_worker(temp_pdf, result_md):
    try:
        from docling.document_converter import DocumentConverter, PdfFormatOption
        from docling.datamodel.pipeline_options import PdfPipelineOptions, RapidOcrOptions
        from docling.datamodel.base_models import InputFormat
        
        opts = PdfPipelineOptions()
        opts.do_ocr = True
        opts.ocr_options = RapidOcrOptions(force_full_page_ocr=True)
        conv = DocumentConverter(format_options={InputFormat.PDF: PdfFormatOption(pipeline_options=opts)})
        
        md_text = conv.convert(temp_pdf).document.export_to_markdown()
        
        with open(result_md, 'w', encoding='utf-8') as f:
            f.write(md_text)
        sys.exit(0)
    except Exception as e:
        sys.stderr.write(f"Child error: {e}\n")
        sys.exit(1)

def kill_process_tree(pid):
    try:
        parent = psutil.Process(pid)
        children = parent.children(recursive=True)
        for child in children:
            try:
                child.kill()
            except psutil.NoSuchProcess:
                pass
        parent.kill()
    except psutil.NoSuchProcess:
        pass

def main():
    multiprocessing.set_start_method('spawn', force=True)
    parser = argparse.ArgumentParser(description="OCR a page range of a PDF using docling+RapidOCR")
    parser.add_argument("--pdf", required=True, help="Path to input PDF")
    parser.add_argument("--start-page", required=True, type=int, help="Start page (1-based inclusive)")
    parser.add_argument("--end-page", required=True, type=int, help="End page (1-based inclusive)")
    parser.add_argument("--report", required=True, help="Path to output JSON report")
    parser.add_argument("--out-md", help="Optional output markdown/text path for OCR text")
    parser.add_argument("--timeout-seconds", type=int, default=600, help="Hard wall-clock cap for the OCR child")
    parser.add_argument("--rss-cap-mb", type=int, default=6000, help="Hard RSS cap for the OCR child")
    parser.add_argument("--max-pages", type=int, default=40, help="Max allowed pages")
    args = parser.parse_args()

    # 1. Validate
    if args.start_page < 1 or args.end_page < args.start_page:
        sys.stderr.write("Invalid page range.\n")
        sys.exit(2)
    
    page_count = args.end_page - args.start_page + 1
    if page_count > args.max_pages:
        sys.stderr.write(f"Refusing to run: {page_count} pages exceeds --max-pages={args.max_pages}.\n")
        sys.exit(2)

    if _is_same_path(args.pdf, args.report):
        sys.stderr.write("Refusing to run: --report resolves to the same file as --pdf.\n")
        sys.exit(2)
        
    if args.out_md and _is_same_path(args.pdf, args.out_md):
        sys.stderr.write("Refusing to run: --out-md resolves to the same file as --pdf.\n")
        sys.exit(2)

    # Fail closed if OCR models are not already present -- the read-only dry-run contract must NOT
    # trigger a model download (a write outside the allowed report/out-md/temp outputs).
    if not _ocr_models_present():
        sys.stderr.write(
            "Refusing to run: required RapidOCR model files are not present in the .venv "
            "(read-only mode will not auto-download). Run the one-time model setup first.\n"
        )
        sys.exit(2)

    report_data = {
        "pdf": args.pdf,
        "start_page": args.start_page,
        "end_page": args.end_page,
        "page_count": page_count,
        "status": "OK",
        "elapsed_seconds": 0.0,
        "peak_rss_mb": 0.0,
        "ocr_char_count": 0,
        "coordinate_hit_count": 0,
        "coordinate_hits": [],
        "error": None
    }

    temp_dir = None
    child_process = None
    job_handle = None  # keep in scope: closing it (parent exit) kills the whole OCR job tree

    try:
        # 2. Extract pages
        temp_dir = tempfile.mkdtemp()
        temp_pdf = os.path.join(temp_dir, "temp.pdf")
        result_md = os.path.join(temp_dir, "result.md")
        
        doc = fitz.open(args.pdf)
        if doc.is_encrypted:
            doc.authenticate("")
            
        newdoc = fitz.open()
        newdoc.insert_pdf(doc, from_page=args.start_page - 1, to_page=args.end_page - 1)
        newdoc.save(temp_pdf)
        newdoc.close()
        doc.close()

        # 3. Run OCR child
        child_process = multiprocessing.Process(target=_child_worker, args=(temp_pdf, result_md))
        child_process.start()
        # Bind the OCR worker (and any grandchildren) to a kill-on-close Job object so a force-kill
        # of this parent (e.g. a shell/session timeout) takes the whole OCR tree with it -- no orphan.
        job_handle = _create_kill_on_close_job()
        _assign_to_job(job_handle, child_process.pid)

        start_time = time.time()
        peak_rss_mb = 0.0
        status = "OK"
        
        # 4. Monitor loop
        while child_process.is_alive():
            elapsed = time.time() - start_time
            current_rss_mb = 0.0
            
            try:
                parent = psutil.Process(child_process.pid)
                current_rss = parent.memory_info().rss
                children = parent.children(recursive=True)
                for c in children:
                    current_rss += c.memory_info().rss
                current_rss_mb = current_rss / (1024 * 1024)
            except psutil.NoSuchProcess:
                pass
            
            if current_rss_mb > peak_rss_mb:
                peak_rss_mb = current_rss_mb
                
            sys.stderr.write(f"heartbeat t={elapsed:.1f}s rss={current_rss_mb:.1f}MB status=running\n")
            
            if elapsed > args.timeout_seconds:
                status = "TIMEOUT"
                break
            if current_rss_mb > args.rss_cap_mb:
                status = "RSS_EXCEEDED"
                break
                
            time.sleep(5)
            
        if status in ("TIMEOUT", "RSS_EXCEEDED"):
            report_data["status"] = status
            report_data["error"] = f"Child process terminated due to {status}"
            sys.stderr.write(f"Guard breach: {status}\n")
            kill_process_tree(child_process.pid)
            child_process.join(5)
            if child_process.is_alive():
                child_process.kill()
            report_data["elapsed_seconds"] = time.time() - start_time
            report_data["peak_rss_mb"] = peak_rss_mb
            
            with open(args.report, 'w', encoding='ascii', errors='ignore') as f:
                json.dump(report_data, f, indent=2)
            sys.exit(1)
            
        child_process.join()
        report_data["elapsed_seconds"] = time.time() - start_time
        report_data["peak_rss_mb"] = peak_rss_mb

        if child_process.exitcode != 0:
            report_data["status"] = "ERROR"
            report_data["error"] = f"Child process exited with code {child_process.exitcode}"
            with open(args.report, 'w', encoding='ascii', errors='ignore') as f:
                json.dump(report_data, f, indent=2)
            sys.exit(1)

        # 5. On child success
        if os.path.exists(result_md):
            with open(result_md, 'r', encoding='utf-8', errors='replace') as f:
                md_text = f.read()
                
            report_data["ocr_char_count"] = len(md_text)
            
            # Coordinate-signal detection. Catches keyword forms AND raw coordinate patterns that
            # carry no keyword: OCR frequently renders "Co-ordinates: 5443453.97 N, 499448.26 E"
            # (hyphenated, UTM northing/easting with N/E suffixes) and bare UTM pairs, plus datum
            # labels. Keep this broad so the report does not under-count real coordinate pages.
            keyword = re.compile(
                r'(?i)(co[-\s]?ordinate|easting|northing|utm|latitude|longitude|\bnad[\s-]?83|zone\s*10)'
            )
            # UTM-pair heuristics: a 7-digit northing + 6-digit easting on one line, with or without
            # N/E suffixes (Zone 10N: northing ~5.4-5.5e6, easting ~3-7e5).
            utm_pair = re.compile(
                r'\b5[45]\d{5}(?:\.\d+)?\s*N?\b.{0,30}\b[3-7]\d{5}(?:\.\d+)?\s*E?\b|'
                r'\b[3-7]\d{5}(?:\.\d+)?\s*E\b.{0,30}\b5[45]\d{5}(?:\.\d+)?\s*N\b'
            )
            wellid = re.compile(r'\b(?:MW|BH|TP|SS|SD|GW)[-\s]?\d')
            lines = md_text.splitlines()
            hits = [line for line in lines
                    if keyword.search(line) or utm_pair.search(line)
                    or (wellid.search(line) and re.search(r'\d{5,}', line))]
            
            report_data["coordinate_hit_count"] = len(hits)
            report_data["coordinate_hits"] = hits[:40]
            
            if args.out_md:
                with open(args.out_md, 'w', encoding='utf-8', errors='replace') as f:
                    f.write(md_text)
                    
            with open(args.report, 'w', encoding='ascii', errors='ignore') as f:
                json.dump(report_data, f, indent=2)
                
    except Exception as e:
        report_data["status"] = "ERROR"
        report_data["error"] = str(e)
        try:
            with open(args.report, 'w', encoding='ascii', errors='ignore') as f:
                json.dump(report_data, f, indent=2)
        except Exception:
            pass
        sys.exit(1)
    finally:
        if child_process and child_process.is_alive():
            try:
                kill_process_tree(child_process.pid)
                child_process.join(5)
                if child_process.is_alive():
                    child_process.kill()
            except Exception:
                pass
        # Closing the job handle enforces kill-on-close for anything still assigned to the job.
        if job_handle:
            try:
                ctypes.WinDLL("kernel32").CloseHandle(job_handle)
            except Exception:
                pass

        leaked = False
        if temp_dir and os.path.exists(temp_dir):
            try:
                shutil.rmtree(temp_dir)
            except Exception as ce:
                # Do NOT swallow: the harness promises to delete its only temp copy of the source
                # pages. Surface the leak loudly + record it, and fail closed if the run was otherwise OK.
                leaked = True
                report_data["temp_cleanup_failed"] = True
                report_data["temp_dir_leaked"] = temp_dir
                report_data["error"] = (report_data.get("error") or "") + f" temp cleanup failed: {ce}"
                if report_data["status"] == "OK":
                    report_data["status"] = "TEMP_LEAK"
                try:
                    with open(args.report, "w", encoding="ascii", errors="ignore") as f:
                        json.dump(report_data, f, indent=2)
                except Exception:
                    pass
                sys.stderr.write(f"WARNING: temp cleanup failed; leaked source-page copy at {temp_dir}\n")

        print(f"pages={page_count} status={report_data['status']} hits={report_data['coordinate_hit_count']} -> {args.report}")
        if leaked and report_data["status"] == "TEMP_LEAK":
            sys.exit(3)

if __name__ == "__main__":
    main()
