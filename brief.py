"""Fire Evidence Brief: what the loaded PSI tables say about one habitat design.

Everything here is a count or a lookup on data/catalog.csv. Nothing is predicted.
"""
import html
from datetime import date

import pandas as pd

import core

NEAR = 2.0    # a flame test counts as "near" if its oxygen is within this many points
WINDOW = 3.0  # oxygen window used for the droplet and gas-flame counts

GRADES = {
    "near": "🟢 Flame-tested near your oxygen level",
    "far": "🟡 Flame-tested, but not near your oxygen level",
    "unlisted": "🟡 Flame-tested, oxygen not listed",
    "smoke": "🔵 Smoke tests only",
    "none": "⚪ No tests loaded",
}


def materials(cat):
    names = set()
    for cell in cat["material"].dropna():
        names.update(cell.split("; "))
    return sorted(names)


def _rows_for(cat, material):
    return cat[cat["material"].fillna("").map(lambda cell: material in cell.split("; "))]


def _span(lo, hi, unit=""):
    if pd.isna(lo):
        return None
    return f"{lo:g}{unit}" if lo == hi else f"{lo:g} to {hi:g}{unit}"


def material_evidence(cat, pairs, material, o2):
    mine = _rows_for(cat, material)
    flame = mine[(mine["fuel_class"] == "solid") & (mine["gravity"] != "1g")]
    smoke = mine[mine["fuel_class"] == "smoke source"]
    ev = {
        "material": material,
        "flame_tests": int(len(flame)),
        "flame_tests_by_investigation": {k: int(v) for k, v in flame["investigation"].value_counts().items()},
        "oxygen_tested_pct": None, "nearest_test": None, "oxygen_gap_points": None,
        "flame_tests_near": 0,
        "airflow_tested_cm_s": _span(flame["flow_min"].min(), flame["flow_max"].max()),
        "flame_tests_with_airflow": int(flame["flow_min"].notna().sum()),
        "pressure_tested_psi": _span(flame["pressure_min"].min(), flame["pressure_max"].max()),
        "smoke_tests": int(len(smoke)),
        "smoke_tests_by_investigation": {k: int(v) for k, v in smoke["investigation"].value_counts().items()},
        "smoke_airflow_cm_s": _span(smoke["flow_min"].min(), smoke["flow_max"].max()),
        "gravity_pairs": [],
    }
    with_o2 = flame.dropna(subset=["o2_min"])
    if len(with_o2):
        gap = pd.concat([with_o2["o2_min"] - o2, o2 - with_o2["o2_max"]], axis=1).max(axis=1).clip(lower=0)
        best = with_o2.loc[gap.idxmin()]
        ev["oxygen_tested_pct"] = _span(with_o2["o2_min"].min(), with_o2["o2_max"].max())
        ev["oxygen_gap_points"] = round(float(gap.min()), 1)
        ev["flame_tests_near"] = int((gap <= NEAR).sum())
        ev["nearest_test"] = {
            "investigation": best["investigation"], "psi_id": best["psi_id"], "test": str(best["test_id"]),
            "sample": best["fuel"], "oxygen_source_text": str(best["o2_raw"]),
            "side": "at your level" if gap.min() == 0 else ("below yours" if best["o2_max"] < o2 else "above yours"),
        }
    mat_pairs = pairs[pairs["material"].map(core.tag_material) == material].dropna(subset=["gsi"])
    for p in mat_pairs.itertuples():
        ev["gravity_pairs"].append({
            "sample": p.sample, "thickness": p.thickness, "gsi": round(float(p.gsi), 2),
            "microgravity_burn_length": p.ug_raw, "normal_gravity_burn_length": p.g1_raw,
        })
    if ev["flame_tests_near"]:
        ev["grade"] = "near"
    elif len(with_o2):
        ev["grade"] = "far"
    elif len(flame):
        ev["grade"] = "unlisted"
    elif len(smoke):
        ev["grade"] = "smoke"
    else:
        ev["grade"] = "none"
    return ev


def atmosphere_evidence(cat, o2):
    """Droplet (FLEX) and gas-flame (CFI-G) outcomes in tests near the habitat's oxygen level."""
    out = {"oxygen_window_points": WINDOW}
    flex = cat[(cat["investigation"] == "FLEX") & ((cat["o2_pct"] - o2).abs() <= WINDOW)]
    end = flex["outcome"].fillna("").str.split(";").str[0]
    dil = flex["diluent"].fillna("")
    out["droplets"] = {
        "investigation": "FLEX", "psi_id": "PSI-69", "tests": int(len(flex)),
        "flame_went_out_first": int((end == "Extinction").sum()),
        "burned_to_completion": int((end == "Completion").sum()),
        "droplet_disrupted": int((end == "Disruption").sum()),
        "tests_with_co2": int(dil.str.contains("CO2").sum()),
        "tests_with_helium": int(dil.str.contains("He").sum()),
        "pressure_psi": _span(flex["pressure_min"].min(), flex["pressure_max"].max()),
    }
    gas = cat[(cat["investigation"] == "CFI-G") & ((cat["o2_pct"] - o2).abs() <= WINDOW)]
    res = gas["outcome"].fillna("")
    out["gas_flames"] = {
        "investigation": "CFI-G", "psi_id": "PSI-159", "tests": int(len(gas)),
        "ignited": int(res.str.contains("Hot ignition: Yes").sum()),
        "went_out_on_their_own": int(res.str.contains("self-extinguished").sum()),
        "burned_until_fuel_was_cut": int(res.str.contains("flow terminated").sum()),
        "pressure_psi": _span(gas["pressure_min"].min(), gas["pressure_max"].max()),
    }
    return out


def build_facts(cat, pairs, name, o2, pressure, flow, gravity_label, chosen):
    mats = [material_evidence(cat, pairs, m, o2) for m in chosen]
    return {
        "habitat": {"scenario": name, "oxygen_pct": o2, "pressure_psi": pressure,
                    "airflow_cm_s": flow, "gravity": gravity_label},
        "near_means_within_oxygen_points": NEAR,
        "materials": mats,
        "materials_flame_tested_near": sum(m["grade"] == "near" for m in mats),
        "materials_selected": len(mats),
        "atmosphere": atmosphere_evidence(cat, o2),
        "partial_gravity_tests_loaded": 0,
        "psi_ids": dict(zip(cat["investigation"], cat["psi_id"])),
    }


# ------------------------------------------------------------- plain wording
def material_sentences(ev, o2, partial_gravity):
    s = []
    if ev["flame_tests"]:
        where = ", ".join(f"{n} in {inv}" for inv, n in ev["flame_tests_by_investigation"].items())
        s.append(f"{ev['flame_tests']} microgravity flame tests ({where}).")
        if ev["oxygen_tested_pct"]:
            n = ev["nearest_test"]
            if ev["oxygen_gap_points"] == 0:
                s.append(f"Oxygen tested: {ev['oxygen_tested_pct']}%, which includes your {o2:g}%. "
                         f"{ev['flame_tests_near']} tests are within {NEAR:g} points of it.")
            else:
                s.append(f"Oxygen tested: {ev['oxygen_tested_pct']}%. The nearest test is "
                         f"{ev['oxygen_gap_points']:g} points {n['side']} ({n['investigation']} test {n['test']}).")
        else:
            s.append("The PSI table lists no oxygen level for these tests.")
        s.append(f"Airflow: {ev['airflow_tested_cm_s']} cm/s, listed for {ev['flame_tests_with_airflow']} "
                 f"of the {ev['flame_tests']} tests." if ev["airflow_tested_cm_s"]
                 else "Airflow: not listed as a speed.")
        if not ev["pressure_tested_psi"]:
            s.append("Pressure: not listed.")
    else:
        s.append("No flame tests in the loaded tables.")
    if ev["gravity_pairs"]:
        g = [p["gsi"] for p in ev["gravity_pairs"]]
        rng = f"{min(g):.2f}" if min(g) == max(g) else f"{min(g):.2f} to {max(g):.2f}"
        verdict = ("microgravity and 1g agree" if max(g) == 0 else
                   "gravity changed the burn length" if max(g) < 0.5 else
                   "gravity changed the outcome for at least one sample")
        s.append(f"Gravity: {len(g)} Saffire-II sample{'s' if len(g) > 1 else ''} with a 1g comparison, "
                 f"GSI {rng}; {verdict}.")
    elif partial_gravity:
        s.append("Gravity: no 1g comparison loaded, so nothing bounds partial gravity for this material.")
    if ev["smoke_tests"]:
        where = ", ".join(f"{n} in {inv}" for inv, n in ev["smoke_tests_by_investigation"].items())
        s.append(f"Smoke: {ev['smoke_tests']} smoke-particle tests ({where})"
                 + (f", airflow {ev['smoke_airflow_cm_s']} cm/s." if ev["smoke_airflow_cm_s"] else "."))
    return s


def atmosphere_sentences(atm, o2):
    d, g = atm["droplets"], atm["gas_flames"]
    w = atm["oxygen_window_points"]
    out = {}
    if d["tests"]:
        out["Liquid droplets (FLEX)"] = (
            f"{d['tests']} droplet tests within {w:g} points of {o2:g}% oxygen, at {d['pressure_psi']} psi. "
            f"In {d['flame_went_out_first']} the flame went out before the droplet was used up, "
            f"{d['burned_to_completion']} burned to completion and {d['droplet_disrupted']} were disrupted. "
            f"{d['tests_with_co2']} had CO2 in the atmosphere and {d['tests_with_helium']} had helium.")
    else:
        out["Liquid droplets (FLEX)"] = f"No droplet tests within {w:g} points of {o2:g}% oxygen."
    if g["tests"]:
        out["Gas flames (CFI-G)"] = (
            f"{g['tests']} gas-flame tests within {w:g} points of {o2:g}% oxygen, at {g['pressure_psi']} psi. "
            f"{g['ignited']} ignited. Of those, {g['went_out_on_their_own']} went out on their own and "
            f"{g['burned_until_fuel_was_cut']} burned until the fuel was cut.")
    else:
        out["Gas flames (CFI-G)"] = f"No gas-flame tests within {w:g} points of {o2:g}% oxygen."
    return out


def headline(facts):
    h = facts["habitat"]
    return (f"{facts['materials_flame_tested_near']} of {facts['materials_selected']} materials were "
            f"flame-tested near {h['oxygen_pct']:g}% oxygen")


# ------------------------------------------------------------------ rows
def evidence_rows(cat, chosen):
    """Every catalog row behind the brief's material sections."""
    keep = cat["material"].fillna("").map(lambda cell: any(m in cell.split("; ") for m in chosen))
    return cat[keep]


# ------------------------------------------------------------------ HTML
CSS = """
body{font:15px/1.5 system-ui,Segoe UI,Arial,sans-serif;color:#1c1c1a;max-width:860px;margin:32px auto;padding:0 20px}
h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}
h3{font-size:15px;margin:18px 0 4px}.sub{color:#555;margin:0 0 16px}
table{border-collapse:collapse;width:100%;margin:8px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e4e4e0;vertical-align:top}
th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#555}
.warn{background:#fff6e0;border:1px solid #e8c877;padding:10px 12px;border-radius:6px}
.si{background:#f3f6fb;border:1px solid #c9d6ea;padding:10px 12px;border-radius:6px}
ul{margin:4px 0 0 18px;padding:0}small{color:#666}
@media print{body{margin:0}}
"""


def brief_html(facts, si=None):
    e = html.escape
    h = facts["habitat"]
    partial = "Microgravity" not in h["gravity"]
    parts = [
        "<!doctype html><html lang='en'><head><meta charset='utf-8'>",
        f"<title>Fire Evidence Brief: {e(h['scenario'])}</title><style>{CSS}</style></head><body>",
        "<h1>Fire Evidence Brief</h1>",
        f"<p class='sub'>{e(h['scenario'])}: {h['oxygen_pct']:g}% oxygen, {h['pressure_psi']:g} psi, "
        f"{h['airflow_cm_s']:g} cm/s airflow, {e(h['gravity'])}. Generated {date.today().isoformat()}.</p>",
        "<p class='warn'><b>This is an evidence summary, not a safety assessment.</b> It reports which NASA "
        "microgravity tests exist near these conditions. It does not predict whether a material will burn.</p>",
        f"<h2>{e(headline(facts))}</h2>",
        "<table><tr><th>Material</th><th>Evidence</th><th>Flame tests</th><th>Oxygen tested</th>"
        "<th>Gap to yours</th><th>Smoke tests</th></tr>",
    ]
    for m in facts["materials"]:
        gap = "" if m["oxygen_gap_points"] is None else f"{m['oxygen_gap_points']:g} points"
        parts.append(
            f"<tr><td>{e(m['material'])}</td><td>{e(GRADES[m['grade']])}</td><td>{m['flame_tests']}</td>"
            f"<td>{e(m['oxygen_tested_pct'] or 'not listed') + ('%' if m['oxygen_tested_pct'] else '')}</td>"
            f"<td>{gap}</td><td>{m['smoke_tests']}</td></tr>")
    parts.append(f"</table><small>\"Near\" means within {NEAR:g} points of oxygen. Pressure is not listed "
                 "in any solid-fuel table loaded here, so the grade uses oxygen only.</small>")
    if partial:
        parts.append("<p class='warn'><b>No partial-gravity tests exist in the loaded data.</b> The gravity "
                     "lines below compare microgravity with normal gravity. NASA's challenge statement says "
                     "the two could bound intermediate gravity; that is a hypothesis.</p>")
    if si and si.get("text"):
        parts.append("<h2>Interpretation (SI-worded, number-checked)</h2>"
                     f"<p class='si'>{e(si['text'])}</p><small>Written by {e(si['model'])}. "
                     f"{si['verified']} of {si['total']} numbers match the data in this brief"
                     + (f"; {si['dropped']} sentences were removed because a number did not match" if si["dropped"] else "")
                     + ".</small>")
    parts.append("<h2>By material</h2>")
    for m in facts["materials"]:
        parts.append(f"<h3>{e(m['material'])}</h3><ul>")
        parts += [f"<li>{e(s)}</li>" for s in material_sentences(m, h["oxygen_pct"], partial)]
        for p in m["gravity_pairs"]:
            parts.append(f"<li><small>Sample {e(p['sample'])} ({e(p['thickness'])}): microgravity burn length "
                         f"{e(str(p['microgravity_burn_length']))}, 1g {e(str(p['normal_gravity_burn_length']))}, "
                         f"GSI {p['gsi']:.2f}</small></li>")
        parts.append("</ul>")
    parts.append("<h2>Your atmosphere: liquids and gases</h2>")
    for title, text in atmosphere_sentences(facts["atmosphere"], h["oxygen_pct"]).items():
        parts.append(f"<h3>{e(title)}</h3><p>{e(text)}</p>")
    parts.append("<p><small>These counts are descriptive. Fuel, pressure and flow rate vary between tests "
                 "along with oxygen.</small></p>")
    parts.append("<h2>Sources</h2><ul>")
    used = {}
    for m in facts["materials"]:
        for inv in list(m["flame_tests_by_investigation"]) + list(m["smoke_tests_by_investigation"]):
            used[inv] = None
    ids = facts["psi_ids"]
    for inv in list(used) + ["FLEX", "CFI-G"]:
        parts.append(f"<li>{e(inv)}, NASA Physical Science Informatics {ids[inv]}: "
                     f"<a href='{core.source_link(ids[inv])}'>{core.source_link(ids[inv])}</a></li>")
    parts.append("</ul><p><small>GSI (Gravity Sensitivity Index) = |burn length in 1g − burn length in "
                 "microgravity| ÷ sample length. 0 means the two agree; 1 means the sample burned fully in "
                 "one and not at all in the other.</small></p></body></html>")
    return "".join(parts)
