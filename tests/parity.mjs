// Checks that the site's JavaScript gives the same results as the Python that built data.js.
// Run from the project root:  node tests/parity.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.window = globalThis;
for (const f of ["docs/assets/data.js", "docs/assets/logic.js", "docs/assets/models.js"]) vm.runInThisContext(readFileSync(f, "utf8"));
const { FF, FFLogic: L, FFModels: MD } = globalThis;

const sortKeys = (v) => Array.isArray(v) ? v.map(sortKeys)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, sortKeys(v[k])])) : v;
const same = (a, b) => JSON.stringify(sortKeys(a)) === JSON.stringify(sortKeys(b));

let checks = 0, failures = 0;
const fail = (msg, a, b) => { failures++; console.log("MISMATCH", msg, "\n  js:", JSON.stringify(a), "\n  py:", JSON.stringify(b)); };

for (const sc of FF.scenarios) {
  const exp = FF.expected[sc.name];
  FF.materials.forEach((m, i) => {
    const got = L.materialEvidence(FF, m, sc.o2);
    checks++;
    if (!same(got, exp.materials[i])) fail(`${sc.name} / ${m}`, got, exp.materials[i]);
  });
  const atm = L.atmosphereEvidence(FF, sc.o2);
  checks++;
  if (!same(atm, exp.atmosphere)) fail(`${sc.name} / atmosphere`, atm, exp.atmosphere);

  const rank = L.rankInvestigations(FF, sc.o2, sc.pressure, 10, "solid");
  const py = new Map(exp.ranking.map(([inv, hfri, why]) => [inv, { hfri, why }]));
  for (const r of rank) {
    checks++;
    const p = py.get(r.investigation);
    if (!p || Math.abs(p.hfri - r.hfri) > 0.0101 || p.why !== r.why) fail(`${sc.name} / rank ${r.investigation}`, [r.hfri, r.why], p);
  }
  checks++;
  if (rank[0].hfri !== exp.ranking[0][1]) fail(`${sc.name} / top score`, rank[0].hfri, exp.ranking[0][1]);

  const fr = L.rankFindings(FF, sc.o2, sc.pressure);
  checks++;
  if (!same(fr, exp.findings)) fail(`${sc.name} / findings ranking`, fr, exp.findings);
  const gp = L.gaps(FF, sc.o2, sc.pressure);
  checks++;
  if (!same(gp, exp.gaps)) fail(`${sc.name} / gaps`, gp, exp.gaps);
}
// model predictions: the site's JavaScript against the Python that fitted the models
const M = FF.models, near = (a, b) => Math.abs(a - b) < 1e-3;
for (const [x, want] of M.checks.ending) { checks++; const got = MD.classify(M.droplets.ending, x).fit; if (!got.every((v, i) => near(v, want[i]))) fail(`droplet ending ${x}`, got, want); }
for (const [x, want] of M.checks.rate) { checks++; const got = MD.rate(M.droplets.rate, x).fit; if (!near(got, want)) fail(`droplet rate ${x}`, got, want); }
for (const [x, want] of M.checks.self_ext) { checks++; const got = MD.classify(M.gas.self_ext, x).fit; if (!near(got[0], want[0])) fail(`gas self-ext ${x}`, got, want); }
console.log(`${checks - failures} of ${checks} checks match`);
process.exit(failures ? 1 : 0);
