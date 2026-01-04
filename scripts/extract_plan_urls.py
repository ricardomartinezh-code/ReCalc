import csv
from pathlib import Path
import openpyxl

xlsx_path = Path(r"C:\Users\RicardoMartinezH\Downloads\OPP_ Portafolio C1 2026.xlsx")
out_path = Path(r"C:\Users\RicardoMartinezH\ReCalc\scripts\programs_plan_urls.csv")


def normalize_text(value: str) -> str:
    return (
        str(value or "")
        .lower()
        .encode("ascii", "ignore")
        .decode("ascii")
        .strip()
    )


def normalize_program_key(value: str) -> str:
    normalized = normalize_text(value)
    for prefix in (
        "licenciatura en ",
        "maestria en ",
        "ingenieria en ",
        "ingenieria ",
        "licenciatura ",
        "maestria ",
    ):
        if normalized.startswith(prefix):
            normalized = normalized[len(prefix) :]
            break
    return " ".join(normalized.split()).strip()


def to_title_case(value: str) -> str:
    return " ".join(word[:1].upper() + word[1:].lower() for word in str(value).split())


wb = openpyxl.load_workbook(xlsx_path, data_only=True)

program_links = {}

for sheet in wb.worksheets:
    for row in sheet.iter_rows():
        for cell in row:
            if not cell.value or not isinstance(cell.value, str):
                continue
            value = cell.value.strip()
            if not value:
                continue
            link = cell.hyperlink.target if cell.hyperlink else None
            if not link:
                continue
            key = normalize_program_key(value)
            if not key:
                continue
            if key in program_links:
                continue
            program_links[key] = (to_title_case(value), link)

rows = sorted(program_links.values(), key=lambda x: (x[0].lower(), x[1]))

out_path.parent.mkdir(parents=True, exist_ok=True)
with out_path.open("w", newline="", encoding="utf-8") as f:
    writer = csv.writer(f)
    writer.writerow(["programa", "plan_url"])
    writer.writerows(rows)

print(f"wrote {len(rows)} rows to {out_path}")
