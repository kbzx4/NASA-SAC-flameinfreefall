// Checks the cabin-air model (prebreathe and breathing) against numbers NASA has published.
// Run from the project root:  node tests/air.mjs
import { readFileSync } from "node:fs";
import vm from "node:vm";

globalThis.window = globalThis;
for (const f of ["docs/assets/data.js", "docs/assets/logic.js"]) vm.runInThisContext(readFileSync(f, "utf8"));
const L = globalThis.FFLogic, A = L.AIR;
let n = 0, bad = 0;
const check = (what, got, want, tol) => { n++; const ok = Math.abs(got - want) <= tol; if (!ok) bad++; console.log(`${ok ? "ok  " : "FAIL"} ${what}: ${Math.round(got * 10) / 10} (NASA: ${want}, within ${tol})`); };

// 1. From ISS air, the Shuttle/ISS limit (R 1.65) should need about NASA's 4-hour resting prebreathe.
check("prebreathe from ISS air, minutes", L.prebreathe(21, 14.7, A.suit, A.rmax), A.nasa.protocol_min, 30);
// 2. NASA's exploration atmosphere gives about 128 mmHg of inspired oxygen.
check("inspired oxygen at 8.2 psi and 34%, mmHg", L.pio2(34, 8.2), A.nasa.exp.pio2, 1.5);
// 3. The Shuttle's staged denitrogenation (10.2 psi, 26.5%) gives about the same.
check("inspired oxygen at 10.2 psi and 26.5%, mmHg", L.pio2(26.5, 10.2), A.nasa.exp.pio2, 1.5);
// 4. With the stricter limit (matched only to 6.5 h from sea-level air), the cheapest no-prebreathe cabin
//    should land near the 8.2 psi and 34% oxygen NASA chose. This is not fitted: only the 6.5 h is.
const strict = L.airCorner(A.suit, A.rstrict, A.floor);
check("stricter limit: lowest no-prebreathe oxygen, %", strict.o2, A.nasa.exp.o2, 1);
check("stricter limit: its pressure, psi", strict.p, A.nasa.exp.p, 0.5);
// 5. Sea level breathes 149 mmHg of inspired oxygen, at 0 m.
check("inspired oxygen at 14.7 psi and 21%, mmHg", L.pio2(21, 14.7), 149.5, 1);
console.log(`${n - bad} of ${n} air-model checks against NASA's numbers pass`);
process.exit(bad ? 1 : 0);
