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

  root.FFLogic = { g, span, materialEvidence, atmosphereEvidence, scoreTests, rankInvestigations, materialSentences, atmosphereSentences, rankFindings, gaps, ATMOS, placed, coverage, NEAR_P, inverse,
    source, reportPoints, reportCoverage, burnsAbove, wstfBurning, gravityLimits };
})(typeof window !== "undefined" ? window : globalThis);
