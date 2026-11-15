/* SVG charts, drawn at the container's pixel width so text never scales down. */
(function () {
  "use strict";
  const C = { ug: "#3987e5", g1: "#d95926", third: "#199e70", bg: "#070a12", ink: "#f2f5fa", ink2: "#aab3c5", ink3: "#6f7a8f", line: "rgba(255,255,255,0.09)", line2: "rgba(255,255,255,0.2)", you: "#ffffff" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const g = (x) => String(Number(Number(x).toPrecision(6)));

  /* one shared tooltip */
  let tipEl;
  function tip() {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; tipEl.setAttribute("role", "status"); document.body.appendChild(tipEl); }
    return tipEl;
  }
  function bindTips(scope) {
    scope.querySelectorAll("[data-tip]").forEach((el) => {
      const show = (e) => {
        const t = tip(); t.innerHTML = el.getAttribute("data-tip"); t.classList.add("on");
        const p = e.touches ? e.touches[0] : e, w = t.offsetWidth, h = t.offsetHeight;
        t.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, p.clientX + 14)) + "px";
        t.style.top = (p.clientY + h + 24 > window.innerHeight ? p.clientY - h - 12 : p.clientY + 16) + "px";
      };
      el.addEventListener("mousemove", show);
      el.addEventListener("mouseenter", show);
      el.addEventListener("focus", () => { const r = el.getBoundingClientRect(); show({ clientX: r.left + r.width / 2, clientY: r.top }); });
      el.addEventListener("mouseleave", () => tip().classList.remove("on"));
      el.addEventListener("blur", () => tip().classList.remove("on"));
    });
  }
  function mount(el, draw) {
    const run = () => { const w = el.clientWidth; if (w > 0) { el.innerHTML = draw(w); bindTips(el); } };
    run();
    if (!el._ro) { el._ro = new ResizeObserver(() => { clearTimeout(el._t); el._t = setTimeout(run, 80); }); el._ro.observe(el); }
    el._draw = run;
  }
  const txt = (x, y, s, o = {}) => `<text x="${x}" y="${y}" fill="${o.fill || C.ink2}" font-size="${o.size || 13}" font-weight="${o.weight || 400}" text-anchor="${o.anchor || "start"}" font-family="${o.mono ? "JetBrains Mono, monospace" : "Inter, system-ui, sans-serif"}"${o.extra || ""}>${esc(s)}</text>`;

  /* Microgravity vs 1g burn length, one row per Saffire-II sample. */
  function dumbbell(el, pairs, opts = {}) {
    const rows = pairs.filter((p) => p.gsi != null).sort((a, b) => b.gsi - a.gsi).slice(0, opts.limit || 99);
    mount(el, (W) => {
      const narrow = W < 620, labelW = narrow ? 0 : Math.min(300, W * 0.36), right = 78, rowH = narrow ? 62 : 46, top = 8;
      const x0 = labelW + (narrow ? 10 : 26), x1 = W - right - 14, H = top + rows.length * rowH + 44;
      const X = (v) => x0 + (v / 30) * (x1 - x0);
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Burn length in microgravity and in normal gravity for each Saffire-II sample">`;
      [0, 10, 20, 29].forEach((t) => {
        s += `<line x1="${X(t)}" x2="${X(t)}" y1="${top}" y2="${H - 38}" stroke="${C.line}"/>` + txt(X(t), H - 20, t === 29 ? (x1 - x0 > 430 ? "29 cm = whole sample" : "29 cm") : t + " cm", { anchor: t === 0 ? "start" : "middle", fill: C.ink3, size: 12, mono: true });
      });
      rows.forEach((p, i) => {
        const cy = top + i * rowH + (narrow ? 40 : rowH / 2), same = p.ug === p.g1;
        const name = `${p.material.replace(" (SIBAL)", "")} · ${p.thickness === "See Fig. 5" ? "thickness: see source" : /^0\d/.test(p.thickness) ? p.thickness + "*" : p.thickness}${/Opposed/.test(p.direction) ? " · opposed flow" : ""}`;
        const info = `<b>Sample ${esc(p.sample)}: ${esc(p.material)}</b><span>Microgravity burn length: ${esc(p.ug_raw)}<br>Normal gravity: ${esc(p.g1_raw)}<br>GSI ${p.gsi.toFixed(2)} · ${esc(p.o2_raw)}% O2, ${esc(p.flow_raw)}</span>`;
        s += narrow ? txt(x0, cy - 20, name, { fill: C.ink, size: 13 }) : txt(labelW, cy + 4, name, { anchor: "end", fill: C.ink, size: 13.5 });
        s += `<line x1="${X(0)}" x2="${X(29)}" y1="${cy}" y2="${cy}" stroke="${C.line}" stroke-width="1"/>`;
        if (!same) s += `<rect x="${Math.min(X(p.ug), X(p.g1))}" y="${cy - 5}" width="${Math.abs(X(p.g1) - X(p.ug))}" height="10" rx="5" fill="url(#band)" opacity="0.42"/>`;
        const ux = X(p.ug) - (same ? 9 : 0), gx = X(p.g1) + (same ? 9 : 0);
        s += `<circle cx="${ux}" cy="${cy}" r="7.5" fill="${C.ug}" stroke="${C.bg}" stroke-width="2"/>`;
        s += `<rect x="${gx - 6.5}" y="${cy - 6.5}" width="13" height="13" transform="rotate(45 ${gx} ${cy})" fill="${C.g1}" stroke="${C.bg}" stroke-width="2"/>`;
        s += txt(W - 4, cy + 5, "GSI " + p.gsi.toFixed(2), { anchor: "end", fill: p.gsi >= 0.5 ? C.ink : C.ink2, weight: p.gsi >= 0.5 ? 600 : 400, mono: true, size: 13 });
        s += `<rect x="0" y="${cy - rowH / 2 + (narrow ? 8 : 0)}" width="${W}" height="${rowH}" fill="transparent" tabindex="0" data-tip="${esc(info)}"/>`;
      });
      s += `<defs><linearGradient id="band" x1="0" x2="1"><stop offset="0" stop-color="${C.ug}"/><stop offset="1" stop-color="${C.g1}"/></linearGradient></defs></svg>`;
      return s;
    });
  }

  /* Oxygen level of every flame test, one lane per fuel class, with habitat markers. */
  function lanes(el, FF, markers) {
    const lanesDef = [["solid", "Solid materials", C.ug], ["liquid", "Liquid droplets", C.g1], ["gas", "Gas flames", C.third]];
    const data = lanesDef.map(([cls, label, color]) => {
      const rows = FF.rows.filter((r) => r.c === cls && r.o && r.g !== "1");
      const vals = []; rows.forEach((r) => { vals.push(r.o[0]); if (r.o[1] !== r.o[0]) vals.push(r.o[1]); });
      return { label, color, vals, n: rows.length, lo: Math.min(...vals), hi: Math.max(...vals) };
    });
    mount(el, (W) => {
      const narrow = W < 620, left = narrow ? 8 : 150, right = 18, top = 58, laneH = 56, H = top + laneH * 3 + 46;
      const lo = 10, hi = 44, X = (v) => left + ((v - lo) / (hi - lo)) * (W - left - right);
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Oxygen level of every microgravity flame test, by fuel class">`;
      s += `<rect x="${X(30)}" y="${top - 6}" width="${X(hi) - X(30)}" height="${laneH * 3 + 6}" fill="rgba(255,255,255,0.045)"/>`;
      [10, 20, 30, 40].forEach((t) => { s += `<line x1="${X(t)}" x2="${X(t)}" y1="${top - 6}" y2="${top + laneH * 3}" stroke="${C.line}"/>` + txt(X(t), H - 22, t + "%", { anchor: "middle", fill: C.ink3, size: 12, mono: true }); });
      s += txt(X(hi), H - 4, "Oxygen, % by volume", { anchor: "end", fill: C.ink3, size: 12 });
      data.forEach((d, i) => {
        const y = top + i * laneH, cy = y + laneH / 2;
        s += narrow ? txt(left, y + 9, d.label, { fill: C.ink, size: 12.5 }) : txt(left - 16, cy + 5, d.label, { anchor: "end", fill: C.ink, size: 14 });
        d.vals.forEach((v) => { s += `<line x1="${X(v)}" x2="${X(v)}" y1="${cy - 13}" y2="${cy + 13}" stroke="${d.color}" stroke-width="2" opacity="0.5"/>`; });
        s += txt(X(d.hi) + 8, cy + 4, g(d.hi) + "%", { fill: C.ink, size: 12.5, mono: true, weight: 600 });
        s += `<rect x="${left}" y="${y}" width="${W - left - right}" height="${laneH}" fill="transparent" tabindex="0" data-tip="<b>${esc(d.label)}</b><span>${d.n} microgravity tests list an oxygen level<br>Range ${g(d.lo)}% to ${g(d.hi)}%</span>"/>`;
      });
      markers.filter((m) => !narrow || !m.wideOnly).forEach((m) => {
        const x = X(m.o2);
        s += `<line x1="${x}" x2="${x}" y1="${top - 22}" y2="${top + laneH * 3}" stroke="${C.you}" stroke-width="1.5" stroke-dasharray="4 4" opacity="${m.strong ? 0.95 : 0.55}"/>`;
        s += txt(x, top - 30, narrow ? m.short || m.label : m.label, { anchor: (narrow ? m.shortAnchor : m.anchor) || "middle", fill: C.ink, size: 12.5, weight: 600 });
      });
      return s + "</svg>";
    });
  }

  /* Oxygen level of each flame test, one row per chosen material. */
  function materialStrip(el, FF, materials, o2, name) {
    mount(el, (W) => {
      const narrow = W < 620, left = narrow ? 8 : Math.min(250, W * 0.3), right = 20, top = 44, rowH = narrow ? 52 : 40, H = top + materials.length * rowH + 44;
      const hi = Math.max(42, Math.min(100, o2 + 6)), lo = 10, X = (v) => left + ((v - lo) / (hi - lo)) * (W - left - right);
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Oxygen level of each microgravity flame test, by material">`;
      const step = hi > 60 ? 20 : 10;
      for (let t = lo; t <= hi; t += step) s += `<line x1="${X(t)}" x2="${X(t)}" y1="${top - 4}" y2="${H - 40}" stroke="${C.line}"/>` + txt(X(t), H - 20, t + "%", { anchor: "middle", fill: C.ink3, size: 12, mono: true });
      materials.forEach((m, i) => {
        const y = top + i * rowH, cy = y + (narrow ? 34 : rowH / 2);
        const rows = FF.rows.filter((r) => r.m.includes(m) && r.c === "solid" && r.g !== "1" && r.o);
        const short = m.replace(" fabric (SIBAL)", " fabric").replace(" (acrylic)", "");
        s += narrow ? txt(left, y + 14, short, { fill: C.ink, size: 12.5 }) : txt(left - 16, cy + 4, short, { anchor: "end", fill: C.ink, size: 13.5 });
        s += `<line x1="${X(lo)}" x2="${X(hi)}" y1="${cy}" y2="${cy}" stroke="${C.line}"/>`;
        rows.forEach((r) => { const v = (r.o[0] + r.o[1]) / 2; if (v <= hi) s += `<line x1="${X(v)}" x2="${X(v)}" y1="${cy - 11}" y2="${cy + 11}" stroke="${C.ug}" stroke-width="2" opacity="0.6"/>`; });
        if (!rows.length) s += txt(X(lo) + 8, cy - 7, "no flame test lists an oxygen level", { fill: C.ink3, size: 12 });
        const vals = rows.map((r) => (r.o[0] + r.o[1]) / 2);
        const info = rows.length ? `${rows.length} flame tests list oxygen<br>Range ${g(Math.min(...vals))}% to ${g(Math.max(...vals))}%` : "No flame test for this material lists an oxygen level";
        s += `<rect x="0" y="${y}" width="${W}" height="${rowH}" fill="transparent" tabindex="0" data-tip="<b>${esc(m)}</b><span>${info}</span>"/>`;
      });
      const x = X(o2);
      s += `<line x1="${x}" x2="${x}" y1="${top - 14}" y2="${H - 40}" stroke="${C.you}" stroke-width="1.5" stroke-dasharray="4 4"/>`;
      s += txt(x, top - 22, `${name}: ${g(o2)}% O2`, { anchor: x > W * 0.7 ? "end" : x < W * 0.3 ? "start" : "middle", fill: C.ink, size: 12.5, weight: 600 });
      return s + "</svg>";
    });
  }

  /* Tiny strip for a material card. */
  function mini(FF, material, o2) {
    const rows = FF.rows.filter((r) => r.m.includes(material) && r.c === "solid" && r.g !== "1" && r.o);
    const hi = Math.max(42, Math.min(100, o2 + 6)), X = (v) => ((v - 10) / (hi - 10)) * 300;
    let s = `<svg viewBox="0 0 300 30" preserveAspectRatio="none" width="100%" height="30" aria-hidden="true"><line x1="0" x2="300" y1="15" y2="15" stroke="${C.line}"/>`;
    rows.forEach((r) => { const v = (r.o[0] + r.o[1]) / 2; if (v <= hi) s += `<line x1="${X(v)}" x2="${X(v)}" y1="5" y2="25" stroke="${C.ug}" stroke-width="2" opacity="0.6" vector-effect="non-scaling-stroke"/>`; });
    s += `<line x1="${X(o2)}" x2="${X(o2)}" y1="0" y2="30" stroke="${C.you}" stroke-width="1.5" stroke-dasharray="3 3" vector-effect="non-scaling-stroke"/></svg>`;
    return s;
  }

  /* One finding, split by oxygen band (or by group). Shares as a 100% bar, or medians as bars.
     The row nearest the habitat is marked. Every mark has a tooltip with the counts. */
  function finding(el, f, active) {
    const ch = f.chart; if (!ch) return;
    const byGroup = ch.by === "groups", rows = byGroup ? f.groups : f.bands, bars = ch.kind === "bars";
    const top = Math.max(...rows.flatMap((r) => r.values.filter((v) => v != null)));
    mount(el, (W) => {
      const narrow = W < 560, labelW = narrow ? 0 : 128, right = narrow ? 8 : 74, per = bars ? ch.series.length : 1;
      const barH = bars ? 9 : 14, rowH = narrow ? 30 + per * (barH + 4) : Math.max(34, per * (barH + 4) + 14), H = rows.length * rowH + 4;
      const x0 = labelW + (narrow ? 0 : 14), x1 = W - right, X = (v) => x0 + (v / (bars ? top : 1)) * (x1 - x0);
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(f.si && f.si.headline || f.topic)}, by ${byGroup ? "atmosphere" : "oxygen level"}">`;
      rows.forEach((r, i) => {
        const y = i * rowH, on = !byGroup && i === active, name = byGroup ? r.label : r.label + " O2";
        const by = y + (narrow ? 22 : (rowH - per * (barH + 4) + 4) / 2);
        if (on) s += `<rect x="0" y="${y + 1}" width="${W}" height="${rowH - 2}" rx="8" fill="rgba(255,255,255,0.06)"/>`;
        s += narrow ? txt(4, y + 15, name + (on ? " · nearest yours" : ""), { fill: C.ink, size: 12.5, weight: on ? 600 : 400 })
          : txt(labelW, y + rowH / 2 + 4, name, { anchor: "end", fill: on ? C.ink : C.ink2, size: 13, weight: on ? 600 : 400, mono: true });
        if (bars) {
          ch.series.forEach(([label, color], k) => {
            const v = r.values[k], yy = by + k * (barH + 4);
            if (v == null) return;
            s += `<rect x="${x0}" y="${yy}" width="${Math.max(3, X(v) - x0)}" height="${barH}" rx="3" fill="${color}"/>`;
            s += txt(Math.min(X(v) + 6, W - 2), yy + barH - 1, g(v) + " " + ch.unit, { fill: C.ink2, size: 11.5, mono: true, anchor: X(v) + 60 > W ? "end" : "start" });
            s += `<rect x="${x0}" y="${yy - 2}" width="${x1 - x0}" height="${barH + 4}" fill="transparent" tabindex="0" data-tip="<b>${esc(name)}</b><span>${esc(label)}: ${g(v)} ${esc(ch.unit)}<br>${r.n} tests</span>"/>`;
          });
        } else {
          const n = r.values.reduce((a, b) => a + b, 0) || 1;
          let x = x0;
          r.values.forEach((v, k) => {
            if (!v) return;
            const w = ((x1 - x0) * v) / n;
            s += `<rect x="${x}" y="${by}" width="${Math.max(2, w - 2)}" height="${barH}" rx="3" fill="${ch.series[k][1]}"/>`;
            s += `<rect x="${x}" y="${by - 4}" width="${w}" height="${barH + 8}" fill="transparent" tabindex="0" data-tip="<b>${esc(name)}</b><span>${esc(ch.series[k][0])}: ${v} of ${r.n} tests</span>"/>`;
            x += w;
          });
          if (!narrow) s += txt(W - 4, by + barH - 2, r.n + " tests", { anchor: "end", fill: C.ink3, size: 12, mono: true });
        }
      });
      return s + "</svg>";
    });
  }

  /* Atmosphere map: oxygen against pressure. Every microgravity test that lists both is a dot; the
     atmospheres crews have breathed are pins. opts: you {o2, p, label}, onPin(id), onPick(o2, p). */
  const AX = { o: [10, 100], p: [3.5, 80] };
  function atlas(el, FF, opts = {}) {
    const L = window.FFLogic, pts = L.placed(FF), atm = L.ATMOS;
    const cls = { liquid: [C.g1, "Liquid droplets"], gas: [C.third, "Gas flames"] };
    const bins = new Map(); // one dot per fuel class and spot, sized by how many tests share it
    pts.forEach((x) => {
      const k = `${x.c}|${Math.round(x.o * 2) / 2}|${Math.round(Math.log(x.p) * 40)}`;
      const b = bins.get(k) || { c: x.c, o: 0, p: 0, n: 0, by: {} };
      b.o += x.o; b.p += x.p; b.n++; b.by[x.i] = (b.by[x.i] || 0) + 1; bins.set(k, b);
    });
    const solids = FF.rows.filter((r) => r.g !== "1" && r.c === "solid" && r.o).map((r) => (r.o[0] + r.o[1]) / 2);
    const cov = Object.fromEntries(atm.map((a) => [a.id, L.coverage(FF, a.o2, a.p)]));
    mount(el, (W) => {
      const narrow = W < 620, left = narrow ? 40 : 58, right = narrow ? 14 : 24, top = 26;
      const plotH = Math.round(Math.max(300, Math.min(500, W * 0.5))), H = top + plotH + 106;
      const X = (o) => left + ((o - AX.o[0]) / (AX.o[1] - AX.o[0])) * (W - left - right);
      const Y = (p) => top + plotH - (Math.log(p / AX.p[0]) / Math.log(AX.p[1] / AX.p[0])) * plotH;
      el._inv = { left, right, top, plotH, W };
      const halo = ` paint-order="stroke" stroke="${C.bg}" stroke-width="4" stroke-linejoin="round"`;
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Oxygen and pressure of every microgravity fire test that lists both, with the atmospheres crews have breathed">`;
      // grid
      (narrow ? [20, 40, 60, 80, 100] : [10, 20, 30, 40, 50, 60, 70, 80, 90, 100]).forEach((t) => {
        s += `<line x1="${X(t)}" x2="${X(t)}" y1="${top}" y2="${top + plotH}" stroke="${C.line}"/>` + txt(X(t), top + plotH + 20, t + "%", { anchor: "middle", fill: C.ink3, size: 12, mono: true });
      });
      [4, 7, 10, 15, 20, 30, 50, 75].forEach((t) => {
        s += `<line x1="${left}" x2="${W - right}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.line}"/>` + txt(left - 8, Y(t) + 4, String(t), { anchor: "end", fill: C.ink3, size: 12, mono: true });
      });
      s += txt(left - 8, top - 10, "psi", { anchor: "end", fill: C.ink3, size: 12 });
      s += txt(W - right, top + plotH + 40, "Oxygen, % by volume", { anchor: "end", fill: C.ink3, size: 12 });
      s += `<line x1="${left}" x2="${W - right}" y1="${Y(14.7)}" y2="${Y(14.7)}" stroke="${C.line2}" stroke-dasharray="2 5"/>`;
      if (!narrow) s += txt(X(62), Y(14.7) - 6, "sea-level pressure", { anchor: "middle", fill: C.ink3, size: 11.5 });
      // the tested zone: hull of every placed test
      const hp = hull([...bins.values()].map((b) => [X(b.o / b.n), Y(b.p / b.n)]));
      s += `<path d="M${hp.map((q) => q.map((v) => v.toFixed(1)).join(",")).join("L")}Z" fill="rgba(255,255,255,0.05)" stroke="${C.line2}" stroke-dasharray="4 4" stroke-linejoin="round" transform="translate(0,0)"/>`;
      const topO = Math.max(...pts.map((x) => x.o));
      s += txt(X(topO) + 12, Y(56), `${pts.length} PSI tests`, { fill: C.ink, size: narrow ? 12.5 : 14, weight: 600, extra: halo });
      s += txt(X(topO) + 12, Y(56) + 17, `all at ${g(topO)}% oxygen or less`, { fill: C.ink2, size: narrow ? 11.5 : 12.5, extra: halo });
      if (narrow) s += txt(X(73), Y(10.5), "No PSI test with", { anchor: "middle", fill: C.ink3, size: 12, weight: 500 }) + txt(X(73), Y(10.5) + 15, "this surrounding air", { anchor: "middle", fill: C.ink3, size: 12, weight: 500 });
      else s += txt(X(72), Y(9), "No PSI test with this surrounding air", { anchor: "middle", fill: C.ink3, size: 16, weight: 500 });
      // tests
      [...bins.values()].sort((a, b) => b.n - a.n).forEach((b) => {
        const o = b.o / b.n, p = b.p / b.n, r = Math.min(8, 2.6 + Math.sqrt(b.n) * 0.9), [col, lab] = cls[b.c] || [C.ug, b.c];
        const who = Object.entries(b.by).map(([i, n]) => `${esc(i)}: ${n}`).join("<br>");
        s += `<circle cx="${X(o).toFixed(1)}" cy="${Y(p).toFixed(1)}" r="${r.toFixed(1)}" fill="${col}" fill-opacity="0.72" stroke="${C.bg}" stroke-width="1" tabindex="0" data-tip="<b>${b.n} ${esc(lab.toLowerCase())} test${b.n > 1 ? "s" : ""}</b><span>${g(Math.round(o * 10) / 10)}% oxygen, ${g(Math.round(p * 10) / 10)} psi<br>${who}</span>"/>`;
      });
      // solid materials burned in orbit, from NASA technical reports (transcribed; not in the PSI tables)
      (L.reportPoints ? L.reportPoints(FF) : []).forEach((x) => {
        const cx = X(x.o), cy = Y(x.p), z = 5.5;
        const ntrs = (x.src || []).map((k) => (L.source(FF, k) || {}).ntrs).filter(Boolean).join(", ");
        const tipHtml = `<b>${esc(x.id)} · NASA report</b><span>${esc(x.material)}, ${g(x.o)}% oxygen, ${g(Math.round(x.p * 10) / 10)} psi<br>${esc(x.when)}<br>${esc(x.out)}<br>Source: NASA NTRS ${esc(ntrs)}, ${esc(x.where)}</span>`;
        s += `<rect x="${(cx - z).toFixed(1)}" y="${(cy - z).toFixed(1)}" width="${2 * z}" height="${2 * z}" rx="1.5" fill="${C.ug}" stroke="${C.bg}" stroke-width="1.5" tabindex="0" data-tip="${esc(tipHtml)}"/>`;
      });
      if (!narrow && L.reportPoints && L.reportPoints(FF).some((x) => x.set === "SSCE"))
        s += txt(X(52), Y(40), "Space Shuttle SSCE, 1990s", { anchor: "middle", fill: C.ink2, size: 12, extra: halo }) + txt(X(52), Y(40) + 15, "(from NASA reports)", { anchor: "middle", fill: C.ink3, size: 11.5, extra: halo });
      // solid materials: oxygen only, on a rail under the axis
      const ry = top + plotH + 78;
      s += txt(left, ry - 12, narrow ? "Solid materials · pressure not listed" : "Solid materials (fabric, plastic) · their tables list oxygen but not pressure", { fill: C.ink2, size: 12 });
      [...new Set(solids.map((v) => Math.round(v * 10) / 10))].forEach((v) => { s += `<line x1="${X(v)}" x2="${X(v)}" y1="${ry - 2}" y2="${ry + 12}" stroke="${C.ug}" stroke-width="2" opacity="0.6"/>`; });
      const sMax = Math.max(...solids);
      s += txt(X(sMax) + 8, ry + 10, `${solids.length} tests, up to ${g(sMax)}%`, { fill: C.ink, size: 12, weight: 600 });
      s += `<rect x="${left}" y="${ry - 4}" width="${X(sMax) - left + 4}" height="20" fill="transparent" tabindex="0" data-tip="<b>${solids.length} solid-material flame tests</b><span>Fabric and plastic samples, ${g(Math.min(...solids))}% to ${g(sMax)}% oxygen. Their NASA tables do not list pressure, so they cannot be placed on the map.</span>"/>`;
      // you
      if (opts.you) {
        const ux = X(Math.min(100, Math.max(10, opts.you.o2))), uy = Y(Math.min(AX.p[1], Math.max(AX.p[0], opts.you.p)));
        s += `<line x1="${ux}" x2="${ux}" y1="${top}" y2="${top + plotH}" stroke="${C.you}" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.7"/>`;
        s += `<line x1="${left}" x2="${W - right}" y1="${uy}" y2="${uy}" stroke="${C.you}" stroke-width="1.2" stroke-dasharray="4 4" opacity="0.7"/>`;
        s += `<rect x="${ux - 7}" y="${uy - 7}" width="14" height="14" transform="rotate(45 ${ux} ${uy})" fill="${C.you}" stroke="${C.bg}" stroke-width="2"/>`;
      }
      // pins
      const LAB = { mga: ["end", -14, 5], suit: ["end", -14, 18], a1: ["end", -14, 5], sky: ["middle", 0, -15], iss: ["end", -13, -11], eva: ["end", -8, 22], moon: ["start", 12, -10], exp: ["start", 12, 16] };
      atm.forEach((a, k) => {
        const x = X(a.o2), y = Y(a.p), c = cov[a.id], none = c.n === 0, rep = L.reportCoverage ? L.reportCoverage(FF, a.o2, a.p) : [];
        const tipHtml = `<b>${esc(a.name)} · ${esc(a.when)}</b><span>${g(a.o2)}% oxygen, ${g(a.p)} psi<br>${esc(a.note)}<br><br>${none ? `No microgravity test within ${FF.near} points of oxygen and 25% of this pressure. Nearest: ${g(Math.round(c.nearest.o * 10) / 10)}% at ${g(Math.round(c.nearest.p * 10) / 10)} psi (${esc(c.nearest.i)}).` : `${c.n} microgravity tests within ${FF.near} points of oxygen and 25% of this pressure.`}${opts.onPin ? "<br><i>Click to check this atmosphere</i>" : ""}${rep.length ? `<br><br>NASA reports add ${rep.length} solid-material fire${rep.length > 1 ? "s" : ""} in orbit near it: ${rep.map((x) => esc(x.id)).join(", ")}.` : ""}</span>`;
        s += `<g data-pin="${a.id}" tabindex="0" role="button" aria-label="${esc(a.name)}" style="cursor:${opts.onPin ? "pointer" : "default"}" data-tip="${esc(tipHtml)}">`;
        s += `<circle cx="${x}" cy="${y}" r="16" fill="transparent"/>`;
        s += `<circle cx="${x}" cy="${y}" r="8.5" fill="${none ? C.bg : C.you}" stroke="${C.you}" stroke-width="2"${none ? ` stroke-dasharray="3 2.4"` : ""}/>`;
        s += txt(x, y + 4, String(k + 1), { anchor: "middle", fill: none ? C.ink : C.bg, size: 11, mono: true, weight: 600 });
        if (!narrow) {
          const [anc, dx, dy] = LAB[a.id] || ["start", 12, 4];
          s += `<text x="${x + dx}" y="${y + dy}" fill="${C.ink}" font-size="12.5" font-weight="600" text-anchor="${anc}" font-family="Inter, system-ui, sans-serif"${halo}>${esc(a.short)} <tspan fill="${none ? "#ff9b73" : C.ink2}" font-weight="500">· ${c.n} test${c.n === 1 ? "" : "s"}</tspan></text>`;
        }
        s += `</g>`;
      });
      return s + "</svg>";
    });
    el.classList.toggle("pick", !!opts.onPick);
    el.onclick = (e) => {
      const pin = e.target.closest("[data-pin]");
      if (pin && opts.onPin) return opts.onPin(pin.dataset.pin);
      if (!opts.onPick || !el._inv) return;
      const r = el.querySelector("svg").getBoundingClientRect(), k = el._inv.W / r.width;
      const x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k, I = el._inv;
      if (x < I.left || x > I.W - I.right || y < I.top || y > I.top + I.plotH) return;
      const o = AX.o[0] + ((x - I.left) / (I.W - I.left - I.right)) * (AX.o[1] - AX.o[0]);
      const p = AX.p[0] * Math.exp(((I.top + I.plotH - y) / I.plotH) * Math.log(AX.p[1] / AX.p[0]));
      opts.onPick(Math.round(o * 2) / 2, Math.round(p * 10) / 10);
    };
    el.onkeydown = (e) => { const pin = e.target.closest && e.target.closest("[data-pin]"); if (pin && opts.onPin && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); opts.onPin(pin.dataset.pin); } };
  }
  /* the same atmospheres as a table: the map's text view */
  function atlasTable(FF, link) {
    const L = window.FFLogic;
    return `<div class="table-wrap"><table class="t atlas-t"><thead><tr><th>#</th><th>Atmosphere</th><th>Oxygen</th><th>Pressure</th><th>When</th><th>Tests near it</th><th>Nearest test</th><th>NASA reports near it</th></tr></thead><tbody>${L.ATMOS.map((a, k) => {
      const c = L.coverage(FF, a.o2, a.p), nr = c.nearest, rep = L.reportCoverage ? L.reportCoverage(FF, a.o2, a.p) : [];
      return `<tr${link ? ` data-pin="${a.id}" tabindex="0"` : ""}><td class="mono">${k + 1}</td><td><b>${esc(a.name)}</b>${a.fire ? ` <span class="tag fire">fire</span>` : ""}</td><td class="mono">${g(a.o2)}%</td><td class="mono">${g(a.p)} psi</td><td>${esc(a.when)}</td><td class="mono ${c.n ? "" : "zero"}">${c.n}</td><td>${c.n ? `${g(Math.round(nr.o * 10) / 10)}% at ${g(Math.round(nr.p * 10) / 10)} psi` : `${g(Math.round(nr.o * 10) / 10)}% at ${g(Math.round(nr.p * 10) / 10)} psi, <b>${g(c.o2_gap)} points</b> of oxygen away`}</td><td>${rep.length ? rep.map((x) => esc(x.id)).join(", ") : "none"}</td></tr>`;
    }).join("")}</tbody></table></div>`;
  }
  function hull(P) { // monotone chain
    P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    P.forEach((p) => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); });
    P.slice().reverse().forEach((p) => { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); });
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  /* The self-extinction line: the chance a burning droplet's flame goes out on its own, by oxygen
     level, from the droplet model (scripts/build_models.py), with the real nitrogen-only FLEX tests
     beside it. Everything is computed from the data bundle. */
  function crossoverData(FF) {
    if (FF._xo) return FF._xo;
    const MD = window.FFModels, D = FF.models.droplets, P = 14.7, d0 = 3;
    const fuels = [["Methanol", C.ug], ["Heptane", C.g1]];
    const curves = fuels.map(([fuel, col]) => {
      const pts = [];
      for (let o = 10; o <= 40.001; o += 0.5) { const r = MD.classify(D.ending, MD.dropletX(o, "N2", P, d0, fuel)); pts.push([o, r.fit[0], r.lo[0], r.hi[0]]); }
      return { fuel, col, pts, ff: MD.fiftyFifty(D.ending, MD.dropletX(21, "N2", P, d0, fuel), 0) };
    });
    const f = FF.findings.find((x) => x.id === "droplet-oxygen");
    const inBand = (p, b) => p[4] === 0 && p[0] >= b.o2[0] - 0.05 && p[0] <= b.o2[1] + 0.05; // nitrogen only
    const obs = [];
    f.bands.forEach((b) => fuels.forEach(([fuel, col], k) => {
      const r = D.points.filter((p) => inBand(p, b) && p[2] === k);
      if (r.length) obs.push({ fuel, col, band: b.label, n: r.length, e: r.filter((p) => p[1] === "E").length, o: r.reduce((a, p) => a + p[0], 0) / r.length });
    }));
    const tally = (o2) => {
      const b = f.bands.find((x) => x.o2[0] <= o2 && x.o2[1] >= o2), r = D.points.filter((p) => inBand(p, b));
      return { label: b.label, n: r.length, e: r.filter((p) => p[1] === "E").length };
    };
    const gb = FF.findings.find((x) => x.id === "gas-oxygen").bands;
    const gas = [gb[0], gb[gb.length - 1]].map((b) => ({ label: b.label, lit: b.values[0] + b.values[1], out: b.values[0], cut: b.values[1] }));
    return (FF._xo = { curves, obs, iss: tally(21), moon: tally(30), gas, P, d0, range: D.range.o2, score: D.ending.score });
  }
  function crossover(el, FF) {
    const d = crossoverData(FF), X0 = 10, X1 = 40, R = d.range;
    const fits = d.curves.map((c) => c.ff && c.ff.fit).filter((v) => v != null), z0 = Math.min(...fits), z1 = Math.max(...fits);
    const pc = (v) => Math.round(v * 100) + "%";
    mount(el, (W) => {
      const narrow = W < 620, left = narrow ? 40 : 52, right = narrow ? 12 : 22, top = 40, plotH = Math.round(Math.max(250, Math.min(380, W * 0.4))), H = top + plotH + 46;
      const X = (o) => left + ((o - X0) / (X1 - X0)) * (W - left - right), Y = (p) => top + plotH - p * plotH;
      const halo = ` paint-order="stroke" stroke="${C.bg}" stroke-width="4" stroke-linejoin="round"`;
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Chance a burning droplet's flame goes out on its own, by oxygen level, for methanol and heptane, with NASA's nitrogen-only tests">`;
      [0, 0.25, 0.5, 0.75, 1].forEach((t) => { s += `<line x1="${left}" x2="${W - right}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.line}"/>` + txt(left - 8, Y(t) + 4, pc(t), { anchor: "end", fill: C.ink3, size: 12, mono: true }); });
      (narrow ? [10, 20, 30, 40] : [10, 15, 20, 25, 30, 35, 40]).forEach((t) => { s += `<line x1="${X(t)}" x2="${X(t)}" y1="${top}" y2="${top + plotH}" stroke="${C.line}"/>` + txt(X(t), top + plotH + 20, t + "%", { anchor: "middle", fill: C.ink3, size: 12, mono: true }); });
      s += txt(W - right, top + plotH + 40, "Oxygen, % by volume", { anchor: "end", fill: C.ink3, size: 12 });
      // the line itself: between the two fuels' 50-50 points
      s += `<rect x="${X(z0)}" y="${top}" width="${Math.max(3, X(z1) - X(z0))}" height="${plotH}" fill="rgba(255,255,255,0.07)"/>`;
      s += `<line x1="${left}" x2="${W - right}" y1="${Y(0.5)}" y2="${Y(0.5)}" stroke="${C.line2}" stroke-dasharray="3 5"/>`;
      // habitats
      [[21, narrow ? "ISS" : "ISS air · 21%", "end", -6], [30, narrow ? "Moon base" : "Moon base · 30%", "start", 6]].forEach(([o, lab, anc, dx]) => {
        s += `<line x1="${X(o)}" x2="${X(o)}" y1="${top - 14}" y2="${top + plotH}" stroke="${C.you}" stroke-width="1.3" stroke-dasharray="4 4" opacity="0.75"/>`;
        s += txt(X(o) + dx, top - 18, lab, { anchor: anc, fill: C.ink, size: 12.5, weight: 600 });
      });
      // model: 90% band, then the line (dashed beyond the tested oxygen range)
      d.curves.forEach((c) => {
        const band = c.pts.map((p) => `${X(p[0]).toFixed(1)},${Y(p[3]).toFixed(1)}`).concat(c.pts.slice().reverse().map((p) => `${X(p[0]).toFixed(1)},${Y(p[2]).toFixed(1)}`));
        s += `<path d="M${band.join("L")}Z" fill="${c.col}" opacity="0.16"/>`;
      });
      d.curves.forEach((c) => {
        const seg = (keep) => { const q = c.pts.filter(keep); return q.length > 1 ? "M" + q.map((p) => `${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join("L") : ""; };
        s += `<path d="${seg((p) => p[0] >= R[0] && p[0] <= R[1])}" fill="none" stroke="${c.col}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
        s += `<path d="${seg((p) => p[0] <= R[0])}" fill="none" stroke="${c.col}" stroke-width="2" stroke-dasharray="4 4"/><path d="${seg((p) => p[0] >= R[1])}" fill="none" stroke="${c.col}" stroke-width="2" stroke-dasharray="4 4"/>`;
      });
      // direct labels, where the two lines are furthest apart
      let best = -1, bi = 0;
      d.curves[0].pts.forEach((p, i) => { const gap = Math.abs(p[1] - d.curves[1].pts[i][1]); if (p[0] >= 23 && p[0] <= 28 && gap > best) { best = gap; bi = i; } });
      const lx = X(d.curves[0].pts[bi][0]) + 8;
      s += txt(lx, Y(d.curves[0].pts[bi][1]) - 10, "Methanol", { fill: C.ink, size: 12.5, weight: 600, extra: halo });
      s += txt(lx, Y(d.curves[1].pts[bi][1]) + 20, "Heptane", { fill: C.ink, size: 12.5, weight: 600, extra: halo });
      if (!narrow) s += txt(X(z0) - 8, Y(0.5) - 8, `50-50 at ${g(Math.round(z0 * 10) / 10)} to ${g(Math.round(z1 * 10) / 10)}% oxygen`, { anchor: "end", fill: C.ink2, size: 12, extra: halo });
      // hover columns with both lines' values
      const step = X(10.5) - X(10);
      d.curves[0].pts.forEach((p, i) => {
        const q = d.curves[1].pts[i];
        const tip = `<b>${g(p[0])}% oxygen · model</b><span>Methanol: ${pc(p[1])} (90% range ${pc(p[2])} to ${pc(p[3])})<br>Heptane: ${pc(q[1])} (${pc(q[2])} to ${pc(q[3])})${p[0] < R[0] || p[0] > R[1] ? "<br>Beyond the tested oxygen range" : ""}</span>`;
        s += `<rect x="${(X(p[0]) - step / 2).toFixed(1)}" y="${top}" width="${step.toFixed(1)}" height="${plotH}" fill="transparent" data-tip="${esc(tip)}"/>`;
      });
      // real tests, drawn last so they sit above the hover columns
      d.obs.forEach((o) => {
        const r = Math.min(11, 3.5 + Math.sqrt(o.n) * 1.4), tip = `<b>${o.e} of ${o.n} ${o.fuel.toLowerCase()} droplet flames went out on their own</b><span>NASA FLEX tests at ${esc(o.band)} oxygen, nitrogen only, all droplet sizes</span>`;
        s += `<circle cx="${X(o.o).toFixed(1)}" cy="${Y(o.e / o.n).toFixed(1)}" r="${r.toFixed(1)}" fill="${C.bg}" stroke="${o.col}" stroke-width="2.4" tabindex="0" data-tip="${esc(tip)}"/>`;
      });
      return s + "</svg>";
    });
  }

  /* The cabin-air trade-off: every cabin air by oxygen and pressure. Dashed contours: hours of pure-oxygen prebreathe
     before a spacewalk at NASA's decompression limit (logic.js). Green: no prebreathe, with the oxygen NASA accepts.
     Hatched: less oxygen than NASA accepts. Orange band: the burn line, where the droplet model's chance of a flame
     going out on its own crosses 50% for methanol and heptane. Hover anywhere for the numbers at that point. */
  function airChart(el, FF, opts = {}) {
    const L = window.FFLogic, A = L.AIR, MD = window.FFModels, D = FF.models.droplets;
    const suit = opts.suit || A.suit, rmax = opts.rmax || A.rmax, floor = A.floor;
    const X0 = 15, X1 = 40, P0 = 4, P1 = 16, PH2O = 47 / 51.71493, r1 = (v) => Math.round(v * 10) / 10;
    const xo = crossoverData(FF), fits = xo.curves.map((c) => c.ff && c.ff.fit).filter((v) => v != null);
    const b0 = Math.min(...fits), b1 = Math.max(...fits), corner = L.airCorner(suit, rmax, floor);
    const pins = L.ATMOS.filter((a) => a.o2 >= X0 && a.o2 <= X1 && a.p >= P0 && a.p <= P1);
    const floorP = (o) => PH2O + floor / 51.71493 / (o / 100); // pressure that gives the oxygen floor at o %
    const preP = (o, t) => (rmax * suit * Math.pow(2, t / A.half)) / (1 - o / 100); // pressure where the prebreathe is t minutes
    const pc = (v) => Math.round(v * 100) + "%", hm = (m) => (m < 1 ? "none" : m < 60 ? `${Math.round(m)} min` : `${r1(m / 60)} h`);
    const pr = D.range.p.map((v) => v * 14.6959);
    const info = (o, p, head) => {
      const a = L.airAt(o, p, suit, rmax, floor), f = ["Methanol", "Heptane"].map((fu) => MD.classify(D.ending, MD.dropletX(o, "N2", p, 3, fu)).fit[0]);
      const beyond = o < D.range.o2[0] || o > D.range.o2[1] || p < pr[0] - 1e-9 || p > pr[1];
      return `<b>${head || `${g(r1(o))}% oxygen · ${g(r1(p))} psi`}</b><span>Prebreathe before a ${g(suit)} psi spacewalk: ${hm(a.min)} (R ${a.R}; limit ${g(rmax)})<br>Breathing: ${Math.round(a.pio2)} mmHg of oxygen, ${a.low ? "less than NASA accepts" : a.alt < 50 ? "as at sea level" : `as ${Math.round(a.alt / 10) * 10} m above sea level`}<br>A burning 3 mm droplet goes out on its own: methanol ${pc(f[0])}, heptane ${pc(f[1])} (model${beyond ? ", beyond the tested range" : ""})</span>`;
    };
    mount(el, (W) => {
      const narrow = W < 620, left = narrow ? 40 : 56, right = narrow ? 12 : 22, top = 34;
      const plotW = W - left - right, plotH = Math.round(Math.max(320, Math.min(470, W * 0.48))), H = top + plotH + 50;
      const X = (o) => left + ((o - X0) / (X1 - X0)) * plotW, Y = (p) => top + plotH - ((p - P0) / (P1 - P0)) * plotH;
      const cy = (p) => Math.max(top - 60, Math.min(top + plotH + 60, Y(p)));
      const path = (pts) => "M" + pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join("L");
      const halo = ` paint-order="stroke" stroke="${C.bg}" stroke-width="4" stroke-linejoin="round"`;
      const id = "air" + Math.random().toString(36).slice(2, 7), os = [];
      for (let o = X0; o <= X1 + 1e-9; o += 0.25) os.push(o);
      el._inv = { left, top, plotW, plotH, W };
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Cabin oxygen against cabin pressure: hours of prebreathe before a spacewalk, the oxygen NASA accepts, and the burn line from NASA's droplet tests"><defs><clipPath id="${id}c"><rect x="${left}" y="${top}" width="${plotW}" height="${plotH}"/></clipPath><pattern id="${id}h" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="rgba(255,255,255,0.02)"/><line x1="0" y1="0" x2="0" y2="7" stroke="rgba(255,255,255,0.1)" stroke-width="2.5"/></pattern></defs>`;
      [15, 20, 25, 30, 35, 40].forEach((t) => { s += `<line x1="${X(t)}" x2="${X(t)}" y1="${top}" y2="${top + plotH}" stroke="${C.line}"/>` + txt(X(t), top + plotH + 20, t + "%", { anchor: "middle", fill: C.ink3, size: 12, mono: true }); });
      [4, 6, 8, 10, 12, 14, 16].forEach((t) => { s += `<line x1="${left}" x2="${left + plotW}" y1="${Y(t)}" y2="${Y(t)}" stroke="${C.line}"/>` + txt(left - 8, Y(t) + 4, String(t), { anchor: "end", fill: C.ink3, size: 12, mono: true }); });
      s += txt(left - 8, top - 14, "psi", { anchor: "end", fill: C.ink3, size: 12 });
      s += txt(left + plotW, top + plotH + 40, "Cabin oxygen, % by volume", { anchor: "end", fill: C.ink3, size: 12 });
      s += `<g clip-path="url(#${id}c)">`;
      const fl = os.map((o) => [X(o), cy(floorP(o))]);
      s += `<path d="${path([[X(X0), top + plotH + 60], ...fl, [X(X1), top + plotH + 60]])}Z" fill="url(#${id}h)"/>`;
      const ok = os.filter((o) => o >= corner.o2);
      if (ok.length) s += `<path d="${path([[X(corner.o2), Y(corner.p)], ...ok.map((o) => [X(o), cy(preP(o, 0))]), ...ok.slice().reverse().map((o) => [X(o), cy(floorP(o))])])}Z" fill="${C.third}" fill-opacity="0.22"/>`;
      s += `<rect x="${X(b0)}" y="${top}" width="${Math.max(3, X(b1) - X(b0))}" height="${plotH}" fill="${C.g1}" fill-opacity="0.2"/>`;
      s += `<path d="${path(fl)}" fill="none" stroke="${C.ink3}" stroke-width="1.4"/>`;
      [240, 120, 60].forEach((t) => { s += `<path d="${path(os.map((o) => [X(o), cy(preP(o, t))]))}" fill="none" stroke="${C.ink2}" stroke-width="1.2" stroke-dasharray="5 4" opacity="0.8"/>`; });
      s += `<path d="${path(os.map((o) => [X(o), cy(preP(o, 0))]))}" fill="none" stroke="${C.third}" stroke-width="2.4"/>`;
      s += `</g>`;
      // contour labels, where each contour leaves the plot
      const lab = (t, text, strong) => {
        const k = rmax * suit * Math.pow(2, t / A.half), oTop = 100 * (1 - k / P1), o = { fill: strong ? C.ink : C.ink2, size: 11.5, weight: strong ? 600 : 400, extra: halo };
        if (oTop >= X0 && oTop <= X1 - 3) return txt(X(oTop) + 5, top + 14, text, o);
        const p = k / (1 - X1 / 100);
        return p >= P0 + 0.3 && p <= P1 - 0.3 ? txt(left + plotW - 6, Y(p) - 7, text, { ...o, anchor: "end" }) : "";
      };
      s += lab(240, narrow ? "4 h" : "4 h of prebreathe") + lab(120, "2 h") + lab(60, "1 h") + lab(0, narrow ? "none" : "no prebreathe below this line", true);
      // the burn line, and which side is which
      const bm = X((b0 + b1) / 2);
      s += txt(bm, top + plotH - 26, "Burn line", { anchor: "middle", fill: C.ink, size: 12.5, weight: 600, extra: halo }) + txt(bm, top + plotH - 10, `${g(r1(b0))} to ${g(r1(b1))}%`, { anchor: "middle", fill: C.ink2, size: 11.5, mono: true, extra: halo });
      const room = X(b0) - 8 - left, lt = narrow ? "← go out" : room > 175 ? "← most go out on their own" : room > 135 ? "← go out on their own" : "← go out";
      s += txt(X(b0) - 8, top - 12, lt, { anchor: "end", fill: C.ink2, size: 12 }) + txt(X(b1) + 8, top - 12, narrow ? "keep burning →" : "most keep burning →", { fill: C.ink2, size: 12 });
      // the regions
      s += txt(left + 8, Y(7.2), narrow ? "Too little" : "Less oxygen than", { fill: C.ink2, size: 12, weight: 500, extra: halo }) + txt(left + 8, Y(7.2) + 15, narrow ? "oxygen" : "NASA accepts", { fill: C.ink2, size: 12, weight: 500, extra: halo });
      if (!narrow && corner.o2 < 36) { const go = 37.5, gp = (preP(go, 0) + floorP(go)) / 2; if (gp > P0 && gp < P1) s += txt(X(go), Y(gp) - 2, "No prebreathe,", { anchor: "middle", fill: C.ink, size: 12, weight: 600, extra: halo }) + txt(X(go), Y(gp) + 13, "enough oxygen", { anchor: "middle", fill: C.ink, size: 12, weight: 600, extra: halo }); }
      // the cheapest no-prebreathe air, and its distance from the burn line
      if (corner.o2 >= X0 && corner.o2 <= X1 && corner.p >= P0 && corner.p <= P1) {
        const cx = X(corner.o2), cyy = Y(corner.p);
        const gapTxt = corner.o2 > b1 ? `${g(r1(corner.o2 - b1))} points past the burn line` : corner.o2 >= b0 ? "on the burn line" : "before the burn line";
        if (corner.o2 > b1) s += `<line x1="${X(b1)}" x2="${cx}" y1="${cyy}" y2="${cyy}" stroke="${C.ink}" stroke-width="1.3" stroke-dasharray="2 3" opacity="0.85"/>`;
        s += `<circle cx="${cx}" cy="${cyy}" r="6" fill="${C.ink}" stroke="${C.bg}" stroke-width="2"/>`;
        if (narrow) s += txt(cx + 9, cyy + 17, `${g(corner.o2)}%`, { fill: C.ink, size: 12, weight: 600, extra: halo });
        else { // a callout below the point, in the empty low-oxygen area
          const ty = Math.min(top + plotH - 44, cyy + 64);
          s += `<line x1="${cx}" x2="${cx}" y1="${cyy + 8}" y2="${ty - 16}" stroke="${C.ink}" stroke-width="1" opacity="0.6"/>`;
          s += txt(cx, ty, `${g(corner.o2)}% at ${g(corner.p)} psi`, { anchor: "middle", fill: C.ink, size: 12.5, weight: 600, extra: halo })
            + txt(cx, ty + 15, "least oxygen with no prebreathe,", { anchor: "middle", fill: C.ink2, size: 11.5, extra: halo })
            + txt(cx, ty + 30, gapTxt, { anchor: "middle", fill: C.ink2, size: 11.5, extra: halo });
        }
      }
      // crew atmospheres
      const PL = { iss: ["start", 11, 4, "ISS"], eva: ["middle", 0, -13, narrow ? "Shuttle" : "Shuttle, before spacewalks"], moon: ["start", 11, 4, "Moon base"], exp: ["start", 11, 4, narrow ? "Explor." : "Exploration"] };
      pins.forEach((a) => {
        const x = X(a.o2), y = Y(a.p), [anc, dx, dy, name] = PL[a.id] || ["start", 11, 4, a.short];
        const t = info(a.o2, a.p, `${a.name} · ${a.when}`).replace(/<\/span>$/, opts.onPin ? "<br><i>Click to open this air</i></span>" : "</span>");
        s += `<g data-pin="${a.id}" tabindex="0" role="button" aria-label="${esc(a.name)}" style="cursor:${opts.onPin ? "pointer" : "default"}" data-tip="${esc(t)}"><circle cx="${x}" cy="${y}" r="15" fill="transparent"/><circle cx="${x}" cy="${y}" r="7.5" fill="${C.you}" stroke="${C.bg}" stroke-width="2"/>`;
        s += `<text x="${x + dx}" y="${y + dy}" fill="${C.ink}" font-size="12.5" font-weight="600" text-anchor="${anc}" font-family="Inter, system-ui, sans-serif"${halo}>${esc(name)}</text></g>`;
      });
      // your habitat
      const u = opts.you;
      if (u && u.o2 >= X0 && u.o2 <= X1 && u.p >= P0 && u.p <= P1) {
        const ux = X(u.o2), uy = Y(u.p);
        s += `<line x1="${ux}" x2="${ux}" y1="${top}" y2="${top + plotH}" stroke="${C.you}" stroke-width="1.1" stroke-dasharray="4 4" opacity="0.55" pointer-events="none"/><line x1="${left}" x2="${left + plotW}" y1="${uy}" y2="${uy}" stroke="${C.you}" stroke-width="1.1" stroke-dasharray="4 4" opacity="0.55" pointer-events="none"/>`;
        s += `<rect x="${ux - 7}" y="${uy - 7}" width="14" height="14" transform="rotate(45 ${ux} ${uy})" fill="${C.you}" stroke="${C.bg}" stroke-width="2" pointer-events="none"/>`;
      }
      return s + "</svg>";
    });
    // hover anywhere for the numbers there; click to choose that air
    const at = (e) => {
      const svg = el.querySelector("svg"), I = el._inv; if (!svg || !I) return null;
      const r = svg.getBoundingClientRect(), k = I.W / r.width, x = (e.clientX - r.left) * k, y = (e.clientY - r.top) * k;
      if (x < I.left || x > I.left + I.plotW || y < I.top || y > I.top + I.plotH) return null;
      return { o: X0 + ((x - I.left) / I.plotW) * (X1 - X0), p: P0 + ((I.top + I.plotH - y) / I.plotH) * (P1 - P0) };
    };
    el.onmousemove = (e) => {
      if (e.target.closest && e.target.closest("[data-tip]")) return;
      const q = at(e), t = tip();
      if (!q) { t.classList.remove("on"); return; }
      t.innerHTML = info(q.o, q.p).replace(/<\/span>$/, opts.onPick ? "<br><i>Click to choose this air</i></span>" : "</span>"); t.classList.add("on");
      const w = t.offsetWidth, h = t.offsetHeight;
      t.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, e.clientX + 14)) + "px";
      t.style.top = (e.clientY + h + 24 > window.innerHeight ? e.clientY - h - 12 : e.clientY + 16) + "px";
    };
    el.onmouseleave = () => tip().classList.remove("on");
    el.classList.toggle("pick", !!(opts.onPick || opts.onPin));
    el.onclick = (e) => { const pin = e.target.closest && e.target.closest("[data-pin]"); if (pin && opts.onPin) return opts.onPin(pin.dataset.pin); const q = at(e); if (q && opts.onPick) opts.onPick(Math.round(q.o * 2) / 2, Math.round(q.p * 10) / 10); };
    el.onkeydown = (e) => { const pin = e.target.closest && e.target.closest("[data-pin]"); if (pin && opts.onPin && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); opts.onPin(pin.dataset.pin); } };
  }
  function airLegend(suit) {
    return `<div class="legend"><span><i style="background:${C.third};border-radius:2px;opacity:.8"></i>No prebreathe, with the oxygen NASA accepts</span><span><i style="border-radius:2px;background:repeating-linear-gradient(45deg,rgba(255,255,255,.5) 0 2px,transparent 2px 5px)"></i>Less oxygen than NASA accepts</span><span><i style="background:${C.g1};border-radius:2px;opacity:.8"></i>Burn line: where most droplet flames stop going out on their own</span><span><i class="tick" style="background:transparent;border-left:2px dashed ${C.ink2}"></i>Hours of prebreathe before a ${g(suit)} psi spacewalk</span><span><i style="background:#fff"></i>Crew atmospheres</span></div>`;
  }

  /* Limiting oxygen by gravity level for three materials (Olson and Ferkul 2012, Table I, transcribed).
     Bar: from the highest oxygen at which the flame went out (MOC) to the lowest at which it kept burning (ULOI). */
  const MAT_COL = ["#a274e6", "#bf8420", "#2aa7ae"]; // validated for this dark surface (dataviz validator)
  function gravityLimitsChart(el, FF) {
    const L = window.FFLogic, mats = L.gravityLimits(FF);
    if (!mats.length) { el.innerHTML = ""; return; }
    const order = [["Microgravity", "Microgravity", "0 g, with airflow"], ["Moon", "Moon", "1/6 g"], ["Mars", "Mars", "0.38 g"], ["Earth", "Earth", "1 g"]];
    const all = mats.flatMap((m) => m.rows), lo = Math.floor(Math.min(...all.map((r) => r.moc)) - 1), hi = Math.ceil(Math.max(...all.map((r) => r.uloi)) + 1);
    const moonLow = mats.every((m) => m.moon.mid < m.earth.mid && m.moon.mid < m.micro.mid);
    mount(el, (W) => {
      const narrow = W < 620, left = narrow ? 42 : 56, right = narrow ? 12 : 132, top = 30, plotH = narrow ? 270 : 320, H = top + plotH + 62;
      const colW = (W - left - right) / order.length, X = (k) => left + (k + 0.5) * colW;
      const Y = (v) => top + plotH - ((v - lo) / (hi - lo)) * plotH;
      const halo = ` paint-order="stroke" stroke="${C.bg}" stroke-width="4" stroke-linejoin="round"`;
      let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Lowest oxygen at which three materials kept burning, in microgravity, Moon, Mars and Earth gravity">`;
      s += `<rect x="${X(1) - colW / 2}" y="${top}" width="${colW}" height="${plotH}" fill="rgba(255,255,255,0.045)"/>`;
      for (let v = Math.ceil(lo / 2) * 2; v <= hi; v += 2) s += `<line x1="${left}" x2="${W - right}" y1="${Y(v)}" y2="${Y(v)}" stroke="${C.line}"/>` + txt(left - 8, Y(v) + 4, v + "%", { anchor: "end", fill: C.ink3, size: 12, mono: true });
      if (21 > lo && 21 < hi) {
        s += `<line x1="${left}" x2="${W - right}" y1="${Y(21)}" y2="${Y(21)}" stroke="${C.line2}" stroke-dasharray="4 4"/>`;
        s += txt(left + 6, Y(21) + (narrow ? 15 : -6), narrow ? "air · 21%" : "21% · Earth's air", { fill: C.ink2, size: 11.5, extra: halo });
      }
      order.forEach(([, name0, sub0], k) => {
        const name = narrow && k === 0 ? "0 g" : name0, sub = narrow && k === 0 ? "airflow" : sub0;
        s += txt(X(k), top + plotH + 22, name, { anchor: "middle", fill: C.ink, size: narrow ? 12.5 : 13.5, weight: 600 });
        s += txt(X(k), top + plotH + 39, sub, { anchor: "middle", fill: C.ink3, size: narrow ? 11 : 12 });
      });
      s += txt(left - 8, top - 12, "Oxygen", { anchor: "end", fill: C.ink3, size: 12 });
      if (moonLow) s += txt(X(1), top - 10, narrow ? "Moon: all 3 below Earth and 0 g" : "Below Earth and microgravity for all three", { anchor: "middle", fill: C.ink, size: narrow ? 11.5 : 12.5, weight: 600, extra: halo });
      const ends = [];
      mats.forEach((m, i) => {
        const col = MAT_COL[i % MAT_COL.length], dx = (i - (mats.length - 1) / 2) * (narrow ? 9 : 13);
        const pts = order.map(([key], k) => [X(k) + dx, m.rows.find((r) => r.gravity.startsWith(key))]);
        s += `<path d="M${pts.map(([x, r]) => `${x.toFixed(1)},${Y(r.mid).toFixed(1)}`).join("L")}" fill="none" stroke="${col}" stroke-width="2" opacity="0.9"/>`;
        pts.forEach(([x, r], k) => {
          const d = r.delta != null ? `<br>${r.delta > 0 ? "+" : ""}${g(r.delta)} points against Earth gravity` : "";
          const tipHtml = `<b>${esc(m.material)} · ${esc(order[k][1])}${k === 0 ? " (30 cm/s airflow)" : " gravity"}</b><span>Kept burning at ${g(r.uloi)}% oxygen (ULOI)<br>Went out at ${g(r.moc)}% (MOC)<br>${g(m.psia)} psi${d}</span>`;
          s += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y(r.uloi).toFixed(1)}" y2="${Y(r.moc).toFixed(1)}" stroke="${col}" stroke-width="6" stroke-linecap="round" opacity="0.4"/>`;
          s += `<circle cx="${x.toFixed(1)}" cy="${Y(r.mid).toFixed(1)}" r="5.5" fill="${col}" stroke="${C.bg}" stroke-width="2"/>`;
          s += `<rect x="${(x - colW / 6).toFixed(1)}" y="${(Y(r.uloi) - 8).toFixed(1)}" width="${(colW / 3).toFixed(1)}" height="${(Y(r.moc) - Y(r.uloi) + 16).toFixed(1)}" fill="transparent" tabindex="0" data-tip="${esc(tipHtml)}"/>`;
        });
        ends.push({ y: Y(pts[pts.length - 1][1].mid), label: `${m.material} · ${g(m.psia)} psi`, col });
      });
      if (!narrow) { // direct labels at the Earth end, pushed apart so they never overlap
        ends.sort((a, b) => a.y - b.y);
        for (let i = 1; i < ends.length; i++) ends[i].y = Math.max(ends[i].y, ends[i - 1].y + 17);
        ends.forEach((e) => { s += txt(W - right + 12, e.y + 4, e.label, { fill: C.ink, size: 12.5, weight: 600, extra: halo }); s += `<circle cx="${W - right + 4}" cy="${e.y}" r="3.5" fill="${e.col}"/>`; });
      }
      return s + "</svg>";
    });
  }
  /* the in-orbit report tests as a table, highest oxygen first */
  function reportTable(FF) {
    const L = window.FFLogic, rows = L.reportPoints(FF).slice().sort((a, b) => b.o - a.o || a.p - b.p);
    const cite = (x) => (x.src || []).map((k) => { const s = L.source(FF, k); return s ? `<a href="${s.url}" target="_blank" rel="noopener">NTRS ${esc(s.ntrs)} ↗</a>` : ""; }).join(" ");
    return `<div class="table-wrap"><table class="t rep-t"><thead><tr><th>Test</th><th>Flight</th><th>Material</th><th>Oxygen</th><th>Pressure</th><th>What happened</th><th>Source</th></tr></thead><tbody>${rows.map((x) =>
      `<tr><td><b>${esc(x.id)}</b></td><td>${esc(x.when)}</td><td>${esc(x.material)}</td><td class="mono">${g(x.o)}%</td><td class="mono">${g(Math.round(x.p * 10) / 10)} psi</td><td>${esc(x.out)}</td><td>${cite(x)}<br><span class="muted">${esc(x.where)}</span></td></tr>`).join("")}</tbody></table></div>`;
  }

  window.FFCharts = { dumbbell, lanes, materialStrip, mini, finding, atlas, atlasTable, crossover, crossoverData, airChart, airLegend, gravityLimitsChart, reportTable, MAT_COL, bindTips, esc, C };
})();
