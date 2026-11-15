"""Build data/catalog.csv and data/saffire2_pairs.csv from the PSI experiment tables.

Rules:
- One row per test where the PSI table is per-test; one row per table line otherwise
  (row_level says which).
- Never invent a value. If the table is silent, the cell stays empty.
- Every parsed number keeps its source text next to it (the *_raw columns).
- Every cleaning decision is described in DATA_NOTES.md.

Run from the project root:  python scripts/build_catalog.py
"""
import csv
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
from core import tag_material  # noqa: E402
RAW = ROOT / "data" / "raw"
OUT = ROOT / "data" / "catalog.csv"
PAIRS = ROOT / "data" / "saffire2_pairs.csv"

MMHG_TO_PSI = 14.6959 / 760.0
BAR_TO_PSI = 14.5038
ATM_TO_PSI = 14.6959

# DOIs come from secondary sources (see brief section 10) and are marked "verify".
INV = {
    "SAFFIRE-1": ("PSI-98", ""),
    "SAFFIRE-2": ("PSI-99", ""),
    "SAFFIRE-3": ("PSI-100", ""),
    "BASS-II": ("PSI-25", "10.60555/4qc4-de67"),
    "FLEX": ("PSI-69", "10.60555/mbq8-0451"),
    "FLEX-2": ("PSI-68", "10.60555/byp8-h018"),
    "CFI-G": ("PSI-159", "10.60555/cyt1-kh64"),
    "CFI-G inverse": ("PSI-159", "10.60555/cyt1-kh64"),
    "SAME": ("PSI-102", ""),
    "SAME-R": ("PSI-101", ""),
    "SLICE": ("PSI-106", "10.60555/pm12-rg61"),
    "BASS": ("PSI-26", ""),
    "CFI": ("PSI-39", "10.60555/m6pj-a914"),
    "ACME Flame Design": ("PSI-10", "10.60555/w4zy-bt45"),
    "ACME Flame Design inverse": ("PSI-10", "10.60555/w4zy-bt45"),
    "ACME CLD Flame": ("PSI-21", ""),
    "ACME s-Flame": ("PSI-23", ""),
    "SPICE": ("PSI-107", ""),
    "ACME BRE": ("PSI-20", ""),
    "ACME E-FIELD Flames": ("PSI-22", ""),
    "DAFT": ("PSI-47", ""),
}

COLS = [
    "investigation", "psi_id", "doi", "row_level", "test_id",
    "fuel_class", "fuel", "material",
    "o2_pct", "o2_min", "o2_max", "o2_raw", "o2_supply_pct",
    "diluent",
    "pressure_psi", "pressure_min", "pressure_max", "pressure_raw",
    "flow_cm_s", "flow_min", "flow_max", "flow_raw", "flow_direction",
    "gravity", "outcome", "sensors", "source_file", "notes",
]


def read(name):
    path = RAW / name
    for enc in ("utf-8-sig", "latin-1"):
        try:
            with open(path, newline="", encoding=enc) as f:
                rows = list(csv.reader(f))
            break
        except UnicodeDecodeError:
            continue
    header = [h.strip() for h in rows[0]]
    return [dict(zip(header, [c.strip() for c in r])) for r in rows[1:]]


def num(text):
    """Return a float only if the whole cell is a plain number."""
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


def nums(text):
    return [float(x) for x in re.findall(r"\d+\.?\d*|\.\d+", text or "")]


def fmt(x, digits=2):
    return "" if x is None else f"{round(x, digits):g}"


def row(inv, src, **kw):
    r = dict.fromkeys(COLS, "")
    r["investigation"] = inv
    r["psi_id"], r["doi"] = INV[inv]
    r["source_file"] = src
    r["row_level"] = "test"
    r.update(kw)
    return r


def span(prefix, lo, hi, digits=2):
    """Fill <prefix>, <prefix>_min, <prefix>_max. Single value only when lo == hi."""
    key = {"o2": "o2_pct", "pressure": "pressure_psi", "flow": "flow_cm_s"}[prefix]
    out = {f"{prefix}_min": fmt(lo, digits), f"{prefix}_max": fmt(hi, digits)}
    out[key] = fmt(lo, digits) if lo == hi else fmt((lo + hi) / 2, digits)
    return out


def saffire():
    out, pairs = [], []

    src = "PSI-98_Experimental table_SAFFIRE-1.csv"
    for d in read(src):
        if not d["Sample Number"].startswith("S"):
            continue  # flow-visualisation lines, not burn tests
        o = nums(d["Percent O2"])
        out.append(row(
            "SAFFIRE-1", src, test_id=d["Sample Number"], fuel_class="solid",
            fuel=f'{d["Material"]}, {d["Sample Thickness (cm)"]} cm thick, '
                 f'{d["Sample Length (cm)"]} x {d["Sample Width (cm)"]} cm (length x width as listed)',
            o2_raw=d["Percent O2"], **span("o2", min(o), max(o)),
            flow_raw=d["Air Flow (cm/s)"], **span("flow", *[num(d["Air Flow (cm/s)"])] * 2),
            flow_direction=d["Flow Direction"], gravity="µg",
            outcome=f'Burn time {d["Burn Time (s)"]} s', sensors="Camera 1; Camera 2",
        ))

    src = "PSI-99_Experimental table_SAFFIRE-2.csv"
    last_material = ""
    for d in read(src):
        sid = d["Sample Number"]
        if not re.match(r"^2-\d+$", sid):
            continue  # flow-visualisation lines and footnotes
        material = d["Material"] or last_material  # blank = continuation of the cell above
        filled = not d["Material"]
        last_material = material
        o = nums(d["Percent O2 (Note 1)"])
        f = nums(d["Air Flow (cm/s)"])[0]
        fuel = f'{material}, {d["Samle Thickness"]} thick, {d["Sample Length"]} x {d["Sample Width (cm)"]}'
        ug_len, ug_rate = d["?-g Burn Length"], d["?-g Spread Length"]
        g1_len, g1_rate = d["1-g Burn Length"], d["1-g Spread Rate"]
        note = "Material cell blank in source; taken from the row above. " if filled else ""
        common = dict(fuel_class="solid", fuel=fuel, flow_direction=d["Flow Direction"],
                      sensors="Camera 1; Camera 2")
        out.append(row(
            "SAFFIRE-2", src, test_id=sid, gravity="µg",
            o2_raw=d["Percent O2 (Note 1)"], **span("o2", min(o), max(o)),
            flow_raw=d["Air Flow (cm/s)"], **span("flow", f, f),
            outcome=f'Burn length {ug_len}; spread {ug_rate}; burn time {d["Burn Time (s)"]}',
            notes=note + "O2 derived from CO2 production (source Note 1).", **common,
        ))
        out.append(row(
            "SAFFIRE-2", src, test_id=f"{sid} (1g)", gravity="1g",
            outcome=f"Burn length {g1_len}; spread {g1_rate}",
            notes=note + "1g comparison listed in the same PSI table. The table does not state "
                         "the 1g test's O2, pressure or airflow, so those cells are empty.",
            **common,
        ))
        pairs.append({
            "sample": sid, "material": material, "thickness_raw": d["Samle Thickness"],
            "flow_direction": d["Flow Direction"], "o2_raw": d["Percent O2 (Note 1)"],
            "flow_raw": d["Air Flow (cm/s)"], "sample_length_raw": d["Sample Length"],
            "ug_burn_length_raw": ug_len, "ug_spread_raw": ug_rate,
            "g1_burn_length_raw": g1_len, "g1_spread_raw": g1_rate,
        })

    src = "PSI-100_Experimental table_SAFFIRE-3.csv"
    for d in read(src):
        f = nums(d["Air Flow"])[0]
        out.append(row(
            "SAFFIRE-3", src, test_id=d["Sample Number"], fuel_class="solid",
            fuel=f'{d["Material"]}, {d["Sample Thickness"]} thick, {d["Sample Length"]} x {d["Sample Width"]}',
            flow_raw=d["Air Flow"], **span("flow", f, f), flow_direction=d["Direction"],
            gravity="µg", sensors="Camera 1; Camera 2",
            notes="Table lists no O2, pressure or outcome.",
        ))
    return out, pairs


def bass2():
    src = "PSI-25_Experimental table_BASS-II.csv"
    out = []
    for d in read(src):
        o_raw = d["Calibrated  initial O2 % by vol"]
        o = num(o_raw)
        extra = span("o2", o, o) if o is not None else {}
        out.append(row(
            "BASS-II", src, test_id=d["Test #"], fuel_class="solid",
            fuel=d["Fuel Sample Material"], o2_raw=o_raw,
            flow_raw=f'Fan display {d["Fan display"]}; flow restrictor {d["Flow restrictor"]}',
            gravity="µg",
            sensors="Radiometer; video frames; O2, CO2 and CO gas readings",
            notes=f'PI {d["PI"]}. Final O2 {d["Calibrated final O2 % by vol"]} %. '
                  "Fan setting is an instrument display value, not cm/s, so flow speed is empty. "
                  "Table lists no pressure and no outcome.",
            **extra,
        ))
    return out


def flex():
    src = "PSI-69_Experimental table_FLEX.csv"
    out = []
    for d in read(src):
        o = num(d["O initial ambient composition; mole fraction"])
        p_raw = d["Ambient pressure; mmHg"]
        p = num(p_raw)
        notes = []
        if p is not None and p <= 0:
            p = None
            notes.append("Pressure listed as 0 mmHg; treated as missing.")
        parts = []
        for label, col in (("N2", "N initial ambient composition; mole fraction"),
                           ("CO2", "CO initial ambient composition; mole fraction"),
                           ("He", "He initial ambient composition; mole fraction")):
            v = num(d[col])
            if v:
                parts.append(f"{label} {v:g}")
        extra = {}
        if o is not None:
            extra.update(span("o2", o * 100, o * 100))
        if p is not None:
            extra.update(span("pressure", p * MMHG_TO_PSI, p * MMHG_TO_PSI))
        out.append(row(
            "FLEX", src, test_id=f'{d["FLEX Test #"]} ({d["FLEX Identifier"]})',
            fuel_class="liquid",
            fuel=f'{d["Fuel"]} droplet, initial diameter {d["Droplet initial diameter; mm"]} mm',
            o2_raw=d["O initial ambient composition; mole fraction"],
            diluent="; ".join(parts), pressure_raw=f"{p_raw} mmHg", gravity="µg",
            outcome=f'{d["Test end"]}; burn time {d["Burn time; s"]} s; '
                    f'extinction diameter {d["Visible flame extinction diameter; mm"]} mm',
            notes=" ".join(notes), **extra,
        ))
    return out


def flex2():
    src = "PSI-68_Experimental table_Flex2.csv"
    out = []
    for d in read(src):
        o = [x * 100 for x in nums(d["Oxygen Mole Fraction"])]
        p = [x * ATM_TO_PSI for x in nums(d["Ambient Pressure (atm)"])]
        f = nums(d["Flow Velocity (cm/s)"])
        out.append(row(
            "FLEX-2", src, row_level="summary (test matrix per fuel)",
            test_id=d["Sample (Fuel Type)"], fuel_class="liquid",
            fuel=f'{d["Sample (Fuel Type)"]} droplet, {d["Initial Droplet Diameter (mm)"]} mm',
            o2_raw=d["Oxygen Mole Fraction"], o2_min=fmt(min(o)), o2_max=fmt(max(o)),
            diluent=d["Ambient Gas Mixture"],
            pressure_raw=f'{d["Ambient Pressure (atm)"]} atm',
            pressure_min=fmt(min(p)), pressure_max=fmt(max(p)),
            flow_raw=d["Flow Velocity (cm/s)"], flow_min=fmt(min(f)), flow_max=fmt(max(f)),
            gravity="µg",
            notes="Table gives the planned range per fuel, not one row per test.",
        ))
    return out


def cfig():
    src = "PSI-159_Experimental table_CFI-G_Normal Flames.csv"
    out = []
    for d in read(src):
        o = num(d["XO2 before test"])
        p = num(d["approx p (bar)"])
        extra = {}
        if o is not None:
            extra.update(span("o2", o * 100, o * 100))
        if p is not None:
            extra.update(span("pressure", p * BAR_TO_PSI, p * BAR_TO_PSI))
        end = {"SE": "self-extinguished", "FT": "flow terminated"}.get(d["Self-ext or flow term"], "")
        outcome = f'Hot ignition: {d["Hot ignition"]}'
        if end:
            outcome += f"; {end}"
        if d["burn time (sec)"]:
            outcome += f'; burn time {d["burn time (sec)"]} s'
        out.append(row(
            "CFI-G", src, test_id=d["Test"], fuel_class="gas",
            fuel=f'{d["Fuel"]}, fuel mole fraction {d["Xf"]}, fuel flow {d["mHC (mg/s)"]} mg/s (spherical burner)',
            o2_raw=d["XO2 before test"], pressure_raw=f'{d["approx p (bar)"]} bar',
            gravity="µg", outcome=outcome, sensors="Burner temperature (peak burner T)",
            notes=d["Comments"], **extra,
        ))
    return out


def same():
    out = []
    src = "PSI-102_Experimental table_SAME.csv"
    for d in read(src):
        f = num(d["Air Flow (cm/s)"])
        extra = span("flow", f, f) if f is not None else {}
        out.append(row(
            "SAME", src, test_id=d["Sample #"], fuel_class="smoke source",
            fuel=d["Sample Material"], flow_raw=d["Air Flow (cm/s)"], gravity="µg",
            outcome=(f'Weight loss rate {d["Weight loss rate (mg/min)"]} mg/min; '
                     f'aging {d["Aging Duration (minutes)"]} min') if d["Weight loss rate (mg/min)"] else "",
            notes="Smoke-particle experiment (overheated material), not a flame test.", **extra,
        ))
    src = "PSI-101_Experimental table_SAME-R.csv"
    for d in read(src):
        f = num(d["Inlet velocity (cm/s)"])
        extra = span("flow", f, f) if f is not None else {}
        out.append(row(
            "SAME-R", src, test_id=d["SAME Test #"], fuel_class="smoke source",
            fuel=d["Sample Type"], flow_raw=d["Inlet velocity (cm/s)"], gravity="µg",
            outcome=f'{d["Description"]}; duration {d["Duration (sec)"]} s',
            notes="Smoke-particle experiment (overheated material), not a flame test.", **extra,
        ))
    return out


def slice_():
    src = "PSI-106_Experimental table_Slice.csv"
    out = []
    for d in read(src):
        out.append(row(
            "SLICE", src, row_level="summary (one line per test day)",
            test_id=d["Test Date"], fuel_class="gas", fuel=d["Fuel Type"], gravity="µg",
            notes="Table lists test days and fuel mixes only; no O2, pressure, flow or outcome.",
        ))
    return out


def bass():
    src = "PSI-26_Experimental table_BASS.csv"
    out = []
    for d in read(src):
        fuel = d["Fuel Sample Material"]
        if "soot cleaning" in fuel.lower():
            continue  # a maintenance entry, not a burn test
        out.append(row(
            "BASS", src, test_id=d["Test #"], fuel_class="solid", fuel=fuel, gravity="µg",
            notes=f'As-run order {d["As Run Test #"]}, sample {d["Sample #"]}. '
                  "Table lists no O2, pressure, airflow or outcome.",
        ))
    return out


def cfi():
    src = "PSI-39_Experimental table_CFI.csv"
    out = []
    for d in read(src):
        o = num(d["Oxygen"])
        p = nums(d["Pressure"])
        parts = [f"{label} {num(d[col]):g}" for label, col in (("N2", "Nitrogen"), ("He", "Helium")) if num(d[col])]
        extra = {}
        if o is not None:
            extra.update(span("o2", o * 100, o * 100))
        if p:
            extra.update(span("pressure", p[0] * ATM_TO_PSI, p[0] * ATM_TO_PSI))
        out.append(row(
            "CFI", src, test_id=f'{d["Flex Number"]} ({d["CIR"]})', fuel_class="liquid",
            fuel=f'{d["Fuel"]} droplet' + {"Yes": ", fiber-supported", "No": ", free-floating"}.get(d["Fiber"], ""),
            o2_raw=d["Oxygen"], diluent="; ".join(parts), pressure_raw=d["Pressure"], gravity="µg",
            notes="Cool Flames Investigation. Table lists no airflow or outcome.", **extra,
        ))
    return out


def cfig_inverse():
    """Inverse flames: oxygen flows out of the burner into a chamber of fuel and nitrogen.
    The surrounding gas holds no oxygen, so o2_* stays empty; the burner's oxygen goes in o2_supply_pct."""
    src = "PSI-159_Experimental table_CFI-G_Inverse Flames.csv"
    out = []
    for d in read(src):
        if not d["Test"]:
            continue
        o = num(d["XO2"])
        p = num(d["approx p (bar)"])
        extra = span("pressure", p * BAR_TO_PSI, p * BAR_TO_PSI) if p is not None else {}
        ign = d["Hot ignition"].lower()
        end = {"SE": "self-extinguished", "FT": "flow terminated"}.get(d["Self -ext or flow term"], "")
        outcome = f"Hot ignition: {ign.capitalize()}" if ign else ""
        if end and ign == "yes":
            outcome += f"; {end}"
        if d["burn time (sec)"] and ign == "yes":
            outcome += f'; burn time {d["burn time (sec)"]} s'
        out.append(row(
            "CFI-G inverse", src, test_id=d["Test"], fuel_class="gas",
            fuel=f'{d["Fuel"].lower()} in the surrounding gas, fuel mole fraction {d["Xf before test"]}; oxygen flow {d["O2 flow rate (mg/s)"]} mg/s from a spherical burner (inverse flame)',
            o2_raw=f'XO2 {d["XO2"]} (oxygen supplied from the burner; the surrounding gas is fuel and nitrogen)',
            o2_supply_pct=fmt(o * 100) if o is not None else "", diluent="N2",
            pressure_raw=f'{d["approx p (bar)"]} bar', gravity="µg", outcome=outcome,
            sensors="Burner temperature (peak burner T)",
            notes="; ".join(x for x in (f'Flame colour: {d["Color"]}' if d["Color"] not in ("", "-") else "", d["Comments"]) if x), **extra,
        ))
    return out


def flame_design_inverse():
    src = "PSI-10_Experimental table_Flame Design_Inverse Flame.csv"
    out = []
    for d in read(src):
        o = num(d["XO2"])
        p = num(d["pinit (atm)"])
        extra = span("pressure", p * ATM_TO_PSI, p * ATM_TO_PSI) if p is not None else {}
        out.append(row(
            "ACME Flame Design inverse", src, test_id=d["Test"], fuel_class="gas",
            fuel=f'ethylene in the surrounding gas, mole fraction {d["XC2H4 initial"]}; oxygen flow {d["mO2 (mg/s)"]} mg/s from a spherical burner (inverse flame)',
            o2_raw=f'XO2 {d["XO2"]} (oxygen supplied from the burner; the surrounding gas is ethylene and nitrogen)',
            o2_supply_pct=fmt(o * 100) if o is not None else "", diluent="N2",
            pressure_raw=f'{d["pinit (atm)"]} atm', gravity="µg",
            notes="Table lists no outcome.", **extra,
        ))
    return out


def cld():
    src = "PSI-21_Experimental table_CLD Flame.csv"
    out = []
    for d in read(src):
        out.append(row(
            "ACME CLD Flame", src, row_level="summary (one line per test day)",
            test_id=d["Test Day"], fuel_class="gas",
            fuel=f'{d["Fuel Bottle"]}, diluted with nitrogen to {d["Fuel conc. Range"]} (coflow burner)',
            diluent="N2", gravity="µg", outcome=f'Flames ignited: {d["Flames ignited"]}' if d["Flames ignited"] else "",
            notes="Table lists test days, fuel mixes and flame counts; no O2, pressure or outcome per flame.",
        ))
    return out


def sflame():
    src = "PSI-23_Experimental table_ACME s-Flame.csv"
    out = []
    for d in read(src):
        atm = d["Atmosphere*"]
        m = re.search(r"(\d+\.?\d*)\s*%\s*O2", atm)
        extra = span("o2", float(m.group(1)), float(m.group(1))) if m else {}
        out.append(row(
            "ACME s-Flame", src, row_level="summary (one line per test day)",
            test_id=d["Test Day*"], fuel_class="gas", fuel=f'{d["Fuel Bottle"]} (spherical burner)',
            o2_raw=atm, gravity="µg", outcome=f'Flames ignited: {d["Flames Ignited*"]}' if d["Flames Ignited*"] else "",
            notes="Atmosphere is about 1 atm; pressure rises and oxygen falls as the chamber fills with combustion products (table note).", **extra,
        ))
    return out


def spice():
    """Smoke-point flames on a coflow nozzle. The table lists the coflow air speed, not its oxygen level."""
    src = "PSI-107_Experimental table_Spice.csv"
    out = []
    for i, d in enumerate(read(src), 1):
        a = num(d["Air Rate (cm/s)"])
        extra = span("flow", a, a) if a is not None and a >= 0 else {}
        out.append(row(
            "SPICE", src, test_id=f'{i}: day {d["GMT date"]}, ignition {d["GMT ignition"]}', fuel_class="gas",
            fuel=f'{d["Fuel"]}, {d["Fuel Rate (mg/s)"]} mg/s from a {d["Nozzle (mm)"]} mm nozzle (coflow)',
            flow_raw=d["Air Rate (cm/s)"], flow_direction="coflow", gravity="µg",
            notes="Smoke-point study; the table lists fuel and air rates, not oxygen, pressure or outcome."
                  + (" Air rate is listed below zero and is not used as a speed." if a is not None and a < 0 else ""),
            **extra,
        ))
    return out


def flame_design():
    src = "PSI-10_Experimental table_Flame Design_Normal Flame.csv"
    out = []
    for d in read(src):
        o = num(d["XO2 (init)"])
        p = num(d["pinit (atm)"])
        extra = {}
        if o is not None:
            extra.update(span("o2", o * 100, o * 100))
        if p is not None:
            extra.update(span("pressure", p * ATM_TO_PSI, p * ATM_TO_PSI))
        out.append(row(
            "ACME Flame Design", src, test_id=d["Test"], fuel_class="gas",
            fuel=f'{d["Fuel"]}, fuel mole fraction {d["Xfuel"]}, fuel flow {d["mfuel (mg/s)"]} mg/s (spherical burner)',
            o2_raw=d["XO2 (init)"], pressure_raw=f'{d["pinit (atm)"]} atm', diluent="N2",
            gravity="µg", notes="Table lists no outcome. RAMPED means the flow was varied during the test.",
            **extra,
        ))
    return out


def bre():
    src = "PSI-20_Experimental table_ACME BRE.csv"
    out = []
    for d in read(src):
        raw = d["Oxygen Conc (percent)"]
        o = nums(raw)
        fixed = ""
        if raw.endswith("00%"):  # a spreadsheet percent format turned 34 into "3400%"
            o = [x / 100 for x in o]
            fixed = f'Oxygen cell reads "{raw}" in the source; read as {o[0]:g}%. '
        out.append(row(
            "ACME BRE", src, row_level="summary (one line per test day)",
            test_id=f'{d["Year"]} {d["Month"]} {d["Date"]}', fuel_class="gas",
            fuel=f'{d["Fuel Bottle"]}, {d["Burner Size (mm)"]} mm burner',
            o2_raw=raw, o2_min=fmt(min(o)), o2_max=fmt(max(o)), diluent="N2", gravity="µg",
            outcome=f'{d["Flames Ignited"]} flames ignited that day',
            notes=fixed + "Burning Rate Emulator. Oxygen values are approximate levels for tests that "
                          "ignited; chamber pressure also varied but is not listed.",
        ))
    return out


def efield():
    src = "PSI-22_Experimental table_ACME E-FIELD Flames.csv"
    out, seen = [], set()
    rows = read(src)
    for i, d in enumerate(rows):
        if not d["Test Day"]:
            continue  # continuation line: extra fuel concentrations for the day above
        conc = [d["Fuel Conc"]]
        for nxt in rows[i + 1:]:
            if nxt["Test Day"]:
                break
            conc.append(nxt["Fuel Conc"])
        key = (d["Test Day"], d["Mesh Polarity"], d["Fuel Bottle"])
        if key in seen:
            continue  # the source lists test day 18319 twice
        seen.add(key)
        out.append(row(
            "ACME E-FIELD Flames", src, row_level="summary (one line per test day)",
            test_id=d["Test Day"], fuel_class="gas",
            fuel=f'{d["Fuel Bottle"]} bottle, run at {", ".join(conc)} fuel (balance N2)',
            diluent="N2", gravity="µg", outcome=f'{d["Flames Ignited"]} flames ignited that day',
            notes=f'{d["Test Type"]}. Mesh polarity {d["Mesh Polarity"]}. An electric field acted on the '
                  "flame. Table lists no O2, pressure or airflow.",
        ))
    return out


def daft():
    src = "PSI-47_Experimental table_DAFT.csv"
    out = []
    for d in read(src):
        out.append(row(
            "DAFT", src, row_level="summary (one line per session)", test_id=d["Session Name"],
            fuel_class="dust", fuel=d["Sample Material"], gravity="µg",
            sensors=d["Hardware Description"].replace("Contained ", "").replace(" and batteries", ""),
            notes=f'{d["Actual Day"]}. {d["Sampled Location"]}. Dust-particle measurement, not a flame test.',
        ))
    return out


def main():
    saf, pairs = saffire()
    rows = (saf + bass2() + bass() + flex() + flex2() + cfi() + cfig() + cfig_inverse() + flame_design()
            + flame_design_inverse() + bre() + efield() + cld() + sflame() + slice_() + spice() + same() + daft())
    for r in rows:
        if r["fuel_class"] in ("solid", "smoke source"):
            r["material"] = tag_material(r["fuel"])
    with open(OUT, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=COLS)
        w.writeheader()
        w.writerows(rows)
    with open(PAIRS, "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=list(pairs[0]))
        w.writeheader()
        w.writerows(pairs)
    counts = {}
    for r in rows:
        counts[r["investigation"]] = counts.get(r["investigation"], 0) + 1
    print(f"catalog.csv: {len(rows)} rows")
    for k, v in counts.items():
        print(f"  {k}: {v}")
    print(f"saffire2_pairs.csv: {len(pairs)} rows")


if __name__ == "__main__":
    main()
