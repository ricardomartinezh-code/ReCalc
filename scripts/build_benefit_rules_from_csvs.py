import csv
import json
import re
from pathlib import Path

LIC_PATH = Path(r"C:\Users\RicardoMartinezH\Downloads\Copia de  OPP _ Precios Enero 2026 - Licenciatura.csv")
LIC_ONLINE_PATH = Path(r"C:\Users\RicardoMartinezH\Downloads\Copia de  OPP _ Precios Enero 2026 - Lic. Online .csv")
BACH_PATH = Path(r"C:\Users\RicardoMartinezH\Downloads\Copia de  OPP _ Precios Enero 2026 - Bachillerato.csv")
OUTPUT_PATH = Path(r"C:\Users\RicardoMartinezH\ReCalc\scripts\benefit_rules.json")


def normalize_text(value: str) -> str:
    return (
        str(value or "")
        .strip()
        .lower()
        .encode("ascii", "ignore")
        .decode("ascii")
    )


def parse_percent(value: str | None) -> int | None:
    if value is None:
        return None
    match = re.search(r"\d+(\.\d+)?", str(value))
    if not match:
        return None
    return int(float(match.group(0)))


def normalize_modalidad(value: str | None) -> str:
    normalized = normalize_text(value or "")
    if not normalized:
        return "*"
    if "online" in normalized:
        return "online"
    if "mixt" in normalized or "ejecutiv" in normalized:
        return "mixta"
    if "presencial" in normalized or "escolar" in normalized:
        return "presencial"
    return "*"


def normalize_comment(value: str | None) -> str:
    if value is None:
        return ""
    normalized = normalize_text(value)
    if normalized in ("true", "false", "si", "no", "1", "0"):
        return ""
    return str(value).strip()


def should_apply(value: str | None) -> bool:
    if value is None:
        return False
    normalized = normalize_text(value)
    if not normalized:
        return False
    if normalized in ("false", "no", "0"):
        return False
    return True


def load_csv(path: Path):
    with path.open("r", newline="", encoding="utf-8", errors="replace") as f:
        return list(csv.reader(f))


def plantel_from_row(row):
    candidates = []
    if len(row) > 2:
        candidates.append(row[2])
    if len(row) > 8:
        candidates.append(row[8])
    for candidate in candidates:
        if candidate and normalize_text(candidate) not in ("plantel", ""):
            return str(candidate).strip()
    return ""


def add_rule(rules, *, linea, plantel, modalidad, porcentaje, comentario, plan="*"):
    if not plantel or porcentaje is None:
        return
    rules.append(
        {
            "lineaNegocio": linea,
            "plantel": [plantel],
            "modalidad": modalidad,
            "plan": str(plan),
            "activo": True,
            "porcentaje": porcentaje,
            "comentario": comentario,
        }
    )


def build_rules():
    rules = []

    for row in load_csv(LIC_PATH):
        plantel = plantel_from_row(row)
        if not plantel:
            continue
        lic_apply = row[12] if len(row) > 12 else ""
        lic_modalidad = row[13] if len(row) > 13 else ""
        lic_percent = row[14] if len(row) > 14 else ""
        if should_apply(lic_apply):
            add_rule(
                rules,
                linea="licenciatura",
                plantel=plantel,
                modalidad=normalize_modalidad(lic_modalidad),
                porcentaje=parse_percent(lic_percent),
                comentario=normalize_comment(lic_apply),
            )

        salud_apply = row[8] if len(row) > 8 else ""
        salud_modalidad = row[9] if len(row) > 9 else ""
        salud_percent = row[10] if len(row) > 10 else ""
        if should_apply(salud_apply):
            add_rule(
                rules,
                linea="salud",
                plantel=plantel,
                modalidad=normalize_modalidad(salud_modalidad),
                porcentaje=parse_percent(salud_percent),
                comentario=normalize_comment(salud_apply),
            )

    for row in load_csv(LIC_ONLINE_PATH):
        plantel = plantel_from_row(row)
        if not plantel:
            continue
        online_apply = row[12] if len(row) > 12 else ""
        online_modalidad = row[13] if len(row) > 13 else ""
        online_percent = row[14] if len(row) > 14 else ""
        if should_apply(online_apply):
            add_rule(
                rules,
                linea="licenciatura",
                plantel=plantel,
                modalidad=normalize_modalidad(online_modalidad),
                porcentaje=parse_percent(online_percent),
                comentario=normalize_comment(online_apply),
            )

    for row in load_csv(BACH_PATH):
        plantel = plantel_from_row(row)
        if not plantel:
            continue
        bach_apply = row[14] if len(row) > 14 else ""
        bach_comment = row[15] if len(row) > 15 else ""
        bach_modalidad = row[16] if len(row) > 16 else ""
        bach_percent = row[17] if len(row) > 17 else ""
        plan = "*"
        if len(row) > 10 and str(row[10]).strip():
            plan = "9"
        if len(row) > 4 and str(row[4]).strip():
            plan = "6"
        if should_apply(bach_apply):
            add_rule(
                rules,
                linea="preparatoria",
                plantel=plantel,
                modalidad=normalize_modalidad(bach_modalidad),
                porcentaje=parse_percent(bach_percent),
                comentario=normalize_comment(bach_comment) or normalize_comment(bach_apply),
                plan=plan,
            )

    return rules


if __name__ == "__main__":
    benefit_rules = build_rules()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(
        json.dumps({"rules": benefit_rules}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )
    print(f"Wrote {len(benefit_rules)} benefit rules to {OUTPUT_PATH}")
