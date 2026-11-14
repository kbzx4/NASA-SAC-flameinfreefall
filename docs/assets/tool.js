/* The tool page. All evidence comes from logic.js; this file only draws it. */
(function () {
  "use strict";
  const FF = window.FF, L = window.FFLogic, CH = window.FFCharts, LINKS = window.FF_LINKS, esc = CH.esc, g = L.g;
  const $ = (id) => document.getElementById(id);
  FFFlame.stars($("stars"));

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
  const preset = FF.scenarios.find((s) => s.name === q.get("s")) || FF.scenarios[1];
  const state = {
    scenario: preset.name, o2: preset.o2, pressure: preset.pressure, flow: 10,
    gravity: Math.min(2, Math.max(0, +q.get("g") || 1)),
    materials: DEFAULT_MATERIALS.filter((m) => FF.materials.includes(m)),
    view: ["brief", "gravity", "investigations", "compare", "data"].includes(q.get("view")) ? q.get("view") : "brief",
    concern: "solid", compare: ["SAFFIRE-2", "BASS-II", "FLEX"], open: null,
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
    if (b.dataset.s) { const s = FF.scenarios.find((x) => x.name === b.dataset.s); state.scenario = s.name; state.o2 = s.o2; state.pressure = s.pressure; }
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
    if (!si) return "";
    return `<div class="si">${esc(si.text)}<span class="chk">${icon("M5 12.5l4.2 4.2L19 7").replace("<svg", '<svg style="width:11px;height:11px;vertical-align:-1px"')} SI-written · ${si.verified} of ${si.total} numbers found in the data${si.judge ? " · re-read by a second model" : ""}${si.dropped + si.judged_out ? ` · ${si.dropped + si.judged_out} sentence${si.dropped + si.judged_out > 1 ? "s" : ""} removed` : ""}</span></div>`;
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
        <div class="tile"><div class="k">${partial() ? `Tests in ${state.gravity === 1 ? "Moon" : "Mars"} gravity` : "Microgravity flame tests"}</div><div class="v">${partial() ? `0 <small>none exist in the loaded data</small>` : `${flameUg} <small>for these materials</small>`}</div></div>
        <div class="tile"><div class="k">Records behind this brief</div><div class="v">${records.length} <small>NASA test records</small></div></div>
      </div>
      ${partial() ? `<div class="callout"><b>${esc(gravityLabel())}: no test data.</b> No loaded investigation ran in partial gravity. The GSI on each card compares microgravity with normal gravity for the same material. NASA's challenge statement says the two could bound what happens in between; that is a hypothesis.</div>` : ""}

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
      <p class="note">These counts are descriptive. Fuel, pressure and flow rate vary between tests along with oxygen.${isPreset() ? "" : " SI-written interpretations on the material cards are prepared for the four preset habitats; custom values show the computed facts only."}</p>

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

  /* ------------------------------------------------------------- gravity */
  function drawGravity() {
    const paired = FF.pairs.filter((p) => p.gsi != null), flips = paired.filter((p) => p.gsi >= 0.5).length, tight = paired.filter((p) => p.gsi === 0).length;
    $("view-gravity").innerHTML = `
      <span class="eyebrow">Gravity bound</span>
      <h1 style="margin-top:12px">Gravity changed the outcome for ${flips} of ${paired.length} Saffire-II samples</h1>
      <p class="lede">Saffire-II burned the same materials in microgravity and in normal gravity. For ${tight} samples the burn length was the same in both, so the answer for the Moon or Mars is constrained. For ${flips} it differed by half the sample or more, so the answer in partial gravity is open.</p>
      <div class="figure"><div id="dumbbell"></div>
        <div class="legend"><span><i style="background:#3987e5"></i>Microgravity</span><span><i class="dia" style="background:#d95926"></i>Normal gravity (1g)</span><span>Bar: the range the Moon and Mars fall in, if burning changes steadily with gravity</span></div></div>
      <div class="cols-2" style="margin-top:18px">
        <div class="card"><h3>Gravity Sensitivity Index</h3>
          <div class="formula">GSI = | L<sub class="e">1g</sub> − L<sub class="u">µg</sub> | ÷ L<sub>sample</sub></div>
          <p style="margin-top:14px">L is burn length. <b style="color:var(--ink)">0</b> means microgravity and 1g agree, so the bound is tight. <b style="color:var(--ink)">1</b> means the sample burned fully in one and not at all in the other, so the bound says nothing about partial gravity.</p></div>
        <div class="card prose"><h3>Read this before you use it</h3><ul>
          <li>NASA's challenge statement says microgravity and normal-gravity results <i>could</i> bound intermediate gravity. That is a hypothesis.</li>
          <li>${paired.length} samples, one oxygen level (about 22%), one airflow (20 cm/s).</li>
          <li>The PSI table does not state the oxygen, pressure or airflow of the 1g tests.</li>
          <li>GSI uses burn length only. The fabric samples have GSI 0 but spread at a steady 2.1 to 2.6 mm/s in microgravity and accelerated in 1g.</li>
          <li>For thick PMMA, the microgravity value is the length with visible damage after a 600 to 900 s burn, with the flame still anchored (source notes 3 and 4).</li></ul></div>
      </div>
      <div class="h-sec"><h2>Source text</h2><span><a href="${FF.investigations.find((i) => i.name === "SAFFIRE-2").link}" target="_blank" rel="noopener">PSI-99, Saffire-II</a></span></div>
      <div class="scroll"><table class="t"><tr><th>Sample</th><th>Material</th><th>Thickness</th><th>Flow</th><th>O2 %</th><th>µg burn length</th><th>µg spread</th><th>1g burn length</th><th>1g spread</th><th>GSI</th></tr>
        ${FF.pairs.map((p) => `<tr><td>${esc(p.sample)}</td><td>${esc(p.material)}</td><td>${esc(p.thickness)}</td><td>${esc(p.direction)}</td><td>${esc(p.o2_raw)}</td><td>${esc(p.ug_raw)}</td><td>${esc(p.ug_spread || "—")}</td><td>${esc(p.g1_raw || "—")}</td><td>${esc(p.g1_spread || "—")}</td><td class="mono">${p.gsi == null ? "—" : p.gsi.toFixed(2)}</td></tr>`).join("")}</table></div>
      <p class="note">"Complete" is plotted as the full sample length. Sample 2-7 is split into its PMMA and Nomex sections; the table gives no 1g result for the PMMA section, so it has no GSI. Cells are shown as NASA wrote them.</p>`;
    CH.dumbbell($("dumbbell"), FF.pairs);
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
    const texts = [...Object.values(FF.si.material), ...Object.values(FF.si.atmosphere), ...FF.investigations.map((i) => i.si).filter(Boolean)];
    const total = texts.reduce((a, t) => a + t.total, 0), dropped = texts.reduce((a, t) => a + t.dropped + t.judged_out, 0);
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
          <li>No investigation here ran in partial gravity.</li></ul></div>
        <div class="card prose"><h3>How SI is used</h3><ul>
          <li>A Gemini model wrote the short interpretations on the material cards and the investigation summaries, from a list of facts computed by code.</li>
          <li>Code then looked up every number in each text in those facts and removed any sentence containing a number that was not there. Across ${texts.length} texts, ${total.toLocaleString("en-US")} numbers were checked and ${dropped} sentence${dropped === 1 ? " was" : "s were"} removed.</li>
          <li>A second model (Gemma) then re-read each remaining sentence against the facts and removed any it judged unsupported. The removed-sentence count above includes both checks.</li>
          <li>Neither check is proof, so the computed facts beside each text remain the reference.</li>
          <li>Grades, counts, rankings and charts are computed without SI.</li>
          <li>An SI coding assistant (Claude) helped write the code and the site text.</li></ul></div>
      </div>
      <div class="h-sec"><h2>Sources</h2><span>NASA Physical Science Informatics</span></div>
      <div class="scroll"><table class="t"><tr><th>Investigation</th><th>NASA record</th><th>Fuel class</th><th>Records</th><th>NASA file</th></tr>
        ${FF.investigations.map((i) => `<tr><td>${esc(i.name)}</td><td><a href="${i.link}" target="_blank" rel="noopener">${esc(i.psi)} ↗</a></td><td>${esc(i.class)}</td><td class="mono">${i.rows}</td><td>${esc(i.file)}</td></tr>`).join("")}</table></div>
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
    const used = new Set(["FLEX", "CFI-G"]);
    let h = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Fire Evidence Brief: ${esc(state.scenario)}</title><style>${css}</style></head><body>
      <h1>Fire Evidence Brief</h1><p class="sub">${esc(state.scenario)}: ${g(state.o2)}% oxygen, ${g(state.pressure)} psi, ${g(state.flow)} cm/s airflow, ${esc(gravityLabel())}. Generated ${new Date().toISOString().slice(0, 10)} with Flamebound.</p>
      <p class="warn"><b>This is an evidence summary, not a safety assessment.</b> It reports which NASA microgravity tests exist near these conditions. It does not predict whether a material will burn.</p>
      <h2>${f.near} of ${f.mats.length} materials were flame-tested near ${g(state.o2)}% oxygen</h2>
      <table><tr><th>Material</th><th>Evidence</th><th>Flame tests</th><th>Oxygen tested</th><th>Gap to yours</th><th>Smoke tests</th></tr>
      ${f.mats.map((m) => `<tr><td>${esc(m.material)}</td><td>${GRADE[m.grade][0]}</td><td>${m.flame_tests}</td><td>${m.oxygen_tested_pct ? m.oxygen_tested_pct + "%" : "not listed"}</td><td>${m.oxygen_gap_points == null ? "" : g(m.oxygen_gap_points) + " points"}</td><td>${m.smoke_tests}</td></tr>`).join("")}</table>
      <small>"Near" means within ${g(FF.near)} points of oxygen. Pressure is not listed in any solid-fuel table loaded, so the grade uses oxygen only.</small>
      ${partial() ? `<p class="warn"><b>No partial-gravity tests exist in the loaded data.</b> The gravity lines below compare microgravity with normal gravity. NASA's challenge statement says the two could bound intermediate gravity; that is a hypothesis.</p>` : ""}
      <h2>By material</h2>`;
    f.mats.forEach((m) => {
      Object.keys(m.flame_tests_by_investigation).concat(Object.keys(m.smoke_tests_by_investigation)).forEach((i) => used.add(i));
      const si = isPreset() ? FF.si.material[`${state.scenario}|${m.material}`] : null;
      h += `<h3>${esc(m.material)}</h3>${si ? `<p class="si">${esc(si.text)}<br><small>SI-written (${esc(si.model)}); ${si.verified} of ${si.total} numbers found in the data.</small></p>` : ""}<ul>${L.materialSentences(FF, m, state.o2, partial()).map((s) => `<li>${esc(s)}</li>`).join("")}
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
  const DRAW = { brief: drawBrief, gravity: drawGravity, investigations: drawInvestigations, compare: drawCompare, data: drawData };
  function update() {
    drawControls();
    document.querySelectorAll(".tab").forEach((t) => t.setAttribute("aria-selected", t.dataset.view === state.view));
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("on", v.id === "view-" + state.view));
    DRAW[state.view]();
  }
  update();
})();
