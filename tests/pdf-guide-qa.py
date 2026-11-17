"""Read and render the downloaded PDF for visual QA; this never authors a PDF."""
import argparse
import json
import shutil
import subprocess
from pathlib import Path

import pdfplumber
from PIL import Image, ImageDraw, ImageOps
from pypdf import PdfReader


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--output", type=Path, default=Path("build/test-results/pdf-guide"))
    parser.add_argument("--poppler", type=Path)
    args = parser.parse_args()
    source = args.pdf.resolve(strict=True)
    output = args.output.resolve()
    output.mkdir(parents=True, exist_ok=True)
    bundled = Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/Library/bin/pdftoppm.exe"
    poppler = args.poppler or shutil.which("pdftoppm") or (bundled if bundled.is_file() else None)
    if poppler is None:
        raise RuntimeError("Provide --poppler or put pdftoppm on PATH")
    reader = PdfReader(source)
    findings = {"file": str(source), "pages": len(reader.pages), "outside_page": [], "page_text": []}
    with pdfplumber.open(source) as document:
        for number, page in enumerate(document.pages, 1):
            text = page.extract_text() or ""
            findings["page_text"].append({"page": number, "characters": len(text), "text": text})
            for char in page.chars:
                if not char["text"].strip():
                    continue
                if char["x0"] < -1 or char["x1"] > page.width + 1 or char["top"] < -1 or char["bottom"] > page.height + 1:
                    findings["outside_page"].append({"page": number, "text": char["text"], "box": [char["x0"], char["top"], char["x1"], char["bottom"]]})
    (output / "text-and-layout.json").write_text(json.dumps(findings, indent=2, ensure_ascii=False), encoding="utf-8")
    # Replace only this tool's generated PNGs so a shorter revision cannot leave
    # stale pages in the visual review set.
    for pattern in ("page-*.png", "contact-*.png"):
        for generated in output.glob(pattern):
            generated.unlink()
    subprocess.run([str(poppler), "-png", "-scale-to", "1600", str(source), str(output / "page")], check=True)
    images = sorted(output.glob("page-*.png"), key=lambda item: int(item.stem.split("-")[-1]))
    if len(images) != len(reader.pages):
        raise AssertionError("Rendered image count does not match PDF page count")
    # Six-page sheets help find spacing problems; the full-size pages remain available.
    for start in range(0, len(images), 6):
        sheet = Image.new("RGB", (1100, 1640), "#dbe2e7")
        draw = ImageDraw.Draw(sheet)
        for slot, path in enumerate(images[start:start + 6]):
            with Image.open(path) as image:
                thumb = ImageOps.contain(image.convert("RGB"), (520, 500))
            left = (slot % 2) * 550 + (550 - thumb.width) // 2
            top = (slot // 2) * 540 + 28
            sheet.paste(thumb, (left, top))
            draw.text(((slot % 2) * 550 + 20, (slot // 2) * 540 + 8), "Page " + str(start + slot + 1), fill="#153243")
        sheet.save(output / ("contact-" + str(start // 6 + 1).zfill(2) + ".png"))
    if findings["outside_page"]:
        raise AssertionError(str(len(findings["outside_page"])) + " text characters extend outside page bounds; inspect text-and-layout.json")
    print(f"PASS: {len(reader.pages)} pages parsed and rendered; no text outside page bounds. Review PNGs in {output}.")


if __name__ == "__main__":
    main()
