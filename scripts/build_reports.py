"""Read the result tables hand-copied from NASA technical reports (data/reports/*.csv) for the site.

These tables are not in NASA's PSI database. Each row was transcribed (by Claude, the SI coding assistant) from a NASA report on the
NASA Technical Reports Server (NTRS) and names its source, table and page. They are kept apart from
data/catalog.csv, so the PSI findings, models and SI texts do not depend on them.

Checks run here stop the build if a copied number does not agree with the report:
- partial gravity: the oxygen margins the report printed are recomputed from the copied limits;
- every row names a source that is in sources.csv.

Run from the project root:  python scripts/build_reports.py   (build_site.py also calls reports())
"""
import csv
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DIR = ROOT / "data" / "reports"
KPA_TO_PSI = 14.6959 / 101.325
ATM_TO_PSI = 14.6959


def read(name):
    with open(DIR / name, newline="", encoding="utf-8") as f:
        return list(csv.DictReader(f))


def num(text):
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def limit(text):
    """A threshold cell: a number, or a bound such as "<30", ">40" or "39*" (passed on 5 samples)."""
    t = (text or "").strip()
    star = t.endswith("*")
    t = t.rstrip("*").strip()
    if t.startswith("<"):
        return {"v": float(t[1:]), "bound": "below", "star": star}
    if t.startswith(">"):
        return {"v": float(t[1:]), "bound": "above", "star": star}
    return {"v": float(t), "bound": None, "star": star}


def reports():
    sources = {r["key"]: r for r in read("sources.csv")}

    def src(r):
        keys = [k.strip() for k in r["source"].split(";")]
        missing = [k for k in keys if k not in sources]
        assert not missing, f"unknown source {missing} in {r}"
        return keys

    saffire = []
    for r in read("saffire.csv"):
        p = num(r["pressure_kpa"])
        saffire.append({
            "id": r["test"], "flight": r["flight"], "material": r["material"],
            "length_cm": num(r["sample_length_cm"]), "flow_cm_s": num(r["air_flow_cm_s"]), "direction": r["flow_direction"],
            "kpa": p, "psi": round(p * KPA_TO_PSI, 3), "o2": num(r["o2_pct"]),
            "burn_s": num(r["burn_s"]), "heat_w": num(r["heat_w"]), "heat_kind": r["heat_kind"] or None,
            "heat_kj": num(r["total_heat_kj"]), "co2_ppm": num(r["co2_rise_ppm"]), "co2_mmhg": num(r["co2_rise_mmhg"]),
            "co_ppm": num(r["co_rise_ppm"]), "flame_cm": num(r["steady_flame_cm"]), "flame_max_cm": num(r["max_flame_cm"]),
            "outcome": r["outcome"], "src": src(r), "where": r["where"],
        })

    ssce = []
    for r in read("ssce.csv"):
        p = num(r["pressure_atm"])
        ssce.append({
            "id": r["mission"], "when": r["when"] or None, "material": r["fuel"], "thick_mm": num(r["thickness_mm"]),
            "o2": num(r["o2_pct"]), "atm": p, "psi": round(p * ATM_TO_PSI, 3), "spread": num(r["spread_cm_s"]),
            "outcome": r["outcome"], "src": src(r), "where": r["where"],
        })

    pg = []
    for r in read("partial_gravity.csv"):
        pg.append({"material": r["material"], "psia": num(r["pressure_psia"]), "gravity": r["gravity"], "g": num(r["g"]),
                   "uloi": num(r["uloi_pct"]), "moc": num(r["moc_pct"]), "printed_delta": num(r["delta_o2_printed"]),
                   "src": src(r), "where": r["where"]})
    # the report's oxygen margin: mean of the low-g limits minus mean of the 1g limits (its Eq. 1)
    for row in pg:
        if row["printed_delta"] is None:
            continue
        earth = next(x for x in pg if x["material"] == row["material"] and x["gravity"] == "Earth")
        delta = (row["uloi"] + row["moc"]) / 2 - (earth["uloi"] + earth["moc"]) / 2
        assert abs(delta - row["printed_delta"]) < 0.006, (row, delta)
        row["delta"] = round(delta, 2)

    wstf10 = []
    for r in read("wstf_10psi.csv"):
        wstf10.append({"material": r["material"], "category": r["category"], "uloi": limit(r["uloi_pct"]),
                       "moc": limit(r["moc_pct"]), "seen": r["observations"], "holder": r["holder"],
                       "src": src(r), "where": r["where"]})

    wstf_o2 = []
    for r in read("wstf_pure_oxygen.csv"):
        wstf_o2.append({"material": r["material"], "acronym": r["acronym"] or None, "composition": r["composition"],
                        "form": r["form"], "thick_in": num(r["thickness_in"]), "ulpi": num(r["ulpi_psia"]),
                        "mtp": num(r["mtp_psia"]), "uloi": num(r["uloi_pct"]), "moc": num(r["moc_pct"]),
                        "src": src(r), "where": r["where"]})

    return {
        "sources": [{"key": k, "citation": v["citation"], "ntrs": v["ntrs"], "url": v["url"], "used": v["used"]}
                    for k, v in sources.items()],
        "saffire": saffire, "ssce": ssce, "gravity": pg, "wstf10": wstf10, "wstfO2": wstf_o2,
    }


if __name__ == "__main__":
    r = reports()
    print({k: len(v) for k, v in r.items()})
