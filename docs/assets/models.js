/* Fire model: predictions from the models scripts/build_models.py fitted to NASA's FLEX and CFI-G tests.

   Each model is evaluated with its full fit (the answer) and with its 300 bootstrap refits (the
   uncertainty: the middle 90% of their answers). Inputs are standardised with the training means
   and scales. tests/parity.mjs checks these predictions against the Python that fitted them. */
(function (root) {
  "use strict";
  const sig = (v) => 1 / (1 + Math.exp(-v));
  const z = (m, x) => x.map((v, i) => (v - m.mu[i]) / m.sd[i]);
  const dot = (w, zz) => w[0] + zz.reduce((a, v, i) => a + v * w[i + 1], 0);

  function probs(rows, zz) {
    if (rows.length === 1) return [sig(dot(rows[0], zz))];
    const l = rows.map((r) => dot(r, zz)), top = Math.max(...l), e = l.map((v) => Math.exp(v - top)), s = e.reduce((a, b) => a + b, 0);
    return e.map((v) => v / s);
  }
  function q(arr, p) { const a = [...arr].sort((x, y) => x - y); const i = (a.length - 1) * p, lo = Math.floor(i); return a[lo] + (a[Math.min(a.length - 1, lo + 1)] - a[lo]) * (i - lo); }

  /* classifier: {fit: [p per class], lo: [...], hi: [...]} */
  function classify(m, x) {
    const zz = z(m, x), fit = probs(m.fit, zz), boots = m.boot.map((b) => probs(b, zz));
    return { fit, lo: fit.map((_, k) => q(boots.map((b) => b[k]), 0.05)), hi: fit.map((_, k) => q(boots.map((b) => b[k]), 0.95)), boots };
  }
  /* burning rate in mm^2/s: {fit, lo, hi} */
  function rate(m, x) {
    const zz = z(m, x), boots = m.boot.map((b) => Math.exp(dot(b, zz)));
    return { fit: Math.exp(dot(m.fit, zz)), lo: q(boots, 0.05), hi: q(boots, 0.95) };
  }

  /* droplet inputs in model order: oxygen %, CO2 %, helium %, pressure atm, diameter mm, heptane 0/1 */
  function dropletX(o2, gas, psi, d0, fuel) {
    return [o2, gas === "CO2" ? 20 : 0, gas === "He" ? 20 : 0, psi / 14.6959, d0, fuel === "Heptane" ? 1 : 0];
  }
  /* gas inputs: oxygen %, pressure bar, fuel mole fraction, fuel flow mg/s, propane, butane */
  function gasX(o2, psi, xf, m, fuel) {
    return [o2, psi / 14.5038, xf, m, fuel === "propane" ? 1 : 0, fuel === "butane" ? 1 : 0];
  }

  /* outside what the model was trained on: list of [name, value, [lo, hi]] */
  function outside(range, names, x, labels) {
    return names.map((n, i) => [labels[i], x[i], range[n]]).filter(([, v, r]) => r && (v < r[0] - 1e-9 || v > r[1] + 1e-9));
  }

  /* n simulated droplets drawn from the model at one set of conditions. Each takes a random
     bootstrap refit (so the spread reflects the model's uncertainty), a burning rate with the
     model's scatter, and an ending drawn from that refit's probabilities. */
  function simulate(M, x, n, seed) {
    let s = seed || 1;
    const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
    const gauss = () => Math.sqrt(-2 * Math.log(rnd() + 1e-12)) * Math.cos(2 * Math.PI * rnd());
    const E = M.ending, R = M.rate, out = [];
    for (let i = 0; i < n; i++) {
      const d0 = Math.max(0.8, x[4] * (1 + 0.08 * gauss()));
      const xi = x.slice(); xi[4] = d0;
      const b = Math.floor(rnd() * E.boot.length);
      const p = probs(E.boot[b], z(E, xi));
      const u = rnd(), end = u < p[0] ? "E" : u < p[0] + p[1] ? "C" : "D";
      const K = Math.exp(dot(R.boot[b % R.boot.length], z(R, xi)) + R.resid_sd * gauss());
      const ratio = M.ext_ratio[Math.floor(rnd() * M.ext_ratio.length)];
      const de = end === "C" ? 0 : d0 * ratio;
      out.push({ o2: x[0], fuel: x[5] ? "Heptane" : "Methanol", d0, de, t: (d0 * d0 - de * de) / K, end, gas: x[1] ? "CO2" : x[2] ? "He" : "N2", p: x[3] * 14.6959, id: "sim " + (i + 1), sim: true });
    }
    return out;
  }

  /* the oxygen level where the chance that the flame goes out on its own crosses 50%, for one set of
     coefficients; null if it does not cross between 5% and 100% oxygen */
  function crossing(m, rows, x, k) {
    const at = (o) => { const xi = x.slice(); xi[0] = o; return probs(rows, z(m, xi))[k] - 0.5; };
    let lo = 5, hi = 100;
    if (Math.sign(at(lo)) === Math.sign(at(hi))) return null;
    for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (Math.sign(at(mid)) === Math.sign(at(lo))) lo = mid; else hi = mid; }
    return (lo + hi) / 2;
  }
  function fiftyFifty(m, x, k) {
    const fit = crossing(m, m.fit, x, k), boots = m.boot.map((b) => crossing(m, b, x, k)).filter((v) => v != null);
    return fit == null ? null : { fit, lo: q(boots, 0.05), hi: q(boots, 0.95) };
  }

  root.FFModels = { classify, rate, dropletX, gasX, outside, simulate, probs, z, fiftyFifty };
})(typeof window !== "undefined" ? window : globalThis);
