"""Write docs/assets/data.js for the static site, from data/catalog.csv and data/si_cache.json.

The bundle also carries "expected" results computed here in Python for each preset habitat.
tests/parity.mjs recomputes them with the site's JavaScript and fails if they differ.

Run from the project root:  python scripts/build_site.py
"""
import json
import shutil
import sys
from datetime import date
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import brief  # noqa: E402
import core  # noqa: E402
from scripts import build_findings, build_insights, build_reports, build_si  # noqa: E402

OUT = ROOT / "docs" / "assets"


def clean(v):
    return None if pd.isna(v) else v


def pair(lo, hi):
    return None if pd.isna(lo) else [float(lo), float(hi)]


def rows(cat):
    out = []
    for r in cat.to_dict("records"):
        out.append({
            "i": r["investigation"], "p": r["psi_id"], "l": r["row_level"], "t": str(r["test_id"]),
            "c": r["fuel_class"], "f": clean(r["fuel"]),
            "m": r["material"].split("; ") if isinstance(r["material"], str) else [],
            "o": pair(r["o2_min"], r["o2_max"]), "or": clean(r["o2_raw"]), "d": clean(r["diluent"]),
            "P": pair(r["pressure_min"], r["pressure_max"]), "Pr": clean(r["pressure_raw"]),
            "F": pair(r["flow_min"], r["flow_max"]), "Fr": clean(r["flow_raw"]),
            "dr": clean(r["flow_direction"]), "g": "1" if r["gravity"] == "1g" else "u",
            "out": clean(r["outcome"]), "s": clean(r["sensors"]), "n": clean(r["notes"]),
            "src": r["source_file"],
            **({"os": float(r["o2_supply_pct"])} if not pd.isna(r.get("o2_supply_pct")) else {}),
        })
    return out


def shown(entry, fields):
    """The part of a cached SI text the site shows, with what each check did."""
    if not entry:
        return None
    out = {f: entry.get(f, "") for f in fields}
    if out.get("headline"):
        out["headline"] = out["headline"].rstrip(".")  # headlines take no full stop
    return {**out, "model": entry["model"], "judge": entry.get("judge"),
            "total": entry["total"], "verified": entry["verified"], "dropped": len(entry["dropped"]),
            "judged_out": len(entry["judged_out"])}


def main():
    cat, pairs = core.load_catalog(), core.load_pairs()
    cache = json.loads(build_si.CACHE.read_text(encoding="utf-8")) if build_si.CACHE.exists() else {}
    si = {"material": {}, "atmosphere": {}, "investigation": {}}
    for kind, label, facts in build_si.jobs():
        hit = cache.get(build_si.key_of(kind, facts))
        if hit and hit.get("text"):
            si[kind][label] = {"text": hit["text"], "model": hit["model"], "total": hit["total"],
                               "verified": hit["verified"], "dropped": hit["dropped"],
                               "judge": hit.get("judge"), "judged_out": len(hit.get("judge_removed", []))}

    all_materials = brief.materials(cat)
    scenarios = [{"name": n, "o2": s["o2"], "pressure": s["pressure"], "note": s["note"]}
                 for n, s in core.SCENARIOS.items()]
    found = build_findings.findings(cat)
    texts, briefs = build_insights.load()
    expected = {}
    for s in scenarios:
        facts = brief.build_facts(cat, pairs, s["name"], s["o2"], s["pressure"], 10.0, "Moon (0.17 g)", all_materials)
        facts.pop("psi_ids")
        scored = core.score_tests(cat, s["o2"], s["pressure"], 10.0, "solid")
        rank = core.rank_investigations(scored, s["o2"], s["pressure"], 10.0, "solid")
        expected[s["name"]] = {
            "materials": facts["materials"], "atmosphere": facts["atmosphere"],
            "near": facts["materials_flame_tested_near"],
            "ranking": [[r["Investigation"], r["HFRI"], r["Why"]] for r in rank.to_dict("records")],
            "findings": build_findings.rank(found, s["o2"], s["pressure"]),
            "gaps": build_insights.gaps(s["o2"], s["pressure"], cat),
        }

    investigations = []
    for inv, g in cat.groupby("investigation", sort=False):
        investigations.append({
            "name": inv, "psi": g["psi_id"].iloc[0], "link": core.source_link(g["psi_id"].iloc[0]),
            "class": g["fuel_class"].iloc[0], "rows": int(len(g)), "file": g["source_file"].iloc[0],
            "attributes": core.describe(cat, inv), "si": si["investigation"].get(inv),
        })

    pp = pairs.copy()
    pp["mat"] = pp["material"].map(core.tag_material)
    pair_rows = [{k: clean(v) for k, v in r.items()} for r in pp.to_dict("records")]

    bundle = {
        "built": date.today().isoformat(),
        "near": brief.NEAR, "window": brief.WINDOW, "range": core.RANGE,
        "scenarios": scenarios, "gravity": list(core.GRAVITY),
        "fuelClasses": core.FUEL_CLASSES, "related": [sorted(x) for x in core.RELATED],
        "materials": all_materials, "investigations": investigations,
        "rows": rows(cat), "pairs": pair_rows,
        "si": {"material": si["material"], "atmosphere": si["atmosphere"]},
        "findings": [{**f, "si": shown(texts.get(f["id"]), ("headline", "found", "means", "limit"))} for f in found],
        "briefings": {k: shown(v, ("text",)) for k, v in briefs.items()},
        "replay": build_findings.replay(),
        "models": json.loads((ROOT / "data" / "models.json").read_text(encoding="utf-8")),
        "reports": build_reports.reports(),
        "expected": expected,
    }
    OUT.mkdir(parents=True, exist_ok=True)
    text = "window.FF=" + json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + ";\n"
    (OUT / "data.js").write_text(text, encoding="utf-8")
    shutil.copy(ROOT / "data" / "catalog.csv", OUT / "psi-combustion-catalog.csv")
    n_si = sum(len(v) for v in si.values()) + len(texts) + len(briefs)
    print(f"data.js: {len(text) / 1024:.0f} KB, {len(bundle['rows'])} rows, "
          f"{len(investigations)} investigations, {n_si} SI texts")


if __name__ == "__main__":
    main()
