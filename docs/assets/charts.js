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
        const name = `${p.material.replace(" (SIBAL)", "")} · ${p.thickness === "See Fig. 5" ? "thickness: see source" : p.thickness}${/Opposed/.test(p.direction) ? " · opposed flow" : ""}`;
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

  window.FFCharts = { dumbbell, lanes, materialStrip, mini, bindTips, esc, C };
})();
