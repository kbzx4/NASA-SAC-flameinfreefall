/* Test replay: NASA's own droplet (FLEX) and gas-flame (CFI-G) tests, played back in time-lapse.

   Every droplet starts at its recorded diameter, shrinks following the d2 law (diameter squared falls
   steadily, the standard model the burning rates in the table are measured against), and ends at its
   recorded burn time the way the table says it ended: flame out with fuel left, burned to nothing, or
   disrupted. Gas flames burn for their recorded time and end on their own, when the fuel was cut off,
   or never light. Only the look of each flame is drawn; its size and colour are not measured. */
(function (root) {
  "use strict";
  const COL = { out: "#3987e5", burn: "#d95926", other: "#9b6fd6", idle: "rgba(255,255,255,0.18)" };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const g = (x) => String(Number(Number(x).toPrecision(4)));
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const KINDS = {
    droplets: {
      finding: "droplet-oxygen", label: "Fuel droplets · FLEX", cell: 44, target: 16,
      states: [["Went out, fuel left", COL.out, "E"], ["Burned until used up", COL.burn, "C"], ["Droplet disrupted", COL.other, "D"]],
      rows: (FF) => FF.replay.droplets.map((r) => ({ o2: r[0], fuel: r[1], d0: r[2], de: r[3], t: r[4], end: r[5], gas: r[6], p: r[7], id: r[8] })),
      tip: (r) => `<b>FLEX test ${esc(r.id)}</b><span>${esc(r.fuel)} droplet, ${g(r.d0)} mm<br>${g(r.o2)}% oxygen${r.gas === "N2" ? "" : r.gas === "CO2" ? ", CO2 added" : ", helium added"}${r.p ? `, ${g(r.p)} psi` : ""}<br>${{ E: `Flame went out after ${g(r.t)} s with ${g(r.de)} mm of fuel left`, C: `Burned until the fuel was used up, ${g(r.t)} s`, D: `Droplet disrupted after ${g(r.t)} s` }[r.end]}</span>`,
    },
    gas: {
      finding: "gas-oxygen", label: "Gas flames · CFI-G", cell: 38, target: 18,
      states: [["Went out on its own", COL.out, "SE"], ["Burned until fuel cut", COL.burn, "FT"], ["Did not light", COL.other, "N"]],
      rows: (FF) => FF.replay.gas.map((r) => ({ o2: r[0], fuel: r[1], t: r[2], end: r[3], cool: r[4], p: r[5], id: r[6] })),
      tip: (r) => `<b>CFI-G test ${esc(r.id)}</b><span>${esc(r.fuel)} on a spherical burner<br>${g(r.o2)}% oxygen${r.p ? `, ${g(r.p)} psi` : ""}<br>${{ SE: `Went out on its own after ${g(r.t)} s`, FT: `Burned ${g(r.t)} s until the fuel was cut off`, N: "Did not light" }[r.end]}${r.cool ? "<br>A cool flame was recorded" : ""}</span>`,
    },
  };

  let tipEl;
  function tip(html, x, y) {
    if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "tip"; document.body.appendChild(tipEl); }
    if (!html) { tipEl.classList.remove("on"); return; }
    tipEl.innerHTML = html; tipEl.classList.add("on");
    const w = tipEl.offsetWidth, h = tipEl.offsetHeight;
    tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + "px";
    tipEl.style.top = (y + h + 24 > innerHeight ? y - h - 12 : y + 16) + "px";
  }

  function bandsOf(FF, kind) {
    return FF.findings.find((f) => f.id === KINDS[kind].finding).bands.map((b) => ({ lo: b.o2[0], hi: b.o2[1], label: b.label + " oxygen" }));
  }
  function nearest(bands, o2) {
    let best = 0;
    bands.forEach((b, i) => { const d = Math.max(b.lo - o2, o2 - b.hi, 0), e = Math.max(bands[best].lo - o2, o2 - bands[best].hi, 0); if (d < e) best = i; });
    return best;
  }

  /* one flame cell */
  function drawDroplet(ctx, r, x, y, c, t, fade) {
    const s = c / 17, done = t >= r.t, k = Math.min(1, t / r.t);
    const d = done ? (r.end === "C" ? 0 : r.de) : Math.sqrt(Math.max(0, r.d0 * r.d0 - (r.d0 * r.d0 - r.de * r.de) * k));
    const after = done ? Math.min(1, (t - r.t) / fade) : 0, alive = done ? 1 - after : 1;
    const rad = (d / 2) * s;
    if (alive > 0.01) {
      // a burning droplet in orbit: a dim blue sphere well away from the droplet (drawn, not measured)
      const flick = 1 + 0.04 * Math.sin(t * 9 + r.d0 * 7);
      const R = Math.min(c * 0.46, c * 0.2 + (d / 4.7) * c * 0.26) * flick * (0.85 + 0.15 * alive);
      const gr = ctx.createRadialGradient(x, y, 0, x, y, R);
      const warm = /heptane/i.test(r.fuel); // heptane flames carry glowing soot; methanol burns almost clean
      gr.addColorStop(0, warm ? `rgba(255,170,80,${0.42 * alive})` : `rgba(110,130,255,${0.08 * alive})`);
      gr.addColorStop(0.5, warm ? `rgba(255,120,60,${0.2 * alive})` : `rgba(110,130,255,${0.2 * alive})`);
      gr.addColorStop(0.8, `rgba(170,185,255,${0.85 * alive})`);
      gr.addColorStop(0.92, `rgba(120,140,255,${0.35 * alive})`);
      gr.addColorStop(1, "rgba(90,100,240,0)");
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    }
    if (r.end === "D" && done) {
      // the droplet breaks into pieces that fly apart
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + r.d0, dist = (r.de / 2) * s + after * c * 0.32;
        ctx.fillStyle = `rgba(214,222,236,${1 - after})`;
        ctx.beginPath(); ctx.arc(x + Math.cos(a) * dist, y + Math.sin(a) * dist, Math.max(0.8, rad * 0.35), 0, Math.PI * 2); ctx.fill();
      }
    } else if (rad > 0.2) {
      ctx.fillStyle = done ? "rgba(170,180,198,0.9)" : "#dfe6f3";
      ctx.beginPath(); ctx.arc(x, y, Math.max(1, rad), 0, Math.PI * 2); ctx.fill();
    }
    return done ? r.end : "live";
  }

  function drawGas(ctx, r, x, y, c, t, fade) {
    const done = r.end === "N" ? t > fade * 0.6 : t >= r.t;
    const after = done && r.end !== "N" ? Math.min(1, (t - r.t) / (r.end === "FT" ? fade * 0.35 : fade)) : 0;
    const alive = r.end === "N" ? 0 : done ? 1 - after : 1;
    ctx.strokeStyle = "rgba(150,160,180,0.55)"; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x, y + 3); ctx.lineTo(x, y + c * 0.42); ctx.stroke();
    if (r.end === "N" && t < fade * 0.6) { // the igniter tries
      ctx.fillStyle = `rgba(255,190,120,${0.8 * (1 - t / (fade * 0.6))})`; ctx.beginPath(); ctx.arc(x + 5, y - 4, 2, 0, Math.PI * 2); ctx.fill();
    }
    if (alive > 0.01) {
      const R = c * 0.44 * (1 + 0.04 * Math.sin(t * 2.5 + r.o2)), gr = ctx.createRadialGradient(x, y, 0, x, y, R);
      if (r.cool) { // a cool flame: faint and pale
        gr.addColorStop(0, `rgba(150,180,255,${0.06 * alive})`); gr.addColorStop(0.8, `rgba(170,195,255,${0.3 * alive})`); gr.addColorStop(1, "rgba(150,180,255,0)");
      } else {
        gr.addColorStop(0, `rgba(255,214,140,${0.85 * alive})`); gr.addColorStop(0.35, `rgba(255,150,70,${0.5 * alive})`);
        gr.addColorStop(0.75, `rgba(150,165,255,${0.7 * alive})`); gr.addColorStop(0.9, `rgba(110,130,255,${0.3 * alive})`); gr.addColorStop(1, "rgba(90,100,240,0)");
      }
      ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = "#b9c2d4"; ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    return done ? r.end : "live";
  }

  /* mount(el, FF, {kind, left, right, gas, compact, autoplay, loop}) */
  function mount(el, FF, opts) {
    const o = Object.assign({ kind: "droplets", gas: "", compact: false, autoplay: true, loop: false }, opts);
    let kind = o.kind, K = KINDS[kind], bands = bandsOf(FF, kind), raf = 0, playing = false, visible = true, last = 0, t = 0;
    const sel = [o.left != null ? o.left : nearest(bands, 21), 0];
    sel[1] = o.right != null ? o.right : o.o2 != null && nearest(bands, o.o2) !== sel[0] ? nearest(bands, o.o2) : bands.length - 1;
    let panels = [], tmax = 1, speed = 1;

    el.innerHTML = `<div class="replay${o.compact ? " compact" : ""}">
      ${o.compact ? "" : `<div class="rp-top">
        <div class="pills rp-kind">${Object.entries(KINDS).map(([k, v]) => `<button class="pill" data-kind="${k}" aria-pressed="${k === kind}">${v.label}</button>`).join("")}</div>
        <div class="pills rp-gas"></div></div>`}
      <div class="rp-bar"><button class="btn primary small rp-play"></button><button class="btn small rp-restart">Restart</button>
        <span class="rp-clock mono"></span></div>
      <div class="rp-panels">${[0, 1].map((i) => `<div class="rp-panel"><div class="rp-head"></div><canvas></canvas><div class="rp-tally"></div></div>`).join("")}</div>
      <div class="legend rp-legend"></div></div>`;
    const $ = (s) => el.querySelector(s), canv = [...el.querySelectorAll("canvas")];

    function filtered(i) {
      const b = bands[sel[i]], all = K.rows(FF);
      return all.filter((r) => r.o2 >= b.lo - 0.05 && r.o2 <= b.hi + 0.05 && (kind !== "droplets" || !o.gas || r.gas === o.gas));
    }
    function setup() {
      K = KINDS[kind]; bands = bandsOf(FF, kind);
      panels = [0, 1].map((i) => ({ rows: filtered(i) }));
      tmax = Math.max(1, ...panels.flatMap((p) => p.rows.map((r) => r.t)));
      speed = Math.max(1, tmax / K.target);
      el.querySelectorAll(".rp-head").forEach((h, i) => {
        const p = panels[i], total = FF.findings.find((f) => f.id === K.finding).bands[sel[i]].n;
        h.innerHTML = o.compact ? `<b>${esc(bands[sel[i]].label)}</b><span>${p.rows.length} NASA tests</span>`
          : `<div class="pills">${bands.map((b, j) => `<button class="pill" data-side="${i}" data-band="${j}" aria-pressed="${j === sel[i]}">${esc(b.label.replace(" oxygen", ""))}</button>`).join("")}</div>
            <span>${p.rows.length} tests replayed${!o.gas && p.rows.length < total ? ` of ${total}; ${total - p.rows.length} ${total - p.rows.length === 1 ? "lacks" : "lack"} a start size or burn time` : ""}</span>`;
      });
      const gp = $(".rp-gas");
      if (gp) gp.innerHTML = kind === "droplets" ? [["", "Any gas"], ["N2", "Nitrogen only"], ["CO2", "CO2 added"], ["He", "Helium added"]].map(([k, l]) => `<button class="pill" data-gasf="${k}" aria-pressed="${o.gas === k}">${l}</button>`).join("") : "";
      $(".rp-legend").innerHTML = K.states.map(([l, c]) => `<span><i style="background:${c}"></i>${l}</span>`).join("") + `<span><i style="background:${COL.idle}"></i>Still burning</span>`;
      size(); t = reduce && !playing ? tmax + 1 : 0; frame(performance.now(), true);
    }
    function size() {
      canv.forEach((cv, i) => {
        const W = cv.parentElement.clientWidth || 300, c = K.cell * (o.compact ? 0.9 : 1);
        const cols = Math.max(4, Math.floor(W / c)), n = panels[i].rows.length, rows = Math.max(1, Math.ceil(n / cols));
        const dpr = Math.min(2, devicePixelRatio || 1), H = rows * c;
        cv.width = W * dpr; cv.height = H * dpr; cv.style.height = H + "px";
        Object.assign(panels[i], { W, H, c, cols, dpr });
      });
    }
    function frame(now, once) {
      if (!once) { t += ((now - last) / 1000) * speed; }
      last = now;
      const fade = tmax * 0.05;
      panels.forEach((p, i) => {
        const ctx = canv[i].getContext("2d"), cw = (p.W - 0) / p.cols;
        ctx.setTransform(p.dpr, 0, 0, p.dpr, 0, 0); ctx.clearRect(0, 0, p.W, p.H);
        ctx.globalCompositeOperation = "lighter";
        const count = { live: 0 }; K.states.forEach(([, , k]) => { count[k] = 0; });
        p.rows.forEach((r, j) => {
          const x = (j % p.cols) * cw + cw / 2, y = Math.floor(j / p.cols) * p.c + p.c / 2;
          ctx.globalCompositeOperation = "lighter";
          const st = (kind === "droplets" ? drawDroplet : drawGas)(ctx, r, x, y, p.c, t, fade);
          count[st] = (count[st] || 0) + 1;
          ctx.globalCompositeOperation = "source-over";
          if (st !== "live") {
            const col = K.states.find((s) => s[2] === st)[1];
            ctx.strokeStyle = col; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(x, y, p.c * 0.4, 0, Math.PI * 2); ctx.stroke(); ctx.globalAlpha = 1;
          }
        });
        const n = p.rows.length || 1;
        el.querySelectorAll(".rp-tally")[i].innerHTML = `<div class="split">${K.states.map(([, c, k]) => count[k] ? `<span style="flex:${count[k] / n};background:${c}"></span>` : "").join("")}${count.live ? `<span style="flex:${count.live / n};background:${COL.idle}"></span>` : ""}</div>
          <div class="rp-count">${K.states.map(([l, c, k]) => `<span><i style="background:${c}"></i>${l} <b>${count[k]}</b></span>`).join("")}<span><i style="background:${COL.idle}"></i>Still burning <b>${count.live}</b></span></div>`;
      });
      $(".rp-clock").textContent = `t = ${g(Math.min(t, tmax).toFixed(1))} s of test time · shown ${Math.round(speed)}× faster`;
      $(".rp-play").textContent = playing ? "Pause" : t >= tmax ? "Play again" : "Play";
      if (playing && t > tmax + tmax * 0.12) {
        if (o.loop) t = 0; else { playing = false; $(".rp-play").textContent = "Play again"; }
      }
      if (playing && visible && !once) raf = requestAnimationFrame(frame);
    }
    function play() { if (t >= tmax) t = 0; playing = true; last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
    function pause() { playing = false; cancelAnimationFrame(raf); frame(performance.now(), true); }

    el.addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.classList.contains("rp-play")) return playing ? pause() : play();
      if (b.classList.contains("rp-restart")) { t = 0; return playing ? null : play(); }
      if (b.dataset.kind) { kind = b.dataset.kind; o.gas = ""; const bs = bandsOf(FF, kind); sel[0] = nearest(bs, 21); sel[1] = bs.length - 1; el.querySelectorAll("[data-kind]").forEach((x) => x.setAttribute("aria-pressed", x === b)); }
      else if (b.dataset.band) sel[+b.dataset.side] = +b.dataset.band;
      else if (b.dataset.gasf != null) o.gas = b.dataset.gasf;
      else return;
      setup(); if (!reduce) play();
    });
    canv.forEach((cv, i) => {
      cv.addEventListener("mousemove", (e) => {
        const p = panels[i], rc = cv.getBoundingClientRect(), cw = p.W / p.cols;
        const j = Math.floor((e.clientY - rc.top) / p.c) * p.cols + Math.floor((e.clientX - rc.left) / cw), r = p.rows[j];
        tip(r ? K.tip(r) : null, e.clientX, e.clientY);
      });
      cv.addEventListener("mouseleave", () => tip(null));
    });
    const ro = new ResizeObserver(() => { size(); frame(performance.now(), true); });
    ro.observe(el);
    const io = new IntersectionObserver((es) => {
      visible = es[0].isIntersecting;
      if (visible && playing) { last = performance.now(); cancelAnimationFrame(raf); raf = requestAnimationFrame(frame); }
      if (visible && o.autoplay && !playing && !reduce && t === 0) play();
    }, { threshold: 0.2 });
    io.observe(el);
    setup();
    return { destroy() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); playing = false; tip(null); } };
  }

  root.FFReplay = { mount };
})(window);
