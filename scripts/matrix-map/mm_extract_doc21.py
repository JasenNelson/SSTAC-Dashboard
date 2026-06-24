import sys
import os
import fitz  # PyMuPDF

def extract_pages(pdf_path, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    doc_name = os.path.splitext(os.path.basename(pdf_path))[0]
    
    try:
        doc = fitz.open(pdf_path)
    except Exception as e:
        print(f"Error opening {pdf_path}: {e}")
        return

    # Extract pages 4 to 8 (0-indexed 3 to 7)
    for page_num in range(min(15, len(doc))):
        page = doc[page_num]
        pix = page.get_pixmap(dpi=200)
        out_path = os.path.join(output_dir, f"{doc_name}_page_{page_num + 1}.png")
        pix.save(out_path)
        print(f"Saved {out_path}")

if __name__ == "__main__":
    pdf_path = sys.argv[1]
    out_dir = sys.argv[2]
    extract_pages(pdf_path, out_dir)
