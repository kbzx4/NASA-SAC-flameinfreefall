/* Evidence logic for the site. A line-for-line port of brief.py and core.py.
   tests/parity.mjs checks that it returns the same results as the Python for every preset habitat. */
(function (root) {
  "use strict";

  const g = (x) => String(Number(Number(x).toPrecision(6)));
  const lows = (rows, k) => rows.filter((r) => r[k]).map((r) => r[k][0]);
  const highs = (rows, k) => rows.filter((r) => r[k]).map((r) => r[k][1]);
  const min = (a) => (a.length ? Math.min(...a) : null);
  const max = (a) => (a.length ? Math.max(...a) : null);
  const span = (lo, hi, unit = "") => (lo == null ? null : lo === hi ? g(lo) + unit : `${g(lo)} to ${g(hi)}${unit}`);
  const round = (x, d) => Math.round(x * 10 ** d) / 10 ** d;

  function counts(rows) {
    const c = new Map();
    rows.forEach((r) => c.set(r.i, (c.get(r.i) || 0) + 1));
    return Object.fromEntries([...c.entries()].sort((a, b) => b[1] - a[1]));
  }

  function gap(r, o2) {
    return Math.max(r.o[0] - o2, o2 - r.o[1], 0);
  }

  function materialEvidence(FF, material, o2) {
    const mine = FF.rows.filter((r) => r.m.includes(material));
    const flame = mine.filter((r) => r.c === "solid" && r.g !== "1");
    const smoke = mine.filter((r) => r.c === "smoke source");
    const ev = {
      material,
      flame_tests: flame.length,
      flame_tests_by_investigation: counts(flame),
      oxygen_tested_pct: null, nearest_test: null, oxygen_gap_points: null,
      flame_tests_near: 0,
      airflow_tested_cm_s: span(min(lows(flame, "F")), max(highs(flame, "F"))),
      flame_tests_with_airflow: flame.filter((r) => r.F).length,
      pressure_tested_psi: span(min(lows(flame, "P")), max(highs(flame, "P"))),
      smoke_tests: smoke.length,
      smoke_tests_by_investigation: counts(smoke),
      smoke_airflow_cm_s: span(min(lows(smoke, "F")), max(highs(smoke, "F"))),
      gravity_pairs: [],
    };
    const withO2 = flame.filter((r) => r.o);
    if (withO2.length) {
      let best = withO2[0];
      withO2.forEach((r) => { if (gap(r, o2) < gap(best, o2)) best = r; });
      const gmin = gap(best, o2);
      ev.oxygen_tested_pct = span(min(lows(withO2, "o")), max(highs(withO2, "o")));
      ev.oxygen_gap_points = round(gmin, 1);
      ev.flame_tests_near = withO2.filter((r) => gap(r, o2) <= FF.near).length;
      ev.nearest_test = {
        investigation: best.i, psi_id: best.p, test: best.t, sample: best.f, oxygen_source_text: String(best.or),
        side: gmin === 0 ? "at your level" : best.o[1] < o2 ? "below yours" : "above yours",
      };
    }
    FF.pairs.filter((p) => p.mat === material && p.gsi != null).forEach((p) => ev.gravity_pairs.push({
      sample: p.sample, thickness: p.thickness, gsi: round(p.gsi, 2),
      microgravity_burn_length: p.ug_raw, normal_gravity_burn_length: p.g1_raw,
    }));
    ev.grade = ev.flame_tests_near ? "near" : withO2.length ? "far" : flame.length ? "unlisted" : smoke.length ? "smoke" : "none";
    return ev;
  }

  function atmosphereEvidence(FF, o2) {
    const near = (name) => FF.rows.filter((r) => r.i === name && r.o && Math.abs((r.o[0] + r.o[1]) / 2 - o2) <= FF.window);
    const flex = near("FLEX");
    const end = flex.map((r) => (r.out || "").split(";")[0]);
    const gas = near("CFI-G");
    const has = (rows, text, k) => rows.filter((r) => (r[k] || "").includes(text)).length;
    return {
      oxygen_window_points: FF.window,
      droplets: {
        investigation: "FLEX", psi_id: "PSI-69", tests: flex.length,
        flame_went_out_first: end.filter((e) => e === "Extinction").length,
        burned_to_completion: end.filter((e) => e === "Completion").length,
        droplet_disrupted: end.filter((e) => e === "Disruption").length,
        tests_with_co2: has(flex, "CO2", "d"), tests_with_helium: has(flex, "He", "d"),
        pressure_psi: span(min(lows(flex, "P")), max(highs(flex, "P"))),
      },
      gas_flames: {
        investigation: "CFI-G", psi_id: "PSI-159", tests: gas.length,
        ignited: has(gas, "Hot ignition: Yes", "out"),
        went_out_on_their_own: has(gas, "self-extinguished", "out"),
        burned_until_fuel_was_cut: has(gas, "flow terminated", "out"),
        pressure_psi: span(min(lows(gas, "P")), max(highs(gas, "P"))),
      },
    };
  }

  /* ---- HFRI = M_conditions x M_fuel x W_evidence ---- */
  function fuelMatch(FF, a, b) {
    if (a === b) return 1;
    return FF.related.some((p) => p.includes(a) && p.includes(b)) ? 0.5 : 0.2;
  }

  function closeness(range, x, scale) {
    if (!range) return 0; // a value the table does not list earns no credit
    const d = Math.max(range[0] - x, x - range[1], 0);
    return Math.min(1, Math.max(0, 1 - d / scale));
  }

  function scoreTests(FF, o2, pressure, flow, fuelClass) {
    return FF.rows.filter((r) => r.g !== "1").map((r) => {
      const mc = (closeness(r.o, o2, FF.range.o2) + closeness(r.P, pressure, FF.range.pressure) + closeness(r.F, flow, FF.range.flow)) / 3;
      const mf = fuelMatch(FF, r.c, fuelClass);
      const we = r.l === "test" ? 1 : 0.6;
      return { r, mc, mf, we, hfri: mc * mf * we };
    });
  }

  function rng(lo, hi, unit) {
    if (lo == null) return "not listed";
    return lo === hi ? `${g(lo)} ${unit}` : `${g(lo)} to ${g(hi)} ${unit}`;
  }

  function rankInvestigations(FF, o2, pressure, flow, fuelClass) {
    const scored = scoreTests(FF, o2, pressure, flow, fuelClass);
    const groups = new Map();
    scored.forEach((s) => { if (!groups.has(s.r.i)) groups.set(s.r.i, []); groups.get(s.r.i).push(s); });
    const out = [];
    groups.forEach((grp, inv) => {
      let best = grp[0];
      grp.forEach((s) => { if (s.hfri > best.hfri) best = s; });
      const word = { 1: "same fuel class", 0.5: "related fuel class", 0.2: "different fuel class" }[best.mf];
      const cls = best.r.c.charAt(0).toUpperCase() + best.r.c.slice(1);
      const parts = [`${cls} (${word})`];
      const rows = grp.map((s) => s.r);
      [["o", "O2", "%", o2], ["P", "pressure", "psi", pressure], ["F", "airflow", "cm/s", flow]].forEach(([k, label, unit, x]) => {
        const lo = min(lows(rows, k)), hi = max(highs(rows, k));
        if (lo == null) parts.push(`${label} not listed`);
        else parts.push(`${label} range ${rng(lo, hi, unit)} ${lo <= x && x <= hi ? "includes" : "misses"} your ${g(x)}`);
      });
      if (best.we < 1) parts.push("summary table only");
      out.push({
        investigation: inv, hfri: round(best.hfri, 2), why: parts.join("; ") + ".", tests: grp.length,
        close: grp.filter((s) => s.hfri >= 0.7).length, closest: best.r.t, psi: best.r.p, scored: grp,
      });
    });
    out.sort((a, b) => b.hfri - a.hfri || b.close - a.close);
    return out;
  }

  /* ---- plain wording ---- */
  function materialSentences(FF, ev, o2, partialGravity) {
    const s = [];
    if (ev.flame_tests) {
      const where = Object.entries(ev.flame_tests_by_investigation).map(([inv, n]) => `${n} in ${inv}`).join(", ");
      s.push(`${ev.flame_tests} microgravity flame tests (${where}).`);
      if (ev.oxygen_tested_pct) {
        const n = ev.nearest_test;
        if (ev.oxygen_gap_points === 0) {
          s.push(`Oxygen tested: ${ev.oxygen_tested_pct}%, which includes your ${g(o2)}%. ${ev.flame_tests_near} tests are within ${g(FF.near)} points of it.`);
        } else {
          s.push(`Oxygen tested: ${ev.oxygen_tested_pct}%. The nearest test is ${g(ev.oxygen_gap_points)} points ${n.side} (${n.investigation} test ${n.test}).`);
        }
      } else {
        s.push("The PSI table lists no oxygen level for these tests.");
      }
      s.push(ev.airflow_tested_cm_s
        ? `Airflow: ${ev.airflow_tested_cm_s} cm/s, listed for ${ev.flame_tests_with_airflow} of the ${ev.flame_tests} tests.`
        : "Airflow: not listed as a speed.");
      if (!ev.pressure_tested_psi) s.push("Pressure: not listed.");
    } else {
      s.push("No flame tests in the loaded tables.");
    }
    if (ev.gravity_pairs.length) {
      const v = ev.gravity_pairs.map((p) => p.gsi), lo = Math.min(...v), hi = Math.max(...v);
      const verdict = hi === 0 ? "microgravity and 1g agree" : hi < 0.5 ? "gravity changed the burn length" : "gravity changed the outcome for at least one sample";
      s.push(`Gravity: ${v.length} Saffire-II sample${v.length > 1 ? "s" : ""} with a 1g comparison, GSI ${lo === hi ? lo.toFixed(2) : `${lo.toFixed(2)} to ${hi.toFixed(2)}`}; ${verdict}.`);
    } else if (partialGravity) {
      s.push("Gravity: no 1g comparison loaded, so nothing bounds partial gravity for this material.");
    }
    if (ev.smoke_tests) {
      const where = Object.entries(ev.smoke_tests_by_investigation).map(([inv, n]) => `${n} in ${inv}`).join(", ");
      s.push(`Smoke: ${ev.smoke_tests} smoke-particle tests (${where})` + (ev.smoke_airflow_cm_s ? `, airflow ${ev.smoke_airflow_cm_s} cm/s.` : "."));
    }
    return s;
  }

  function atmosphereSentences(atm, o2) {
    const d = atm.droplets, a = atm.gas_flames, w = g(atm.oxygen_window_points);
    return {
      droplets: d.tests
        ? `${d.tests} droplet tests within ${w} points of ${g(o2)}% oxygen, at ${d.pressure_psi} psi. In ${d.flame_went_out_first} the flame went out before the droplet was used up, ${d.burned_to_completion} burned to completion and ${d.droplet_disrupted} were disrupted. ${d.tests_with_co2} had CO2 in the atmosphere and ${d.tests_with_helium} had helium.`
        : `No droplet tests within ${w} points of ${g(o2)}% oxygen.`,
      gas: a.tests
        ? `${a.tests} gas-flame tests within ${w} points of ${g(o2)}% oxygen, at ${a.pressure_psi} psi. ${a.ignited} ignited. Of those, ${a.went_out_on_their_own} went out on their own and ${a.burned_until_fuel_was_cut} burned until the fuel was cut.`
        : `No gas-flame tests within ${w} points of ${g(o2)}% oxygen.`,
    };
  }

  /* ---- findings: ranked by how close their tests come to a habitat (build_findings.rank) ---- */
  function rankFindings(FF, o2, pressure, fuelClass) {
    const gapTo = (r) => (r ? Math.max(r[0] - o2, o2 - r[1], 0) : Infinity);
    const out = [];
    FF.findings.forEach((f) => {
      if (fuelClass && f.fuel_class !== fuelClass) return;
      let i = 0;
      f.bands.forEach((b, k) => {
        const d = gapTo(b.o2) - gapTo(f.bands[i].o2);
        if (d < 0 || (d === 0 && b.n > f.bands[i].n)) i = k;
      });
      const b = f.bands[i], mo = closeness(b.o2, o2, FF.range.o2), mp = closeness(b.p, pressure, FF.range.pressure);
      out.push({ id: f.id, score: round(mo * (1 + mp) / 2 * (b.n >= 10 ? 1 : 0.7), 2), band: i, m_o2: round(mo, 2), m_p: round(mp, 2), n: b.n, gap: gapTo(b.o2) });
    });
    out.sort((a, b) => b.score - a.score || a.gap - b.gap || b.n - a.n); // ties: nearest oxygen, then more tests
    out.forEach((r) => { delete r.n; delete r.gap; });
    return out;
  }

  /* ---- what the loaded data cannot say about a habitat (build_insights.gaps) ---- */
  function gaps(FF, o2, pressure) {
    const t = FF.rows.filter((r) => r.g !== "1"), out = [];
    const top = max(highs(t, "o"));
    if (o2 > top + 2) out.push(`no flame test in the data ran above ${g(top)}% oxygen, and this habitat is at ${g(o2)}%`);
    const solid = max(highs(t.filter((r) => r.c === "solid"), "o"));
    if (o2 > solid + 2) out.push(`no solid material (fabric, plastic) was flame-tested above ${g(solid)}% oxygen`);
    const low = min(lows(t, "P"));
    if (pressure < low - 1) out.push(`no test in the data ran below ${g(low)} psi, and this habitat is at ${g(pressure)} psi`);
    out.push("no solid-material flame test in the data lists its pressure");
    out.push("no test in the data ran in Moon or Mars gravity");
    return out;
  }

  /* ---- the atmospheres crews have breathed, or are planned to (Atmosphere map) ---- */
  const ATMOS = [
    { id: "mga", name: "Mercury, Gemini and Apollo in flight", short: "Mercury to Apollo", o2: 100, p: 5, when: "1961 to 1975", note: "Pure oxygen at about a third of sea-level pressure, for every US crew until Skylab." },
    { id: "a1", name: "Apollo 1 ground test", short: "Apollo 1", o2: 100, p: 16.7, when: "January 1967", note: "Pure oxygen above sea-level pressure, during a launch-pad rehearsal. A fire spread through the cabin in seconds and killed the three crew.", fire: true },
    { id: "sky", name: "Skylab", short: "Skylab", o2: 74, p: 5, when: "1973 to 1974", note: "About three-quarters oxygen and one quarter nitrogen, at 5 psi." },
    { id: "iss", name: "Space Shuttle, Mir and ISS cabin", short: "ISS", o2: 21, p: 14.7, when: "1981 to today", note: "Sea-level air. Mir had a fire in air like this in 1997, from an oxygen generator.", fire: true },
    { id: "eva", name: "Shuttle cabin before a spacewalk", short: "Shuttle pre-spacewalk", o2: 26.5, p: 10.2, when: "1981 to 2011", note: "The cabin was lowered to 10.2 psi with extra oxygen, so crews could get into suits faster." },
    { id: "moon", name: "Moon base or pressurized rover", short: "Moon base", o2: 30, p: 10.2, when: "planned", note: "The oxygen level and pressure NASA expects for Moon bases and rovers.", scenario: "Moon base / pressurized rover" },
    { id: "exp", name: "NASA exploration atmosphere", short: "Exploration", o2: 34, p: 8.2, when: "proposed 2006", note: "The atmosphere NASA's Exploration Atmospheres Working Group proposed for exploration vehicles.", scenario: "Exploration atmosphere" },
    { id: "suit", name: "Spacesuit", short: "Spacesuit", o2: 100, p: 4.3, when: "every US spacewalk", note: "Pure oxygen at 4.3 psi, inside the suit.", scenario: "Spacesuit" },
  ];
  const NEAR_P = 1.25; // "near" in pressure: within 25% either way
  /* microgravity tests that list both oxygen and pressure, as points */
  function placed(FF) {
    return FF._placed || (FF._placed = FF.rows.filter((r) => r.g !== "1" && r.o && r.P).map((r) => ({ o: (r.o[0] + r.o[1]) / 2, p: (r.P[0] + r.P[1]) / 2, c: r.c, i: r.i, t: r.t, out: r.out })));
  }
  /* how much test evidence sits near one atmosphere: tests within FF.near points of oxygen and 25% of
     pressure, and the nearest test (distance: 5 points of oxygen counts the same as 25% of pressure) */
  function coverage(FF, o2, p) {
    const pts = placed(FF), lp = Math.log(NEAR_P);
    const near = pts.filter((x) => Math.abs(x.o - o2) <= FF.near && Math.abs(Math.log(x.p / p)) <= lp);
    let best = null, bd = Infinity;
    pts.forEach((x) => { const d = Math.hypot((x.o - o2) / 5, Math.log(x.p / p) / lp); if (d < bd) { bd = d; best = x; } });
    const by = {}; near.forEach((x) => { by[x.i] = (by[x.i] || 0) + 1; });
    const solids = FF.rows.filter((r) => r.g !== "1" && r.c === "solid" && r.o && Math.abs((r.o[0] + r.o[1]) / 2 - o2) <= FF.near).length;
    return { n: near.length, by, nearest: best, o2_gap: best ? round(Math.abs(best.o - o2), 1) : null, solids };
  }

  function inverse(FF) { // tests whose oxygen came from the burner, not the surrounding air
    if (FF._inv) return FF._inv;
    const r = FF.rows.filter((x) => / inverse$/.test(x.i)), o = r.filter((x) => x.os != null);
    return (FF._inv = { n: r.length, top: o.length ? Math.max(...o.map((x) => x.os)) : 0, minP: r.length ? Math.min(...r.filter((x) => x.P).map((x) => x.P[0])) : 0,
      invs: [...new Set(r.map((x) => x.i))] });
  }

  /* ---- tests from NASA technical reports (data/reports): hand-copied, kept apart from the PSI tables ---- */
  const REP = (FF) => FF.reports || { sources: [], saffire: [], ssce: [], gravity: [], wstf10: [], wstfO2: [] };
  function source(FF, key) { return REP(FF).sources.find((s) => s.key === key); }
  /* solid materials burned in orbit with their oxygen and pressure recorded: Saffire IV-VI and SSCE */
  function reportPoints(FF) {
    if (FF._rp) return FF._rp;
    const R = REP(FF);
    const sa = R.saffire.map((r) => ({ o: r.o2, p: r.psi, id: `Saffire ${r.id}`, set: "Saffire", when: r.flight, material: r.material, out: r.outcome, src: r.src, where: r.where }));
    const ss = R.ssce.map((r) => ({ o: r.o2, p: r.psi, id: `SSCE ${r.id}`, set: "SSCE", when: `Space Shuttle ${r.id}${r.when ? `, ${r.when}` : ""}`, material: r.material,
      out: r.spread != null ? `Flame spread ${r.spread} cm/s. ${r.outcome}` : r.outcome, src: r.src, where: r.where }));
    return (FF._rp = [...sa, ...ss]);
  }
  function reportCoverage(FF, o2, p) { // the same "near" as coverage(): FF.near points of oxygen, 25% of pressure
    const lp = Math.log(NEAR_P);
    return reportPoints(FF).filter((x) => Math.abs(x.o - o2) <= FF.near && Math.abs(Math.log(x.p / p)) <= lp);
  }
  /* NASA's standard upward flame test (NASA-STD-6001 Test 1), normal gravity, 10.2 psi: a material can keep burning
     at an oxygen level above its MOC, the highest oxygen at which it reliably went out ("<30": burned even at 30%) */
  function burnsAbove(moc, o2) { return moc.bound === "below" ? o2 >= moc.v : moc.bound === "above" ? false : o2 > moc.v; }
  function wstfBurning(FF, o2) {
    const rows = REP(FF).wstf10;
    return { n: rows.length, burning: rows.filter((r) => burnsAbove(r.moc, o2)) };
  }
  /* limiting oxygen by gravity level (Olson and Ferkul 2012, Table I): the middle of the band between the lowest
     oxygen that kept burning (ULOI) and the highest at which the flame went out (MOC) */
  function gravityLimits(FF) {
    const rows = REP(FF).gravity, mats = [...new Set(rows.map((r) => r.material))];
    return mats.map((m) => {
      const r = rows.filter((x) => x.material === m).map((x) => ({ ...x, mid: (x.uloi + x.moc) / 2 })).sort((a, b) => a.g - b.g);
      const at = (name) => r.find((x) => x.gravity === name || x.gravity.startsWith(name));
      return { material: m, psia: r[0].psia, rows: r, earth: at("Earth"), moon: at("Moon"), mars: at("Mars"), micro: at("Microgravity"),
        lowest: r.reduce((a, b) => (b.mid < a.mid ? b : a)) };
    });
  }

  /* What NASA's technical reports say for one habitat: one entry per report group, with the result nearest
     the habitat and the patterns computed from the transcribed tables (no SI). Ranked by how far the habitat's
     oxygen is from the oxygen the group tested, then by pressure. Limits quoted are from the Saffire VI paper
     (p. 5): NASA's 1-hour CO2 limit of 3 mmHg and the 24-hour CO limit (SMAC) of 100 ppm. */
  function reportEvidence(FF, o2, p) {
    const R = REP(FF), out = [], r1 = (v) => Math.round(v * 10) / 10, lp = Math.log(NEAR_P);
    const gapTo = (lo, hi, v) => (v < lo ? lo - v : v > hi ? v - hi : 0);
    const dist = (o, q) => Math.hypot((o - o2) / 5, Math.log(q / p) / lp);
    const add = (e) => { e.p = e.p.map(r1); e.o2_gap = r1(gapTo(e.o2[0], e.o2[1], o2)); e.p_gap = r1(gapTo(e.p[0], e.p[1], p)); out.push(e); };
    const low1 = (t) => t.charAt(0).toLowerCase() + t.slice(1);
    const srcOf = (rows) => [...new Set(rows.flatMap((r) => r.src))];
    if (R.ssce.length) {
      const os = R.ssce.map((r) => r.o2), ps = R.ssce.map((r) => r.psi);
      const near = R.ssce.slice().sort((a, b) => dist(a.o2, a.psi) - dist(b.o2, b.psi))[0];
      const at = (o, atm) => R.ssce.find((r) => r.o2 === o && r.atm === atm && r.spread != null);
      const lines = [], a35 = at(35, 1.5), a50 = at(50, 1.5), pr = R.ssce.filter((r) => r.o2 === 50 && r.spread != null).sort((a, b) => a.atm - b.atm);
      if (a35 && a50) lines.push(`Flames spread over paper ${r1(a50.spread / a35.spread)} times faster at 50% oxygen than at 35%, at the same 1.5 atm (${a50.spread} against ${a35.spread} cm/s).`);
      if (pr.length > 1) lines.push(`At 50% oxygen they spread faster as pressure rose: ${pr.map((r) => `${r.spread} cm/s at ${r.atm} atm`).join(", ")}.`);
      const thick = R.ssce.filter((r) => /PMMA/.test(r.material));
      if (thick.length) lines.push(`Thick PMMA kept burning on all ${thick.length} flights, at ${[...new Set(thick.map((r) => r.o2))].sort((a, b) => a - b).join(" and ")}% oxygen, until the experiment put it out or the camera film ran out.`);
      add({ id: "ssce", title: "Solid materials burned in orbit at 35 to 70% oxygen", where: "Space Shuttle SSCE · in orbit", gravity: "microgravity",
        o2: [Math.min(...os), Math.max(...os)], p: [Math.min(...ps), Math.max(...ps)],
        nearest: `In orbit on the Space Shuttle (SSCE ${near.id}), ${near.material} at ${near.o2}% oxygen and ${near.atm} atm${near.spread != null ? `: the flame spread at ${near.spread} cm/s, ${low1(near.outcome).replace(/^spread /, "")}` : ` ${low1(near.outcome)}`}`,
        lines, caveat: "Quiet air with no airflow; small samples (paper 10 cm, PMMA 2.5 cm) in a 39-litre chamber.", src: srcOf(R.ssce) });
    }
    if (R.saffire.length) {
      const os = R.saffire.map((r) => r.o2), ps = R.saffire.map((r) => r.psi);
      const near = R.saffire.slice().sort((a, b) => dist(a.o2, a.psi) - dist(b.o2, b.psi))[0];
      const lines = [], co2 = R.saffire.filter((r) => r.co2_mmhg != null && r.co2_mmhg > 3), coR = R.saffire.filter((r) => r.co_ppm != null);
      const keep = R.saffire.find((r) => /fan off/.test(r.outcome)), smoke = R.saffire.find((r) => /smoke-alarm/.test(r.outcome));
      if (keep) lines.push(`Saffire ${keep.id}, ${keep.material} at ${keep.o2}% oxygen and ${r1(keep.psi)} psi: ${keep.outcome}`);
      if (co2.length) lines.push(`${co2.map((r) => `Saffire ${r.id}`).join(" and ")} raised the spacecraft's average CO2 by ${co2.map((r) => r.co2_mmhg).join(" and ")} mmHg, past NASA's 1-hour limit of 3 mmHg.`);
      if (coR.length) lines.push(`CO rose by up to ${Math.max(...coR.map((r) => r.co_ppm))} ppm; ${coR.filter((r) => r.co_ppm > 100).length} of the ${coR.length} burns with a CO reading went above NASA's 24-hour limit of 100 ppm.`);
      if (smoke) lines.push(`Saffire ${smoke.id}: a tight smoke-alarm threshold (1 mg/m3) was reached only at 981 s, after much of the hazardous gas had been released.`);
      add({ id: "saffire", title: "Large fires in a real spacecraft, up to 31% oxygen", where: "Saffire IV to VI · Cygnus, in orbit", gravity: "microgravity",
        o2: [Math.min(...os), Math.max(...os)], p: [Math.min(...ps), Math.max(...ps)],
        nearest: `In orbit in a Cygnus spacecraft (Saffire ${near.id}), ${near.material} at ${near.o2}% oxygen and ${r1(near.psi)} psi: ${low1(near.outcome)}`,
        lines, caveat: "Samples 18 to 50 cm long in a flow duct at 20 cm/s; one or two tests at each condition.", src: srcOf(R.saffire) });
    }
    if (R.wstf10.length) {
      const n = R.wstf10.length, at = Math.min(99.5, Math.max(30, o2));
      const burn = R.wstf10.filter((r) => burnsAbove(r.moc, at)), unk = R.wstf10.filter((r) => r.moc.bound === "above" && r.moc.v < at);
      const outN = n - burn.length - unk.length, top = R.wstf10.filter((r) => r.moc.bound === "above" && r.moc.v >= 99.5);
      const names = (rows) => [...new Set(rows.map((r) => r.material.replace(/ (single|double) layer$/, "")))].join(", ");
      const lines = [`Still burning at 30% oxygen, Moon-base air: ${names(R.wstf10.filter((r) => burnsAbove(r.moc, 30)))}.`];
      if (top.length) lines.push(`Still going out at 99.5% oxygen: ${names(top)}.`);
      add({ id: "wstf10", title: "NASA's standard material test at 10.2 psi", where: "NASA White Sands · Earth gravity", gravity: "Earth gravity",
        o2: [30, 99.5], p: [10.2, 10.2],
        nearest: `In NASA's standard material test at 10.2 psi, in Earth gravity, ${o2 < 30 ? "run from 30% oxygen up: at 30%, " : `at ${g(at)}% oxygen `}${burn.length} of ${n} material setups kept burning, ${outN} went out${unk.length ? `, and ${unk.length} were tested only up to ${Math.max(...unk.map((r) => r.moc.v))}%` : ""}.`,
        lines, caveat: "NASA-STD-6001 Test 1: a strip burned upward in Earth gravity; it fails if it burns past 15 cm. Some materials burn at lower oxygen in low gravity.", src: srcOf(R.wstf10) });
    }
    if (R.wstfO2.length) {
      const mtp = R.wstfO2.map((r) => r.mtp), lo = R.wstfO2.reduce((a, b) => (b.mtp < a.mtp ? b : a));
      add({ id: "wstfO2", title: "In pure oxygen, materials burn at a fraction of a spacesuit's pressure", where: "NASA White Sands · Earth gravity", gravity: "Earth gravity",
        o2: [99.8, 99.8], p: [Math.min(...mtp), Math.max(...R.wstfO2.map((r) => r.ulpi))],
        nearest: `In 99.8% oxygen, all ${R.wstfO2.length} spacecraft materials tested became flammable above ${g(Math.min(...mtp))} to ${g(Math.max(...mtp))} psi, the highest pressure at which every sample went out. A US spacesuit runs at 4.3 psi.`,
        lines: [`${lo.material} (${lo.form}) burned down to the lowest pressure: it went out reliably only at ${g(lo.mtp)} psi or below.`],
        caveat: "NASA-STD-6001 Test 1 in Earth gravity, with a hot-wire igniter because the standard igniter fails below 0.7 psi.", src: srcOf(R.wstfO2) });
    }
    if (R.gravity.length) {
      const gl = gravityLimits(FF), os = R.gravity.flatMap((r) => [r.moc, r.uloi]), ps = R.gravity.map((r) => r.psia);
      const moonLow = gl.filter((m) => m.moon.mid < m.earth.mid && m.moon.mid < m.micro.mid).length;
      const big = gl.reduce((a, b) => (b.moon.delta < a.moon.delta ? b : a));
      add({ id: "gravity", title: "At Moon gravity, materials burned at lower oxygen than on Earth or in microgravity", where: "NASA Glenn drop tower · Moon and Mars gravity", gravity: "in Moon, Mars and microgravity in a drop tower",
        o2: [Math.min(...os), Math.max(...os)], p: [Math.min(...ps), Math.max(...ps)],
        nearest: `In NASA drop-tower tests, ${moonLow === gl.length ? `all ${gl.length}` : `${moonLow} of ${gl.length}`} materials kept burning at lower oxygen at Moon gravity than on Earth or in microgravity; ${big.material}'s limit fell ${g(-big.moon.delta)} points.`,
        lines: gl.map((m) => `${m.material} (${g(m.psia)} psi): Earth ${g(m.earth.moc)} to ${g(m.earth.uloi)}%, Moon ${g(m.moon.moc)} to ${g(m.moon.uloi)}%, Mars ${g(m.mars.moc)} to ${g(m.mars.uloi)}%, microgravity ${g(m.micro.moc)} to ${g(m.micro.uloi)}%.`),
        caveat: "Ranges run from the oxygen where the flame went out to where it kept burning. Drop tests last about 5 seconds; the microgravity tests had a 30 cm/s airflow.", src: srcOf(R.gravity) });
    }
    return out.sort((a, b) => a.o2_gap - b.o2_gap || a.p_gap / Math.max(p, 1) - b.p_gap / Math.max(p, 1));
  }

  root.FFLogic = { g, span, materialEvidence, atmosphereEvidence, scoreTests, rankInvestigations, materialSentences, atmosphereSentences, rankFindings, gaps, ATMOS, placed, coverage, NEAR_P, inverse,
    source, reportPoints, reportCoverage, burnsAbove, wstfBurning, gravityLimits, reportEvidence };
})(typeof window !== "undefined" ? window : globalThis);
