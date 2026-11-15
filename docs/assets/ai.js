/* Live SI. Answers questions and writes briefings from the facts code computed for the user's habitat.

   Every answer goes through the same two checks as the precomputed text:
     1. numbers: any sentence with a number that is not in the context sent to the model is removed;
     2. second pass: a different model re-reads every sentence against that context and flags any it
        finds unsupported, which are removed.
   The model sees only the context built here; it never sees the raw tables.

   Where requests go (assets/config.js, window.FF_AI):
     proxy: a URL that forwards {model, prompt} to Gemini and keeps the key on the server, or
     key:   a Gemini API key used straight from the browser (visible to anyone who opens the page).
   With neither set, a visitor can paste their own key; it stays in their browser. */
(function (root) {
  "use strict";
  const CFG = Object.assign({
    proxy: "", key: "",
    writers: ["gemini-3.1-flash-lite", "gemini-3.5-flash-lite", "gemma-4-26b-a4b-it"],
    judges: ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite"],
  }, root.FF_AI || {});
  const URL = "https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent";
  const NUMBER = /(?<![A-Za-z\d.])\d+(?:\.\d+)?/g;
  const STORE = "airburn-gemini-key";

  function userKey() { try { return localStorage.getItem(STORE) || ""; } catch (e) { return ""; } }
  function setUserKey(k) { try { k ? localStorage.setItem(STORE, k.trim()) : localStorage.removeItem(STORE); } catch (e) { /* storage blocked */ } }
  function mode() { return CFG.proxy ? "proxy" : CFG.key ? "site key" : userKey() ? "your key" : ""; }

  async function call(model, prompt, signal) {
    const body = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.2, maxOutputTokens: 8192 } };
    let res;
    if (CFG.proxy) {
      // text/plain keeps this a "simple" request, so no CORS preflight is needed
      res = await fetch(CFG.proxy, { method: "POST", body: JSON.stringify({ model, body }), signal });
    } else {
      res = await fetch(URL.replace("%s", model), {
        method: "POST", signal,
        headers: { "Content-Type": "application/json", "x-goog-api-key": CFG.key || userKey() },
        body: JSON.stringify(body),
      });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) {
      const e = new Error((data.error && data.error.message) || `HTTP ${res.status}`);
      e.status = (data.error && data.error.code) || res.status; // a proxy may report errors inside a 200
      throw e;
    }
    const cand = (data.candidates || [])[0];
    if (!cand || (cand.finishReason && cand.finishReason !== "STOP")) throw new Error("reply cut short");
    return (cand.content.parts || []).filter((p) => p.text && !p.thought).map((p) => p.text).join(" ").trim();
  }

  async function first(models, prompt, signal) {
    let last;
    for (const m of models) {
      try { const t = await call(m, prompt, signal); if (t) return { model: m, text: t }; }
      catch (e) { if (signal && signal.aborted) throw e; last = e; }
    }
    throw last || new Error("no model answered");
  }

  const numbers = (s) => (s.match(NUMBER) || []).map((x) => Math.round(parseFloat(x) * 100) / 100);
  const sentences = (t) => t.replace(/\s+/g, " ").trim().split(/(?<=[.!?])\s+(?=[A-Z0-9"(])/).filter(Boolean);

  /* Check 1: drop sentences with a number that is not in the context. */
  function verify(text, context) {
    const allowed = new Set(numbers(JSON.stringify(context)));
    let total = 0, found = 0;
    const kept = [], dropped = [];
    sentences(text).forEach((s) => {
      const ns = numbers(s.replace(/\[(?:F\d+|R\d+|gaps|model|map|air)(?:\s*,\s*(?:F\d+|R\d+|gaps|model|map|air))*\]/g, "").replace(/\b1\s?g\b/g, ""));
      const ok = ns.filter((n) => allowed.has(n)).length;
      total += ns.length; found += ok;
      (ok === ns.length ? kept : dropped).push(s);
    });
    return { kept, dropped, total, found };
  }

  const JUDGE = `You are checking an answer about test data against the facts it was written from.
FACTS is a JSON object. SENTENCES are numbered. For each sentence decide:
SUPPORTED: every fact it states (a number, material, fuel, condition or result) is in FACTS, and any
interpretation follows directly from FACTS. Rewording is fine. Careful words such as "suggests" are fine.
Saying that the data does not cover something is fine when FACTS does not cover it. Citations such
as [F2] are labels, not claims.
UNSUPPORTED: it states a fact that FACTS does not contain, attaches a number to the wrong thing,
contradicts FACTS, brings in outside knowledge, claims cause and effect, or calls something safe or unsafe.
FACTS.context says where the findings apply and which design questions they bear on; linking a finding
to them is SUPPORTED.

Reply with exactly one line per sentence and nothing else, in this form:
1 SUPPORTED
2 UNSUPPORTED: short reason

FACTS:
%FACTS%

SENTENCES:
%SENTENCES%`;

  /* Check 2: a different model re-reads every sentence. Returns the sentences it rejects. */
  async function judge(kept, context, writer, signal) {
    if (!kept.length) return { model: null, bad: [] };
    const prompt = JUDGE.replace("%FACTS%", JSON.stringify(context)).replace("%SENTENCES%", kept.map((s, i) => `${i + 1} ${s}`).join("\n"));
    const models = CFG.judges.filter((m) => m !== writer).concat(CFG.judges.filter((m) => m === writer));
    for (const m of models) {
      try {
        const raw = await call(m, prompt, signal);
        const v = {};
        raw.split("\n").forEach((line) => { const x = line.match(/^\s*(\d+)\s+(SUPPORTED|UNSUPPORTED.*)$/); if (x) v[+x[1]] = x[2]; });
        if (Object.keys(v).length === kept.length) {
          return { model: m, bad: kept.map((s, i) => [s, v[i + 1]]).filter(([, r]) => r.startsWith("UNSUPPORTED")) };
        }
      } catch (e) { if (signal && signal.aborted) throw e; }
    }
    return { model: null, bad: [] };
  }

  const RULES = `Rules:
- Use only CONTEXT. Bring in no outside facts: no other experiments, standards, missions or numbers.
- If CONTEXT does not answer the question, say so plainly and name the gap from CONTEXT.gaps that applies.
- End each sentence with the sources it used, once, in square brackets, like [F2] or [F2, model].
  Never put a citation inside a sentence.
- Write every number exactly as it appears in CONTEXT. Do not work out new numbers, percentages or ratios.
- The tests change several things at once: describe what was seen together, never cause and effect.
- Say "suggests" or "may", never "proves". Do not call anything safe or unsafe, and give no instructions.
- Plain words a student can follow. Do not write "1g"; say "normal gravity". No markdown, no lists.`;

  const ASK = `You answer questions on a fire-safety dashboard for crewed spacecraft, Moon bases and Mars
habitats. Code computed CONTEXT from NASA microgravity combustion test tables: the user's habitat, the
findings ranked for it (each with an id such as F1, its facts, the result nearest the habitat and its
caveats), what the data cannot tell, the materials the user picked, and model_predictions from models
fitted to the tests, and test_coverage: how close the tests come to this habitat and to the atmospheres crews have
breathed. When you use a model prediction, say once that it is a model prediction, and cite it as [model]. Cite
test_coverage as [map]. nasa_reports holds results from NASA technical reports beyond the PSI tables (each with an
id such as R1, the result nearest the habitat, its facts, where and in what gravity it was tested, and its caveat);
cite them like [R1], and say when a result was in Earth gravity or a drop tower rather than in orbit. When no PSI
finding is close to the habitat, use the closest nasa_reports entries. air holds code-computed estimates for this
habitat's air from NASA's published limits, not test data: minutes of pure-oxygen prebreathe before a spacewalk, the
inspired oxygen and the altitude it matches; cite it as [air] and call it an estimate.

Answer QUESTION in at most 110 words.

${RULES}

QUESTION: %Q%

CONTEXT:
%C%`;

  const BRIEF = `You are writing the opening briefing of a fire-safety evidence dashboard for one crewed
habitat design. Code computed CONTEXT from NASA microgravity combustion test tables: the habitat, the
findings ranked by how close their tests came to it (each with an id such as F1), the gaps,
test_coverage: how close the tests come to this habitat (cite it as [map]), and nasa_reports: results from
NASA technical reports beyond the PSI tables, ranked the same way (cite them like [R1]; say when a result was
in Earth gravity or a drop tower rather than in orbit). When no PSI finding is close, lead with the closest
nasa_reports entry. air holds code-computed estimates of this habitat's spacewalk prebreathe and breathing from
NASA's published limits, not test data (cite it as [air]).

Write three or four sentences: what the closest evidence shows for this habitat, with its key numbers;
what that suggests for a fire in this habitat; and the most important gap. If the closest tests are far
from this habitat's oxygen level, say so first. Do not open with the habitat's name and conditions.

${RULES}

CONTEXT:
%C%`;

  /* What the fitted models (assets/models.js) predict for this habitat, as plain facts. */
  function modelFacts(FF, st) {
    const MD = root.FFModels;
    if (!MD || !FF.models) return undefined;
    const D = FF.models.droplets, G = FF.models.gas, pc = (v) => Math.round(v * 100);
    const drop = (fuel) => {
      const x = MD.dropletX(st.o2, "N2", st.pressure, 3, fuel), e = MD.classify(D.ending, x), ff = MD.fiftyFifty(D.ending, x, 0);
      return { droplet: `3 mm ${fuel.toLowerCase()} droplet, nitrogen only`, chance_flame_goes_out_on_its_own_pct: pc(e.fit[0]),
        range_90_pct: [pc(e.lo[0]), pc(e.hi[0])], chance_burns_until_used_up_pct: pc(e.fit[1]), chance_droplet_disrupted_pct: pc(e.fit[2]),
        oxygen_where_chance_of_going_out_is_50_pct: ff ? Math.round(ff.fit * 10) / 10 : "no crossing" };
    };
    const se = MD.classify(G.self_ext, MD.gasX(st.o2, st.pressure, 1, 1, "propane"));
    return {
      what_these_are: "predictions from models fitted to the FLEX and CFI-G test tables and checked on tests they never saw; they are model output, not test results",
      habitat_inside_tested_oxygen_range: st.o2 >= D.range.o2[0] && st.o2 <= D.range.o2[1],
      droplets: [drop("Methanol"), drop("Heptane")],
      gas_flame: { flame: "propane, 1 mg/s, pure fuel", chance_lit_flame_goes_out_on_its_own_pct: pc(se.fit[0]), range_90_pct: [pc(se.lo[0]), pc(se.hi[0])] },
      model_quality: { droplet_auc: D.ending.score.auc_goes_out, gas_auc: G.self_ext.score.auc, gas_lighting: "could not be predicted better than guessing" },
    };
  }

  /* The facts sent to the model: everything the page shows for this habitat, and nothing else. */
  /* the Atmosphere map's numbers: how close NASA's microgravity tests come to this habitat, and to the
     atmospheres crews have breathed */
  function coverageFacts(FF, L, st) {
    const c = L.coverage(FF, st.o2, st.pressure), pts = L.placed(FF), r1 = (v) => Math.round(v * 10) / 10;
    return {
      tests_with_oxygen_and_pressure: pts.length,
      not_on_map: `NASA's ${L.inverse(FF).n} inverse-flame tests (ACME CFI-G and Flame Design) fed up to ${L.inverse(FF).top}% oxygen out of the burner into a chamber of fuel and nitrogen; that oxygen is not the surrounding air, so those tests are not counted here`,
      highest_oxygen_tested_pct: Math.max(...pts.map((x) => x.o)), lowest_pressure_tested_psi: r1(Math.min(...pts.map((x) => x.p))),
      tests_near_this_habitat: c.n, near_means: `within ${FF.near} points of oxygen and 25% of the pressure`,
      nearest_test: c.nearest ? { investigation: c.nearest.i, oxygen_pct: r1(c.nearest.o), pressure_psi: r1(c.nearest.p) } : null,
      solid_material_tests_near_this_oxygen: c.solids,
      crew_atmospheres: L.ATMOS.map((a) => ({ name: a.name, when: a.when, oxygen_pct: a.o2, pressure_psi: a.p, tests_near: L.coverage(FF, a.o2, a.p).n })),
    };
  }

  /* NASA technical report evidence in the order the Insights page shows it (Moon or Mars gravity pins the drop-tower group) */
  function reportFacts(FF, L, st) {
    if (!L.reportEvidence) return [];
    let rev = L.reportEvidence(FF, st.o2, st.pressure);
    rev = st.gravity > 0 ? [...rev.filter((e) => e.id === "gravity"), ...rev.filter((e) => e.id !== "gravity")] : [...rev.filter((e) => e.id !== "gravity"), ...rev.filter((e) => e.id === "gravity")];
    return rev;
  }
  /* the cabin-air estimates the "Choose the air" view shows (logic.js), for this habitat */
  function airFacts(L, st) {
    if (!L.airAt) return undefined;
    const A = L.AIR, a = st.air || { suit: A.suit, strict: false }, rmax = a.strict ? A.rstrict : A.rmax, x = L.airAt(st.o2, st.pressure, a.suit, rmax), c = L.airCorner(a.suit, rmax);
    return {
      what_this_is: "estimates from NASA's published limits, not test data: R is the cabin's nitrogen pressure over the suit pressure; NASA accepted its Shuttle and ISS prebreathe protocols at R 1.65; inspired oxygen is the oxygen fraction times (pressure minus 47 mmHg); simplified, one tissue, at rest",
      suit_pressure_psi: a.suit, decompression_limit_R: rmax, R_value: x.R, prebreathe_minutes_of_pure_oxygen: Math.round(x.min),
      inspired_oxygen_mmHg: Math.round(x.pio2), less_oxygen_than_nasa_accepts: x.low, altitude_with_the_same_oxygen_m: Math.round(x.alt / 10) * 10,
      least_oxygen_cabin_with_no_prebreathe: { oxygen_pct: c.o2, pressure_psi: c.p },
    };
  }
  function context(FF, L, st) {
    const ranked = L.rankFindings(FF, st.o2, st.pressure);
    const ids = Object.fromEntries(FF.findings.map((f, i) => [f.id, "F" + (i + 1)]));
    return {
      habitat: { oxygen_pct: st.o2, pressure_psi: st.pressure, airflow_cm_s: st.flow, gravity: FF.gravity[st.gravity] },
      context: {
        where_this_applies: "crewed spacecraft, Moon bases and Mars habitats are closed cabins with fans moving the air; NASA's challenge statement says exploration habitats may run at 30% oxygen or more at 10.2 psi or less",
        design_questions: "what oxygen level and pressure to run the cabin at; how to move the air; how to detect a fire and the gases it gives off; which materials to allow on board; which gases to use to put a fire out",
      },
      findings_ranked: ranked.map((r) => {
        const f = FF.findings.find((x) => x.id === r.id), b = f.bands[r.band];
        return {
          id: ids[f.id], topic: f.topic, investigation: f.investigations.join(", "), relevance: r.score,
          result_nearest_this_habitat: b.line,
          oxygen_of_those_tests_pct: b.o2, pressure_of_those_tests_psi: b.p,
          facts: f.facts, caveats: f.caveats,
        };
      }),
      gaps: L.gaps(FF, st.o2, st.pressure),
      model_predictions: modelFacts(FF, st),
      test_coverage: coverageFacts(FF, L, st),
      air: airFacts(L, st),
      nasa_reports: reportFacts(FF, L, st).map((e, k) => ({
        id: "R" + (k + 1), title: e.title, source: e.where, tested_in: e.gravity, oxygen_tested_pct: e.o2, pressure_tested_psi: e.p,
        oxygen_points_from_this_habitat: e.o2_gap, result_nearest_this_habitat: e.nearest, facts: e.lines, caveat: e.caveat,
        note: "transcribed from a NASA technical report, not from the PSI tables",
      })),
      materials_on_board: st.materials.map((m) => {
        const ev = L.materialEvidence(FF, m, st.o2);
        return { material: m, flame_tests_in_microgravity: ev.flame_tests, oxygen_tested_pct: ev.oxygen_tested_pct || "not listed",
          oxygen_gap_to_habitat_points: ev.oxygen_gap_points, flame_tests_within_2_points: ev.flame_tests_near, smoke_tests: ev.smoke_tests };
      }),
    };
  }

  /* Ask a question (kind "ask") or write a briefing (kind "brief"). Resolves to
     {text, model, judge, total, found, dropped: [...], judged_out: [[sentence, reason]]}. */
  async function run(kind, FF, L, st, question, signal) {
    const ctx = context(FF, L, st);
    const prompt = (kind === "ask" ? ASK.replace("%Q%", question.slice(0, 500)) : BRIEF).replace("%C%", JSON.stringify(ctx));
    const w = await first(CFG.writers, prompt, signal);
    const v = verify(w.text, ctx);
    const j = await judge(v.kept, ctx, w.model, signal);
    const out = new Set(j.bad.map(([s]) => s));
    return {
      text: v.kept.filter((s) => !out.has(s)).join(" "), model: w.model, judge: j.model,
      total: v.total, found: v.found, dropped: v.dropped, judged_out: j.bad, ids: Object.fromEntries(FF.findings.map((f, i) => ["F" + (i + 1), f.id])),
      rids: Object.fromEntries(reportFacts(FF, L, st).map((e, k) => ["R" + (k + 1), e.id])),
    };
  }

  root.FFAI = { run, mode, setUserKey, userKey, verify, context, configured: () => !!mode() };
})(typeof window !== "undefined" ? window : globalThis);
