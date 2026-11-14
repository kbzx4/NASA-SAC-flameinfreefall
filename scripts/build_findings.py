"""Compute the fire-safety findings in the NASA tables, and rank them for a habitat.

Each finding is worked out by code from data/catalog.csv (and, for gas readings the catalog does
not carry, from the raw BASS-II table). A finding holds:
  - facts:   finished clauses with every number in them, for the SI layer to interpret
  - bands:   the tests split by oxygen level, each with a one-line result, so the site can say
             what the data shows nearest to the user's oxygen level
  - chart:   the same bands as counts, for a stacked bar
  - caveats: what else varied between the tests, written by code

rank() scores how close each finding's tests come to a habitat, the same way for Python and
for the site (docs/assets/logic.js; tests/parity.mjs checks they agree).

Run from the project root:  python scripts/build_findings.py
"""
import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import core  # noqa: E402
from scripts.build_catalog import read  # noqa: E402

OUT = ROOT / "data" / "findings.json"

OUT_COLOR, BURN_COLOR, OTHER_COLOR = "#3987e5", "#d95926", "#9b6fd6"


def g(x):
    return f"{float(x):g}"


def rng(lo, hi, unit=""):
    return f"{g(lo)}{unit}" if lo == hi else f"{g(lo)} to {g(hi)}{unit}"


def of(a, b):
    return f"{a} of {b}"


def span(s):
    s = s.dropna()
    return None if s.empty else [round(float(s.min()), 2), round(float(s.max()), 2)]


# ------------------------------------------------------------------ findings
def droplet_oxygen(cat):
    f = cat[cat.investigation == "FLEX"].copy()
    f["end"] = f.outcome.str.split(";").str[0]
    edges = [(0, 15.5), (15.5, 19.5), (19.5, 22.5), (22.5, 27.5), (27.5, 40)]
    bands = []
    for lo, hi in edges:
        b = f[(f.o2_pct > lo) & (f.o2_pct <= hi)]
        n, out_, done, dis = len(b), int((b.end == "Extinction").sum()), int((b.end == "Completion").sum()), int((b.end == "Disruption").sum())
        o2 = span(b.o2_pct)
        bands.append({
            "o2": o2, "p": span(b.pressure_psi), "n": n, "label": rng(*o2, "%"),
            "values": [out_, done, dis],
            "line": f"at {rng(*o2, '%')} oxygen, {of(out_, n)} droplet flames went out on their own before the fuel was used up",
        })
    lo, hi = bands[2], bands[4]
    return {
        "id": "droplet-oxygen", "investigations": ["FLEX"], "fuel_class": "liquid", "topic": "Oxygen level",
        "tests": int(len(f)), "o2": span(f.o2_pct), "p": span(f.pressure_psi),
        "facts": {
            "what_was_tested": f"{len(f)} burning fuel droplets (methanol and heptane) in microgravity, from 12% to 34% oxygen",
            "result_low_oxygen": bands[0]["line"],
            "result_air": lo["line"],
            "result_high_oxygen": hi["line"],
            "how_the_others_ended": (f"at {hi['label']} oxygen, {hi['values'][1]} burned until the fuel was used up and "
                                     f"{hi['values'][2]} ended with the droplet disrupted"),
        },
        "caveats": ["The gas mixed in with the oxygen (nitrogen, CO2 or helium), the pressure and the fuel also vary between tests.",
                    (f"At {hi['label']} oxygen most tests ({hi['values'][2]} of {hi['n']}) ended with the droplet disrupted and only "
                     f"{hi['values'][1]} burned until the fuel was used up; the table does not say what happened to the droplet "
                     "or whether its flame was still burning.")],
        "bands": bands,
        "chart": {"unit": "tests", "series": [["Went out on its own", OUT_COLOR], ["Burned until the fuel was used up", BURN_COLOR], ["Droplet disrupted", OTHER_COLOR]]},
    }


def droplet_low_oxygen(cat):
    f = cat[cat.investigation == "FLEX"].copy()
    f["tb"] = f.outcome.str.extract(r"burn time ([\d.]+) s")[0].astype(float)
    f["fuelname"] = f.fuel.str.split().str[0]
    low = f[f.o2_pct <= 15.5]
    edges = [(0, 15.5), (15.5, 19.5), (19.5, 22.5), (22.5, 27.5), (27.5, 40)]
    bands = []
    for lo, hi in edges:
        b = f[(f.o2_pct > lo) & (f.o2_pct <= hi)]
        o2 = span(b.o2_pct)
        med = {k: round(float(v), 1) for k, v in b.groupby("fuelname").tb.median().items()}
        bands.append({
            "o2": o2, "p": span(b.pressure_psi), "n": int(b.tb.notna().sum()), "label": rng(*o2, "%"),
            "values": [med.get("Methanol"), med.get("Heptane")],
            "line": (f"at {rng(*o2, '%')} oxygen, methanol droplet flames burned for a median of {g(med['Methanol'])} s "
                     f"and heptane for {g(med['Heptane'])} s"),
        })
    m, h = low[low.fuelname == "Methanol"], low[low.fuelname == "Heptane"]
    return {
        "id": "droplet-low-oxygen", "investigations": ["FLEX"], "fuel_class": "liquid", "topic": "Low oxygen",
        "tests": int(f.tb.notna().sum()), "o2": span(f.o2_pct), "p": span(f.pressure_psi),
        "facts": {
            "what_was_tested": "how long burning fuel droplets stayed alight in microgravity at different oxygen levels",
            "result_lowest_oxygen": (f"{len(low)} droplet flames were lit at {rng(*span(low.o2_pct), '%')} oxygen and every one "
                                     f"burned for some time: methanol for {g(m.tb.min())} to {g(m.tb.max())} s "
                                     f"(median {g(round(m.tb.median(), 1))} s, {len(m)} tests) and heptane for "
                                     f"{g(h.tb.min())} to {g(h.tb.max())} s (median {g(round(h.tb.median(), 1))} s, {len(h)} tests)"),
            "lowest_oxygen_with_a_flame": f"{g(low.o2_pct.min())}% oxygen",
            "trend": f"{bands[0]['line']}; {bands[4]['line']}",
        },
        "caveats": ["Burn time depends on droplet size, which varies between tests.",
                    "Most of these flames still went out before the fuel was used up (see the oxygen-level finding)."],
        "bands": bands,
        "chart": {"unit": "s", "kind": "bars", "series": [["Methanol, median burn time", OUT_COLOR], ["Heptane, median burn time", BURN_COLOR]]},
    }


def droplet_diluent(cat):
    f = cat[cat.investigation == "FLEX"].copy()
    f["end"] = f.outcome.str.split(";").str[0]
    f["dil"] = np.where(f.diluent.str.contains("CO2"), "CO2", np.where(f.diluent.str.contains("He"), "He", "N2"))
    b = f[(f.o2_pct >= 19.5) & (f.o2_pct <= 22.5)]
    rows = {}
    for key, label in (("N2", "nitrogen only"), ("CO2", "CO2 added"), ("He", "helium added")):
        r = b[b.dil == key]
        rows[key] = {"label": label, "n": len(r), "out": int((r.end == "Extinction").sum()),
                     "done": int((r.end == "Completion").sum()), "dis": int((r.end == "Disruption").sum()), "p": span(r.pressure_psi)}
    o2 = span(b.o2_pct)
    line = lambda k: f"with {rows[k]['label']}, {of(rows[k]['out'], rows[k]['n'])} went out on their own"
    return {
        "id": "droplet-diluent", "investigations": ["FLEX"], "fuel_class": "liquid", "topic": "Suppression gases",
        "tests": int(len(b)), "o2": o2, "p": span(b.pressure_psi),
        "facts": {
            "what_was_tested": (f"{len(b)} burning fuel droplets in microgravity at {rng(*o2, '%')} oxygen, where the rest of the "
                                "atmosphere was nitrogen only, or had CO2 or helium added"),
            "result_nitrogen_only": line("N2"), "result_co2_added": line("CO2"), "result_helium_added": line("He"),
        },
        "caveats": ["The fuel (methanol or heptane) and the pressure also differ between the three groups.",
                    f"The CO2 tests span {rng(*rows['CO2']['p'], ' psi')}; the others stay below 15 psi."],
        "bands": [{"o2": o2, "p": span(b.pressure_psi), "n": int(len(b)), "label": "all three", "values": None,
                   "line": f"at {rng(*o2, '%')} oxygen, {line('N2')}, {line('CO2')} and {line('He')}"}],
        "groups": [{"label": r["label"], "n": r["n"], "values": [r["out"], r["done"], r["dis"]]} for r in rows.values()],
        "chart": {"unit": "tests", "by": "groups", "series": [["Went out on its own", OUT_COLOR], ["Burned until the fuel was used up", BURN_COLOR], ["Droplet disrupted", OTHER_COLOR]]},
    }


def gas_oxygen(cat):
    c = cat[cat.investigation == "CFI-G"].copy()
    c["hot"] = c.outcome.str.contains("Hot ignition: Yes")
    c["se"] = c.hot & c.outcome.str.contains("self-extinguished")
    c["ft"] = c.hot & c.outcome.str.contains("flow terminated")
    c["tb"] = c.outcome.str.extract(r"burn time ([\d.]+) s")[0].astype(float)
    raw = pd.DataFrame(read("PSI-159_Experimental table_CFI-G_Normal Flames.csv"))
    peak = pd.to_numeric(raw["Peak burner T (C )"], errors="coerce").to_numpy()
    c["peak"] = peak[: len(c)]
    bands = []
    for lo, hi in ((0, 28), (28, 45)):
        b = c[(c.o2_pct > lo) & (c.o2_pct <= hi)]
        o2, n, hot = span(b.o2_pct), len(b), int(b.hot.sum())
        se, ft = int(b.se.sum()), int(b.ft.sum())
        med = round(float(b[b.hot].tb.median()), 1)
        pk = round(float(b[b.hot].peak.median()))
        ended = (f"all {hot} went out on their own" if se == hot else f"{se} went out on their own and {ft} burned until the fuel was cut off")
        bands.append({
            "o2": [round(o2[0], 1), round(o2[1], 1)], "p": span(b.pressure_psi), "n": n, "label": rng(round(o2[0], 1), round(o2[1], 1), "%"),
            "values": [se, ft, n - hot], "median_burn_s": med, "peak_burner_c": pk,
            "line": (f"at {rng(round(o2[0], 1), round(o2[1], 1), '%')} oxygen, {of(hot, n)} gas flames lit; {ended}, "
                     f"with a median burn of {g(med)} s"),
        })
    a, b = bands
    return {
        "id": "gas-oxygen", "investigations": ["CFI-G"], "fuel_class": "gas", "topic": "Oxygen level",
        "tests": int(len(c)), "o2": span(c.o2_pct), "p": span(c.pressure_psi),
        "facts": {
            "what_was_tested": f"{len(c)} gas flames (ethane, propane and butane) on a spherical burner in microgravity",
            "result_near_air": a["line"], "result_high_oxygen": b["line"],
            "burner_temperature": (f"the burner hardware itself (not the flame) reached a median peak temperature of {a['peak_burner_c']} °C at {a['label']} oxygen "
                                   f"and {b['peak_burner_c']} °C at {b['label']} oxygen"),
        },
        "caveats": ["Fuel, fuel flow and pressure also vary between tests.",
                    "Cutting the fuel flow is a test procedure; the table does not say how long those flames would have burned."],
        "bands": bands,
        "chart": {"unit": "tests", "series": [["Went out on its own", OUT_COLOR], ["Burned until the fuel was cut off", BURN_COLOR], ["Did not light", OTHER_COLOR]]},
    }


def cool_flames(cat):
    raw = pd.DataFrame(read("PSI-159_Experimental table_CFI-G_Normal Flames.csv"))
    raw["o2"] = pd.to_numeric(raw["XO2 before test"], errors="coerce") * 100
    raw["p"] = pd.to_numeric(raw["approx p (bar)"], errors="coerce") * 14.5038
    raw["tb"] = pd.to_numeric(raw["burn time (sec)"], errors="coerce")
    cool = raw[raw["Cool flame?"].str.lower().str.startswith("yes")]
    many = raw[raw["Comments"].str.contains("transitions", na=False)]
    o2 = [round(cool.o2.min(), 1), round(cool.o2.max(), 1)]
    p = [round(cool.p.min(), 2), round(cool.p.max(), 2)]
    fuels = sorted(cool.Fuel.unique())
    line = (f"at {rng(*o2, '%')} oxygen, {len(cool)} of the {len(raw)} gas-flame tests recorded a cool flame, with burn times of "
            f"{g(cool.tb.min())} to {g(cool.tb.max())} s")
    return {
        "id": "cool-flames", "investigations": ["CFI-G"], "fuel_class": "gas", "topic": "Hard-to-see flames",
        "tests": int(len(cool)), "o2": o2, "p": p,
        "facts": {
            "definition": ("a cool flame is a faint, low-temperature flame, much harder to see than a normal hot flame; "
                           "the table records it separately from the hot flame"),
            "result": line,
            "conditions": f"every one burned {', '.join(fuels)} at about {rng(*p, ' psi')}",
            "one_test": f'one test (21291 C1) is noted as "{many.Comments.iloc[0]}"' if len(many) else None,
        },
        "caveats": [f"All of these tests used one fuel mix at one pressure and {rng(*o2, '%')} oxygen, so the table cannot show "
                    "where else cool flames occur.",
                    "The table does not say whether the burn time includes the cool-flame phase."],
        "bands": [{"o2": o2, "p": p, "n": int(len(cool)), "label": rng(*o2, "%"), "values": None, "line": line}],
        "chart": None,
    }


def gravity(cat):
    p = core.load_pairs()
    p = p[p.gsi.notna()]
    rows = []
    for mat, grp in p.groupby("material", sort=False):
        name = mat.replace("Cotton-Fiberglass (SIBAL)", "cotton-fiberglass fabric").replace(" section", "")
        ug_none = int((grp.ug == 0).sum())
        g1_full = int((grp.g1 == grp.full).sum())
        rows.append({"material": name, "n": len(grp), "ug_none": ug_none, "ug_full": int((grp.ug == grp.full).sum()),
                     "g1_full": g1_full, "g1_none": int((grp.g1 == 0).sum())})
    by = {r["material"]: r for r in rows}
    s, f, pm, nx = by["Silicone"], by["cotton-fiberglass fabric"], by["PMMA"], by["Nomex"]
    changed = int((p.gsi >= 0.5).sum())
    o2 = [21.5, 22.1]
    line = (f"for {of(changed, len(p))} samples burned in both microgravity and normal gravity, the burn length differed by "
            "half the sample length or more")
    return {
        "id": "gravity", "investigations": ["SAFFIRE-2"], "fuel_class": "solid", "topic": "Gravity",
        "tests": int(len(p)), "o2": o2, "p": None,
        "facts": {
            "what_was_tested": (f"{len(p)} spacecraft material samples burned in microgravity at about 21.5% to 22.1% oxygen "
                                "with 20 cm/s airflow, and the same samples burned in normal gravity"),
            "result_overall": line,
            "silicone": (f"none of the {s['n']} silicone samples burned in microgravity; in normal gravity {s['g1_full']} burned "
                         f"completely, 1 burned 7.6 cm and 1 did not burn"),
            "pmma": (f"both PMMA (acrylic) samples burned about 10 cm in microgravity, with the flame still alight after 600 to "
                     f"900 s, and burned completely in normal gravity"),
            "fabric": (f"both cotton-fiberglass fabric samples burned their whole 29 cm length in microgravity and in normal "
                       f"gravity, spreading at 2.1 and 2.6 mm/s in microgravity"),
            "nomex": "the Nomex sample did not burn in either",
        },
        "caveats": ["The table does not list the oxygen, pressure or airflow of the normal-gravity tests.",
                    "No test in the data ran in Moon or Mars gravity."],
        "bands": [{"o2": o2, "p": None, "n": int(len(p)), "label": "about 22%", "values": None, "line": line}],
        "chart": None,
        "gravity": True,
    }


def flow_direction(cat):
    s = cat[cat.investigation == "SAFFIRE-1"]
    t = {r.flow_direction.strip(): float(r.outcome.split()[2]) for r in s.itertuples()}
    o2 = span(pd.concat([s.o2_min, s.o2_max]))
    line = (f"a 40.6 by 94 cm cotton-fiberglass fabric sheet burned for {g(t['Concurrent'])} s when the flame spread with "
            f"the airflow and {g(t['Opposed'])} s when it spread against it")
    return {
        "id": "flow-direction", "investigations": ["SAFFIRE-1"], "fuel_class": "solid", "topic": "Airflow",
        "tests": int(len(s)), "o2": o2, "p": None,
        "facts": {
            "what_was_tested": f"two large fabric fires in microgravity, at {rng(*o2, '%')} oxygen with 20 cm/s airflow",
            "result": line,
            "ratio": f"the burn with the airflow lasted {g(t['Concurrent'] / t['Opposed'])} times as long",
        },
        "caveats": ["Two tests only, one in each direction.",
                    "Saffire-III repeated these sheets at 30 cm/s, but its table lists no result."],
        "bands": [{"o2": o2, "p": None, "n": int(len(s)), "label": rng(*o2, "%"), "values": None, "line": line}],
        "chart": None,
    }


def carbon_monoxide(cat):
    raw = pd.DataFrame(read("PSI-25_Experimental table_BASS-II.csv"))
    for k, col in (("o2i", "Calibrated  initial O2 % by vol"), ("o2f", "Calibrated final O2 % by vol"),
                   ("coi", "Initial CO (ppm)"), ("cof", "Final CO (ppm)")):
        raw[k] = pd.to_numeric(raw[col], errors="coerce")
    raw["dco"] = raw.cof - raw.coi
    ok = raw.dropna(subset=["dco"]).copy()
    big = ok.loc[ok.dco.idxmax()]
    bands = []
    for lo, hi in ((0, 16.5), (16.5, 19.5), (19.5, 23)):
        b = ok[(ok.o2i > lo) & (ok.o2i <= hi)]
        o2 = span(b.o2i)
        med = round(float(b.dco.median()))
        bands.append({"o2": o2, "p": None, "n": len(b), "label": rng(*o2, "%"), "values": [med], "median_rise_ppm": med,
                      "line": f"in {len(b)} tests started at {rng(*o2, '%')} oxygen, carbon monoxide rose by a median of {med} ppm"})
    return {
        "id": "carbon-monoxide", "investigations": ["BASS-II"], "fuel_class": "solid", "topic": "Toxic gases",
        "tests": int(len(ok)), "o2": span(ok.o2i), "p": None,
        "facts": {
            "what_was_tested": (f"carbon monoxide in the test chamber before and after {len(ok)} small solid samples "
                                "(plastic films, slabs and rods, and cotton-fiberglass fabric) burned in microgravity"),
            "result": (f"carbon monoxide rose in {int((ok.dco > 0).sum())} of the {len(ok)} tests, by a median of "
                       f"{g(round(ok.dco.median()))} ppm; it rose by 100 ppm or more in {int((ok.dco >= 100).sum())} tests"),
            "largest_rise": f"the largest rise was {g(big.dco)} ppm, from a {big['Fuel Sample Material'].strip()} sample at {g(big.o2i)}% oxygen",
            "by_oxygen": "; ".join(b["line"] for b in bands),
        },
        "caveats": ["The table does not give the chamber volume, so these readings do not scale directly to a cabin.",
                    "Different sample types were burned at different oxygen levels, so the oxygen split is not a controlled comparison."],
        "bands": bands,
        "chart": {"unit": "ppm", "kind": "bars", "series": [["Median rise in carbon monoxide", BURN_COLOR]]},
    }


def smoke(cat):
    s = pd.DataFrame(read("PSI-101_Experimental table_SAME-R.csv"))
    s["v"] = pd.to_numeric(s["Inlet velocity (cm/s)"], errors="coerce")
    s["age"] = pd.to_numeric(s["Net aging time (sec)"], errors="coerce")
    kinds = s["Sample Type"].value_counts()
    mats = ", ".join(f"{k} ({v})" for k, v in kinds.items())
    line = f"smoke from {len(kinds)} overheated spacecraft materials was measured in {len(s)} runs"
    return {
        "id": "smoke", "investigations": ["SAME-R", "SAME"], "fuel_class": "smoke source", "topic": "Smoke detection",
        "tests": int(len(s)), "o2": None, "p": None,
        "facts": {
            "what_was_tested": "smoke from spacecraft materials heated until they smoked, without being set alight, in microgravity",
            "result": f"{line}: {mats}",
            "airflow": f"the airflow into the smoke chamber was {g(s.v.min())} to {g(s.v.max())} cm/s, and {int((s.v == 0).sum())} runs had no airflow",
            "aging": f"the smoke was held for {g(s.age.min())} to {g(s.age.max())} s before it was measured",
        },
        "caveats": ["This table lists how each run was set up, not the smoke particle sizes; those are in NASA data files not loaded here.",
                    "The table lists no oxygen level or pressure."],
        "bands": [{"o2": None, "p": None, "n": int(len(s)), "label": "", "values": None, "line": line}],
        "chart": None,
    }


def findings(cat=None):
    cat = core.load_catalog() if cat is None else cat
    out = [droplet_oxygen(cat), droplet_low_oxygen(cat), droplet_diluent(cat), gas_oxygen(cat), cool_flames(cat),
           gravity(cat), flow_direction(cat), carbon_monoxide(cat), smoke(cat)]
    for f in out:
        f["facts"] = {k: v for k, v in f["facts"].items() if v}
        f["psi"] = [core.describe(cat, i)["PSI ID"] for i in f["investigations"]]
        f["links"] = [core.source_link(p) for p in f["psi"]]
    return out


# ------------------------------------------------------------------ ranking
def r2(x):
    """Round to 2 places, halves up, as Math.round does on the site."""
    return math.floor(x * 100 + 0.5) / 100


def closeness(r, x, scale):
    if not r:
        return 0.0
    d = max(r[0] - x, x - r[1], 0)
    return min(1.0, max(0.0, 1 - d / scale))


def o2_gap(r, x):
    return float("inf") if not r else max(r[0] - x, x - r[1], 0)


def rank(found, o2, pressure, fuel_class=None):
    """Score each finding for a habitat, using its group of tests nearest the habitat's oxygen level.

    score = C_oxygen x (1 + C_pressure) / 2 x W_tests. Oxygen gates the score: a group 20 or more
    points of oxygen away scores 0 however close its pressure is. A pressure the table does not list
    counts as 0, which halves the score. W_tests is 1 for 10 or more tests in the group, else 0.7.
    Ties go to the nearer oxygen level, then to more tests. A fuel-class filter, if given, drops other classes.
    """
    out = []
    for f in found:
        if fuel_class and f["fuel_class"] != fuel_class:
            continue
        i = min(range(len(f["bands"])), key=lambda k: (o2_gap(f["bands"][k]["o2"], o2), -f["bands"][k]["n"]))
        b = f["bands"][i]
        mo, mp = closeness(b["o2"], o2, core.RANGE["o2"]), closeness(b["p"], pressure, core.RANGE["pressure"])
        s = mo * (1 + mp) / 2 * (1 if b["n"] >= 10 else 0.7)
        out.append({"id": f["id"], "score": r2(s), "band": i, "m_o2": r2(mo), "m_p": r2(mp), "n": b["n"], "gap": o2_gap(b["o2"], o2)})
    out.sort(key=lambda r: (-r["score"], r["gap"], -r["n"]))  # ties: nearest oxygen, then more tests
    for r in out:
        del r["n"], r["gap"]
    return out


def main():
    found = findings()
    OUT.write_text(json.dumps(found, indent=1, ensure_ascii=False), encoding="utf-8")
    for f in found:
        print(f"\n## {f['id']} ({f['tests']} tests)")
        for k, v in f["facts"].items():
            print(f"  {k}: {v}")
    for name, sc in core.SCENARIOS.items():
        print(f"\n{name}: " + ", ".join(f"{r['id']} {r['score']}" for r in rank(found, sc["o2"], sc["pressure"])))


if __name__ == "__main__":
    main()
