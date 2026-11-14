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
PAUSE = 4.5  # seconds between calls, to stay under the per-minute limit

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
        "You are writing for an aerospace engineer checking fire safety evidence for a crewed habitat.\n"
        "The JSON describes NASA microgravity flame-test records for one material, and the habitat's "
        "oxygen level.\n"
        "Write 2 sentences, 45 words at most.\n"
        "Sentence 1: how many flame tests exist, and how close they come to the habitat's oxygen level. "
        "Use the count of tests near the habitat's oxygen level and the gap to the nearest test exactly as "
        "the JSON labels them; they are different things.\n"
        "Sentence 2: what the gravity comparison shows, if the JSON has gravity_comparison_samples; "
        "otherwise the most important thing the evidence does not cover. Each entry there is one sample: "
        "report a sample's burn lengths only as that entry gives them and never combine entries. A GSI of "
        "0.00 means the two burn lengths agree; 1.00 means the sample burned fully in one and not at all "
        "in the other.\n" + RULES),
    "investigation": (
        "You are writing for a university student browsing NASA microgravity combustion investigations.\n"
        "The JSON lists attributes of one investigation, read from its data table.\n"
        "Write 2 sentences, 45 words at most.\n"
        "Sentence 1: what kind of test it was and under what conditions. 'Kind of test' says whether "
        "anything was burned; do not say something burned unless it does. 'Fuels or samples' counts "
        "distinct descriptions in the table, not distinct fuels, and its example is only one of them.\n"
        "Sentence 2: what varied between tests, and what the table does not list.\n" + RULES),
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


def material_facts(name, o2, ev):
    """The evidence for one material, with keys that say exactly what each number is."""
    near = f"flame_tests_within_{brief.NEAR:g}_points_of_habitat_oxygen"
    n = ev["nearest_test"]
    return tidy({
        "habitat": {"scenario": name, "oxygen_pct": o2},
        "material": ev["material"],
        "flame_tests_total": ev["flame_tests"],
        "flame_tests_by_investigation": ev["flame_tests_by_investigation"],
        "oxygen_range_tested_pct": ev["oxygen_tested_pct"],
        near: ev["flame_tests_near"],
        "gap_from_habitat_oxygen_to_nearest_test_in_points": ev["oxygen_gap_points"],
        "nearest_test": f'{n["investigation"]} test {n["test"]}, {n["side"].replace("yours", "the habitat oxygen level")}',
        "flame_tests_that_list_an_airflow_speed": ev["flame_tests_with_airflow"],
        "flame_tests_that_list_pressure": 0 if not ev["pressure_tested_psi"] else None,
        "smoke_particle_tests": ev["smoke_tests"],
        "gravity_comparison_samples": [
            {"sample": p["sample"], "GSI": f'{p["gsi"]:.2f}',
             "burn_length_in_microgravity": p["microgravity_burn_length"],
             "burn_length_in_normal_gravity": p["normal_gravity_burn_length"]}
            for p in ev["gravity_pairs"]],
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
            out.append(("material", f"{name}|{m}", material_facts(name, sc["o2"], ev)))
    for inv in cat["investigation"].unique():
        out.append(("investigation", inv, {"investigation": inv, **core.describe(cat, inv)}))
    return out


def main():
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    todo = jobs()
    made = 0
    for n, (kind, label, facts) in enumerate(todo, 1):
        k = key_of(kind, facts)
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
