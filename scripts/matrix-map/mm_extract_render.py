import sys
import os
import fitz  # PyMuPDF

def extract_candidate_pages(pdf_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    doc_name = os.path.splitext(os.path.basename(pdf_path))[0]
    
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Error opening {pdf_path}: {e}")
        return

    # Indicators of a sediment chemistry RESULTS table. Broadened 2026-06-25 after a
    # sediment doc ("Lot 3 Sediment HHRA") returned 0 candidate pages with the original
    # narrow list. The 15-page cap + the AGY sediment/name gates handle over-inclusion.
    keywords = [
        "sample id", "date sampled", "sample depth", "analytical results",
        "station", "sampling date", "sample date", "date collected",
        "mg/kg", "ug/kg", "concentration", "sediment quality",
        "results of chemical", "depth (m)", "sed11", "sed0",
    ]
    
    saved_count = 0
    scanned_count = len(doc)
    
    for page_num in range(scanned_count):
        page = doc[page_num]
        text = page.get_text("text").lower()
        
        # Check if any keyword is in text
        if any(kw in text for kw in keywords):
            # Render page to PNG
            pix = page.get_pixmap(dpi=200)
            out_path = os.path.join(output_dir, f"{doc_name}_page_{page_num + 1}.png")
            pix.save(out_path)
            print(f"Saved {out_path}")
            saved_count += 1
            
            # Cap exploration
            if saved_count >= 15:
                print(f"Reached maximum of 15 candidate pages for {doc_name}.")
                break
                
    if saved_count == 0:
        print(f"Scanned all {scanned_count} pages of {doc_name} but found 0 candidate pages.")

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python mm_extract_render.py <pdf_path> <output_dir>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    extract_candidate_pages(pdf_path, out_dir)
