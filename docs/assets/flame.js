/* Hero flame and starfield. An illustration of how gravity shapes a flame, not a simulation.
   At 0 g hot gas does not rise, so the flame is a blue sphere around the fuel. At 1 g buoyancy
   stretches it into a teardrop. Everything in between is drawn by interpolation. */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const mix = (c1, c2, t) => [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
  function ramp(stops, t) {
    const n = stops.length - 1, i = Math.min(n - 1, Math.floor(clamp(t) * n)), f = clamp(t) * n - i;
    return mix(stops[i], stops[i + 1], f);
  }
  // the dim violet-blue of a candle flame in orbit, which makes little glowing soot
  const BLUE = [[176, 184, 255], [124, 136, 255], [86, 92, 240], [48, 44, 170]];
  const WARM = [[255, 244, 205], [255, 196, 80], [255, 120, 36], [170, 38, 14]];
  const PER_FRAME = 9;

  const sprites = new Map();
  function sprite(rgb) {
    const key = rgb.map((v) => Math.round(v / 12)).join(",");
    if (!sprites.has(key)) {
      const c = document.createElement("canvas"); c.width = c.height = 64;
      const x = c.getContext("2d"), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      const col = rgb.map(Math.round).join(",");
      gr.addColorStop(0, `rgba(${col},1)`); gr.addColorStop(0.4, `rgba(${col},0.38)`); gr.addColorStop(1, `rgba(${col},0)`);
      x.fillStyle = gr; x.fillRect(0, 0, 64, 64);
      sprites.set(key, c);
    }
    return sprites.get(key);
  }

  /* A random point on a sphere's surface, seen from the side. Drawing a ball this way fills the
     whole disc and makes the edge slightly brighter, as a real spherical flame looks. */
  function onSphere() {
    const z = Math.random() * 2 - 1, a = Math.random() * Math.PI * 2, s = Math.sqrt(1 - z * z);
    return [s * Math.cos(a), s * Math.sin(a)];
  }

  function Flame(canvas) {
    const ctx = canvas.getContext("2d");
    let parts = [], W = 0, H = 0, dpr = 1, g = 0, t = 0, raf = 0, visible = true;
    // The same candle at every gravity, as in NASA's side-by-side photos: only the flame changes.
    const geo = () => {
      const R = Math.min(W, H) * 0.2, wick = H * 0.52;
      // in orbit the ball's centre sits above the wick tip, so the ball wraps the wick
      return { R, cx: W / 2, wick, top: wick + R * 0.34, cy: wick - R * lerp(0.3, 0.02, g) };
    };

    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = canvas.clientWidth; H = canvas.clientHeight;
      canvas.width = Math.max(1, W * dpr); canvas.height = Math.max(1, H * dpr);
    }
    function spawn({ R, cx, cy }) {
      // a thick shell: the glow fills the ball, a little brighter near its edge
      const [ux, uy] = onSphere(), shell = R * 0.76 * Math.pow(1 - g, 1.4) * (0.62 + Math.random() * 0.4);
      const out = (0.04 + Math.random() * 0.08) * (1 - g) * R * 0.02;
      parts.push({
        x: cx + ux * shell + R * 0.3 * g * (Math.random() - 0.5) * 2,
        y: cy + uy * shell * lerp(1, 0.2, g),
        vx: ux * out,
        vy: uy * out - Math.pow(g, 0.8) * R * (0.03 + Math.random() * 0.024),
        age: 0, life: lerp(110, 50, g) * (0.65 + Math.random() * 0.7), seed: Math.random() * 10,
      });
    }
    function step() {
      const G = geo();
      t += 1;
      for (let i = 0; i < PER_FRAME; i++) spawn(G);
      const alive = [];
      for (const p of parts) {
        if (++p.age > p.life) continue;
        const k = p.age / p.life;
        // buoyant plumes neck in as they rise; a little sway stands in for flicker
        p.vx += (G.cx - p.x) * 0.0036 * g * (0.4 + k) + Math.sin(t * 0.11 + p.seed + p.y * 0.035) * 0.0009 * g * G.R;
        p.vx *= lerp(1, 0.95, g);
        p.x += p.vx; p.y += p.vy;
        alive.push(p);
      }
      parts = alive;
    }
    function draw() {
      const { R, cx, cy, wick, top } = geo();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, W, H);

      const gy = cy - R * 1.2 * g, glowR = Math.max(1, Math.min(R * lerp(2.3, 2.7, g), W / 2, gy, H - gy));
      const glow = ctx.createRadialGradient(cx, gy, 0, cx, gy, glowR);
      const gc = mix([90, 100, 255], [255, 130, 50], Math.pow(g, 0.7)).map(Math.round).join(",");
      glow.addColorStop(0, `rgba(${gc},0.16)`); glow.addColorStop(0.6, `rgba(${gc},0.04)`); glow.addColorStop(1, `rgba(${gc},0)`);
      ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);

      // the candle, faintly lit by its own flame and fading into the dark below
      const cw = R * 0.46, bottom = Math.min(H, top + R * 0.62);  // ends above the slider
      const body = ctx.createLinearGradient(cx - cw / 2, 0, cx + cw / 2, 0);
      body.addColorStop(0, "rgba(46,50,66,1)"); body.addColorStop(0.42, "rgba(104,110,134,1)"); body.addColorStop(1, "rgba(38,42,56,1)");
      ctx.fillStyle = body; ctx.fillRect(cx - cw / 2, top, cw, bottom - top);
      const fade = ctx.createLinearGradient(0, top + R * 0.08, 0, bottom);
      fade.addColorStop(0, "rgba(5,8,16,0)"); fade.addColorStop(1, "rgba(5,8,16,1)");
      ctx.fillStyle = fade; ctx.fillRect(cx - cw / 2 - 1, top, cw + 2, bottom - top + 1);
      const lit = mix([150, 160, 255], [255, 196, 120], Math.pow(g, 0.7)).map(Math.round).join(",");
      ctx.fillStyle = `rgba(${lit},0.38)`;
      ctx.beginPath(); ctx.ellipse(cx, top, cw / 2, R * 0.05, 0, 0, Math.PI * 2); ctx.fill();

      // the flame; it goes out just above the cool wax
      const q0 = top - R * 0.24, q1 = top - R * 0.03;
      ctx.globalCompositeOperation = "lighter";
      for (const p of parts) {
        const k = p.age / p.life;
        const warm = Math.pow(g, 0.55) * smooth(0.03, 0.26, k);
        const rgb = mix(ramp(BLUE, k), ramp(WARM, k), warm);
        const size = R * lerp(lerp(0.32, 0.26, k), lerp(0.3, 0.07, k), g);
        ctx.globalAlpha = Math.sin(Math.PI * Math.pow(k, lerp(1, 0.72, g))) * lerp(0.02, 0.1, Math.pow(g, 0.6))
          * (1 - 0.62 * Math.pow(Math.sin(Math.PI * Math.min(1, g * 1.25)), 0.7))
          * (1 - smooth(q0, q1, p.y));
        ctx.drawImage(sprite(rgb), p.x - size, p.y - size, size * 2, size * 2);
      }
      // in orbit a pale glow sits low inside the ball, around the wick
      const cyc = wick - R * 0.06, core = ctx.createRadialGradient(cx, cyc, 0, cx, cyc, R * 0.42);
      core.addColorStop(0, `rgba(255,232,214,${0.14 * (1 - g)})`); core.addColorStop(1, "rgba(255,232,214,0)");
      ctx.globalAlpha = 1; ctx.fillStyle = core; ctx.fillRect(cx - R * 0.42, cyc - R * 0.42, R * 0.84, R * 0.84);
      ctx.globalCompositeOperation = "source-over";

      // the wick, dark against the flame, with a glowing tip
      ctx.strokeStyle = "rgba(16,18,24,0.95)"; ctx.lineWidth = Math.max(2, R * 0.035); ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx + R * 0.02 * g, wick); ctx.stroke();
      const tip = ctx.createRadialGradient(cx, wick, 0, cx, wick, R * 0.06);
      tip.addColorStop(0, "rgba(255,150,70,0.85)"); tip.addColorStop(1, "rgba(255,150,70,0)");
      ctx.fillStyle = tip; ctx.fillRect(cx - R * 0.06, wick - R * 0.06, R * 0.12, R * 0.12);
    }
    function warm() { parts = []; for (let i = 0; i < 130; i++) step(); } // start fully formed, not from nothing
    function frame() {
      raf = 0;
      if (!visible || reduce) return;
      step(); draw();
      raf = requestAnimationFrame(frame);
    }
    resize(); warm(); draw();
    new ResizeObserver(() => { resize(); warm(); draw(); }).observe(canvas);
    new IntersectionObserver((e) => { visible = e[0].isIntersecting; if (visible && !raf && !reduce) raf = requestAnimationFrame(frame); }).observe(canvas);
    return {
      /* jump = true rebuilds the flame at the new gravity at once (for clicks); false lets it flow there (for drags) */
      set(v, jump) { g = clamp(v); if (jump || reduce) { warm(); draw(); } },
    };
  }

  function stars(canvas) {
    const ctx = canvas.getContext("2d");
    function draw() {
      const dpr = Math.min(2, window.devicePixelRatio || 1), W = canvas.clientWidth, H = canvas.clientHeight;
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.scale(dpr, dpr);
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const n = Math.round((W * H) / 5200);
      for (let i = 0; i < n; i++) {
        const r = rnd() < 0.06 ? 1.3 : rnd() * 0.8 + 0.2;
        ctx.fillStyle = `rgba(${rnd() < 0.2 ? "170,205,255" : "255,255,255"},${0.14 + rnd() * 0.42})`;
        ctx.beginPath(); ctx.arc(rnd() * W, rnd() * H, r, 0, Math.PI * 2); ctx.fill();
      }
    }
    draw();
    let timer; window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(draw, 150); });
  }

  /* Flame balls drifting behind the page. Without buoyancy a weak flame can sit as a still sphere,
     so these do not rise or flicker; they only drift. Decoration, not data. */
  function drift(host) {
    if (reduce) return;
    const canvas = document.createElement("canvas");
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const ball = document.createElement("canvas"); ball.width = ball.height = 128;
    const bx = ball.getContext("2d"), gr = bx.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, "rgba(200,206,255,0.42)"); gr.addColorStop(0.5, "rgba(140,152,255,0.44)");
    gr.addColorStop(0.78, "rgba(112,124,250,0.5)"); gr.addColorStop(0.92, "rgba(64,70,210,0.18)");
    gr.addColorStop(1, "rgba(44,46,160,0)");
    bx.fillStyle = gr; bx.fillRect(0, 0, 128, 128);
    let W = 0, H = 0, balls = [], last = 0, mx = -1e4, my = -1e4;
    const make = () => {
      const depth = Math.random();                       // 0 = far and faint, 1 = near
      return { x: Math.random() * W, y: Math.random() * H, r: lerp(9, 46, depth * depth), depth,
               vx: (Math.random() - 0.5) * 0.3, vy: (Math.random() - 0.5) * 0.3,
               ph: Math.random() * 6.28, sp: 0.006 + Math.random() * 0.008 };
    };
    function resize() {
      W = canvas.clientWidth; H = canvas.clientHeight; canvas.width = Math.max(1, W); canvas.height = Math.max(1, H);
      const n = Math.max(5, Math.min(14, Math.round((W * H) / 120000)));
      while (balls.length < n) balls.push(make());
      balls.length = n;
    }
    function frame(now) {
      requestAnimationFrame(frame);
      if (document.hidden || now - last < 32) return;
      last = now;
      ctx.clearRect(0, 0, W, H);
      ctx.globalCompositeOperation = "lighter";
      for (const b of balls) {
        // a ball eases away from the pointer, as a flame would from a puff of air
        const dx = b.x - mx, dy = b.y - my, d2 = dx * dx + dy * dy;
        if (d2 < 32400 && d2 > 1) { const f = (1 - d2 / 32400) * 0.05 / Math.sqrt(d2); b.vx += dx * f; b.vy += dy * f; }
        const v = Math.hypot(b.vx, b.vy), cruise = lerp(0.1, 0.24, b.depth);
        if (v > cruise) { b.vx *= 0.985; b.vy *= 0.985; }
        b.x += b.vx; b.y += b.vy; b.ph += b.sp;
        const m = b.r * 2;
        if (b.x < -m) b.x = W + m; else if (b.x > W + m) b.x = -m;
        if (b.y < -m) b.y = H + m; else if (b.y > H + m) b.y = -m;
        const r = b.r * (1 + 0.05 * Math.sin(b.ph));
        ctx.globalAlpha = lerp(0.16, 0.42, b.depth) * (0.86 + 0.14 * Math.sin(b.ph * 0.7 + 1));
        ctx.drawImage(ball, b.x - r, b.y - r, r * 2, r * 2);
      }
      ctx.globalAlpha = 1;
    }
    resize();
    let timer; window.addEventListener("resize", () => { clearTimeout(timer); timer = setTimeout(resize, 150); });
    window.addEventListener("pointermove", (e) => { mx = e.clientX; my = e.clientY; }, { passive: true });
    requestAnimationFrame(frame);
  }

  /* A small microgravity flame that follows the pointer: a blue shell with no "up", which trails
     behind when the pointer moves. Mouse only; touch screens and reduced-motion get nothing. */
  function cursor() {
    if (reduce || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    const canvas = document.createElement("canvas");
    canvas.setAttribute("aria-hidden", "true");
    canvas.style.cssText = "position:fixed;left:0;top:0;width:100vw;height:100vh;z-index:80;pointer-events:none";
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const halo = sprite([70, 140, 255]);
    let W = 0, H = 0, dpr = 1, tx = 0, ty = 0, x = 0, y = 0, inside = false, seen = false;
    let parts = [], raf = 0, heat = 0, box = null;
    function resize() {
      dpr = Math.min(2, window.devicePixelRatio || 1);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr; box = null;
    }
    function frame() {
      raf = 0;
      const dx = tx - x, dy = ty - y, speed = Math.hypot(dx, dy);
      x += dx * 0.24; y += dy * 0.24;
      heat = lerp(heat, inside ? 1 : 0, 0.1);
      if (inside) {
        const n = 3 + Math.min(4, Math.floor(speed / 14));  // moving through air feeds the flame
        for (let i = 0; i < n; i++) {
          const [ux, uy] = onSphere(), shell = 9 * (0.9 + Math.random() * 0.2), out = 0.07 + Math.random() * 0.13;
          parts.push({ x: x + ux * shell, y: y + uy * shell, vx: ux * out, vy: uy * out,
                       age: 0, life: 30 + Math.random() * 34, s: 7 + Math.random() * 5 });
        }
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.globalCompositeOperation = "source-over"; ctx.globalAlpha = 1;
      if (box) ctx.clearRect(box[0], box[1], box[2] - box[0], box[3] - box[1]); else ctx.clearRect(0, 0, W, H);
      let x0 = x - 48, y0 = y - 48, x1 = x + 48, y1 = y + 48;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = 0.2 * heat;
      ctx.drawImage(halo, x - 44, y - 44, 88, 88);
      const alive = [];
      for (const p of parts) {
        if (++p.age > p.life) continue;
        const k = p.age / p.life, size = p.s * lerp(1.05, 0.55, k);
        p.x += p.vx; p.y += p.vy;
        ctx.globalAlpha = Math.sin(Math.PI * k) * 0.2;
        ctx.drawImage(sprite(ramp(BLUE, k)), p.x - size, p.y - size, size * 2, size * 2);
        x0 = Math.min(x0, p.x - size); y0 = Math.min(y0, p.y - size); x1 = Math.max(x1, p.x + size); y1 = Math.max(y1, p.y + size);
        alive.push(p);
      }
      parts = alive;
      box = [Math.floor(x0) - 2, Math.floor(y0) - 2, Math.ceil(x1) + 2, Math.ceil(y1) + 2];
      if (inside || parts.length || heat > 0.01) raf = requestAnimationFrame(frame);
    }
    const kick = () => { if (!raf && !document.hidden) raf = requestAnimationFrame(frame); };
    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("pointermove", (e) => {
      if (e.pointerType === "touch") return;
      tx = e.clientX; ty = e.clientY;
      if (!seen) { x = tx; y = ty; seen = true; }
      inside = true; kick();
    }, { passive: true });
    document.documentElement.addEventListener("pointerleave", () => { inside = false; });
    window.addEventListener("blur", () => { inside = false; });
    document.addEventListener("visibilitychange", kick);
  }

  /* Page-wide atmosphere: stars, drifting flame balls, and the pointer flame. */
  function ambient(starCanvas) {
    stars(starCanvas);
    drift(starCanvas.parentElement);
    cursor();
  }

  window.FFFlame = { Flame, stars, drift, cursor, ambient };
})();
