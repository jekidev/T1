#!/usr/bin/env python3
"""Extract readable text from RAG documents using only stdlib plus optional PyMuPDF.

Supported directly: md, txt, text, json, csv, yaml, yml, docx.
PDF support uses PyMuPDF from requirements-knowledge.txt.
Legacy .doc support uses antiword when installed and otherwise returns no text.
"""
from __future__ import annotations

import argparse
import html
import json
import re
import subprocess
import sys
import zipfile
from pathlib import Path
from xml.etree import ElementTree

TEXT_EXTENSIONS = {".md", ".txt", ".text", ".json", ".csv", ".yaml", ".yml"}


def normalize(value: str) -> str:
    value = value.replace("\x00", " ")
    value = re.sub(r"[ \t]+", " ", value)
    value = re.sub(r"\n{3,}", "\n\n", value)
    return value.strip()


def extract_docx(path: Path) -> str:
    with zipfile.ZipFile(path) as archive:
        raw = archive.read("word/document.xml")
    root = ElementTree.fromstring(raw)
    parts: list[str] = []
    for element in root.iter():
        tag = element.tag.rsplit("}", 1)[-1]
        if tag == "t" and element.text:
            parts.append(element.text)
        elif tag in {"p", "br", "tab"}:
            parts.append("\n" if tag != "tab" else "\t")
    return normalize(html.unescape("".join(parts)))


def extract_pdf(path: Path) -> str:
    try:
        import fitz  # type: ignore
    except Exception as exc:
        raise RuntimeError("PDF extraction requires PyMuPDF: pip install -r requirements-knowledge.txt") from exc
    document = fitz.open(path)
    return normalize("\n\n".join(page.get_text("text") for page in document))


def extract_doc(path: Path) -> str:
    try:
        completed = subprocess.run(
            ["antiword", str(path)],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=30,
        )
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return ""
    return normalize(completed.stdout.decode("utf-8", errors="replace"))


def extract(path: Path) -> str:
    extension = path.suffix.lower()
    if extension in TEXT_EXTENSIONS:
        return normalize(path.read_text(encoding="utf-8", errors="replace"))
    if extension == ".docx":
        return extract_docx(path)
    if extension == ".pdf":
        return extract_pdf(path)
    if extension == ".doc":
        return extract_doc(path)
    return ""


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    parser.add_argument("--max-chars", type=int, default=120_000)
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()
    path = Path(args.path).resolve()
    if not path.is_file():
        print(f"Document does not exist: {path}", file=sys.stderr)
        return 2
    try:
        text = extract(path)[: max(0, args.max_chars)]
    except Exception as exc:
        print(str(exc), file=sys.stderr)
        return 1
    if args.json:
        print(json.dumps({"path": str(path), "text": text}, ensure_ascii=False))
    else:
        sys.stdout.write(text)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
