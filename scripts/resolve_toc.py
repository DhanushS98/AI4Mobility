#!/usr/bin/env python3
"""
Resolve table-of-contents page numbers for the project report.

The report is generated twice: once to lay the pages out, and once with the
resolved numbers written into the contents list. This script is the step in
between — it reads the rendered PDF and works out which page each heading
starts on.

Two rules keep it honest:
  * a heading occupies its own short line, so prose containing the same word
    is not mistaken for the heading itself;
  * headings appear in order, so each search starts where the previous heading
    was found. That is what stops a word like "References" matching an earlier
    mention in the body text.

Usage:  python3 scripts/resolve_toc.py
"""
from __future__ import annotations

import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDF = ROOT / "docs" / "report" / "AI4Mobility_Project_Report.pdf"
SRC = ROOT / "scripts" / "build_report.js"
OUT = Path("/tmp/toc_pages.json")
SKIP = 3          # title page + the two contents pages


def norm(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()


def main() -> int:
    if not PDF.exists():
        print(f"{PDF} not found — build the report once first.")
        return 1

    text = subprocess.run(["pdftotext", "-layout", str(PDF), "-"],
                          capture_output=True, text=True, check=True).stdout
    pages = text.split("\f")

    src = SRC.read_text(encoding="utf-8")
    block = src[src.index("const TOC = ["):src.index("function tocParagraphs")]
    titles = re.findall(r"\['([^']+)',\s*\d\]", block)

    pmap: dict[str, int] = {}
    missing: list[str] = []
    floor = SKIP + 1          # headings appear in order; never search backwards

    for title in titles:
        nt = norm(title)
        hit = None
        for i in range(floor, len(pages) + 1):
            for line in pages[i - 1].splitlines():
                ln = line.strip()
                if norm(ln).startswith(nt) and len(ln) <= len(title) + 6:
                    hit = i
                    break
            if hit:
                break
        if hit:
            pmap[title] = hit - 1     # printed numbering excludes the title page
            floor = hit
        else:
            missing.append(title)

    OUT.write_text(json.dumps(pmap, indent=1), encoding="utf-8")
    print(f"resolved {len(pmap)}/{len(titles)} headings -> {OUT}")
    if missing:
        print("  unresolved:", ", ".join(missing))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
