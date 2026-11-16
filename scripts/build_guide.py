"""Build the offline HTML guide from its editable Excel workbook and local assets."""
import base64
import html
import json
import posixpath
import re
import tempfile
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
GUIDE = ROOT / "guide"
SRC = ROOT / "src"
NS = {"s": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
ASSETS = ("logo.png", "terrain.svg", "endpoint.svg", "software.svg", "vulnerability.svg")


def strings(node):
    if node is None:
        return ""
    # Concatenate normal or rich inline text, excluding phonetic annotations.
    return "".join(t.text or "" for t in node.findall("s:t", NS) + node.findall("s:r/s:t", NS))


def read_copy(workbook):
    with zipfile.ZipFile(workbook) as book:
        doc = ET.fromstring(book.read("xl/workbook.xml"))
        sheet = next((s for s in doc.findall("s:sheets/s:sheet", NS) if s.get("name") == "Guide text"), None)
        if sheet is None:
            raise ValueError("Missing 'Guide text' worksheet")
        rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
        def target(rel):
            if rel.get("TargetMode") == "External":
                raise ValueError("Workbook data must be stored inside the XLSX")
            name = rel.attrib["Target"]
            return posixpath.normpath(name.lstrip("/") if name.startswith("/") else "xl/" + name)
        sheet_name = target(next(r for r in rels if r.get("Id") == sheet.attrib["{" + REL + "}id"]))
        shared_rel = next((r for r in rels if r.get("Type", "").endswith("/sharedStrings")), None)
        shared = [strings(si) for si in ET.fromstring(book.read(target(shared_rel)))] if shared_rel is not None else []
        entries = {}
        header = False
        for row in ET.fromstring(book.read(sheet_name)).findall("s:sheetData/s:row", NS):
            cells = {}
            for cell in row.findall("s:c", NS):
                column = re.sub(r"[0-9]", "", cell.attrib["r"])
                value = cell.findtext("s:v", "", NS)
                if cell.get("t") == "s":
                    value = shared[int(value)]
                elif cell.get("t") == "inlineStr":
                    value = strings(cell.find("s:is", NS))
                cells[column] = value
            key, text = cells.get("A", ""), cells.get("C", "")
            if not header:
                header = key == "Key" and text == "Text"
            elif key or text:
                if not key or not text.strip() or key in entries:
                    raise ValueError(f"Invalid or duplicate text key in row {row.get('r')}: {key}")
                entries[key] = text
        if not header:
            raise ValueError("Expected Key in column A and Text in column C")
        return entries


def encode(data):
    return base64.b64encode(data).decode("ascii")


def script_json(value):
    return json.dumps(value, ensure_ascii=False, separators=(",", ":")).replace("<", r"\u003c")


def read(path):
    return path.read_text(encoding="utf-8")


def build():
    workbook = GUIDE / "TSAAT-Guide-Text.xlsx"
    copy = read_copy(workbook)
    keys = json.loads(read(SRC / "text-keys.json"))
    missing = set(keys) - copy.keys()
    if missing:
        raise ValueError("Required text keys missing: " + ", ".join(sorted(missing)))
    media = {}
    for filename in ASSETS:
        asset = ROOT / "assets" / filename
        mime = "image/png" if asset.suffix == ".png" else "image/svg+xml"
        media[asset.stem] = f"data:{mime};base64,{encode(asset.read_bytes())}"
    vendor = ROOT / "vendor" / "jszip"
    notice = read(vendor / "LICENSE.markdown").replace("*/", "* /")
    parts = {
        "TITLE": html.escape(copy["ui.browserTitle"]), "WAIT": html.escape(copy["ui.wait"]),
        "WARN": html.escape(copy["ui.dataWarning"]), "LOGO": media["logo"], "BOOK": encode(workbook.read_bytes()),
        "STRUCTURE": script_json(json.loads(read(SRC / "structure.json"))),
        "REQUIRED": script_json(keys), "MEDIA": script_json(media),
        "CSS": "\n".join(read(SRC / f) for f in ("guide.css", "examples.css", "training.css")),
        "JS": "\n".join(read(SRC / f) for f in ("site.js", "illustrations.js", "training.js", "interactions.js")),
        "ZIP": ("/* Library distribution notice\n" + notice + "\n*/\n" + read(vendor / "jszip.min.js")).replace("</script", r"<\/script"),
    }
    document = re.sub(r"__([A-Z]+)__", lambda m: parts[m[1]], read(SRC / "template.html"))
    target = GUIDE / "TSAAT-User-Guide.html"
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", dir=GUIDE, delete=False) as tmp:
        tmp.write(document)
    try:
        Path(tmp.name).replace(target)
    finally:
        Path(tmp.name).unlink(missing_ok=True)
    print(f"Built {target.name} with {len(copy)} workbook entries.")


if __name__ == "__main__":
    build()

