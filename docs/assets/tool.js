/* The tool page. All evidence comes from logic.js; this file only draws it. */
(function () {
  "use strict";
  const FF = window.FF, L = window.FFLogic, CH = window.FFCharts, LINKS = window.FF_LINKS, esc = CH.esc, g = L.g;
  const $ = (id) => document.getElementById(id);
  FFFlame.ambient($("stars"));

  const GRAVITY_SHORT = ["Orbit · microgravity", "Moon · 0.17 g", "Mars · 0.38 g"];
  const DEFAULT_MATERIALS = ["PMMA (acrylic)", "Silicone", "Cotton-fiberglass fabric (SIBAL)", "Nomex", "Kapton", "Teflon"];
  const GRADE = {
    near: ["Tested near your oxygen level", "M5 12.5l4.2 4.2L19 7"],
    far: ["Tested, but not near your oxygen level", "M4 12h16M8 8l-4 4 4 4M16 8l4 4-4 4"],
    unlisted: ["Tested, oxygen level not listed", "M12 17v.01M9.2 9a2.9 2.9 0 1 1 4.6 2.4c-1 .7-1.8 1.3-1.8 2.6"],
    smoke: ["Smoke tests only", "M4 15h12a3.5 3.5 0 0 0 0-7 5 5 0 0 0-9.6 1.5A3 3 0 0 0 4 15zM7 19h10"],
    none: ["No tests loaded", "M6 12h12"],
  };
  const icon = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
  const DL = icon("M12 4v11M7 11l5 5 5-5M5 20h14");

  const q = new URLSearchParams(location.search);
  const atQ = q.has("o2") && q.has("p") && !isNaN(+q.get("o2")) && !isNaN(+q.get("p")); // e.g. ?o2=100&p=16.7 from the map
  const preset = (atQ && FF.scenarios.find((s) => s.o2 === +q.get("o2") && s.pressure === +q.get("p"))) || (atQ ? { ...FF.scenarios.find((s) => s.name === "Custom"), o2: Math.min(100, Math.max(10, +q.get("o2"))), pressure: Math.min(45, Math.max(3, +q.get("p"))) } : null) || FF.scenarios.find((s) => s.name === q.get("s")) || FF.scenarios[1];
  const state = {
    scenario: preset.name, o2: preset.o2, pressure: preset.pressure, flow: 10,
    gravity: q.has("g") && !isNaN(+q.get("g")) ? Math.min(2, Math.max(0, Math.round(+q.get("g"))))
      : preset.name === "ISS cabin" || (atQ && !/^Moon|^Exploration/.test(preset.name)) ? 0 : 1, // the ISS, and past crew atmospheres opened from the map, are in orbit
    materials: DEFAULT_MATERIALS.filter((m) => FF.materials.includes(m)),
    view: ["insights", "map", "model", "replay", "brief", "gravity", "investigations", "compare", "data"].includes(q.get("view")) ? q.get("view") : "insights",
    model: { fuel: "Methanol", gas: "N2", d0: 3, gfuel: "propane", flow: 1, xf: 1 },
    replay: { kind: "droplets" },
    concern: "solid", compare: ["SAFFIRE-2", "BASS-II", "FLEX"], open: null, kind: "", find: "",
  };
  const partial = () => state.gravity > 0;
  const gravityLabel = () => FF.gravity[state.gravity];
  const isPreset = () => state.scenario !== "Custom";

  /* ------------------------------------------------------------ controls */
  function drawControls() {
    $("scenarios").innerHTML = FF.scenarios.map((s) => `<button class="pill" aria-pressed="${s.name === state.scenario}" data-s="${esc(s.name)}">${esc(s.name)}</button>`).join("");
    $("scenario-note").textContent = FF.scenarios.find((s) => s.name === state.scenario).note;
    $("gravity").innerHTML = GRAVITY_SHORT.map((t, i) => `<button class="pill" aria-pressed="${i === state.gravity}" data-gi="${i}">${t}</button>`).join("");
    $("materials").innerHTML = FF.materials.map((m) => `<button class="pill" aria-pressed="${state.materials.includes(m)}" data-m="${esc(m)}">${esc(m.replace(" fabric (SIBAL)", " fabric"))}</button>`).join("");
    [["o2", "%"], ["pressure", " psi"], ["flow", " cm/s"]].forEach(([k, unit]) => { $(k).value = state[k]; $(k + "-out").textContent = g(state[k]) + unit; });
  }
  document.querySelector(".side").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.s) { const s = FF.scenarios.find((x) => x.name === b.dataset.s); state.scenario = s.name; state.o2 = s.o2; state.pressure = s.pressure; if (s.name === "ISS cabin") state.gravity = 0; else if (/^Moon/.test(s.name)) state.gravity = 1; }
    else if (b.dataset.gi) state.gravity = +b.dataset.gi;
    else if (b.dataset.m) { const m = b.dataset.m; state.materials = state.materials.includes(m) ? state.materials.filter((x) => x !== m) : FF.materials.filter((x) => x === m || state.materials.includes(x)); }
    update();
  });
  ["o2", "pressure", "flow"].forEach((k) => $(k).addEventListener("input", () => {
    state[k] = +$(k).value;
    if (k !== "flow") state.scenario = "Custom";
    update();
  }));
  document.querySelectorAll(".tab").forEach((t) => t.addEventListener("click", () => { state.view = t.dataset.view; update(); window.scrollTo({ top: 0 }); }));

  /* --------------------------------------------------------------- brief */
  function facts() {
    const mats = state.materials.map((m) => L.materialEvidence(FF, m, state.o2));
    return { mats, atm: L.atmosphereEvidence(FF, state.o2), near: mats.filter((m) => m.grade === "near").length };
  }
  function recordsFor(materials) { return FF.rows.filter((r) => r.m.some((m) => materials.includes(m))); }
  function siBlock(si) {
    return si ? `<div class="si">${esc(si.text)}</div>` : "";
  }

  function gsiText(ev) {
    if (!ev.gravity_pairs.length) return "no 1g pair";
    const v = ev.gravity_pairs.map((p) => p.gsi), lo = Math.min(...v), hi = Math.max(...v);
    return lo === hi ? lo.toFixed(2) : `${lo.toFixed(2)}–${hi.toFixed(2)}`;
  }
  function materialCard(ev) {
    const [label, path] = GRADE[ev.grade];
    const si = isPreset() ? FF.si.material[`${state.scenario}|${ev.material}`] : null;
    const gap = ev.oxygen_gap_points == null ? "—" : ev.oxygen_gap_points === 0 ? "0" : g(ev.oxygen_gap_points);
    const pairs = ev.gravity_pairs.length ? `<div class="scroll" style="margin-top:10px"><table class="t"><tr><th>Saffire-II sample</th><th>Microgravity</th><th>1g</th><th>GSI</th></tr>${ev.gravity_pairs.map((p) => `<tr><td>${esc(p.sample)} · ${esc(p.thickness)}</td><td>${esc(p.microgravity_burn_length)}</td><td>${esc(p.normal_gravity_burn_length)}</td><td class="mono">${p.gsi.toFixed(2)}</td></tr>`).join("")}</table></div>` : "";
    return `<article class="mat">
      <header><h3>${esc(ev.material)}</h3><span class="status ${ev.grade}">${icon(path)}${label}</span></header>
      ${ev.oxygen_tested_pct ? CH.mini(FF, ev.material, state.o2) : ""}
      <div class="kv">
        <div><div class="k">Flame tests</div><div class="v">${ev.flame_tests}</div></div>
        <div><div class="k">Oxygen gap, points</div><div class="v">${gap}</div></div>
        <div><div class="k">Gravity, GSI</div><div class="v${ev.gravity_pairs.length ? "" : " sm"}">${gsiText(ev)}</div></div>
      </div>
      ${siBlock(si)}
      <details><summary>The evidence in detail</summary><ul style="margin-top:8px">${L.materialSentences(FF, ev, state.o2, partial()).map((s) => `<li>${esc(s)}</li>`).join("")}</ul>${pairs}</details>
    </article>`;
  }
  function split(parts) {
    const total = parts.reduce((a, p) => a + p[1], 0) || 1;
    return `<div class="split" role="img" aria-label="${esc(parts.map((p) => `${p[0]}: ${p[1]}`).join(", "))}">${parts.filter((p) => p[1]).map((p) => `<span style="flex:${p[1] / total};background:${p[2]}" data-tip="<b>${esc(p[0])}</b><span>${p[1]} of ${total} tests</span>"></span>`).join("")}</div>
      <div class="legend">${parts.map((p) => `<span><i style="background:${p[2]}"></i>${esc(p[0])} <b style="color:var(--ink)">${p[1]}</b></span>`).join("")}</div>`;
  }
  function drawBrief() {
    const el = $("view-brief");
    if (!state.materials.length) { el.innerHTML = `<h1>Pick at least one material</h1><p class="lede">Choose the materials on board in the panel on the left.</p>`; return; }
    const f = facts(), n = f.mats.length, C = 2 * Math.PI * 62;
    const gaps = f.mats.filter((m) => m.oxygen_gap_points != null);
    const best = gaps.length ? gaps.reduce((a, b) => (b.oxygen_gap_points < a.oxygen_gap_points ? b : a)) : null;
    const records = recordsFor(state.materials);
    const flameUg = f.mats.reduce((a, m) => a + m.flame_tests, 0);
    const d = f.atm.droplets, gas = f.atm.gas_flames, words = L.atmosphereSentences(f.atm, state.o2);
    const atmSi = isPreset() ? FF.si.atmosphere[state.scenario] : null;
    el.innerHTML = `
      <div class="verdict">
        <div class="ring"><svg viewBox="0 0 148 148"><circle cx="74" cy="74" r="62" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="10"/>${f.near ? `<circle cx="74" cy="74" r="62" fill="none" stroke="var(--near)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${(f.near / n) * C} ${C}"/>` : ""}</svg>
          <div class="txt"><b>${f.near}/${n}</b><span>tested near</span></div></div>
        <div><span class="eyebrow">Fire evidence brief</span>
          <h1 style="margin-top:12px">${f.near} of ${n} materials were flame-tested near ${g(state.o2)}% oxygen</h1>
          <p class="ctx">${esc(state.scenario)}: ${g(state.o2)}% oxygen, ${g(state.pressure)} psi, ${g(state.flow)} cm/s airflow, ${esc(gravityLabel())}.</p></div>
      </div>
      <div class="tiles">
        <div class="tile"><div class="k">Nearest solid flame test</div><div class="v">${best ? (best.oxygen_gap_points === 0 ? "at your level" : `${g(best.oxygen_gap_points)} <small>points of oxygen ${best.nearest_test.side.replace(" yours", "")}</small>`) : "none"}</div></div>
        <div class="tile"><div class="k">${partial() ? `Tests in ${state.gravity === 1 ? "Moon" : "Mars"} gravity` : "Microgravity flame tests"}</div><div class="v">${partial() ? `0 <small>in the PSI tables; drop-tower tests on the Gravity tab</small>` : `${flameUg} <small>for these materials</small>`}</div></div>
        <div class="tile"><div class="k">Records behind this brief</div><div class="v">${records.length} <small>NASA test records</small></div></div>
      </div>
      ${partial() ? `<div class="callout"><b>${esc(gravityLabel())}: no PSI test data.</b> No PSI investigation ran in partial gravity. The GSI on each card compares microgravity with normal gravity for the same material. NASA's challenge statement says the two could bound what happens in between; in NASA drop-tower tests at Moon gravity, three materials kept burning at lower oxygen than in either, so that bound did not hold for their oxygen limits. <a href="?view=gravity" data-view-link="gravity">See the Gravity tab</a>.</div>${reportCard("What NASA's reports add")}` : ""}

      <div class="h-sec"><h2>Materials</h2><span>"Near" means within ${g(FF.near)} points of oxygen. No solid-fuel table lists pressure, so the grade uses oxygen only.</span></div>
      <div class="mats">${f.mats.map(materialCard).join("")}</div>

      <div class="h-sec"><h2>Where the flame tests sit</h2><span>Each line is one microgravity flame test</span></div>
      <div class="figure"><div id="strip"></div></div>

      <div class="h-sec"><h2>Your atmosphere: liquids and gases</h2><span>Tests within ${g(FF.window)} points of ${g(state.o2)}% oxygen</span></div>
      <div class="cols-2">
        <div class="card"><h3>Liquid droplets · FLEX</h3>${d.tests ? split([["Flame went out first", d.flame_went_out_first, "#3987e5"], ["Burned to completion", d.burned_to_completion, "#d95926"], ["Droplet disrupted", d.droplet_disrupted, "#5d6779"]]) : ""}<p style="margin-top:12px;font-size:14.5px">${esc(words.droplets)}</p></div>
        <div class="card"><h3>Gas flames · CFI-G</h3>${gas.tests ? split([["Went out on their own", gas.went_out_on_their_own, "#3987e5"], ["Burned until fuel was cut", gas.burned_until_fuel_was_cut, "#d95926"], ["Did not ignite", gas.tests - gas.ignited, "#5d6779"]]) : ""}<p style="margin-top:12px;font-size:14.5px">${esc(words.gas)}</p></div>
      </div>
      ${atmSi ? `<div style="margin-top:14px">${siBlock(atmSi)}</div>` : ""}
      <p class="note">These counts are descriptive. Fuel, pressure and flow rate vary between tests along with oxygen.${isPreset() ? "" : " SI-worded interpretations on the material cards are prepared for the four preset habitats; custom values show the computed facts only."}</p>

      <div class="h-sec"><h2>Take it with you</h2><span></span></div>
      <div class="row">
        <button class="btn primary" id="dl-brief">${DL}Download the brief</button>
        <button class="btn" id="dl-records">${DL}Download the ${records.length} records (CSV)</button>
      </div>`;
    CH.materialStrip($("strip"), FF, state.materials, state.o2, state.scenario === "Custom" ? "Your habitat" : state.scenario);
    CH.bindTips(el);
    $("dl-brief").onclick = () => save("fire-evidence-brief.html", "text/html", briefHtml(f));
    $("dl-records").onclick = () => save("fire-evidence-records.csv", "text/csv", toCsv(records));
  }

  /* ------------------------------------------------------------ live SI */
  const AI = window.FFAI;
  const SUGGEST = ["What happens to a liquid fuel fire at this oxygen level?", "Which of my materials were flame-tested near this oxygen level?",
    "Did adding CO2 or helium help flames go out?", "What can't this data tell me about this habitat?"];
  const habitatKey = () => [state.o2, state.pressure, state.flow, state.gravity, state.materials.join("|")].join(";");
  const live = { ask: null, brief: null }; // {key, q, busy, result, error}
  const LIMIT = 30; // live requests per hour from one browser, to spare the shared free quota
  function allowed() {
    if (AI.mode() === "your key") return true;
    let t = [];
    try { t = JSON.parse(localStorage.getItem("flamebound-live") || "[]").filter((x) => Date.now() - x < 3600e3); } catch (e) { return true; }
    if (t.length >= LIMIT) return false;
    try { localStorage.setItem("flamebound-live", JSON.stringify(t.concat(Date.now()))); } catch (e) { /* storage blocked */ }
    return true;
  }
  function cites(text, r) {
    return esc(text).replace(/\[((?:F\d+|R\d+|gaps|model|map)(?:\s*,\s*(?:F\d+|R\d+|gaps|model|map))*)\]/g, (m, list) => list.split(/\s*,\s*/).map((c) =>
      /^R\d+$/.test(c) ? (r.rids && r.rids[c] ? `<a class="cite" href="#rep-${r.rids[c]}">${c}</a>` : "") :
      c === "model" ? `<a class="cite" href="?view=model" data-view-link="model">model</a>` : c === "map" ? `<a class="cite" href="?view=map" data-view-link="map">map</a>` : c === "gaps" ? `<a class="cite" href="#gaps">gaps</a>` : r.ids[c] ? `<a class="cite" href="#ins-${r.ids[c]}">${c}</a>` : "").join(""));
  }
  function liveCheck() { return ""; }

  function liveBody(slot) {
    const L2 = live[slot];
    if (!L2 || L2.key !== habitatKey()) return "";
    if (L2.busy) return `<p class="live-wait"><span class="spin"></span>Writing from the findings, then checking every sentence…</p>`;
    if (L2.error) return `<p class="live-err">${esc(L2.error)}</p>`;
    const r = L2.result;
    return `<p class="live-text">${r.text ? cites(r.text, r) : "Every sentence of the answer failed a check, so nothing is shown. Try asking another way."}</p>${liveCheck(r)}`;
  }
  async function go(slot, q) {
    if (!allowed()) { live[slot] = { key: habitatKey(), error: `This browser has used its ${LIMIT} live requests for the hour. The findings below do not need SI.` }; drawInsights(); return; }
    const key = habitatKey();
    live[slot] = { key, q, busy: true };
    drawInsights();
    try {
      const r = await AI.run(slot === "ask" ? "ask" : "brief", FF, L, state, q || "");
      if (live[slot].key === key) live[slot] = { key, q, result: r };
    } catch (e) {
      const why = e.status === 429 ? "The free SI quota is used up for now. Everything else on this page is computed and still works."
        : e.status === 400 || e.status === 403 ? "The SI service refused the key. Check the key, or clear it and paste another."
        : "The SI service did not answer. Try again in a moment.";
      if (live[slot].key === key) live[slot] = { key, q, error: why };
    }
    if (state.view === "insights") drawInsights();
  }
  function askPanel() {
    if (!AI.configured()) {
      return `<div class="ask"><div class="k">Ask Flamebound · live SI</div>
        <p class="hint" style="margin:8px 0 10px">Live questions need a Gemini API key. Paste one to try it here; it is kept only in this browser. <a href="https://aistudio.google.com/apikey" target="_blank" rel="noopener">Get a free key ↗</a></p>
        <form id="key-form" class="ask-row"><input id="key-in" class="find" type="password" autocomplete="off" placeholder="Gemini API key" aria-label="Gemini API key"><button class="btn primary small">Turn on live SI</button></form></div>`;
    }
    const a = live.ask && live.ask.key === habitatKey() ? live.ask : null;
    return `<div class="ask"><div class="k">Ask Flamebound · live SI${AI.mode() === "your key" ? ` · using your key · <button class="linkish" id="key-clear">forget it</button>` : ""}</div>
      <form id="ask-form" class="ask-row"><input id="ask-q" class="find" maxlength="300" placeholder="Ask about this habitat" value="${esc(a ? a.q : "")}" aria-label="Ask a question about this habitat"><button class="btn primary small"${a && a.busy ? " disabled" : ""}>Ask</button></form>
      <div class="pills" id="ask-sugg" style="margin-top:10px">${SUGGEST.map((x) => `<button class="pill" data-q="${esc(x)}">${esc(x)}</button>`).join("")}</div>
      <div class="ask-out">${liveBody("ask")}</div>
      <p class="hint" style="margin-top:10px">Answers come only from the findings on this page and cite them, like F1. They are checked by code and a second model as they arrive, but nobody reads them before you do.</p></div>`;
  }
  function bindLive() {
    const kf = $("key-form");
    if (kf) kf.onsubmit = (e) => { e.preventDefault(); const k = $("key-in").value.trim(); if (k) { AI.setUserKey(k); drawInsights(); } };
    const kc = $("key-clear");
    if (kc) kc.onclick = () => { AI.setUserKey(""); live.ask = live.brief = null; drawInsights(); };
    const af = $("ask-form");
    if (af) af.onsubmit = (e) => { e.preventDefault(); const q = $("ask-q").value.trim(); if (q) go("ask", q); };
    const sg = $("ask-sugg");
    if (sg) sg.onclick = (e) => { const b = e.target.closest("button"); if (b) go("ask", b.dataset.q); };
    const wb = $("brief-live");
    if (wb) wb.onclick = () => go("brief");
    document.querySelectorAll("[data-view-link]").forEach((x) => x.onclick = (e) => { e.preventDefault(); state.view = x.dataset.viewLink; update(); window.scrollTo({ top: 0 }); });
  }

  /* ------------------------------------------------------------ insights */
  const KINDS = [["", "All fires"], ["solid", "Solid materials"], ["liquid", "Liquid fuels"], ["gas", "Gas flames"], ["smoke source", "Smoke"]];
  const tick = () => icon("M5 12.5l4.2 4.2L19 7").replace("<svg", '<svg style="width:11px;height:11px;vertical-align:-1px"');
  const checkLine = () => "";
  const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);
  const rangeText = (r, unit) => (r[0] === r[1] ? g(r[0]) : `${g(r[0])} to ${g(r[1])}`) + unit;
  function insightText(f) {
    const t = f.si || {};
    return [t.headline, t.found, t.means, t.limit, f.topic, f.investigations.join(" "), ...Object.values(f.facts), ...f.caveats].join(" ").toLowerCase();
  }
  function insightCard(f, r, i, pinned) {
    const t = f.si, b = f.bands[r.band];
    const off = b.o2 ? Math.max(b.o2[0] - state.o2, state.o2 - b.o2[1], 0) : null;
    const near = b.o2 == null ? "No oxygen level listed" : off === 0 ? `At your ${g(state.o2)}% oxygen` : `Nearest tests to your ${g(state.o2)}% oxygen, ${g(Math.round(off * 10) / 10)} points away`;
    const why = [b.o2 ? `Oxygen ${rangeText(b.o2, "%")}: closeness ${r.m_o2.toFixed(2)}` : "No oxygen level listed: closeness 0",
      b.p ? `Pressure ${rangeText(b.p, " psi")}: closeness ${r.m_p.toFixed(2)}` : "No pressure listed: closeness 0, which halves the score",
      `${b.n} test${b.n === 1 ? "" : "s"} in this group${b.n >= 10 ? "" : ", fewer than 10: × 0.7"}`];
    const legend = f.chart ? `<div class="legend">${f.chart.series.map(([l, c]) => `<span><i style="background:${c}"></i>${esc(l)}</span>`).join("")}</div>` : "";
    const facts = `<ul class="facts">${Object.values(f.facts).map((x) => `<li>${esc(cap(x))}.</li>`).join("")}</ul>`;
    return `<article class="insight${pinned ? " pinned" : ""}" id="ins-${f.id}">
      <div class="ins-head"><span class="n">${i + 1}</span><span class="tag code">F${FF.findings.indexOf(f) + 1}</span><span class="tag">${esc(f.topic)}</span>${f.investigations.map((inv, k) => `<a class="tag" href="${f.links[k]}" target="_blank" rel="noopener">${esc(inv)} · ${esc(f.psi[k])} ↗</a>`).join("")}
        <span class="rel" tabindex="0" data-tip="<b>Relevance ${r.score.toFixed(2)}</b><span>${esc(why.join("|")).split("|").join("<br>")}</span>">${pinned ? "Pinned · relevance" : "Relevance"} <b>${r.score.toFixed(2)}</b><i><em style="width:${r.score * 100}%"></em></i></span></div>
      <h3>${esc(t && t.headline ? t.headline : cap(f.topic))}</h3>
      <p class="near-line"><b>${near}:</b> ${esc(cap(b.line))}.</p>
      ${f.chart ? `<div class="ins-chart" id="ch-${f.id}"></div>${legend}` : ""}
      ${REPLAYABLE[f.id] ? `<button class="btn small rp-go" data-f="${f.id}" data-band="${r.band}"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>Replay these tests</button>` : ""}
      ${t ? `<div class="ins-body">${t.found ? `<div><div class="k">What the tests found</div><p>${esc(t.found)}</p></div>` : ""}
        ${t.means ? `<div class="si"><div class="k">What it suggests for a crewed habitat · SI interpretation</div>${esc(t.means)}${checkLine(t)}</div>` : ""}
        ${t.limit ? `<p class="limit"><b>Limit:</b> ${esc(t.limit)}</p>` : ""}</div>` : facts}
      <details><summary>The facts code computed from the NASA table</summary>${facts.replace("</ul>", f.caveats.map((x) => `<li class="cav">${esc(x)}</li>`).join("") + "</ul>")}</details>
    </article>`;
  }
  /* one word on how much test evidence sits near this habitat, beside the briefing */
  function verdict() {
    const c = L.coverage(FF, state.o2, state.pressure), rep = L.reportCoverage(FF, state.o2, state.pressure).length, n = c.n + rep;
    const [word, cls] = n >= 20 ? ["Tested", "ok"] : n > 0 ? ["Sparse", "thin"] : ["Untested", "none"];
    const why = c.n ? `${c.n} microgravity tests within ${FF.near} points of oxygen and 25% of this pressure.` : `No microgravity test within ${FF.near} points of oxygen and 25% of this pressure. The nearest is at ${g(Math.round(c.nearest.o * 10) / 10)}% oxygen and ${g(Math.round(c.nearest.p * 10) / 10)} psi.`;
    const whyAll = why + (rep ? ` NASA's technical reports add ${rep} solid-material fire${rep > 1 ? "s" : ""} in orbit near it.` : "");
    return `<a class="verdict ${cls}" href="?view=map" data-view-link="map" data-tip="<b>${word}</b><span>${esc(whyAll)} Open the Atmosphere map.</span>"><i></i>${word}</a>`;
  }
  /* the replay on the Insights view: kept across redraws (live SI redraws the view) and restarted
     only when the oxygen group nearest the habitat changes */
  function insRpGas() { // nitrogen only when both sides have at least 5 such tests, so CO2 and helium do not tip the count
    const bs = FF.findings.find((f) => f.id === "droplet-oxygen").bands, gap = (b, o) => Math.max(b.o2[0] - o, o - b.o2[1], 0);
    const near = (o) => bs.reduce((best, b, i) => (gap(b, o) < gap(bs[best], o) ? i : best), 0);
    const a = near(21), b = near(state.o2) !== a ? near(state.o2) : bs.length - 1;
    const n2 = (i) => FF.replay.droplets.filter((r) => r[6] === "N2" && r[0] >= bs[i].o2[0] - 0.05 && r[0] <= bs[i].o2[1] + 0.05).length;
    return n2(a) >= 5 && n2(b) >= 5 ? "N2" : "";
  }
  let insRp = null, insRpHost = null, insRpKey = null;
  function insReplay(rank) {
    const slot = $("ins-rp"); if (!slot) return;
    const gas = insRpGas(), key = (rank ? rank.band : -1) + gas;
    if (insRpHost && insRpKey === key) { slot.appendChild(insRpHost); return; }
    if (insRp) insRp.destroy();
    insRpHost = document.createElement("div"); insRpKey = key; slot.appendChild(insRpHost);
    insRp = FFReplay.mount(insRpHost, FF, { kind: "droplets", compact: true, loop: true, o2: state.o2, gas });
  }
  function drawInsights() {
    const el = $("view-insights"), habitat = state.scenario === "Custom" ? "your habitat" : state.scenario;
    const byId = Object.fromEntries(FF.findings.map((f) => [f.id, f]));
    const all = L.rankFindings(FF, state.o2, state.pressure);
    let rank = state.kind ? all.filter((r) => byId[r.id].fuel_class === state.kind) : all;
    const pin = partial() ? rank.find((r) => byId[r.id].gravity) : null;
    if (pin) rank = [pin, ...rank.filter((r) => r !== pin)];
    const words = state.find.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const shown = rank.filter((r) => words.every((w) => insightText(byId[r.id]).includes(w)));
    const brief = isPreset() ? FF.briefings[state.scenario] : null, gaps = L.gaps(FF, state.o2, state.pressure);
    const far = all[0].m_o2 === 0;
    let rev = L.reportEvidence(FF, state.o2, state.pressure);
    // Moon or Mars gravity pins the drop-tower group first; in orbit it goes last, after the fires burned in orbit
    rev = partial() ? [...rev.filter((e) => e.id === "gravity"), ...rev.filter((e) => e.id !== "gravity")] : [...rev.filter((e) => e.id !== "gravity"), ...rev.filter((e) => e.id === "gravity")];
    const revNear = rev.filter((e) => e.o2_gap < FF.range.o2);
    const revShown = rev.filter((e) => (!state.kind || state.kind === "solid") && words.every((w) => [e.title, e.where, e.nearest, ...e.lines].join(" ").toLowerCase().includes(w)));
    const psiLines = all.slice(0, 3).map((r) => cap(byId[r.id].bands[r.band].line) + ".").join(" ");
    const custom = far
      ? `No PSI finding has tests within ${g(FF.range.o2)} points of ${g(state.o2)}% oxygen.${revNear.length ? ` NASA's technical reports come closer: ${revNear.slice(0, 2).map((e) => e.nearest).join(" ")} The nearest PSI results are a long way off: ` : " The nearest results are these, and they are a long way from your habitat. "}${psiLines}`
      : psiLines;
    const repSection = revShown.length ? `<div class="h-sec" id="reports"><h2>From NASA technical reports</h2><span>Beyond the PSI tables · ranked by how close their tests came to ${g(state.o2)}% oxygen</span></div>
      ${revShown.map((e, k) => repEvidenceCard(e, k)).join("")}` : "";
    const models = [...new Set(FF.findings.filter((f) => f.si).map((f) => f.si.model))].join(", ");
    el.innerHTML = `
      <span class="eyebrow">Fire safety insights</span>
      <h1 style="margin-top:12px">What NASA's microgravity fire tests suggest for ${esc(habitat)}</h1>
      <p class="lede">${g(state.o2)}% oxygen, ${g(state.pressure)} psi, ${esc(gravityLabel())}. ${FF.findings.length} findings computed from the ${(() => { const inv = new Set(FF.findings.flatMap((f) => f.investigations)); return `${FF.rows.filter((r) => inv.has(r.i)).length.toLocaleString("en-US")} NASA test records of ${inv.size} investigations`; })()}, ranked by how close their tests came to these conditions, and interpreted by SI.</p>
      <div class="briefing">${(() => {
        const lb = live.brief && live.brief.key === habitatKey() ? live.brief : null;
        if (lb) return `${verdict()}<div class="k">Briefing · written live by SI for these values</div>${liveBody("brief")}`;
        if (brief) return `${verdict()}<div class="k">Briefing · SI-written from the ranked findings and the gaps</div><p>${esc(brief.text)}</p>${checkLine(brief)}${revNear.length ? `<div class="k" style="margin-top:14px">Beyond the PSI tables · from NASA technical reports, computed, not SI-written</div><p>The gaps this briefing names are gaps in NASA's PSI tables. NASA's technical reports go further: ${esc(revNear.slice(0, 2).map((e) => e.nearest).join(" "))}${revShown.length ? ` <a href="#reports">See the reports</a>` : ""}</p>` : ""}`;
        return `${verdict()}<div class="k">Closest results · computed, not SI-written</div><p>${esc(custom)}</p>
          ${AI.configured() ? `<button class="btn small" id="brief-live" style="margin-top:12px">Write an SI briefing for these values</button>` : `<span class="chk none">Turn on live SI below to get an SI-written briefing for these values.</span>`}`;
      })()}
      </div>
      ${askPanel()}
      <div class="figure ins-replay">
        <span class="eyebrow">Real NASA tests, replayed</span>
        <h3 style="margin-top:10px">ISS air against the droplet tests nearest your oxygen: watch how many flames go out on their own</h3>
        <p class="sub">Each flame is one FLEX fuel-droplet test from NASA's table, starting at its recorded size and ending the way the table says it ended. Hover over one to see it.</p>
        <div id="ins-rp"></div>
        <p class="note">Droplets shrink following the d² law; the look of each flame is drawn, not measured. Time-lapse. ${insRpGas() === "N2" ? "Only tests with nothing added to the nitrogen, so CO2 and helium do not tip the count." : "Tests with CO2 or helium added, which went out on their own more often, are included."} <a href="?view=replay" data-view-link="replay">Open the full replay</a> to pick oxygen levels, gases and gas flames.</p>
      </div>
      ${all[0].score < 0.4 ? `<div class="callout"><b>No close evidence${revNear.length ? " in the PSI tables" : ""}.</b> No PSI finding comes from tests near ${g(state.o2)}% oxygen and ${g(state.pressure)} psi. ${far && revNear.length ? `The NASA technical reports below come closer; the PSI findings after them are the nearest PSI has.` : "The findings below are the nearest there are; treat this habitat as a research gap."}</div>` : ""}
      ${far ? repSection : ""}
      ${pin ? `<div class="callout info"><b>${esc(gravityLabel())}.</b> No PSI test ran in partial gravity, so the one microgravity versus normal-gravity comparison is pinned first. NASA drop-tower tests at Moon and Mars gravity are on the <a href="?view=gravity" data-view-link="gravity">Gravity</a> tab.</div>` : ""}
      <div class="ins-tools">
        <div class="pills" id="kinds">${KINDS.map(([k, l]) => `<button class="pill" aria-pressed="${state.kind === k}" data-k="${k}">${l}</button>`).join("")}</div>
        <input class="find" id="find" type="search" placeholder="Find: oxygen, CO2, smoke, gravity, PMMA" value="${esc(state.find)}" aria-label="Find a finding">
      </div>
      <div id="ins-list">${shown.length ? shown.map((r, i) => insightCard(byId[r.id], r, i, r === pin)).join("") : `<p class="muted">No finding matches "${esc(state.find)}".</p>`}</div>
      ${far ? "" : repSection}
      <div class="h-sec" id="gaps"><h2>What the PSI tables cannot tell you</h2><span>Computed for ${g(state.o2)}% oxygen and ${g(state.pressure)} psi · under each gap, what NASA's technical reports add</span></div>
      <div class="card prose"><ul>${gaps.map((x) => { const r = gapReport(x); return `<li>${esc(cap(x))}.${r ? `<span class="muted" style="display:block;font-size:.92em;margin-top:3px">${esc(r)}</span>` : ""}</li>`; }).join("")}</ul></div>
      <div class="cols-2" style="margin-top:18px">
        <div class="card"><h3>How the findings are ranked</h3>
          <div class="formula">Relevance = C<sub>oxygen</sub> × ½ (1 + C<sub>pressure</sub>) × W<sub>tests</sub></div>
          <p style="margin-top:14px">Each finding splits its tests into groups by oxygen level, and the group nearest your oxygen level is scored. C is 1 when your value is inside the group's tested range and falls to 0 at ${g(FF.range.o2)} points of oxygen or ${g(FF.range.pressure)} psi away. Oxygen gates the score: tests far from your oxygen level score 0 however close their pressure is. A pressure the table does not list counts as 0, which halves the score. W is 1 for 10 or more tests and 0.7 for fewer.</p></div>
        <div class="card prose"><h3>Who did what</h3><ul>
          <li>Code computed every finding, count, ranking and gap from the NASA tables. Open "The facts code computed" on any card to see them.</li>
          <li>SI (${esc(models)}) wrote each headline, the summary of what the tests found, the interpretation, the limit and the briefing, reading only those facts.</li>
          <li>Code then looked up every number in the facts, and a second model re-read every sentence and removed any that stated something the facts do not hold.</li>
          <li>Relevance says how close the evidence is to your habitat. It does not say whether a fire would start or spread.</li></ul></div>
      </div>`;
    shown.forEach((r) => { const f = byId[r.id]; if (f.chart) CH.finding($("ch-" + f.id), f, r.band); });
    insReplay(all.find((r) => r.id === "droplet-oxygen"));
    CH.bindTips(el);
    bindLive();
    $("kinds").onclick = (e) => { const b = e.target.closest("button"); if (!b) return; state.kind = b.dataset.k; drawInsights(); };
    el.querySelectorAll(".rp-go").forEach((b) => b.onclick = () => {
      const [kind, gasFilter] = REPLAYABLE[b.dataset.f];
      state.replay = { kind, right: b.dataset.f === "droplet-diluent" ? undefined : +b.dataset.band, gas: gasFilter };
      state.view = "replay"; update(); window.scrollTo({ top: 0 });
    });
    $("find").oninput = (e) => {
      state.find = e.target.value;
      const pos = e.target.selectionStart;
      drawInsights();
      const box = $("find"); box.focus(); box.setSelectionRange(pos, pos);
    };
  }

  /* ------------------------------------------------------------- gravity */
  function drawGravity() {
    const paired = FF.pairs.filter((p) => p.gsi != null), flips = paired.filter((p) => p.gsi >= 0.5).length, tight = paired.filter((p) => p.gsi === 0).length;
    $("view-gravity").innerHTML = `
      <span class="eyebrow">Gravity bound</span>
      <h1 style="margin-top:12px">Gravity changed the outcome for ${flips} of ${paired.length} Saffire-II samples</h1>
      <p class="lede">Saffire-II burned the same materials in microgravity and in normal gravity. For ${tight} samples the burn length was the same in both, so the answer for the Moon or Mars is constrained. For ${flips} it differed by half the sample or more, so the answer in partial gravity is open${paired.length - tight - flips ? `; for ${paired.length - tight - flips} it differed by less than half` : ""}.</p>
      <div class="figure"><div id="dumbbell"></div>
        <div class="legend"><span><i style="background:#3987e5"></i>Microgravity</span><span><i class="dia" style="background:#d95926"></i>Normal gravity (1g)</span><span>Bar: the range the Moon and Mars fall in, if burning changes steadily with gravity</span></div></div>
      <div class="cols-2" style="margin-top:18px">
        <div class="card"><h3>Gravity Sensitivity Index</h3>
          <div class="formula">GSI = | L<sub class="e">1g</sub> − L<sub class="u">µg</sub> | ÷ L<sub>sample</sub></div>
          <p style="margin-top:14px">L is burn length. <b style="color:var(--ink)">0</b> means microgravity and 1g agree, so the bound is tight. <b style="color:var(--ink)">1</b> means the sample burned fully in one and not at all in the other, so the bound says nothing about partial gravity.</p></div>
        <div class="card prose"><h3>Read this before you use it</h3><ul>
          <li>NASA's challenge statement says microgravity and normal-gravity results <i>could</i> bound intermediate gravity. That is a hypothesis, and NASA's drop-tower tests below found Moon-gravity oxygen limits outside it for all three materials tested.</li>
          <li>${paired.length} samples, one oxygen level (about 22%), one airflow (20 cm/s).</li>
          <li>The PSI table does not state the oxygen, pressure or airflow of the 1g tests.</li>
          <li>GSI uses burn length only. The fabric samples have GSI 0 but spread at a steady 2.1 to 2.6 mm/s in microgravity and accelerated in 1g.</li>
          <li>For thick PMMA, the microgravity value is the length with visible damage after a 600 to 900 s burn, with the flame still anchored (source notes 3 and 4).</li></ul></div>
      </div>
      <div class="h-sec"><h2>Source text</h2><span><a href="${FF.investigations.find((i) => i.name === "SAFFIRE-2").link}" target="_blank" rel="noopener">PSI-99, Saffire-II</a></span></div>
      <div class="scroll"><table class="t"><tr><th>Sample</th><th>Material</th><th>Thickness</th><th>Flow</th><th>O2 %</th><th>µg burn length</th><th>µg spread</th><th>1g burn length</th><th>1g spread</th><th>GSI</th></tr>
        ${FF.pairs.map((p) => `<tr><td>${esc(p.sample)}</td><td>${esc(p.material)}</td><td>${esc(p.thickness)}</td><td>${esc(p.direction)}</td><td>${esc(p.o2_raw)}</td><td>${esc(p.ug_raw)}</td><td>${esc(p.ug_spread || "—")}</td><td>${esc(p.g1_raw || "—")}</td><td>${esc(p.g1_spread || "—")}</td><td class="mono">${p.gsi == null ? "—" : p.gsi.toFixed(2)}</td></tr>`).join("")}</table></div>
      <p class="note">"Complete" is plotted as the full sample length. Sample 2-7 is split into its PMMA and Nomex sections; the table gives no 1g result for the PMMA section, so it has no GSI. Cells are shown as NASA wrote them, including the thickness "037 mm" (marked * on the chart), which may mean 0.37 mm.</p>`;
    CH.dumbbell($("dumbbell"), FF.pairs);
    const gl = L.gravityLimits(FF), src = L.source(FF, "partial-g"), src26 = L.source(FF, "partial-g-2026");
    if (!gl.length) return;
    const moonLow = gl.filter((m) => m.moon.mid < m.earth.mid && m.moon.mid < m.micro.mid).length;
    $("view-gravity").insertAdjacentHTML("beforeend", `
      <div class="h-sec" style="margin-top:34px"><h2>Tested at Moon and Mars gravity</h2><span>From a NASA report</span></div>
      <div class="figure"><h3>At Moon gravity, ${moonLow === gl.length ? `all ${gl.length}` : `${moonLow} of ${gl.length}`} materials kept burning at lower oxygen than on Earth or in microgravity</h3>
        <p class="sub">NASA Glenn spun samples in a centrifuge inside a 5-second drop tower to make Moon and Mars gravity, and lowered the oxygen until the flame went out. Each bar runs from the oxygen level where the flame went out (MOC) to the level where it kept burning (ULOI); the dot is the middle.</p>
        <div id="gravlim"></div>
        <div class="legend">${gl.map((m, i) => `<span><i style="background:${CH.MAT_COL[i]}"></i>${esc(m.material)} · ${g(m.psia)} psi</span>`).join("")}</div></div>
      <div class="scroll" style="margin-top:14px"><table class="t"><tr><th>Material</th><th>Pressure</th>${gl[0].rows.map((r) => `<th>${esc(r.gravity)}</th>`).join("")}</tr>
        ${gl.map((m) => `<tr><td>${esc(m.material)}</td><td class="mono">${g(m.psia)} psi</td>${m.rows.map((r) => `<td class="mono">${g(r.moc)}–${g(r.uloi)}%${r.delta != null ? `<br><span class="muted">${r.delta > 0 ? "+" : ""}${g(r.delta)} vs Earth</span>` : ""}</td>`).join("")}</tr>`).join("")}</table></div>
      <div class="card prose" style="margin-top:14px"><h3>Read this before you use it</h3><ul>
        <li>Each cell runs from the highest oxygen at which the flame went out to the lowest at which it kept burning. "vs Earth" is the report's oxygen margin: the middle of that range minus the middle of the Earth-gravity range.</li>
        <li>Drop tests last about 5 seconds, so a flame that seemed steady might have gone out given more time. The microgravity tests had a 30 cm/s airflow.</li>
        <li>Three materials, two pressures. NASA's standard material test (NASA-STD-6001, Test 1) runs in Earth gravity.</li>
        <li>${src26 ? `A 2026 NASA abstract (<a href="${src26.url}" target="_blank" rel="noopener">NTRS ${esc(src26.ntrs)} ↗</a>) says the oxygen needed to burn reaches a minimum near Moon gravity; NASA's FM2 experiment is to burn samples on the Moon itself.` : ""}</li></ul>
        <p class="note">Source: ${src ? `${esc(src.citation)} <a href="${src.url}" target="_blank" rel="noopener">NTRS ${esc(src.ntrs)} ↗</a>, ${esc(src.used)}.` : ""}</p></div>`);
    CH.gravityLimitsChart($("gravlim"), FF);
  }

  /* ------------------------------------------- NASA technical reports */
  // Hand-copied report tables (data/reports): shown beside the PSI results, never mixed into them.
  function reportNotes() {
    const out = [], o2 = state.o2, p = state.pressure, r1 = (v) => g(Math.round(v * 10) / 10);
    const near = L.reportCoverage(FF, o2, p);
    if (near.length) out.push(`<b>${near.length} solid-material fire${near.length > 1 ? "s" : ""} in orbit near this atmosphere</b>: ${near.map((x) => `${esc(x.id)} (${esc(x.material)}, ${g(x.o)}% oxygen, ${r1(x.p)} psi)`).join("; ")}. <a href="?view=map" data-view-link="map">Atmosphere map</a>`);
    else {
      const pts = L.reportPoints(FF), lp = Math.log(L.NEAR_P);
      const best = pts.reduce((a, x) => { const d = Math.hypot((x.o - o2) / 5, Math.log(x.p / p) / lp); return !a || d < a.d ? { x, d } : a; }, null);
      if (best) out.push(`No solid-material fire in orbit from NASA's reports is near this atmosphere. The closest is ${esc(best.x.id)}: ${esc(best.x.material)} at ${g(best.x.o)}% oxygen and ${r1(best.x.p)} psi. <a href="?view=map" data-view-link="map">Atmosphere map</a>`);
    }
    if (Math.abs(Math.log(p / 10.2)) <= Math.log(L.NEAR_P) && o2 >= 30 && o2 < 99.5) {
      const w = L.wstfBurning(FF, o2);
      out.push(`<b>NASA's standard material test at 10.2 psi, in Earth gravity:</b> ${w.burning.length} of ${w.n} material setups kept burning at ${g(o2)}% oxygen (${esc([...new Set(w.burning.map((r) => r.material.replace(/ (single|double) layer$/, "")))].join(", ") || "none")}).`);
    }
    if (o2 >= 99) {
      const mtp = FF.reports.wstfO2.map((r) => r.mtp);
      out.push(`<b>In 99.8% oxygen, in Earth gravity:</b> all ${mtp.length} spacecraft materials NASA tested became flammable above ${g(Math.min(...mtp))} to ${g(Math.max(...mtp))} psi. This atmosphere is at ${g(p)} psi.`);
    }
    if (partial()) {
      const gl = L.gravityLimits(FF), key = state.gravity === 1 ? "moon" : "mars";
      out.push(`<b>${state.gravity === 1 ? "Moon" : "Mars"} gravity, NASA drop-tower tests:</b> ${gl.map((m) => `${esc(m.material)} kept burning down to ${g(m[key].uloi)}% oxygen (Earth gravity: ${g(m.earth.uloi)}%)`).join("; ")}. <a href="?view=gravity" data-view-link="gravity">Gravity</a>`);
    }
    return out;
  }
  function repEvidenceCard(e, k) {
    const near = e.o2_gap === 0 ? `Covers your ${g(state.o2)}% oxygen` : `${g(e.o2_gap)} points of oxygen from your ${g(state.o2)}%`;
    const links = e.src.map((key) => { const s = L.source(FF, key); return s ? `<a class="tag" href="${s.url}" target="_blank" rel="noopener">NTRS ${esc(s.ntrs)} ↗</a>` : ""; }).join("");
    return `<article class="insight rep-ins" id="rep-${e.id}">
      <div class="ins-head"><span class="n">R${k + 1}</span><span class="tag code">NASA report</span>${partial() && e.id === "gravity" ? `<span class="tag">Pinned for ${esc(gravityLabel())}</span>` : ""}<span class="tag">${esc(e.where)}</span>${links}</div>
      <h3>${esc(e.title)}</h3>
      <p class="near-line"><b>${near}:</b> ${esc(e.nearest)}</p>
      ${e.lines.length ? `<ul class="facts">${e.lines.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      <p class="note">Tested at ${rangeText(e.o2, "%")} oxygen and ${rangeText(e.p, " psi")}, ${esc(e.gravity)}. ${esc(e.caveat)} Computed from tables transcribed from the report, not SI-written.</p>
    </article>`;
  }
  /* what NASA's technical reports add to one PSI gap (code-written, from the transcribed tables) */
  function gapReport(x) {
    const R = FF.reports, rp = L.reportPoints(FF), r1 = (v) => Math.round(v * 10) / 10;
    if (!R || !rp.length) return "";
    const sa = rp.filter((p) => p.set === "Saffire"), ss = rp.filter((p) => p.set === "SSCE"), hi = (a) => Math.max(...a.map((p) => p.o)), lo = (a) => Math.min(...a.map((p) => p.o));
    if (/^no solid material/i.test(x)) return `NASA's technical reports go further: in orbit, Saffire IV to VI burned solids at up to ${g(hi(sa))}% oxygen, and the Space Shuttle's SSCE at ${g(lo(ss))} to ${g(hi(ss))}%.`;
    if (/lists its pressure/i.test(x)) return `NASA's technical reports give the pressure for ${rp.length} solid-material fires in orbit, from ${g(r1(Math.min(...rp.map((p) => p.p))))} to ${g(r1(Math.max(...rp.map((p) => p.p))))} psi.`;
    if (/Moon or Mars gravity/i.test(x)) {
      const gl = L.gravityLimits(FF), low = gl.filter((m) => m.moon.mid < m.earth.mid && m.moon.mid < m.micro.mid).length;
      return gl.length ? `NASA's technical reports add drop-tower tests lasting about 5 seconds at Moon and Mars gravity: ${low} of ${gl.length} materials kept burning at lower oxygen at Moon gravity than on Earth or in microgravity.` : "";
    }
    if (/ran above/i.test(x)) return `NASA's technical reports go further: in orbit, the Space Shuttle's SSCE burned solids at up to ${g(hi(ss))}% oxygen; in Earth gravity, NASA White Sands ran its standard material test in 99.8% oxygen.`;
    if (/ran below/i.test(x) && R.wstfO2.length) {
      const m = R.wstfO2.map((r) => r.mtp), u = R.wstfO2.map((r) => r.ulpi);
      return `NASA's technical reports go lower, in Earth gravity: NASA White Sands tested materials in 99.8% oxygen at ${g(Math.min(...m))} to ${g(Math.max(...u))} psi, and each of the ${R.wstfO2.length} could burn above ${g(Math.min(...m))} to ${g(Math.max(...m))} psi.`;
    }
    return "";
  }
  function reportCard(title) {
    const n = reportNotes();
    return n.length ? `<div class="card prose rep-card" style="margin-top:14px"><h3>${title}</h3><ul>${n.map((x) => `<li>${x}</li>`).join("")}</ul>
      <p class="note" style="margin-top:8px">Transcribed from NASA technical reports, not from the PSI tables; each row names its report, table and page on the <a href="?view=data" data-view-link="data">Data</a> tab.</p></div>` : "";
  }

  /* ------------------------------------------------------ investigations */
  function attributes(inv) {
    return `<div class="scroll" style="margin-top:10px"><table class="t">${Object.entries(inv.attributes).map(([k, v]) => `<tr><td style="width:36%">${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table></div>`;
  }
  function drawInvestigations() {
    const rank = L.rankInvestigations(FF, state.o2, state.pressure, state.flow, state.concern), top = rank[0];
    $("view-investigations").innerHTML = `
      <span class="eyebrow">Ranked investigations</span>
      <h1 style="margin-top:12px">Most relevant for ${esc(state.scenario === "Custom" ? "your habitat" : state.scenario)}: ${esc(top.investigation)}</h1>
      <p class="lede">${g(state.o2)}% oxygen, ${g(state.pressure)} psi, ${g(state.flow)} cm/s airflow. Ranked by how close each investigation's tests come to these conditions.</p>
      <div class="row" style="margin-bottom:18px"><label for="concern" class="muted">I am worried about</label>
        <select id="concern">${Object.entries(FF.fuelClasses).map(([label, v]) => `<option value="${v}"${v === state.concern ? " selected" : ""}>${esc(label)}</option>`).join("")}</select></div>
      ${top.hfri < 0.4 ? `<div class="callout" style="margin:0 0 16px"><b>No close evidence.</b> Nothing loaded here was tested near this scenario. Treat it as a research gap.</div>` : ""}
      ${rank.map((r, i) => { const inv = FF.investigations.find((x) => x.name === r.investigation); return `
        <div class="rank"><div class="n">${i + 1}</div>
          <div><h3>${esc(r.investigation)} <a class="mono" style="font-size:12.5px;font-weight:500" href="${inv.link}" target="_blank" rel="noopener">${esc(inv.psi)} ↗</a></h3>
            <p class="why">${esc(r.why)}</p>
            <details style="margin-top:10px"${state.open === r.investigation ? " open" : ""} data-inv="${esc(r.investigation)}"><summary>About this investigation · ${r.tests} records</summary>
              <div style="margin-top:10px">${siBlock(inv.si)}</div>${attributes(inv)}</details></div>
          <div class="score"><small>HFRI</small>${r.hfri.toFixed(2)}<div class="bar"><i style="width:${r.hfri * 100}%"></i></div></div>
        </div>`; }).join("")}
      <div class="cols-2" style="margin-top:22px">
        <div class="card"><h3>Habitat Fire Relevance Index</h3>
          <div class="formula">HFRI = M<sub>conditions</sub> × M<sub>fuel</sub> × W<sub>evidence</sub></div>
          <p style="margin-top:14px">An investigation's HFRI is that of its closest test. It measures how close the evidence is to your scenario. It says nothing about whether a material burns.</p></div>
        <div class="card prose"><h3>How each part is scored</h3><ul>
          <li><b style="color:var(--ink)">M conditions</b>: mean closeness of oxygen, pressure and airflow. Each is 1 inside the tested range and falls to 0 at ${g(FF.range.o2)} points of oxygen, ${g(FF.range.pressure)} psi or ${g(FF.range.flow)} cm/s away. A value the NASA table does not list counts as 0, because it cannot be checked.</li>
          <li><b style="color:var(--ink)">M fuel</b>: 1 for the same fuel class, 0.5 for a related one, 0.2 otherwise.</li>
          <li><b style="color:var(--ink)">W evidence</b>: 1 if the table has one row per test, 0.6 if it is a summary.</li></ul></div>
      </div>`;
    $("concern").onchange = (e) => { state.concern = e.target.value; drawInvestigations(); };
    $("view-investigations").querySelectorAll("details[data-inv]").forEach((d) => d.addEventListener("toggle", () => { if (d.open) state.open = d.dataset.inv; else if (state.open === d.dataset.inv) state.open = null; }));
  }

  /* ------------------------------------------------------------- compare */
  function drawCompare() {
    const chosen = FF.investigations.filter((i) => state.compare.includes(i.name));
    const keys = Object.keys(FF.investigations[0].attributes);
    $("view-compare").innerHTML = `
      <span class="eyebrow">Compare</span>
      <h1 style="margin-top:12px">Investigations side by side</h1>
      <p class="lede">Fuels, test conditions, what varied between tests and what was measured. Pick up to four.</p>
      <div class="pills" id="cmp" style="margin-bottom:20px">${FF.investigations.map((i) => `<button class="pill" aria-pressed="${state.compare.includes(i.name)}" data-c="${esc(i.name)}">${esc(i.name)}</button>`).join("")}</div>
      ${chosen.length ? `<div class="scroll"><table class="t"><tr><th></th>${chosen.map((i) => `<th>${esc(i.name)}</th>`).join("")}</tr>
        ${keys.map((k) => `<tr><td>${esc(k)}</td>${chosen.map((i) => `<td>${esc(i.attributes[k])}</td>`).join("")}</tr>`).join("")}
        <tr><td>NASA record</td>${chosen.map((i) => `<td><a href="${i.link}" target="_blank" rel="noopener">${esc(i.psi)} ↗</a></td>`).join("")}</tr></table></div>
        <p class="note">Every cell is read from the NASA experiment table. "Not listed" means the table is silent.</p>` : `<p class="muted">Pick an investigation above.</p>`}`;
    $("cmp").onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      const n = b.dataset.c;
      if (state.compare.includes(n)) state.compare = state.compare.filter((x) => x !== n);
      else if (state.compare.length < 4) state.compare.push(n);
      drawCompare();
    };
  }

  /* ---------------------------------------------------------------- data */
  function drawData() {
    const unnamed = FF.rows.filter((r) => r.c === "solid" && !r.m.length).length;
    const texts = [...Object.values(FF.si.material), ...Object.values(FF.si.atmosphere), ...FF.investigations.map((i) => i.si).filter(Boolean),
      ...FF.findings.map((f) => f.si).filter(Boolean), ...Object.values(FF.briefings)];
    const total = texts.reduce((a, t) => a + t.total, 0), dropped = texts.reduce((a, t) => a + t.dropped + (t.judged_out || 0), 0);
    $("view-data").innerHTML = `
      <span class="eyebrow">Data and method</span>
      <h1 style="margin-top:12px">${FF.rows.length.toLocaleString("en-US")} records, one table, one set of units</h1>
      <p class="lede">Oxygen in % by volume, pressure in psi, airflow in cm/s. NASA's original text sits beside every converted value, and a cell is empty wherever the NASA table is silent.</p>
      <div class="row" style="margin-bottom:26px"><a class="btn primary" href="assets/psi-combustion-catalog.csv" download>${DL}Download the full catalog (CSV)</a>
        <a class="btn" href="${LINKS.repo}" target="_blank" rel="noopener">Code and cleaning notes</a></div>
      <div class="cols-2">
        <div class="card prose"><h3>Limits</h3><ul>
          <li>${FF.investigations.length} NASA experiment tables are loaded. NASA's archive holds more.</li>
          <li>${unnamed} solid-fuel records name a shape but no material, such as "1/4" clear rod". They are not assigned to any material.</li>
          <li>BASS and BASS-II list a fan setting or nothing for airflow, and no pressure.</li>
          <li>FLEX-2, SLICE, ACME BRE, ACME E-FIELD Flames and DAFT tables are summaries, not one row per test.</li>
          <li>No PSI investigation here ran in partial gravity. NASA reports add short drop-tower tests at Moon and Mars gravity.</li>
          <li>The tables transcribed from NASA reports are shown beside the PSI results and never mixed into the catalog, the findings, the models or the SI texts.</li></ul></div>
        <div class="card prose"><h3>How SI is used</h3><ul>
          <li>Insights: code computes each finding from the NASA tables and ranks the findings for your habitat. ${esc([...new Set(FF.findings.filter((f) => f.si).map((f) => f.si.model))].join(", "))} then interprets each finding (headline, what the tests found, what it suggests, its limit) and writes a briefing for each preset habitat, reading only the facts code computed.</li>
          <li>Live: "Ask Flamebound" and "Write an SI briefing" send the facts computed for your habitat (the ranked findings, the gaps and your materials) to Gemini 3.1 Flash Lite, which answers from those facts only and cites the findings it used. The same two checks run in your browser before the answer is shown. Live answers are not read by a person first.</li>
          <li>Material cards and investigation summaries: code works out every finding and a Gemini model only puts it into sentences. It is asked to change nothing.</li>
          <li>Code then looked up every number in each text in those facts and removed any sentence containing a number that was not there. Across ${texts.length} texts, ${total.toLocaleString("en-US")} numbers were checked and ${dropped} sentence${dropped === 1 ? " was" : "s were"} removed.</li>
          <li>A second SI pass then re-read each remaining sentence against the facts and removed any it judged unsupported. ${texts.filter((t) => t.judge && t.judge !== t.model).length} of the ${texts.length} texts were re-read by a different model${(() => { const j = [...new Set(texts.filter((t) => t.judge && t.judge !== t.model).map((t) => t.judge))]; return j.length ? " (" + esc(j.join(", ")) + ")" : ""; })()}, ${texts.filter((t) => t.judge && t.judge === t.model).length} by the same model in a fresh pass, and ${texts.filter((t) => !t.judge).length} got no second pass. The removed-sentence count above includes both checks.</li>
          <li>Neither check is proof, so the computed facts beside each text remain the reference.</li>
          <li>Grades, counts, rankings and charts are computed without SI.</li>
          <li>An SI coding assistant (Claude) helped write the code and the site text.</li></ul></div>
      </div>
      <div class="h-sec"><h2>Sources</h2><span>NASA Physical Science Informatics</span></div>
      <div class="scroll"><table class="t"><tr><th>Investigation</th><th>NASA record</th><th>Fuel class</th><th>Records</th><th>NASA file</th></tr>
        ${FF.investigations.map((i) => `<tr><td>${esc(i.name)}</td><td><a href="${i.link}" target="_blank" rel="noopener">${esc(i.psi)} ↗</a></td><td>${esc(i.class)}</td><td class="mono">${i.rows}</td><td>${esc(i.file)}</td></tr>`).join("")}</table></div>
      <div class="h-sec"><h2>NASA technical reports</h2><span>Transcribed from the NASA Technical Reports Server</span></div>
      <div class="scroll"><table class="t"><tr><th>Report</th><th>NASA record</th><th>What was copied</th><th>Rows</th></tr>
        ${FF.reports.sources.map((s) => { const n = ["saffire", "ssce", "gravity", "wstf10", "wstfO2"].reduce((a, k) => a + FF.reports[k].filter((r) => r.src.includes(s.key)).length, 0);
          return `<tr><td>${esc(s.citation)}</td><td><a href="${s.url}" target="_blank" rel="noopener">NTRS ${esc(s.ntrs)} ↗</a></td><td>${esc(s.used)}</td><td class="mono">${n || "context"}</td></tr>`; }).join("")}</table></div>
      <p class="note">These tables were read from the rendered report pages and typed in by Claude, the SI coding assistant that helped build this site, with each row naming its table and page. A check in the build recomputes the oxygen margins printed in the partial-gravity report from the copied limits and stops if any disagree. The copied tables are in <a href="${LINKS.repo}/tree/main/data/reports" target="_blank" rel="noopener">data/reports</a>.</p>
      <p class="note">Data built ${esc(FF.built)}. The challenge statement names three Earth uses of this research: fine-water-mist extinguishers, smoke detection and firefighter gear. SAME and SAME-R hold the smoke-particle tests; FLEX holds droplet tests with CO2 or helium added to the atmosphere.</p>`;
  }

  /* ------------------------------------------------------------ downloads */
  function save(name, type, text) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([text], { type: type + ";charset=utf-8" }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function toCsv(rows) {
    const cols = [["investigation", "i"], ["psi_id", "p"], ["row_level", "l"], ["test_id", "t"], ["fuel_class", "c"], ["fuel", "f"], ["material", (r) => r.m.join("; ")],
      ["o2_min_pct", (r) => r.o && r.o[0]], ["o2_max_pct", (r) => r.o && r.o[1]], ["o2_source_text", "or"], ["diluent", "d"],
      ["pressure_min_psi", (r) => r.P && r.P[0]], ["pressure_max_psi", (r) => r.P && r.P[1]], ["pressure_source_text", "Pr"],
      ["airflow_min_cm_s", (r) => r.F && r.F[0]], ["airflow_max_cm_s", (r) => r.F && r.F[1]], ["airflow_source_text", "Fr"], ["flow_direction", "dr"],
      ["gravity", (r) => (r.g === "1" ? "1g" : "microgravity")], ["outcome", "out"], ["sensors", "s"], ["notes", "n"], ["source_file", "src"],
      ["nasa_record", (r) => FF.investigations.find((i) => i.name === r.i).link]];
    const cell = (v) => { const s = v == null ? "" : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
    return "﻿" + [cols.map((c) => c[0]).join(",")].concat(rows.map((r) => cols.map(([, k]) => cell(typeof k === "function" ? k(r) : r[k])).join(","))).join("\n");
  }
  function briefHtml(f) {
    const css = "body{font:15px/1.5 system-ui,Segoe UI,Arial,sans-serif;color:#1c1c1a;max-width:860px;margin:32px auto;padding:0 20px}h1{font-size:26px;margin:0 0 4px}h2{font-size:18px;margin:28px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px}h3{font-size:15px;margin:18px 0 4px}.sub{color:#555;margin:0 0 16px}table{border-collapse:collapse;width:100%;margin:8px 0}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid #e4e4e0;vertical-align:top}th{font-size:12px;text-transform:uppercase;letter-spacing:.04em;color:#555}.warn{background:#fff6e0;border:1px solid #e8c877;padding:10px 12px;border-radius:6px}.si{background:#f3f6fb;border-left:3px solid #3987e5;padding:8px 12px;margin:8px 0}ul{margin:4px 0 0 18px;padding:0}small{color:#666}@media print{body{margin:0}}";
    const used = new Set(["FLEX", "CFI-G", ...FF.findings.flatMap((x) => x.investigations)]);
    let h = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fire Evidence Brief: ${esc(state.scenario)}</title><style>${css}</style></head><body>
      <h1>Fire Evidence Brief</h1><p class="sub">${esc(state.scenario)}: ${g(state.o2)}% oxygen, ${g(state.pressure)} psi, ${g(state.flow)} cm/s airflow, ${esc(gravityLabel())}. Generated ${new Date().toISOString().slice(0, 10)} with Flamebound.</p>
      <p class="warn"><b>This is an evidence summary, not a safety assessment.</b> It reports which NASA microgravity tests exist near these conditions. It does not predict whether a material will burn.</p>
      ${(() => {
        const b = isPreset() ? FF.briefings[state.scenario] : null;
        const top = L.rankFindings(FF, state.o2, state.pressure).slice(0, 5);
        return `<h2>What NASA's microgravity fire tests suggest</h2>${b ? `<p class="si">${esc(b.text)}</p>` : ""}
          <p><small>The ${top.length} findings whose tests came closest to these conditions. Relevance = oxygen closeness × ½ (1 + pressure closeness) × test-count weight.</small></p>
          ${top.map((r, i) => { const x = FF.findings.find((y) => y.id === r.id), t = x.si || {}; return `<h3>${i + 1}. ${esc(t.headline || x.topic)} <small>(${esc(x.investigations.join(", "))}, relevance ${r.score.toFixed(2)})</small></h3>
            <p><b>Nearest these conditions:</b> ${esc(x.bands[r.band].line)}.</p>${t.found ? `<p>${esc(t.found)}</p>` : ""}${t.means ? `<p class="si">${esc(t.means)}<br><small>SI interpretation</small></p>` : ""}${t.limit ? `<p><small>Limit: ${esc(t.limit)}</small></p>` : ""}`; }).join("")}
          <h3>What the PSI tables cannot tell you</h3><ul>${L.gaps(FF, state.o2, state.pressure).map((x) => { const r = gapReport(x); return `<li>${esc(x)}${r ? `<br><small>${esc(r)}</small>` : ""}</li>`; }).join("")}</ul>`;
      })()}
      <h2>${f.near} of ${f.mats.length} materials were flame-tested near ${g(state.o2)}% oxygen</h2>
      <table><tr><th>Material</th><th>Evidence</th><th>Flame tests</th><th>Oxygen tested</th><th>Gap to yours</th><th>Smoke tests</th></tr>
      ${f.mats.map((m) => `<tr><td>${esc(m.material)}</td><td>${GRADE[m.grade][0]}</td><td>${m.flame_tests}</td><td>${m.oxygen_tested_pct ? m.oxygen_tested_pct + "%" : "not listed"}</td><td>${m.oxygen_gap_points == null ? "" : g(m.oxygen_gap_points) + " points"}</td><td>${m.smoke_tests}</td></tr>`).join("")}</table>
      <small>"Near" means within ${g(FF.near)} points of oxygen. Pressure is not listed in any solid-fuel table loaded, so the grade uses oxygen only.</small>
      ${partial() ? `<p class="warn"><b>No partial-gravity tests exist in the loaded PSI data.</b> The gravity lines below compare microgravity with normal gravity. NASA's challenge statement says the two could bound intermediate gravity. In NASA drop-tower tests at Moon gravity (Olson and Ferkul, ICES 2012, NTRS 20130010991), three materials kept burning at lower oxygen than in either, so that bound did not hold for their oxygen limits.</p>` : ""}
      <h2>By material</h2>`;
    f.mats.forEach((m) => {
      Object.keys(m.flame_tests_by_investigation).concat(Object.keys(m.smoke_tests_by_investigation)).forEach((i) => used.add(i));
      const si = isPreset() ? FF.si.material[`${state.scenario}|${m.material}`] : null;
      h += `<h3>${esc(m.material)}</h3>${si ? `<p class="si">${esc(si.text)}</p>` : ""}<ul>${L.materialSentences(FF, m, state.o2, partial()).map((s) => `<li>${esc(s)}</li>`).join("")}
        ${m.gravity_pairs.map((p) => `<li><small>Sample ${esc(p.sample)} (${esc(p.thickness)}): microgravity burn length ${esc(p.microgravity_burn_length)}, 1g ${esc(p.normal_gravity_burn_length)}, GSI ${p.gsi.toFixed(2)}</small></li>`).join("")}</ul>`;
    });
    const words = L.atmosphereSentences(f.atm, state.o2);
    h += `<h2>Your atmosphere: liquids and gases</h2><h3>Liquid droplets (FLEX)</h3><p>${esc(words.droplets)}</p><h3>Gas flames (CFI-G)</h3><p>${esc(words.gas)}</p>
      <p><small>These counts are descriptive. Fuel, pressure and flow rate vary between tests along with oxygen.</small></p><h2>Sources</h2><ul>
      ${FF.investigations.filter((i) => used.has(i.name)).map((i) => `<li>${esc(i.name)}, NASA Physical Science Informatics ${esc(i.psi)}: <a href="${i.link}">${i.link}</a></li>`).join("")}</ul>
      <p><small>GSI (Gravity Sensitivity Index) = |burn length in 1g − burn length in microgravity| ÷ sample length. 0 means the two agree; 1 means the sample burned fully in one and not at all in the other.</small></p></body></html>`;
    return h;
  }

  /* ---------------------------------------------------------------- loop */
  /* ----------------------------------------------------------- fire model */
  const MD = window.FFModels, MODELS = FF.models;
  const pct = (v) => (v * 100 < 1 && v > 0 ? "<1" : v * 100 > 99 && v < 1 ? ">99" : Math.round(v * 100)) + "%";
  let simCtl = null;

  /* probability against oxygen, with the 90% band, the tests behind it and the habitat marked */
  function curve(el, cfg) {
    const W = Math.max(300, el.clientWidth), narrow = W < 560, H = narrow ? 230 : 270, L0 = 46, R0 = 16, T0 = 14, B0 = 40;
    const lo = cfg.x[0], hi = cfg.x[1], X = (v) => L0 + ((v - lo) / (hi - lo)) * (W - L0 - R0), Y = (p) => T0 + (1 - p) * (H - T0 - B0);
    const xs = [], n = 70;
    for (let i = 0; i <= n; i++) xs.push(lo + ((hi - lo) * i) / n);
    const pts = xs.map((x) => { const r = cfg.at(x); return [x, r.fit, r.lo, r.hi]; });
    const inside = (x) => x >= cfg.trained[0] - 1e-9 && x <= cfg.trained[1] + 1e-9;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(cfg.label)} against oxygen level">`;
    s += `<rect x="${X(Math.max(lo, cfg.trained[0]))}" y="${T0}" width="${X(Math.min(hi, cfg.trained[1])) - X(Math.max(lo, cfg.trained[0]))}" height="${H - T0 - B0}" fill="rgba(255,255,255,0.035)"/>`;
    [0, 0.25, 0.5, 0.75, 1].forEach((p) => { s += `<line x1="${L0}" x2="${W - R0}" y1="${Y(p)}" y2="${Y(p)}" stroke="rgba(255,255,255,0.07)"/><text x="${L0 - 8}" y="${Y(p) + 4}" fill="#6f7a8f" font-size="11.5" text-anchor="end" font-family="JetBrains Mono, monospace">${p * 100}%</text>`; });
    for (let t = Math.ceil(lo / 10) * 10; t <= hi; t += hi - lo > 60 ? 20 : 10) s += `<text x="${X(t)}" y="${H - B0 + 18}" fill="#6f7a8f" font-size="11.5" text-anchor="middle" font-family="JetBrains Mono, monospace">${t}%</text>`;
    s += `<text x="${W - R0}" y="${H - 6}" fill="#6f7a8f" font-size="11.5" text-anchor="end">Oxygen, % by volume · shaded: oxygen range of the tests</text>`;
    // tests: went out (top) or did not (bottom), jittered so they do not pile up
    cfg.points.forEach((p, i) => {
      const j = (((i * 9301 + 49297) % 233280) / 233280 - 0.5) * 0.07;
      s += `<circle cx="${X(p[0]) + j * 40}" cy="${Y(p[1] ? 0.985 + j * 0.2 : 0.015 + j * 0.2)}" r="2.6" fill="${p[1] ? "#3987e5" : "#9aa3b5"}" opacity="0.55"/>`;
    });
    const path = (k, keep) => pts.filter(([x]) => keep(x)).map(([x, ...v], i) => `${i ? "L" : "M"}${X(x).toFixed(1)},${Y(v[k]).toFixed(1)}`).join("");
    const band = pts.map(([x, , l]) => `${X(x).toFixed(1)},${Y(l).toFixed(1)}`).concat(pts.slice().reverse().map(([x, , , h]) => `${X(x).toFixed(1)},${Y(h).toFixed(1)}`)).join(" ");
    s += `<polygon points="${band}" fill="rgba(57,135,229,0.18)"/>`;
    s += `<path d="${path(0, () => true)}" fill="none" stroke="#7fd0ff" stroke-width="2" stroke-dasharray="5 5" opacity="0.7"/>`;
    s += `<path d="${path(0, inside)}" fill="none" stroke="#7fd0ff" stroke-width="2.5"/>`;
    const hx = Math.min(hi, Math.max(lo, cfg.you)), hr = cfg.at(hx);
    s += `<line x1="${X(hx)}" x2="${X(hx)}" y1="${T0}" y2="${H - B0}" stroke="#fff" stroke-dasharray="4 4" stroke-width="1.5"/>`;
    s += `<circle cx="${X(hx)}" cy="${Y(hr.fit)}" r="6" fill="#fff" stroke="#04060b" stroke-width="2"/>`;
    s += `<text x="${X(hx) + (X(hx) > W * 0.7 ? -10 : 10)}" y="${Math.max(T0 + 12, Y(hr.fit) - 10)}" fill="#fff" font-size="13" font-weight="600" text-anchor="${X(hx) > W * 0.7 ? "end" : "start"}">${esc(cfg.youLabel)}: ${pct(hr.fit)}</text>`;
    // hover: the value at each oxygen level
    const step = (W - L0 - R0) / n;
    pts.forEach(([x, f, l, h]) => { s += `<rect x="${X(x) - step / 2}" y="${T0}" width="${step}" height="${H - T0 - B0}" fill="transparent" data-tip="<b>${g(Math.round(x * 10) / 10)}% oxygen</b><span>${esc(cfg.label)}: ${pct(f)}<br>90% range ${pct(l)} to ${pct(h)}${inside(x) ? "" : "<br>Outside the tested oxygen range"}</span>"/>`; });
    el.innerHTML = s + "</svg>";
  }

  function drawModel() {
    const el = $("view-model"), m = state.model, D = MODELS.droplets, G = MODELS.gas;
    const x = MD.dropletX(state.o2, m.gas, state.pressure, m.d0, m.fuel), end = MD.classify(D.ending, x), k = MD.rate(D.rate, x);
    const away = (m.d0 * m.d0) / k.fit, ff = MD.fiftyFifty(D.ending, x, 0);
    const r1 = (v) => g(Math.round(v * 10) / 10);
    const offD = MD.outside(D.range, D.inputs, x, ["oxygen", "CO2", "helium", "pressure", "droplet size", "fuel"]);
    const gx = MD.gasX(state.o2, state.pressure, m.xf, m.flow, m.gfuel), se = MD.classify(G.self_ext, gx);
    const offG = MD.outside(G.range, G.inputs, gx, ["oxygen", "pressure", "fuel fraction", "fuel flow"]);
    const sc = D.ending.score, gsc = G.self_ext.score, gl = G.lights.score, oddsD = D.ending.odds_flame_goes_out, oddsG = G.self_ext.odds_goes_out;
    const unit = { oxygen: "%", CO2: "%", helium: "%", pressure: " atm", "droplet size": " mm", "fuel fraction": "", "fuel flow": " mg/s" };
    const off = (list) => list.length ? `<div class="callout info"><b>Beyond the tests.</b> ${list.map(([n, v, r]) => `Your ${n} (${g(Math.round(v * 100) / 100)}${unit[n] || ""}) is outside the ${g(r[0])} to ${g(r[1])}${unit[n] || ""} the tests covered.`).join(" ")} Here the model extends the trend it learned; no test checks it, and the range shown does not include that risk.</div>` : "";
    const chip = (key, v, label) => `<button class="pill" data-m="${key}" data-v="${esc(v)}" aria-pressed="${String(m[key]) === String(v)}">${esc(label)}</button>`;
    el.innerHTML = `
      <span class="eyebrow">Fire model</span>
      <h1 style="margin-top:12px">What models trained on NASA's tests predict at ${g(state.o2)}% oxygen and ${g(state.pressure)} psi</h1>
      <p class="lede">Two models, each fitted to every test in a NASA table and checked on tests it never saw. They predict for conditions between the tests and say how sure they are: the range is the middle 90% of 300 refits on resampled tests.</p>

      <div class="card model">
        <div class="model-head"><div><h3>Burning fuel droplets</h3><p class="muted">Fitted to ${sc.tests} FLEX droplet tests (PSI-69)</p></div>
          <div class="model-ctl">
            <div class="pills">${chip("fuel", "Methanol", "Methanol")}${chip("fuel", "Heptane", "Heptane")}</div>
            <div class="pills">${chip("gas", "N2", "Nitrogen only")}${chip("gas", "CO2", "20% CO2 added")}${chip("gas", "He", "20% helium added")}</div>
            <label class="mini">Droplet size <output>${g(m.d0)} mm</output><input class="plain" type="range" min="1.1" max="4.7" step="0.1" value="${m.d0}" data-r="d0"></label>
          </div></div>
        ${off(offD)}
        <div class="tiles">
          <div class="tile"><div class="k">Flame goes out on its own, fuel left</div><div class="v">${pct(end.fit[0])} <small>90% range ${pct(end.lo[0])} to ${pct(end.hi[0])}</small></div></div>
          <div class="tile"><div class="k">Burns until the fuel is used up</div><div class="v">${pct(end.fit[1])} <small>${pct(end.lo[1])} to ${pct(end.hi[1])}</small></div></div>
          <div class="tile"><div class="k">Droplet disrupted</div><div class="v">${pct(end.fit[2])} <small>${pct(end.lo[2])} to ${pct(end.hi[2])}</small></div></div>
        </div>
        ${ff ? `<p class="model-line big"><b>50-50 point: ${r1(ff.fit)}% oxygen</b> <span class="muted">(90% range ${r1(ff.lo)} to ${r1(ff.hi)}%)</span>. Below it, most of these droplet flames go out on their own; above it, most keep burning.${ff.fit < D.range.o2[0] || ff.fit > D.range.o2[1] ? " This point lies outside the tested oxygen range." : ""}</p>` : ""}
        <p class="model-line">Burning rate ${g(Math.round(k.fit * 1000) / 1000)} mm²/s (90% range ${g(Math.round(k.lo * 1000) / 1000)} to ${g(Math.round(k.hi * 1000) / 1000)}). A ${g(m.d0)} mm droplet that keeps burning is used up in about ${g(Math.round(away * 10) / 10)} s.</p>
        <div class="chart-box"><div class="k">Chance the flame goes out on its own, against oxygen · ${esc(m.fuel.toLowerCase())}, ${g(m.d0)} mm, ${m.gas === "N2" ? "nitrogen only" : m.gas === "CO2" ? "20% CO2" : "20% helium"}, ${g(state.pressure)} psi</div><div id="curve-d"></div>
          <div class="legend"><span><i style="background:#7fd0ff"></i>Model (dashed: beyond the tested oxygen range)</span><span><i style="background:rgba(57,135,229,0.5)"></i>90% range</span><span><i style="background:#3987e5"></i>Test: flame went out</span><span><i style="background:#9aa3b5"></i>Test: did not</span></div></div>
        <div class="row" style="margin-top:16px"><button class="btn primary small" id="sim-go"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>Simulate 60 droplets here, next to the real tests</button></div>
        <div id="sim"></div>
        <details style="margin-top:14px"><summary>How good is this model?</summary><ul class="facts">
          <li>On tests it never saw (5-fold cross-validation), it ranks a test whose flame went out above one whose flame did not ${Math.round(sc.auc_goes_out * 100)}% of the time (AUC ${sc.auc_goes_out}).</li>
          <li>It names the right ending (went out, used up, disrupted) for ${Math.round(sc.accuracy * 100)}% of unseen tests. Always guessing the commonest ending gets ${Math.round(sc.majority_guess * 100)}%.</li>
          <li>What it learned, holding the rest fixed: each extra point of oxygen multiplies the odds that the flame goes out on its own by ${oddsD.o2}; each extra millimetre of droplet by ${oddsD.d0}; heptane instead of methanol by ${oddsD.hep}; each point of CO2 added by ${oddsD.co2}, and of helium by ${oddsD.he}.</li>
          <li>The burning-rate model explains ${Math.round(D.rate.score.r2_log * 100)}% of the spread between unseen tests, with a typical error of ${D.rate.score.mae} mm²/s.</li>
          <li>The FLEX tests change several things at once, so these are associations in this data, not proof of cause.</li></ul></details>
      </div>

      <div class="card model" style="margin-top:18px">
        <div class="model-head"><div><h3>Gas flames on a burner</h3><p class="muted">Fitted to the ${gsc.tests} CFI-G flames that lit (PSI-159)</p></div>
          <div class="model-ctl">
            <div class="pills">${["ethane", "propane", "butane"].map((f) => chip("gfuel", f, f.charAt(0).toUpperCase() + f.slice(1))).join("")}</div>
            <label class="mini">Fuel flow <output>${g(m.flow)} mg/s</output><input class="plain" type="range" min="0.5" max="3" step="0.25" value="${m.flow}" data-r="flow"></label>
            <label class="mini">Fuel in the supply <output>${Math.round(m.xf * 100)}%</output><input class="plain" type="range" min="0.25" max="1" step="0.05" value="${m.xf}" data-r="xf"></label>
          </div></div>
        ${off(offG)}
        <div class="tiles" style="grid-template-columns:1fr">
          <div class="tile"><div class="k">A lit flame goes out on its own, rather than burning until the fuel is cut off</div><div class="v">${pct(se.fit[0])} <small>90% range ${pct(se.lo[0])} to ${pct(se.hi[0])}</small></div></div></div>
        <div class="chart-box"><div class="k">Chance a lit gas flame goes out on its own, against oxygen · ${esc(m.gfuel)}, ${g(m.flow)} mg/s, ${Math.round(m.xf * 100)}% fuel, ${g(state.pressure)} psi</div><div id="curve-g"></div>
          <div class="legend"><span><i style="background:#7fd0ff"></i>Model</span><span><i style="background:rgba(57,135,229,0.5)"></i>90% range</span><span><i style="background:#3987e5"></i>Test: went out on its own</span><span><i style="background:#9aa3b5"></i>Test: burned until fuel cut</span></div></div>
        <details style="margin-top:14px"><summary>How good is this model?</summary><ul class="facts">
          <li>On unseen tests it ranks a flame that went out on its own above one that kept burning ${Math.round(gsc.auc * 100)}% of the time (AUC ${gsc.auc}), and is right for ${Math.round(gsc.accuracy * 100)}% of them, against ${Math.round(gsc.majority_guess * 100)}% for always guessing "went out".</li>
          <li>What it learned: each extra point of oxygen multiplies the odds of going out on its own by ${oddsG.o2}; each extra mg/s of fuel flow by ${oddsG.m}.</li>
          <li>Whether a gas flame lights at all could not be predicted from these inputs: a model got ${Math.round(gl.accuracy * 100)}% right on unseen tests, below the ${Math.round(gl.majority_guess * 100)}% from always guessing "lights". So the site does not predict it.</li></ul></details>
      </div>`;
    const tested = (r) => [Math.min(r[0], 10), Math.max(40, Math.min(100, state.o2 + 6))];
    curve($("curve-d"), { x: tested(D.range.o2), trained: D.range.o2, you: state.o2, youLabel: `${g(state.o2)}% O2`, label: "Chance the flame goes out on its own",
      at: (o) => { const r = MD.classify(D.ending, MD.dropletX(o, m.gas, state.pressure, m.d0, m.fuel)); return { fit: r.fit[0], lo: r.lo[0], hi: r.hi[0] }; },
      points: D.points.filter((p) => p[2] === (m.fuel === "Heptane" ? 1 : 0)).map((p) => [p[0], p[1] === "E"]) });
    curve($("curve-g"), { x: tested(G.range.o2), trained: G.range.o2, you: state.o2, youLabel: `${g(state.o2)}% O2`, label: "Chance a lit flame goes out on its own",
      at: (o) => { const r = MD.classify(G.self_ext, MD.gasX(o, state.pressure, m.xf, m.flow, m.gfuel)); return { fit: r.fit[0], lo: r.lo[0], hi: r.hi[0] }; },
      points: G.points.filter((p) => p[1] && p[3] === m.gfuel).map((p) => [p[0], p[2] === 1]) });
    CH.bindTips(el);
    el.querySelectorAll("[data-m]").forEach((b) => b.onclick = () => { m[b.dataset.m] = b.dataset.v; drawModel(); });
    el.querySelectorAll("[data-r]").forEach((r) => {
      r.oninput = () => { r.previousElementSibling.textContent = r.dataset.r === "xf" ? Math.round(r.value * 100) + "%" : g(+r.value) + (r.dataset.r === "d0" ? " mm" : " mg/s"); };
      r.onchange = () => { m[r.dataset.r] = +r.value; drawModel(); };
    });
    $("sim-go").onclick = () => {
      if (simCtl) simCtl.destroy();
      const sim = MD.simulate(D, x, 60, Math.round(state.o2 * 100 + m.d0 * 10));
      const bands = FF.findings.find((f) => f.id === "droplet-oxygen").bands;
      let bi = 0; bands.forEach((b, i) => { const gap = (q) => Math.max(q.o2[0] - state.o2, state.o2 - q.o2[1], 0); if (gap(b) < gap(bands[bi])) bi = i; });
      const B = bands[bi], real = FF.replay.droplets.map((r) => ({ o2: r[0], fuel: r[1], d0: r[2], de: r[3], t: r[4], end: r[5], gas: r[6], p: r[7], id: r[8] }))
        .filter((r) => r.o2 >= B.o2[0] - 0.05 && r.o2 <= B.o2[1] + 0.05 && r.fuel === m.fuel);
      simCtl = FFReplay.mount($("sim"), FF, { kind: "droplets", custom: [
        { label: `Model: 60 ${m.fuel.toLowerCase()} droplets at ${g(state.o2)}% oxygen`, note: `About ${g(m.d0)} mm, ${m.gas === "N2" ? "nitrogen only" : m.gas === "CO2" ? "20% CO2" : "20% helium"}, ${g(state.pressure)} psi. Each one drawn from the model.`, rows: sim },
        { label: `Real: ${real.length} ${m.fuel.toLowerCase()} tests at ${B.label} oxygen`, note: "The NASA tests nearest your oxygen level, any size and gas. Where the two sides look alike, the model is reproducing the data.", rows: real },
      ] });
    };
  }

  /* ------------------------------------------------------ atmosphere map */
  function setAt(o2, p) {
    const s = FF.scenarios.find((x) => x.o2 === o2 && x.pressure === p && x.name !== "Custom");
    state.scenario = s ? s.name : "Custom"; state.o2 = Math.min(100, Math.max(10, o2)); state.pressure = Math.min(45, Math.max(3, p));
  }
  function drawMap() {
    const el = $("view-map"), c = L.coverage(FF, state.o2, state.pressure), nr = c.nearest, pts = L.placed(FF);
    const topO = Math.max(...pts.map((x) => x.o)), lowP = Math.min(...pts.map((x) => x.p));
    const open = L.ATMOS.filter((a) => L.coverage(FF, a.o2, a.p).n === 0);
    const r1 = (v) => g(Math.round(v * 10) / 10), habitat = state.scenario === "Custom" ? "Your habitat" : state.scenario;
    const by = Object.entries(c.by).sort((a, b) => b[1] - a[1]).map(([i, n]) => `${n} ${esc(i)}`).join(", ");
    el.innerHTML = `
      <span class="eyebrow">Atmosphere map</span>
      <h1 style="margin-top:12px">${open.length} of ${L.ATMOS.length} crew atmospheres, past and planned, have no microgravity fire test near them in the loaded data</h1>
      <p class="lede">Every dot is a NASA microgravity fire test, placed at its oxygen level and pressure. Every numbered pin is a real crew atmosphere, from Mercury to the Moon-base plans. All ${pts.length} tests sit at ${g(topO)}% oxygen or less and ${r1(lowP)} psi or more. Every US spacewalk, and every US crewed flight before Skylab, happened outside that zone. NASA's ${L.inverse(FF).n} inverse-flame tests (ACME CFI-G and Flame Design) did feed up to ${g(L.inverse(FF).top)}% oxygen, but out of the burner into a chamber of fuel and nitrogen, not as the surrounding air, so they are not placed on this map. Squares are solid-material fires in orbit from NASA's technical reports, with their pressure recorded (Saffire IV to VI, and the Space Shuttle's SSCE); they are counted separately. Click a pin, or anywhere on the map, to check that atmosphere.</p>
      <div class="tiles">
        <div class="tile"><div class="k">${esc(habitat)}: ${g(state.o2)}% oxygen, ${g(state.pressure)} psi</div><div class="v">${c.n} <small>tests within ${FF.near} points of oxygen and 25% of this pressure</small></div></div>
        <div class="tile"><div class="k">Nearest test</div><div class="v">${nr ? `${r1(nr.o)}% <small>at ${r1(nr.p)} psi · ${esc(nr.i)} ${esc(nr.t || "")}</small>` : "none"}</div></div>
        <div class="tile"><div class="k">Solid-material tests near this oxygen</div><div class="v">${c.solids} <small>${c.solids ? "pressure not listed" : `none above ${g(Math.max(...FF.rows.filter((r) => r.g !== "1" && r.c === "solid" && r.o).map((r) => r.o[1])))}% oxygen`}</small></div></div>
      </div>
      ${c.n ? `<p class="model-line">Near this atmosphere: ${by}.</p>` : `<div class="callout" style="margin-top:16px"><b>Open territory.</b> No microgravity test in the loaded data is this close. The nearest is ${nr ? `${r1(Math.abs(nr.o - state.o2))} points of oxygen and ${r1(Math.abs(nr.p - state.pressure))} psi away` : "missing"}. Anything said about fire here is an extrapolation.</div>`}
      ${reportCard("What NASA's technical reports add here")}
      <div class="figure" style="margin-top:18px">
        <div id="atlas"></div>
        <div class="legend"><span><i style="background:${CH.C.g1}"></i>Liquid droplets (FLEX, FLEX-2, CFI)</span><span><i style="background:${CH.C.third}"></i>Gas flames (CFI-G, ACME)</span><span><i style="background:${CH.C.ug};border-radius:2px"></i>Solid materials burned in orbit (NASA reports)</span><span><i class="tick" style="background:${CH.C.ug}"></i>Solid materials, oxygen only</span><span><i style="background:#fff"></i>Crew atmosphere with tests near it</span><span><i style="border:2px dashed #fff;background:transparent;width:9px;height:9px"></i>With none</span><span><i class="dia" style="background:#fff"></i>${esc(habitat)}</span></div>
        <p class="note">Bigger dots are several tests at the same spot. Pressure is on a log scale. "Near" means within ${FF.near} points of oxygen and 25% of the pressure. Only tests run in microgravity, with the oxygen of the surrounding air recorded, are shown. Crew atmospheres: NASA history and NASA's Exploration Atmospheres Working Group; the Apollo 1 cabin was pure oxygen at about 16.7 psi.</p>
      </div>
      <h2 style="margin:28px 0 12px">The atmospheres, and the tests near each</h2>
      ${CH.atlasTable(FF, true)}`;
    const pin = (id) => { const a = L.ATMOS.find((x) => x.id === id); setAt(a.o2, a.p); update(); };
    CH.atlas($("atlas"), FF, { you: { o2: state.o2, p: state.pressure }, onPin: pin, onPick: (o, p) => { setAt(o, p); update(); } });
    el.querySelectorAll("tr[data-pin]").forEach((tr) => { tr.onclick = () => pin(tr.dataset.pin); tr.onkeydown = (e) => { if (e.key === "Enter") pin(tr.dataset.pin); }; });
  }

  /* --------------------------------------------------------------- replay */
  const REPLAYABLE = { "droplet-oxygen": ["droplets", ""], "droplet-low-oxygen": ["droplets", ""], "droplet-diluent": ["droplets", "He"],
    "gas-oxygen": ["gas", ""], "cool-flames": ["gas", ""] };
  let replayCtl = null;
  function drawReplay() {
    const el = $("view-replay"), rp = state.replay;
    el.innerHTML = `
      <span class="eyebrow">Test replay</span>
      <h1 style="margin-top:12px">Watch NASA's own tests burn, side by side</h1>
      <p class="lede">Every flame below is one real test from NASA's tables, replayed in time-lapse. The left side starts at ISS air, the right at the oxygen level nearest your ${g(state.o2)}%. Watch how many flames go out on their own, and how many keep going.</p>
      <div id="rp"></div>
      <div class="cols-2" style="margin-top:22px">
        <div class="card prose"><h3>What is data</h3><ul>
          <li>Which tests appear, their oxygen level, fuel, starting droplet size, burn time and how each one ended all come from the NASA table (FLEX, PSI-69; CFI-G, PSI-159). Hover over a flame for its test.</li>
          <li>A droplet shrinks following the d² law: its diameter squared falls at a steady rate. The FLEX burning rates are measured this way, and for the tests that list both, the law matches the recorded burn time to within about 5% for most.</li>
          <li>A droplet whose flame went out keeps the diameter the table lists at extinction: fuel left unburned.</li></ul></div>
        <div class="card prose"><h3>What is drawn</h3><ul>
          <li>The look of each flame: its colour, glow and size around the droplet or burner. The tables do not measure these.</li>
          <li>How a disrupted droplet breaks apart. The table records "Disruption" without saying how.</li>
          <li>Time runs faster than in the tests, and every test starts together; on the space station they ran one at a time.</li></ul></div>
      </div>`;
    if (replayCtl) replayCtl.destroy();
    replayCtl = FFReplay.mount($("rp"), FF, { kind: rp.kind, right: rp.right, gas: rp.gas || "", o2: state.o2 });
  }

  const DRAW = { insights: drawInsights, map: drawMap, model: drawModel, replay: drawReplay, brief: drawBrief, gravity: drawGravity, investigations: drawInvestigations, compare: drawCompare, data: drawData };
  function update() {
    drawControls();
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.view === state.view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === "view-" + state.view));
    if (state.view !== "replay" && replayCtl) { replayCtl.destroy(); replayCtl = null; }
    if (state.view !== "insights" && insRp) { insRp.destroy(); insRp = insRpHost = insRpKey = null; }
    if (simCtl) { simCtl.destroy(); simCtl = null; }
    DRAW[state.view]();
  }
  update();
})();
