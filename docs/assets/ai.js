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
  const STORE = "flamebound-gemini-key";

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
      const ns = numbers(s.replace(/\[F\d+\]/g, "").replace(/\b1\s?g\b/g, ""));
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
- After each claim, cite the finding it comes from in square brackets, like [F2].
- Write every number exactly as it appears in CONTEXT. Do not work out new numbers, percentages or ratios.
- The tests change several things at once: describe what was seen together, never cause and effect.
- Say "suggests" or "may", never "proves". Do not call anything safe or unsafe, and give no instructions.
- Plain words a student can follow. Do not write "1g"; say "normal gravity". No markdown, no lists.`;

  const ASK = `You answer questions on a fire-safety dashboard for crewed spacecraft, Moon bases and Mars
habitats. Code computed CONTEXT from NASA microgravity combustion test tables: the user's habitat, the
findings ranked for it (each with an id such as F1, its facts, the result nearest the habitat and its
caveats), what the data cannot tell, and the materials the user picked.

Answer QUESTION in at most 110 words.

${RULES}

QUESTION: %Q%

CONTEXT:
%C%`;

  const BRIEF = `You are writing the opening briefing of a fire-safety evidence dashboard for one crewed
habitat design. Code computed CONTEXT from NASA microgravity combustion test tables: the habitat, the
findings ranked by how close their tests came to it (each with an id such as F1), and the gaps.

Write three or four sentences: what the closest evidence shows for this habitat, with its key numbers;
what that suggests for a fire in this habitat; and the most important gap. If the closest tests are far
from this habitat's oxygen level, say so first. Do not open with the habitat's name and conditions.

${RULES}

CONTEXT:
%C%`;

  /* The facts sent to the model: everything the page shows for this habitat, and nothing else. */
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
    };
  }

  root.FFAI = { run, mode, setUserKey, userKey, verify, context, configured: () => !!mode() };
})(typeof window !== "undefined" ? window : globalThis);
