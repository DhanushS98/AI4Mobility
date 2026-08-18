# Documents

- `AI4Mobility_Project_Report.docx` — the main project report (51 pages)
- Rebuild with:
  ```bash
  NODE_PATH=$(npm root -g) node scripts/build_report.js   # first pass, lays out the pages
  python3 scripts/resolve_toc.py                          # reads the PDF back for page numbers
  NODE_PATH=$(npm root -g) node scripts/build_report.js   # second pass, writes them in
  ```
