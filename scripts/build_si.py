"""Precompute the SI-written text for the site, and check it twice.

For each preset habitat and material, and for each investigation, a Gemini model writes a short
text from a JSON of facts. Two checks follow:
  1. si.verify(): code removes any sentence containing a number that is not in those facts.
  2. si.judge(): a different model re-reads each remaining sentence against the facts and
     removes any it finds unsupported.
Results are cached in data/si_cache.json, keyed by a hash of the facts and the prompt, so a
rerun only calls the models for what changed.

Neither check is proof. data/si_cache.json holds every text the site shows, with the sentences
each check removed; read it before publishing.

Run from the project root:  python scripts/build_si.py
"""
import hashlib
import json
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import brief  # noqa: E402
import core  # noqa: E402
import si  # noqa: E402

CACHE = ROOT / "data" / "si_cache.json"
PAUSE = 2.5  # seconds between calls, to stay under the per-minute limit

RULES = """
Rules:
- Use only the JSON. Add no outside knowledge and no advice about what is safe.
- Write every number as digits, exactly as it appears in the JSON. Do not calculate new numbers,
  percentages, differences or counts. Do not write "1g"; say "normal gravity".
- Oxygen levels take a % sign. A gap between two oxygen levels is in "points", never "%".
- Leave out anything the JSON does not list. Do not name JSON keys.
- Plain sentences. No headings, no bullet points, no markdown, no preamble.

JSON:
{facts}
"""

TEMPLATES = {
    "material": (
        "Write a two-sentence note for a fire-evidence card read by a spacecraft engineer.\n"
        "The JSON holds three findings that code worked out from NASA flame-test records for one "
        "material. Your job is wording only: turn them into two natural sentences. Never change, add "
        "or drop a finding, a number or a sample.\n"
        "Sentence 1: oxygen_finding together with oxygen_coverage.\n"
        "Sentence 2: all of gravity_finding, with its example sample if it has one, copying the text "
        "inside double quotes exactly. End the sentence where gravity_finding ends.\n\n"
        "Example of the wording, for a different material:\n"
        "None of the 30 flame tests on this material came within 2 points of the habitat's oxygen "
        "level: they cover 15% to 19.5% oxygen, and the nearest sits 6.5 points below it. Gravity "
        "changed the result for 1 of the 3 samples compared, which burned further in normal gravity "
        "than in microgravity (sample 9-2: \"4 cm\" in microgravity, \"Complete\" in normal gravity); "
        "the other 2 gave the same result in both.\n"
        + RULES),
    "investigation": (
        "Write a summary, two or three short sentences, of one NASA microgravity combustion "
        "investigation for a university student.\n"
        "The JSON holds findings that code read from the investigation's data table. Your job is "
        "wording only: turn them into natural sentences. Never change, add or drop a finding or a "
        "number.\n"
        "First: what_it_was and samples.\n"
        "Then: conditions_listed, what varied between tests, and what the table does not list, "
        "leaving out any of the three that the JSON does not have.\n\n"
        "Example of the wording, for a different investigation:\n"
        "This was a flame test on solid samples in microgravity, and its table gives 12 different "
        "fuel or sample descriptions, for example \"Paper strip, 1 cm wide\". The table lists oxygen "
        "from 18 to 21 %. The fuel or sample and oxygen varied between tests, and pressure and "
        "airflow are not listed.\n"
        + RULES),
}


def tidy(v):
    """Drop empty values and write whole numbers without a decimal point, so the model has less to misread."""
    if isinstance(v, dict):
        return {k: tidy(x) for k, x in v.items() if x not in (None, [], {})}
    if isinstance(v, list):
        return [tidy(x) for x in v]
    if isinstance(v, float) and v.is_integer():
        return int(v)
    return v


def gravity_finding(pair):
    """What gravity changed for one Saffire-II sample, worked out from the burn lengths in cm."""
    ug, g1, full = pair["ug"], pair["g1"], pair["full"]
    if g1 > ug:
        return "burned further in normal gravity than in microgravity"
    if g1 < ug:
        return "burned further in microgravity than in normal gravity"
    if ug == 0:
        return "did not burn in microgravity or in normal gravity"
    if ug == full:
        return f"the whole {full:g} cm sample burned in both microgravity and normal gravity"
    return "burned the same length in both microgravity and normal gravity"


def gravity_summary(compared):
    """One clause that counts what gravity changed across the compared samples, with one example."""
    n = len(compared)
    if not n:
        return "this data has no gravity comparison for this material"

    def example(c):
        return (f'(sample {c["sample"]}: "{c["burn_length_in_microgravity"]}" in microgravity, '
                f'"{c["burn_length_in_normal_gravity"]}" in normal gravity)')

    changed = [c for c in compared if c["finding"].startswith("burned further")]
    same = [c for c in compared if not c["finding"].startswith("burned further")]
    group = {1: "the 1 sample", 2: "both samples"}.get(n, f"all {n} samples") + " compared"
    if not changed:
        kinds = {c["finding"] for c in same}
        detail = same[0]["finding"] if len(kinds) == 1 else "the result was the same in both"
        if detail.startswith("did not burn"):
            detail = ("it " if n == 1 else "they ") + detail
        who = "either of the 2 samples compared" if n == 2 else group
        return f"gravity made no difference for {who}: {detail} {example(same[0])}"
    kinds = {c["finding"] for c in changed}
    how = changed[0]["finding"] if len(kinds) == 1 else "burned a different length in microgravity and normal gravity"
    if not same:
        return f"gravity changed the result for {group}: {'it' if n == 1 else 'each'} {how} {example(changed[0])}"
    rest = "the other 1 gave" if len(same) == 1 else f"the other {len(same)} gave"
    return (f"gravity changed the result for {len(changed)} of the {n} samples compared, which {how} "
            f"{example(changed[0])}; {rest} the same result in both")


def material_facts(name, o2, ev, pairs):
    """The evidence for one material. Code states each finding; the model only puts it in plain words."""
    total, near, gap = ev["flame_tests"], ev["flame_tests_near"], ev["oxygen_gap_points"]
    side = ev["nearest_test"]["side"].split()[0]  # at, below or above
    if near:
        count = f"all {total}" if near == total else f"{near} of the {total}"
        finding = (f"{count} flame tests on this material were run within {brief.NEAR:g} "
                   f"points of the habitat's oxygen level")
    else:
        finding = (f"none of the {total} flame tests on this material was run within {brief.NEAR:g} points "
                   f"of the habitat's oxygen level; the nearest was {gap:g} points {side} it")
    lo, _, hi = ev["oxygen_tested_pct"].partition(" to ")
    coverage = (f"the tests that list oxygen cover {lo}% to {hi}% oxygen" if hi
                else f"the tests that list oxygen were all run at {lo}% oxygen")
    by_sample = pairs.set_index("sample").to_dict("index")
    compared = [{"sample": p["sample"], "finding": gravity_finding(by_sample[p["sample"]]),
                 "burn_length_in_microgravity": p["microgravity_burn_length"],
                 "burn_length_in_normal_gravity": p["normal_gravity_burn_length"]}
                for p in ev["gravity_pairs"]]
    return tidy({
        "habitat": {"scenario": name, "oxygen_pct": o2},
        "material": ev["material"],
        "oxygen_finding": finding,
        "oxygen_coverage": coverage,
        "gravity_finding": gravity_summary(compared),
    })


def _and(items):
    """'a', 'a and b', 'a, b and c'."""
    if len(items) < 2:
        return "".join(items)
    return ", ".join(items[:-1]) + " and " + items[-1]


def investigation_facts(cat, inv):
    """What the table says about one investigation, as finished clauses for the model to join."""
    d = core.describe(cat, inv)
    kind = d["Kind of test"]
    what = "a " + kind[0].lower() + kind[1:].replace(";", " in microgravity;", 1)
    if ";" not in kind:
        what += " in microgravity"
    if "1g" in d["Gravity"]:
        what += ", with a normal-gravity comparison of the same samples"
    count, _, example = d["Fuels or samples"].partition(" distinct descriptions in the table, for example: ")
    samples = (f'the table gives {count} different fuel or sample descriptions, for example "{example}"' if example
               else f'every row of the table has the same sample description, "{count}"')
    fan = d["Airflow"].startswith("a fan setting")
    listed, missing = [], []
    for label, key in (("oxygen", "Oxygen"), ("pressure", "Pressure"), ("airflow", "Airflow")):
        value = d[key]
        if key == "Airflow" and fan:
            listed.append("a fan setting (but no air speed)")
        elif value == "not listed":
            missing.append(label)
        else:
            listed.append(f"{label} {'from ' if ' to ' in value else 'of '}{value}")
    if d["Sensors named in the table"] == "not listed":
        missing.append("sensors")
    varied = d["What varied between tests"].replace("airflow or fan setting", "fan setting" if fan else "airflow")
    return tidy({
        "investigation": inv,
        "what_it_was": what,
        "samples": samples,
        "conditions_listed": "the table lists " + _and(listed) if listed else None,
        "varied_between_tests": None if varied.startswith("nothing") else _and(varied.split(", ")),
        "not_listed_in_table": _and(missing) or None,
    })


def key_of(kind, facts):
    blob = json.dumps([kind, TEMPLATES[kind], facts], sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(blob.encode()).hexdigest()[:20]


def jobs():
    cat, pairs = core.load_catalog(), core.load_pairs()
    out = []
    for name, sc in core.SCENARIOS.items():
        if name == "Custom":
            continue
        for m in brief.materials(cat):
            ev = brief.material_evidence(cat, pairs, m, sc["o2"])
            if not ev["oxygen_tested_pct"]:
                continue  # with no oxygen-listed flame test there is nothing to interpret
            out.append(("material", f"{name}|{m}", material_facts(name, sc["o2"], ev, pairs)))
    for inv in cat["investigation"].unique():
        out.append(("investigation", inv, investigation_facts(cat, inv)))
    return out


def main():
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    todo = jobs()
    made = 0
    for n, (kind, label, facts) in enumerate(todo, 1):
        k = key_of(kind, facts)
        if k in cache and not cache[k].get("judge") and cache[k]["text"]:
            verdict = si.judge(cache[k]["text"], facts)  # the second pass failed last time; try it again
            if "error" not in verdict:
                cache[k].update(judge=verdict["model"], judge_removed=verdict["removed"], text=verdict["text"])
                cache[k].pop("judge_error", None)
                CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False), encoding="utf-8")
            print(f"[{n}/{len(todo)}] {kind} {label}: second pass retried: "
                  f"{verdict.get('error') or verdict['model']}", flush=True)
            time.sleep(PAUSE)
            continue
        if k in cache:
            continue
        result = si.interpret(facts, TEMPLATES[kind])
        if "error" in result:
            print(f"[{n}/{len(todo)}] {kind} {label}: {result['error']}", flush=True)
            time.sleep(20)
            continue
        time.sleep(PAUSE)
        verdict = si.judge(result["text"], facts) if result["text"] else {"error": "no text left"}
        entry = {"kind": kind, "label": label, "model": result["model"], "raw": result["raw"],
                 "total": result["total"], "verified": result["verified"], "dropped": result["dropped"],
                 "judge": verdict.get("model"), "judge_removed": verdict.get("removed", []),
                 "text": verdict.get("text", result["text"])}
        if "error" in verdict:
            entry["judge_error"] = verdict["error"]
        cache[k] = entry
        CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False), encoding="utf-8")  # keep progress
        made += 1
        print(f"[{n}/{len(todo)}] {kind} {label}: {result['verified']}/{result['total']} numbers, "
              f"{result['dropped']} dropped by number check, {len(entry['judge_removed'])} by second pass"
              + (f" (second pass failed: {verdict['error']})" if "error" in verdict else ""), flush=True)
        time.sleep(PAUSE)
    # keep only the texts the site uses, so the cache file is the full list to review
    keys = {key_of(k, f) for k, _, f in todo}
    cache = {k: v for k, v in cache.items() if k in keys}
    CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False), encoding="utf-8")
    print(f"done: {made} new, {len(cache)}/{len(todo)} cached")


if __name__ == "__main__":
    main()
