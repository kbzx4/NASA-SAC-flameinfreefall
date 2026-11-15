"""Data loading and the two scores used by the dashboard.

GSI  (Gravity Sensitivity Index)   = |L_1g - L_ug| / L_sample
HFRI (Habitat Fire Relevance Index) = M_conditions x M_fuel x W_evidence

Both are descriptive. Neither predicts whether a material will burn.
"""
import re
from pathlib import Path

import numpy as np
import pandas as pd

DATA = Path(__file__).resolve().parent / "data"
PSI_HOME = "https://psi.nasa.gov"

# ---------------------------------------------------------------- scenarios
# o2 in % by volume, pressure in psi. Sources are listed in the app's Sources tab.
SCENARIOS = {
    "ISS cabin": {"o2": 21.0, "pressure": 14.7,
                  "note": "Sea-level air, as used on the ISS."},
    "Moon base / pressurized rover": {"o2": 30.0, "pressure": 10.2,
                                      "note": "Challenge statement: 30% O2 or more at 10.2 psi or less."},
    "Exploration atmosphere": {"o2": 34.0, "pressure": 8.2,
                               "note": "34% O2 at 8.2 psi, the figure used in NASA exploration-atmosphere studies."},
    "Spacesuit": {"o2": 100.0, "pressure": 4.3,
                  "note": "Challenge statement: 100% O2 at 4.3 psi."},
    "Custom": {"o2": 25.0, "pressure": 12.0, "note": "Set your own values."},
}

GRAVITY = {
    "Microgravity (orbit, transit)": "ug",
    "Moon (0.17 g)": "moon",
    "Mars (0.38 g)": "mars",
}

FUEL_CLASSES = {
    "Solid materials (fabric, plastic)": "solid",
    "Liquid fuels": "liquid",
    "Gaseous fuels": "gas",
    "Smoke detection": "smoke source",
}
RELATED = {frozenset(("solid", "smoke source")), frozenset(("liquid", "gas")),
           frozenset(("smoke source", "dust"))}

# Distance at which closeness reaches 0, per dimension.
RANGE = {"o2": 20.0, "pressure": 10.0, "flow": 30.0}
UNKNOWN = 0.0  # a dimension the PSI table does not list earns no credit: it cannot be checked


MATERIAL_RULES = [  # (text to look for in the PSI fuel cell, name shown in the app)
    ("pmma", "PMMA (acrylic)"),
    ("sibal", "Cotton-fiberglass fabric (SIBAL)"),
    ("cotton-fiberglass", "Cotton-fiberglass fabric (SIBAL)"),
    ("silicone", "Silicone"),
    ("nomex", "Nomex"),
    ("kapton", "Kapton"),
    ("teflon", "Teflon"),
    ("lampwick", "Lampwick"),
    ("pyrell", "Pyrell"),
    ("dibutyl", "Dibutyl phthalate"),
    ("japan wax", "Japan wax"),
    ("paraffin", "Paraffin wax"),
    ("parrafin", "Paraffin wax"),
    ("ultem", "Ultem"),
]


def tag_material(fuel_text):
    """Materials named in a PSI fuel cell. Empty if the cell names none (e.g. '1/4" clear rod')."""
    text = str(fuel_text).lower()
    found = []
    for needle, name in MATERIAL_RULES:
        if needle in text and name not in found:
            found.append(name)
    return "; ".join(found)


def load_catalog():
    return pd.read_csv(DATA / "catalog.csv")


def source_link(psi_id):
    """PSI record page. The four known DOIs redirect to this same address pattern."""
    return f"{PSI_HOME}/physci/repo/data/investigations/{psi_id}"


# -------------------------------------------------------------------- HFRI
def _closeness(lo, hi, x, scale):
    """1 when x is inside [lo, hi], falling linearly to 0 at `scale` away. NaN if unknown."""
    gap = np.maximum.reduce([lo - x, x - hi, np.zeros(len(lo))])
    return np.where(np.isnan(lo), np.nan, np.clip(1 - gap / scale, 0, 1))


def fuel_match(test_class, wanted):
    if test_class == wanted:
        return 1.0
    if frozenset((test_class, wanted)) in RELATED:
        return 0.5
    return 0.2


def score_tests(cat, o2, pressure, flow, fuel_class):
    """Per-test HFRI. 1g comparison rows are left out: PSI lists no conditions for them."""
    t = cat[cat["gravity"] != "1g"].copy()
    target = {"o2": o2, "pressure": pressure, "flow": flow}
    for dim, x in target.items():
        t[f"c_{dim}"] = _closeness(t[f"{dim}_min"].to_numpy(float),
                                   t[f"{dim}_max"].to_numpy(float), x, RANGE[dim])
    c = t[["c_o2", "c_pressure", "c_flow"]]
    t["known_dims"] = c.notna().sum(axis=1)
    t["m_conditions"] = c.fillna(UNKNOWN).mean(axis=1)
    t["m_fuel"] = t["fuel_class"].map(lambda k: fuel_match(k, fuel_class))
    t["w_evidence"] = np.where(t["row_level"] == "test", 1.0, 0.6)
    t["hfri"] = t["m_conditions"] * t["m_fuel"] * t["w_evidence"]
    return t


def _rng(lo, hi, unit):
    if pd.isna(lo):
        return "not listed"
    return f"{lo:g} {unit}" if lo == hi else f"{lo:g} to {hi:g} {unit}"


def rank_investigations(scored, o2, pressure, flow, fuel_class):
    rows = []
    for inv, g in scored.groupby("investigation", sort=False):
        best = g.loc[g["hfri"].idxmax()]
        fuel_word = {1.0: "same fuel class", 0.5: "related fuel class", 0.2: "different fuel class"}[best["m_fuel"]]
        parts = [f"{best['fuel_class'].capitalize()} ({fuel_word})"]
        for dim, label, unit, x in (("o2", "O2", "%", o2), ("pressure", "pressure", "psi", pressure),
                                    ("flow", "airflow", "cm/s", flow)):
            lo, hi = g[f"{dim}_min"].min(), g[f"{dim}_max"].max()
            if pd.isna(lo):
                parts.append(f"{label} not listed")
            elif lo <= x <= hi:
                parts.append(f"{label} range {_rng(lo, hi, unit)} includes your {x:g}")
            else:
                parts.append(f"{label} range {_rng(lo, hi, unit)} misses your {x:g}")
        if best["w_evidence"] < 1:
            parts.append("summary table only")
        rows.append({
            "Investigation": inv,
            "HFRI": round(float(best["hfri"]), 2),
            "Why": "; ".join(parts) + ".",
            "Tests": len(g),
            "Tests with HFRI of 0.7 or more": int((g["hfri"] >= 0.7).sum()),
            "Closest test": str(best["test_id"]),
            "PSI ID": best["psi_id"],
            "Source": source_link(best["psi_id"]),
        })
    out = pd.DataFrame(rows).sort_values(["HFRI", "Tests with HFRI of 0.7 or more"], ascending=False)
    out.insert(0, "Rank", range(1, len(out) + 1))
    return out.reset_index(drop=True)


# -------------------------------------------------------------- comparison
def describe(cat, inv):
    """NASA's suggested attributes for one investigation, read from the catalog only."""
    g = cat[(cat["investigation"] == inv) & (cat["gravity"] != "1g")]
    fuels = g["fuel"].dropna().unique()
    varied = []
    for col, label in (("fuel", "fuel or sample"), ("o2_raw", "oxygen"), ("pressure_raw", "pressure"),
                       ("diluent", "diluent gas"), ("flow_raw", "airflow or fan setting"),
                       ("flow_direction", "flow direction")):
        if g[col].nunique(dropna=True) > 1:
            varied.append(label)
    return {
        "PSI ID": g["psi_id"].iloc[0],
        "Rows in PSI table": f"{len(g)} ({g['row_level'].iloc[0]})",
        "Kind of test": KIND_OF_TEST[g["fuel_class"].iloc[0]],
        "Fuel class": g["fuel_class"].iloc[0],
        "Fuels or samples": (f"{len(fuels)} distinct descriptions in the table, for example: {fuels[0]}"
                             if len(fuels) > 1 else str(fuels[0])),
        "Oxygen": (f'none in the surrounding gas; {_rng(g["o2_supply_pct"].min(), g["o2_supply_pct"].max(), "%")} oxygen supplied from the burner (inverse flames)'
                   if "o2_supply_pct" in g and g["o2_min"].isna().all() and g["o2_supply_pct"].notna().any()
                   else _rng(g["o2_min"].min(), g["o2_max"].max(), "%")),
        "Pressure": _rng(g["pressure_min"].min(), g["pressure_max"].max(), "psi"),
        "Airflow": ("a fan setting is listed, but no air speed in cm/s"
                    if g["flow_min"].isna().all() and g["flow_raw"].notna().any()
                    else _rng(g["flow_min"].min(), g["flow_max"].max(), "cm/s")),
        "What varied between tests": ", ".join(varied) if varied else "nothing listed in the table",
        "Sensors named in the table": "; ".join(g["sensors"].dropna().unique()) or "not listed",
        "Gravity": "microgravity" + (", with a 1g comparison" if inv == "SAFFIRE-2" else ""),
    }


KIND_OF_TEST = {
    "solid": "Flame test on solid samples",
    "liquid": "Flame test on liquid fuel droplets",
    "gas": "Flame test on gas-fuelled burner flames",
    "smoke source": "Smoke-particle measurement from overheated materials; nothing was set alight",
    "dust": "Dust-particle measurement; nothing was burned",
}


# ----------------------------------------------------- gravity bound (GSI)
def _length(raw, full):
    """Burn length in cm from the source text. Returns (value, approximate?)."""
    if not isinstance(raw, str) or not raw.strip():
        return None, False
    if "complete" in raw.lower():
        return full, False  # "Complete" is plotted as the full sample length
    m = re.search(r"\d+\.?\d*", raw)
    return (float(m.group()), "~" in raw) if m else (None, False)


def load_pairs():
    """Saffire-II samples with a microgravity and a 1g burn length each."""
    src = pd.read_csv(DATA / "saffire2_pairs.csv")
    rows = []
    for r in src.to_dict("records"):
        base = {"sample": r["sample"], "material": r["material"], "thickness": r["thickness_raw"],
                "direction": r["flow_direction"], "o2_raw": r["o2_raw"], "flow_raw": r["flow_raw"],
                "ug_raw": r["ug_burn_length_raw"], "g1_raw": r["g1_burn_length_raw"],
                "ug_spread": r["ug_spread_raw"], "g1_spread": r["g1_spread_raw"]}
        if r["sample"] == "2-7":
            # Composite sample: 5 cm of PMMA then 24 cm of Nomex. Source note 2 says the PMMA
            # was consumed and the Nomex did not ignite. The 1g column covers the Nomex only.
            rows.append({**base, "sample": "2-7a", "material": "PMMA section", "thickness": "0.85 mm",
                         "full": 5.0, "ug": 5.0, "g1": None,
                         "ug_raw": "5 cm (PMMA section, completely consumed)", "g1_raw": None,
                         "ug_spread": None, "g1_spread": None})
            rows.append({**base, "sample": "2-7b", "material": "Nomex section", "thickness": "0.37 mm",
                         "full": 24.0, "ug": 0.0, "g1": 0.0,
                         "ug_raw": "0 (Nomex section, not ignited)", "g1_raw": "~ 0 (Nomex)"})
            continue
        full = float(re.search(r"\d+\.?\d*", r["sample_length_raw"]).group())
        ug, _ = _length(r["ug_burn_length_raw"], full)
        g1, _ = _length(r["g1_burn_length_raw"], full)
        rows.append({**base, "full": full, "ug": ug, "g1": g1})
    p = pd.DataFrame(rows)
    p["gsi"] = (p["g1"] - p["ug"]).abs() / p["full"]
    p["label"] = (p["sample"] + " · " + p["material"] + " · " + p["thickness"]
                  + np.where(p["direction"].str.strip() == "Opposed", " · opposed flow", ""))
    return p
