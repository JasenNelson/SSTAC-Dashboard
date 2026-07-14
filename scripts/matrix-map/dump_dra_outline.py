import argparse
import json
import os
import sys
from pypdf import PdfReader

def walk_outline(outline_items, reader, depth=0):
    bookmarks = []
    if not outline_items:
        return bookmarks
        
    for item in outline_items:
        if isinstance(item, list):
            bookmarks.extend(walk_outline(item, reader, depth + 1))
        else:
            title = getattr(item, 'title', None)
            if title is None:
                continue
                
            page_num = None
            try:
                p = reader.get_destination_page_number(item)
                if p is not None and p >= 0:
                    page_num = p + 1
            except Exception:
                pass
                
            bookmarks.append({
                "title": title,
                "page": page_num,
                "depth": depth
            })
    return bookmarks

def main():
    parser = argparse.ArgumentParser(description="Dump PDF outline/bookmark tree")
    parser.add_argument("--pdf", required=True, help="Path to input PDF")
    parser.add_argument("--report", required=True, help="Path to output JSON report")
    args = parser.parse_args()

    report = {
        "pdf": args.pdf,
        "is_encrypted": False,
        "total_pages": 0,
        "outline_present": False,
        "bookmark_count": 0,
        "bookmarks": [],
        "flagged_bookmarks": [],
        "flagged_count": 0,
        "status": "OK",
        "error": None
    }

    # Read-only guarantee: refuse to write the report over the input PDF (e.g. a typo, or the
    # same path with different casing on Windows). Fail-closed BEFORE opening any file for write.
    try:
        same_path = os.path.normcase(os.path.realpath(args.pdf)) == os.path.normcase(os.path.realpath(args.report))
    except Exception:
        same_path = False
    # Also catch path aliases (e.g. an existing hard link) where realpath strings differ but
    # both names address the same underlying file. samefile compares device+inode identity.
    if not same_path and os.path.exists(args.report):
        try:
            same_path = os.path.samefile(args.pdf, args.report)
        except Exception:
            same_path = False
    if same_path:
        sys.stderr.write("Refusing to run: --report resolves to the same file as --pdf (would overwrite the input PDF).\n")
        sys.exit(2)

    try:
        reader = PdfReader(args.pdf)
        
        report["is_encrypted"] = reader.is_encrypted
        if reader.is_encrypted:
            try:
                # `decrypt` returns an integer (e.g., PasswordType.OWNER_PASSWORD) if successful,
                # or False/0 if failed. 
                # pypdf decrypt("") returns 1 or 2 on success, 0 on failure.
                decrypted = reader.decrypt("")
                if not decrypted:
                    report["status"] = "ENCRYPTED_NO_TEXT_ACCESS"
            except Exception:
                report["status"] = "ENCRYPTED_NO_TEXT_ACCESS"

        try:
            total_pages = len(reader.pages)
            report["total_pages"] = total_pages
        except Exception:
            pass

        outline = None
        outline_read_failed = False
        try:
            outline = reader.outline
        except Exception as oe:
            # Fail-closed: a malformed/inaccessible outline is a real diagnostic failure, not a
            # valid "no bookmarks" finding. Do NOT collapse it to NO_OUTLINE/exit 0.
            outline_read_failed = True
            report["status"] = "ERROR"
            report["error"] = "outline read failed: " + str(oe)

        if outline_read_failed:
            pass
        elif not outline:
            if report["status"] == "OK":
                report["status"] = "NO_OUTLINE"
        else:
            report["outline_present"] = True
            bookmarks = walk_outline(outline, reader)
            report["bookmarks"] = bookmarks
            report["bookmark_count"] = len(bookmarks)
            
            flag_words = [
                'appendix', 'coordinate', 'coordinates', 'location', 
                'station', 'sample', 'latitude', 'longitude', 
                'easting', 'northing', 'utm', 'table'
            ]
            
            flagged = []
            for bm in bookmarks:
                title_lower = bm["title"].lower() if bm["title"] else ""
                if any(w in title_lower for w in flag_words):
                    flagged.append(bm)
                    
            report["flagged_bookmarks"] = flagged
            report["flagged_count"] = len(flagged)
            
            if not bookmarks and report["status"] == "OK":
                report["status"] = "NO_OUTLINE"

    except Exception as e:
        report["status"] = "ERROR"
        report["error"] = str(e)

    try:
        with open(args.report, 'w', encoding='ascii', errors='ignore') as f:
            json.dump(report, f, indent=2)
    except Exception as e:
        print(f"Failed to write report: {e}", file=sys.stderr)
        sys.exit(1)

    print(f"bookmarks={report['bookmark_count']} flagged={report['flagged_count']} status={report['status']} -> {args.report}")

    if report["status"] == "ERROR":
        sys.exit(1)

if __name__ == "__main__":
    main()
