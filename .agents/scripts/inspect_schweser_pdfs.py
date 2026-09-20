from pathlib import Path
import re

import fitz

ROOT = Path("/home/runner/workspace/.local/conversation-workspace/files/attached_assets")

for path in sorted(ROOT.glob("CFA_2027_Level_I_Schweser_Notes_Book_*.pdf")):
    doc = fitz.open(path)
    print(f"\n=== {path.name} | pages={doc.page_count} ===")
    for page_number, page in enumerate(doc):
        text = " ".join(page.get_text("text").split())
        if re.search(r"\bReading\s+\d+\b|\bContents\b|\bTable of Contents\b", text, re.I):
            print(f"{page_number + 1:4}: {text[:280]}")