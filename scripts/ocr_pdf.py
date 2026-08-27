#!/usr/bin/env python3
"""
OCR a scanned PDF to text.

Needed because FBR publishes the Finance Act as a scanned gazette: 292 pages
yielding 63 characters per page through any text extractor, markitdown
included (it uses pdfminer, which reads text layers, not pixels).

Renders each page with pypdfium2 and runs the tesseract binary over it.
Deliberately avoids poppler/ocrmypdf/pytesseract so nothing has to be
installed on the machine.

Usage: ocr_pdf.py input.pdf output.txt [dpi] [workers]
"""
import sys, os, subprocess, tempfile
from concurrent.futures import ProcessPoolExecutor

import pypdfium2 as pdfium


def ocr_page(args):
    path, index, dpi = args
    try:
        pdf = pdfium.PdfDocument(path)
        page = pdf[index]
        # scale is relative to 72 dpi
        bitmap = page.render(scale=dpi / 72)
        img = bitmap.to_pil().convert("L")   # greyscale: smaller, no accuracy loss
        with tempfile.TemporaryDirectory() as td:
            png = os.path.join(td, "p.png")
            img.save(png)
            out = os.path.join(td, "o")
            # --psm 1 = automatic page segmentation with orientation detection,
            # which matters for gazette pages printed in two columns.
            subprocess.run(
                ["tesseract", png, out, "-l", "eng", "--psm", "1"],
                check=True, capture_output=True,
            )
            with open(out + ".txt", encoding="utf-8", errors="replace") as fh:
                text = fh.read()
        pdf.close()
        return index, text
    except Exception as exc:                      # keep going; report at the end
        return index, f"\n[OCR FAILED page {index + 1}: {exc}]\n"


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 2
    src, dst = sys.argv[1], sys.argv[2]
    dpi = int(sys.argv[3]) if len(sys.argv) > 3 else 200
    workers = int(sys.argv[4]) if len(sys.argv) > 4 else max(1, (os.cpu_count() or 4) - 1)

    doc = pdfium.PdfDocument(src)
    n = len(doc)
    doc.close()
    print(f"{os.path.basename(src)}: {n} pages, {dpi} dpi, {workers} workers", flush=True)

    results = {}
    done = 0
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for idx, text in pool.map(ocr_page, [(src, i, dpi) for i in range(n)], chunksize=1):
            results[idx] = text
            done += 1
            if done % 25 == 0 or done == n:
                print(f"  {done}/{n} pages", flush=True)

    with open(dst, "w", encoding="utf-8") as fh:
        for i in range(n):
            fh.write(results.get(i, ""))
            fh.write("\n")

    size = os.path.getsize(dst)
    failed = sum(1 for t in results.values() if "[OCR FAILED" in t)
    print(f"wrote {dst}: {size} chars, ~{size // max(n,1)} chars/page, {failed} failed page(s)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
