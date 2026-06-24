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

    keywords = ["sample id", "date sampled", "sample depth", "analytical results"]
    
    saved_count = 0
    for page_num in range(len(doc)):
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
            
            # Cap exploration (let's say 10 candidate pages per doc max just so we don't blow up)
            if saved_count >= 15:
                print("Reached maximum of 15 candidate pages for this doc.")
                break

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python mm_extract_render.py <pdf_path> <output_dir>")
        sys.exit(1)
    
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    extract_candidate_pages(pdf_path, out_dir)
