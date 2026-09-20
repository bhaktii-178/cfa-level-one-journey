from pathlib import Path
import json
import re

import fitz

WORKSPACE = Path("/home/runner/workspace")
SOURCE_DIR = WORKSPACE / ".local/conversation-workspace/files/attached_assets"
OUTPUT_DIR = WORKSPACE / "artifacts/cfa-level-one-journey/public/schweser"
READING_CONTENT_DIR = OUTPUT_DIR / "readings"
RENDER_DIR = WORKSPACE / ".agents/outputs/schweser-pages"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
READING_CONTENT_DIR.mkdir(parents=True, exist_ok=True)
RENDER_DIR.mkdir(parents=True, exist_ok=True)

reading_pattern = re.compile(r"^\s*READING\s+(\d{1,3})\s*$", re.I)
front_matter_last_page = {1: 17, 2: 14, 3: 13, 4: 13}
entries = []

for source in sorted(SOURCE_DIR.glob("CFA_2027_Level_I_Schweser_Notes_Book_*.pdf")):
    book_match = re.search(r"Book_(\d+)_", source.name)
    book_number = int(book_match.group(1)) if book_match else 0
    output_name = f"book-{book_number}.pdf"
    output_path = OUTPUT_DIR / output_name
    if not output_path.exists():
        output_path.write_bytes(source.read_bytes())

    document = fitz.open(source)
    if book_number and not (RENDER_DIR / f"book-{book_number}-page-1.png").exists():
        pixmap = document[0].get_pixmap(matrix=fitz.Matrix(1.2, 1.2), alpha=False)
        pixmap.save(RENDER_DIR / f"book-{book_number}-page-1.png")

    starts = []
    for page_index, page in enumerate(document):
        # Contents pages repeat every reading number. Actual reading sections
        # begin after the front matter in each book.
        if page_index + 1 <= front_matter_last_page.get(book_number, 10):
            continue
        lines = [line.strip() for line in page.get_text("text").splitlines() if line.strip()]
        for line_index, line in enumerate(lines):
            match = reading_pattern.match(line)
            if not match:
                continue
            reading_number = int(match.group(1))
            if any(item["readingNumber"] == str(reading_number) for item in starts):
                continue
            title_parts = []
            for next_line in lines[line_index + 1:]:
                if re.match(r"^(MODULE|LOS|PROFESSOR’S NOTE|PROFESSOR'S NOTE|WARM-UP)\b", next_line, re.I) or len(title_parts) >= 3:
                    break
                title_parts.append(next_line)
            title = " ".join(title_parts).strip()
            starts.append({
                "readingNumber": str(reading_number),
                "title": title.title() if title else f"Reading {reading_number}",
                "page": page_index + 1,
            })
            break

    starts.sort(key=lambda item: item["page"])
    for index, start in enumerate(starts):
        end_page = starts[index + 1]["page"] - 1 if index + 1 < len(starts) else document.page_count
        entries.append({
            "readingNumber": start["readingNumber"],
            "title": start["title"],
            "book": book_number,
            "file": f"/schweser/{output_name}",
            "startPage": start["page"],
            "endPage": end_page,
            "pageCount": end_page - start["page"] + 1,
        })

entries.sort(key=lambda item: int(item["readingNumber"]))
(OUTPUT_DIR / "readings.json").write_text(json.dumps(entries, indent=2) + "\n")

documents = {}
for entry in entries:
    if entry["book"] not in documents:
        source = next(SOURCE_DIR.glob(f"CFA_2027_Level_I_Schweser_Notes_Book_{entry['book']}_*.pdf"))
        documents[entry["book"]] = fitz.open(source)
    document = documents[entry["book"]]
    pages = []
    for page_number in range(entry["startPage"], entry["endPage"] + 1):
        pages.append({
            "pageNumber": page_number,
            "text": document[page_number - 1].get_text("text").strip(),
        })
    (READING_CONTENT_DIR / f"{entry['readingNumber']}.json").write_text(
        json.dumps({"readingNumber": entry["readingNumber"], "pages": pages}, ensure_ascii=False)
        + "\n"
    )

print(f"Generated {len(entries)} reading ranges")
for entry in entries:
    print(
        f"Reading {entry['readingNumber']:>3} | Book {entry['book']} | "
        f"pages {entry['startPage']}-{entry['endPage']} | {entry['title']}"
    )