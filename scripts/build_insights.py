"""SI interpretation of the fire-safety findings, checked twice, plus one briefing per preset habitat.

For each finding in scripts/build_findings.py, a Gemini model reads the code-computed facts and
writes four fields: a headline, what the tests found, what it suggests for a crewed habitat, and
its main limit. For each preset habitat it then writes a short briefing from the findings ranked
closest to that habitat and the gaps code found.

Checks, as for the other SI text on the site:
  1. si.verify(): code removes any sentence with a number that is not in the facts.
  2. a second pass by a different model removes any sentence that states something the facts do
     not contain, contradicts them, or overstates them.
Every text is kept in data/insight_cache.json with what each check removed. Read it before
publishing: neither check is proof.

Run from the project root:  python scripts/build_insights.py
"""
import hashlib
import json
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))
import core  # noqa: E402
import si  # noqa: E402
from scripts import build_findings as bf  # noqa: E402

CACHE = ROOT / "data" / "insight_cache.json"
# The free tier allows 20 requests a day for most strong models; gemini-4-hydrogen had room and wrote
# the most careful interpretations in a side-by-side test. The second pass uses a different model.
WRITERS = ["gemini-4-hydrogen", "gemini-3.5-flash", "gemini-3-flash-preview"]
JUDGES = ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-4-hydrogen"]
FIELDS = ["HEADLINE", "FOUND", "MEANS", "LIMIT"]

RULES = """Rules:
- Use only FACTS. Bring in no outside facts: no other experiments, standards, missions or numbers.
- Write every number as digits, exactly as it appears in FACTS. Do not work out new numbers,
  percentages, ratios or differences.
- The tests change several things at once, so describe results that were seen together. Do not
  say that one thing causes or leads to another.
- Say "suggests" or "points to", never "proves". Do not call anything safe or unsafe, and give no
  instructions. You may name the design question a finding raises (oxygen level, ventilation,
  detection, choice of materials, extinguishing gases).
- Plain words a student can follow. Do not write "1g"; say "normal gravity". No markdown."""

FINDING = """You are helping a spacecraft fire-safety engineer understand one finding from NASA
microgravity combustion tests. Code worked out FACTS from the NASA data table; they are correct.

Write four fields:
HEADLINE: at most 12 words. State the result and which way it went, not the topic studied.
FOUND: one or two sentences on what the tests showed, with the key numbers from FACTS.
MEANS: two sentences. First, what the result suggests would happen to a fire of this kind in a
cabin like the ones in context, reasoning from what was seen in the tests (use "may" or "suggests").
Second, which design question in FACTS it bears on, and why. Do not just name the question; give the
reason in plain words. Do not repeat the context sentence back.
LIMIT: one sentence: the most important limit, taken from caveats.

Example of the MEANS field, for a different finding (paper strips that went out within 5 s at 18%
oxygen but burned to the end at 25%): "The results suggest that a small paper fire in a cabin kept
near 18% oxygen may die out on its own, while at 25% it may keep going. That makes the choice of
cabin oxygen level a choice about how often small fires stop by themselves."

{rules}

Reply with exactly four lines, starting HEADLINE:, FOUND:, MEANS: and LIMIT:.

FACTS:
{facts}
"""

BRIEFING = """You are writing the opening briefing of a fire-safety evidence dashboard for one crewed
habitat design. Code ranked NASA microgravity combustion findings by how close their tests came to
this habitat's oxygen level and pressure, and found the gaps listed. FACTS holds the habitat, the
top-ranked findings with the result nearest the habitat, and the gaps.

Write three or four sentences: what the closest evidence shows for this habitat (with its key
numbers), what that suggests for a fire in this habitat, and the most important gap for this
habitat. Refer to findings by what they found, not by rank or score. Do not open with the habitat's
name and conditions; the page already shows them.

{rules}

Reply with the sentences only.

FACTS:
{facts}
"""

JUDGE = """You are checking an interpretation of test data against the facts it was written from.
FACTS is a JSON object. SENTENCES are numbered. For each sentence decide:
SUPPORTED: every fact it states (a number, material, fuel, condition or result) is in FACTS, and any
  interpretation follows directly from FACTS. Rewording is fine. Careful words such as "suggests"
  are fine.
UNSUPPORTED: it states a fact that FACTS does not contain, attaches a number to the wrong thing,
  contradicts FACTS, brings in outside knowledge (other experiments, standards, physics not in
  FACTS), claims certainty FACTS cannot give, claims cause and effect, or calls something safe or
  unsafe.
FACTS.context says where the findings apply and which design questions they bear on. A sentence that
connects a finding in FACTS to that context, or names one of those design questions, is SUPPORTED
as long as it states the finding correctly.

Reply with exactly one line per sentence and nothing else, in this form:
1 SUPPORTED
2 UNSUPPORTED: short reason

FACTS:
{facts}

SENTENCES:
{sentences}
"""


def call(model, prompt, key, timeout=120):
    body = json.dumps({"contents": [{"parts": [{"text": prompt}]}],
                       "generationConfig": {"temperature": 0.2, "maxOutputTokens": 16384}}).encode()
    req = urllib.request.Request(si.URL.format(model=model), data=body,
                                 headers={"x-goog-api-key": key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        data = json.load(r)
    cand = data["candidates"][0]
    if cand.get("finishReason") not in (None, "STOP"):
        raise RuntimeError(f"{model}: reply stopped early ({cand.get('finishReason')})")
    parts = cand["content"].get("parts", [])
    return " ".join(p["text"] for p in parts if "text" in p and not p.get("thought")).strip()


def first(models, prompt, key):
    last = "no model answered"
    for m in models:
        for attempt in range(3):  # busy servers (429, 503) usually answer on a retry
            try:
                raw = call(m, prompt, key)
                if raw:
                    return m, raw
                last = f"{m}: empty reply"
            except Exception as err:  # HTTP errors, timeouts, replies cut short
                last = f"{m}: {type(err).__name__} {getattr(err, 'code', '')} {err}".strip()
            time.sleep(10 * (attempt + 1))
    raise RuntimeError(last)


def judge(sentences, facts, key, exclude):
    """Second pass. Returns (model, {index: reason}) for the sentences it rejects."""
    prompt = JUDGE.format(facts=json.dumps(facts, ensure_ascii=False),
                          sentences="\n".join(f"{i} {s}" for i, s in enumerate(sentences, 1)))
    for m in [j for j in JUDGES if j != exclude] + [exclude]:
        raw = None
        for attempt in range(2):
            try:
                raw = call(m, prompt, key)
                break
            except Exception:
                time.sleep(10 * (attempt + 1))
        if raw is None:
            continue
        verdicts = dict(re.findall(r"(?m)^\s*(\d+)\s+(SUPPORTED|UNSUPPORTED[^\n]*)", raw))
        if len(verdicts) == len(sentences):
            return m, {int(i): v for i, v in verdicts.items() if v.startswith("UNSUPPORTED")}
    return None, {}


def parse(raw):
    out = {}
    for f in FIELDS:
        m = re.search(rf"(?ms)^\s*\**{f}\**\s*:\s*(.+?)(?=^\s*\**(?:{'|'.join(FIELDS)})\**\s*:|\Z)", raw)
        out[f.lower()] = re.sub(r"\s+", " ", m.group(1)).strip() if m else ""
    return out


def checked(fields, facts, key, writer):
    """Run both checks over every sentence of every field. Returns the kept fields and a report."""
    report = {"total": 0, "verified": 0, "dropped": [], "judged_out": []}
    kept = {}
    for name, text in fields.items():
        v = si.verify(text, facts)
        report["total"] += v["total"]
        report["verified"] += v["verified"]
        if v["dropped"]:
            report["dropped"].append(f"{name}: {v['dropped']} sentence(s)")
        kept[name] = si.sentences(v["text"])
    flat = [(n, s) for n, ss in kept.items() for s in ss]
    model, bad = judge([s for _, s in flat], facts, key, writer) if flat else (None, {})
    report["judge"] = model
    out = {n: [] for n in fields}
    for i, (n, s) in enumerate(flat, 1):
        if i in bad:
            report["judged_out"].append(f"{n}: {s} -> {bad[i]}")
        else:
            out[n].append(s)
    return {n: " ".join(ss) for n, ss in out.items()}, report


def key_of(kind, facts, template):
    return hashlib.sha256(json.dumps([kind, template, facts], sort_keys=True, ensure_ascii=False).encode()).hexdigest()[:20]


CONTEXT = {
    "where_this_applies": ("crewed spacecraft, Moon bases and Mars habitats are closed cabins with fans moving the "
                           "air; NASA's challenge statement says exploration habitats may run at 30% oxygen or more "
                           "at 10.2 psi or less"),
    "design_questions": ("what oxygen level and pressure to run the cabin at; how to move the air; how to detect a "
                         "fire and the gases it gives off; which materials to allow on board; which gases to use to "
                         "put a fire out"),
}


def finding_facts(f):
    return {"topic": f["topic"], "investigation": ", ".join(f["investigations"]), **f["facts"], "caveats": f["caveats"],
            "context": CONTEXT}


def gaps(o2, pressure, cat=None):
    """What the loaded data cannot say about a habitat, worked out by code. Mirrored in logic.js."""
    cat = core.load_catalog() if cat is None else cat
    t = cat[cat["gravity"] != "1g"]
    out = []
    top = float(t["o2_max"].max())
    if o2 > top + 2:
        out.append(f"no flame test in the data ran above {top:g}% oxygen, and this habitat is at {o2:g}%")
    solid = float(t[t["fuel_class"] == "solid"]["o2_max"].max())
    if o2 > solid + 2:
        out.append(f"no solid material (fabric, plastic) was flame-tested above {solid:g}% oxygen")
    low = float(t["pressure_min"].min())
    if pressure < low - 1:
        out.append(f"no test in the data ran below {low:g} psi, and this habitat is at {pressure:g} psi")
    out.append("no solid-material flame test in the data lists its pressure")
    out.append("no test in the data ran in Moon or Mars gravity")
    return out


def briefing_facts(name, sc, found, texts):
    ranked = bf.rank(found, sc["o2"], sc["pressure"])[:4]
    by = {f["id"]: f for f in found}
    top = []
    for r in ranked:
        f = by[r["id"]]
        top.append({"finding": texts.get(f["id"], {}).get("headline") or f["topic"],
                    "result_nearest_this_habitat": f["bands"][r["band"]]["line"]})
    return {"habitat": {"name": name, "oxygen_pct": sc["o2"], "pressure_psi": sc["pressure"]},
            "closest_findings": top, "gaps": gaps(sc["o2"], sc["pressure"]), "context": CONTEXT}


def write_finding(f, key):
    facts = finding_facts(f)
    writer, raw = first(WRITERS, FINDING.format(rules=RULES, facts=json.dumps(facts, ensure_ascii=False)), key)
    kept, report = checked(parse(raw), facts, key, writer)
    return {"kind": "finding", "id": f["id"], "model": writer, "raw": raw, **report, **kept}


def main():
    key = si.api_key()
    if not key:
        sys.exit("No GEMINI_API_KEY in keys.env")
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    save = lambda: CACHE.write_text(json.dumps(cache, indent=1, ensure_ascii=False), encoding="utf-8")
    found = bf.findings()
    wanted = set()

    texts, todo = {}, {}
    for f in found:
        k = key_of("finding", finding_facts(f), FINDING)
        wanted.add(k)
        if k not in cache:
            todo[k] = f
    with ThreadPoolExecutor(max_workers=2) as pool:  # two at a time; more gets "server busy" errors
        jobs = {pool.submit(write_finding, f, key): k for k, f in todo.items()}
        for done in as_completed(jobs):
            k, f = jobs[done], todo[jobs[done]]
            try:
                cache[k] = done.result()
            except RuntimeError as err:
                print(f"{f['id']}: {err}", flush=True)
                continue
            save()
            e = cache[k]
            print(f"{f['id']}: {e['model']}, {e['verified']}/{e['total']} numbers, dropped {e['dropped']}, "
                  f"judge {e['judge']} removed {len(e['judged_out'])}", flush=True)
    for f in found:
        k = key_of("finding", finding_facts(f), FINDING)
        if k in cache:
            texts[f["id"]] = cache[k]

    for name, sc in core.SCENARIOS.items():
        if name == "Custom":
            continue
        facts = briefing_facts(name, sc, found, texts)
        k = key_of("briefing", facts, BRIEFING)
        wanted.add(k)
        if k in cache:
            continue
        try:
            writer, raw = first(WRITERS, BRIEFING.format(rules=RULES, facts=json.dumps(facts, ensure_ascii=False)), key)
        except RuntimeError as err:
            print(f"briefing {name}: {err}", flush=True)
            continue
        kept, report = checked({"text": raw}, facts, key, writer)
        cache[k] = {"kind": "briefing", "id": name, "model": writer, "raw": raw, "facts": facts, **report, **kept}
        save()
        print(f"briefing {name}: {writer}, {report['verified']}/{report['total']} numbers, "
              f"judge {report['judge']} removed {len(report['judged_out'])}", flush=True)
        time.sleep(4)

    cache = {k: v for k, v in cache.items() if k in wanted}
    save()
    print(f"done: {len(cache)} texts cached")


def load():
    """The cached texts the site uses: ({finding id: entry}, {habitat: entry})."""
    cache = json.loads(CACHE.read_text(encoding="utf-8")) if CACHE.exists() else {}
    found = bf.findings()
    by_key = {key_of("finding", finding_facts(f), FINDING): f["id"] for f in found}
    texts = {by_key[k]: v for k, v in cache.items() if k in by_key}
    briefs = {}
    for name, sc in core.SCENARIOS.items():
        if name == "Custom":
            continue
        k = key_of("briefing", briefing_facts(name, sc, found, texts), BRIEFING)
        if k in cache:
            briefs[name] = cache[k]
    return texts, briefs


if __name__ == "__main__":
    main()
