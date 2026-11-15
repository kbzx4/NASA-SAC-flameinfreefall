# Airburn

**Describe a crewed habitat. See what NASA's microgravity fire experiments say about it, how close those tests come to your conditions, and what its air costs: hours of prebreathe before every spacewalk, or air where small fires keep burning, unless the spacesuit changes.**

**Live site:** https://kbzx4.github.io/NASA-SAC-flameinfreefall/ · **30-second demo video:** https://kbzx4.github.io/NASA-SAC-flameinfreefall/demo.mp4

Built for the NASA International Space Apps Challenge 2026, challenge [Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/).

Airburn is an evidence summary, not a safety assessment. It reports which NASA tests exist near a set of conditions, and its models predict how NASA's droplet and gas-flame tests would end there, only within the conditions tested. It does not predict whether a cabin material will burn.

## The problem

NASA's Physical Science Informatics (PSI) archive holds decades of microgravity combustion results. They sit in separate tables with different units and free-text cells, so it is hard to tell how close any of them comes to a new habitat design. Moon bases and pressurized rovers are expected to run at 30% oxygen or more, and the PSI archive has no combustion data in Moon or Mars gravity.

## What it does

1. **You describe a habitat**: oxygen, pressure, airflow, gravity, and the materials on board.
2. **Choose the air.** For any cabin oxygen and pressure, and a suit pressure from today's 4.3 psi to the 8.2 psi of NASA's xEMU design, it shows how long the pure-oxygen prebreathe before a spacewalk is, how the oxygen compares with what NASA accepts, the chance a burning droplet goes out on its own, and the NASA tests nearby, on one chart with the crew atmospheres. Every Insights briefing carries the same numbers in one line.
3. **Atmosphere map.** Every microgravity test that lists oxygen and pressure (754) on one oxygen-against-pressure map, with the eight atmospheres crews have breathed or are planned to: Mercury to Apollo, Apollo 1, Skylab, the Shuttle, Mir and ISS cabin, the Shuttle before a spacewalk, a Moon base, NASA's exploration atmosphere, and the spacesuit. Four of the eight have no test within 2 points of oxygen and 25% of their pressure. Click a pin or anywhere on the map to check that atmosphere; live SI gets the same numbers and cites them as [map].
4. **It ranks what NASA's experiments found.** Code computes nine fire-safety findings from the NASA tables (how often droplet and gas flames went out on their own at each oxygen level, how long they burned at low oxygen, what CO2 and helium did, cool flames, what gravity changed, flame spread with and against the airflow, carbon monoxide from burning samples, and the smoke tests). They are ranked by how close their tests came to your habitat, with the result nearest your oxygen level picked out and charted.
5. **Fire model.** Models fitted to every FLEX droplet test (261) and every lit CFI-G gas flame (132) predict outcomes at your exact conditions, with a 90% range from 300 bootstrap refits: the chance a droplet flame goes out on its own, burns until the fuel is used up or disrupts; its burning rate; the oxygen level where going out on its own becomes a 50-50 chance; and the chance a lit gas flame goes out on its own. Checked on tests they never saw (5-fold cross-validation): droplet AUC 0.88, gas AUC 0.84. Whether a gas flame lights could not be predicted better than guessing, so the site does not predict it. Inputs beyond the tested range are flagged. A simulation draws 60 droplets from the model and plays them next to the real tests nearest your oxygen level.
6. **Test replay.** NASA's own FLEX droplet tests and CFI-G gas-flame tests replay side by side in time-lapse at two oxygen levels. Each droplet starts at its recorded size, shrinks by the d² law and ends at its recorded burn time the way the table says it ended (flame out with fuel left, burned to nothing, or disrupted); live counters tally the outcomes. The look of each flame is drawn, not measured.
7. **Ask Airburn (live SI).** Ask a question about your habitat, or have SI write a briefing for any values you set. Gemini 3.1 Flash Lite answers from the facts computed for that habitat only and cites the findings it used; the number check and a second model (Gemini 3.5 Flash Lite) run in the browser before the answer is shown.
8. **SI interprets each finding** for a crewed habitat: a headline, what the tests found, what it suggests, and its main limit, plus a briefing for each preset habitat and a computed list of what the data cannot tell you. You can filter the findings by fire type and search them.
9. **It grades the evidence for each material**: flame-tested near your oxygen level, tested but not near it, smoke tests only, or not tested.
10. **It shows the gravity bound.** NASA's Saffire-II experiment burned the same materials in orbit and on the ground. The challenge statement says those two results could bound what happens at intermediate gravity. Airburn shows where that bound is tight and where it is wide open.
11. **It ranks and compares investigations** by how close their test conditions come to yours.
12. **You download a brief** and the exact test records behind it, with units harmonised and NASA's original text beside every converted value.

## The formulas, each shown on the site

| Score | Formula | What it means |
|---|---|---|
| Gravity Sensitivity Index | `GSI = \|L_1g − L_µg\| ÷ L_sample` (L is burn length) | 0: microgravity and normal gravity agree. 1: the sample burned fully in one and not at all in the other. |
| Habitat Fire Relevance Index | `HFRI = M_conditions × M_fuel × W_evidence` | How close an investigation's tests come to your conditions. A condition the NASA table does not list counts as 0. |
| Finding relevance | `C_oxygen × ½ (1 + C_pressure) × W_tests` | How close the group of tests nearest your oxygen level comes to your habitat. Oxygen gates the score; an unlisted pressure halves it. W is 1 for 10 or more tests, 0.7 for fewer. |

| Decompression index (NASA's R) | `R = cabin nitrogen pressure ÷ suit pressure`; prebreathe `= 360 ÷ ln 2 × ln(R ÷ R_max)` minutes | NASA accepted the Shuttle and ISS prebreathe protocols at R_max = 1.65. Body nitrogen halves every 360 minutes on pure oxygen. An estimate from NASA's published limits, not test data. |
| Inspired oxygen | `PIO2 = oxygen fraction × (pressure − 47 mmHg)` | NASA's exploration atmosphere gives 128 mmHg; the site's floor is 127 mmHg. |

None of the scores predicts flammability.

## What the data shows

- **The trade-off: prebreathe against fire.** With today's 4.3 psi spacesuits, no cabin air below 27.6% oxygen lets a crew skip the pure-oxygen prebreathe before a spacewalk and still gives the oxygen NASA accepts for breathing. The burn line (below) is at 20.4 to 23.4%. So the air that spares the prebreathe is air where most small droplet fires keep burning. Two ways back: a 5.8 psi suit, the pressure of Russia's Orlan, needs no prebreathe from 21.7% oxygen at 12.2 psi, inside the burn line (droplet flames go out on their own 67% of the time, against 14% at 27.6%); or 1 h 47 min of prebreathe in today's suits brings the cabin to 23.4% at 11.4 psi. The Shuttle suit's makers once proposed 5.8 psi to end the prebreathe, and NASA turned it down on cost. A suit dial under the home page's headline lets you drag the suit pressure and see the cabin air and, of 20 model droplets, how many go out on their own; a suit curve plots the same for every suit pressure from 4.3 to 6 psi, for methanol and heptane droplets, with the model's 90% range. Under the stricter limit below, the suit needs 6.9 psi. The prebreathe estimate gives 4.3 hours from ISS air, where NASA's resting protocol took 4 hours; with a stricter limit set only from NASA's 2024 estimate of 6.5 hours from sea-level air, the least-oxygen cabin with no prebreathe lands at 33.5% oxygen and 8.2 psi, next to the 34% and 8.2 psi NASA chose for exploration; and a 5.8 psi suit's no-prebreathe cabin sits at 12.2 psi, next to the 11.8 psi cabin of the 5.8 psi proposal (`node tests/air.mjs`).
- **The burn line (the self-extinction line).** Somewhere between ISS air and Moon-base air, flames stop putting themselves out. In FLEX tests with nothing added to the nitrogen, 17 of 32 burning droplets went out on their own at 20 to 21% oxygen, against 2 of 23 at 30 to 34%. A model fitted to 261 FLEX tests (AUC 0.88 on unseen tests) puts the 50-50 point at 20.4% oxygen for a 3 mm heptane droplet and 23.4% for methanol: right around the 21% oxygen astronauts breathe today. Pressure moves it by under 2 points. CFI-G gas flames point the same way. These are droplets and gas flames in a test chamber, not cabin materials.
- In FLEX, 58 of 84 droplet flames at 20 to 21% oxygen went out on their own before the fuel was used up; at 30 to 34% oxygen, 2 of 24 did.
- In CFI-G, every gas flame that lit at 18 to 23.4% oxygen went out on its own (median burn 8 s); at 33.2 to 40% oxygen, 30 of the 91 that lit burned until the fuel was cut off (median burn 50 s).
- At about 21% oxygen, 13 of 14 droplet flames went out on their own with helium added and 28 of 36 with CO2 added, against 17 of 34 with nitrogen only.
- In BASS-II, carbon monoxide rose in 117 of 118 burns, by up to 575 ppm.
- Gravity changed the outcome for 4 of 9 Saffire-II samples. Thin silicone did not burn in microgravity and burned completely in normal gravity. Cotton-fiberglass fabric burned completely in both.
- In the PSI tables loaded, no solid-material flame test lists an oxygen level above 22.2%. Liquid-droplet tests reach 34% and gas-flame tests 40%.
- In the tables loaded here, all 754 microgravity tests that list both the oxygen of the surrounding air and the pressure sit at 40% oxygen or less and 7.35 psi or more (the 274 inverse-flame tests of ACME CFI-G and Flame Design fed up to 85% oxygen, but out of the burner into fuel and nitrogen, so they are not placed by surrounding air). The atmospheres of Mercury to Apollo (100%, 5 psi), Apollo 1 (100%, 16.7 psi), Skylab (about 74%, 5 psi) and the spacesuit (100%, 4.3 psi) have no test near them; the nearest is 35 to 61 points of oxygen away.
- No PSI investigation ran in partial gravity.

### From NASA technical reports, beyond the PSI tables

Seven NASA reports on the Technical Reports Server hold results the PSI tables do not. The Insights page ranks them by how close their tests came to the habitat, and leads with them when no PSI test is within 20 points of its oxygen, as for a spacesuit or Skylab-like air. Their tables were transcribed into [data/reports](data/reports) by Claude, the SI coding assistant, from the rendered report pages, each row naming its report, table and page, and are shown beside the PSI results, never mixed into the catalog, the findings, the models or the SI texts.

- **Solids in orbit above 22.2% oxygen, with pressure.** Saffire IV to VI burned fabric and PMMA in a Cygnus cargo spacecraft at up to 31% oxygen and 7.8 psi (Saffire VI, between the Moon-base plan of 30% at 10.2 psi and the exploration plan of 34% at 8.2 psi). Cotton jersey at 26.2% oxygen and 10.3 psi kept burning through 70 s with the fan off and burned until the sample was used up. The two PMMA fires on Saffire VI raised the spacecraft's CO2 past NASA's 1-hour limit, and a tight smoke-alarm threshold was reached only at 981 s, after much of the hazardous gas was out (Urban et al., ICES-2021-266 and ICES-2024-365).
- **Solids in orbit at 35 to 70% oxygen.** The Space Shuttle's Solid Surface Combustion Experiment spread flames over paper at 0.358, 0.454 and 0.547 cm/s at 50% oxygen and 1, 1.5 and 2 atm, and 0.092 cm/s at 35% and 1.5 atm; thick PMMA kept burning at 50 and 70% (Altenkirch et al.).
- **Moon and Mars gravity.** In NASA Glenn drop-tower tests with a centrifuge, Mylar, Ultem 1000 and Nomex HT90-40 all kept burning at lower oxygen at Moon gravity than on Earth or in microgravity; Mylar's limit fell 5.75 points. Nomex and Ultem went out at 21% oxygen in Earth gravity but kept burning at 21% at Moon gravity. So for these materials' oxygen limits, microgravity and Earth results did not bound Moon gravity (Olson and Ferkul, ICES 2012, Table I). Drop tests last about 5 seconds.
- **NASA's standard material test at these atmospheres, Earth gravity.** At 10.2 psi, 7 of 26 material setups kept burning at 30% oxygen (Moon-base air) and 9 at 34%. In 99.8% oxygen, all 7 materials tested became flammable above 0.4 to 0.9 psi; a US spacesuit runs at 4.3 psi (Hirsch et al., NASA White Sands, 2007 and 2010).

## NASA data used

1,989 records from 21 PSI experiment tables across 19 PSI investigations: Saffire I, II and III, BASS, BASS-II, FLEX, FLEX-2, CFI, CFI-G (normal and inverse flames), ACME Flame Design (normal and inverse flames), ACME BRE, ACME E-FIELD Flames, ACME CLD Flame, ACME s-Flame, SLICE, SPICE, SAME, SAME-R and DAFT. The site's "Data and method" page lists each table with a link to its PSI record. The raw tables are in [data/raw](data/raw), the harmonised table in [data/catalog.csv](data/catalog.csv), and every cleaning decision in [DATA_NOTES.md](DATA_NOTES.md).

Source: [NASA Physical Science Informatics](https://psi.nasa.gov/physci/repo/search?q=combustion).

Cabin-air limits (published numbers, used as constants): NASA accepted the Shuttle and ISS prebreathe protocols at R = 1.65 ([Gernhardt et al., NASA EVA operations, 2013](https://nasa.gov/wp-content/uploads/2023/03/gernhardt-eva-ops-chp-5.4-2013.pdf)); the 8.2 psi, 34% oxygen exploration atmosphere gives 128 mmHg of inspired oxygen ([Aerospace Medicine and Human Performance 89(9), 2018](https://asma.kglmeridian.com/downloadpdf/view/journals/amhp/89/9/article-p792.pdf)); about 6.5 hours of prebreathe from sea-level air in NASA's 2024 planetary estimate ([NTRS 20240014714](https://ntrs.nasa.gov/citations/20240014714)); suit pressures of 4.3 and 8.2 psi ([NTRS 20170010132](https://ntrs.nasa.gov/citations/20170010132)). Suit pressures: [NASA NESC, Solving the Pressure Problem](https://nescacademy.nasa.gov/downloadFile/1269) (the Orlan runs at 5.8 psi; the Shuttle suit's makers proposed 5.8 psi with an 11.8 psi cabin, R 1.6, no prebreathe; turned down on cost).

## How SI is used

| Tool | Used for |
|---|---|
| Gemini 4 Hydrogen | Interpreted each of the nine findings (headline, what the tests found, what it suggests for a crewed habitat, its limit) and wrote the briefing for each preset habitat, from facts computed by code. |
| Gemini 3.5 Flash Lite | Second pass on those texts: re-read every sentence against the facts and flagged any that stated something the facts do not hold, claimed cause and effect, or overstated them. Also the second pass on the material notes and investigation summaries below. |
| Gemini 3.1 Flash Lite | Worded the short note on each material card and the summary of each investigation. Code works out every finding first (counts, gaps, what gravity changed); the model only turns the findings into sentences. |
| Gemini 3.5 Flash Lite | Second pass: re-read each of those sentences against the facts and flagged unsupported ones for removal. When it did not answer, Gemma 4 31B or Gemini 3.1 Flash Lite (in a fresh pass) was used instead. `data/si_cache.json` records which model re-read each text. |
| Claude (Claude Code) | Wrote the data pipeline, the site code and the site and repository text, working with the team. |

Checks on all SI text:

1. Code looks up every number in a text in the facts it was written from, and removes any sentence containing a number that is not there.
2. A second SI pass re-reads each remaining sentence against the facts and removes any it judges unsupported.

Neither check is proof. [data/insight_cache.json](data/insight_cache.json) and [data/si_cache.json](data/si_cache.json) hold every SI text the site shows, with what each check removed, and every text was also read in full after it was generated. Findings, grades, counts, rankings and charts are computed without SI.

## Run it

The site is static. From the project root:

```
python -m http.server 8600 --directory docs
```

Then open http://127.0.0.1:8600.

To rebuild the data from the raw NASA tables:

```
pip install -r requirements.txt
python scripts/build_catalog.py     # raw tables -> data/catalog.csv
python scripts/build_findings.py    # findings and their ranking -> data/findings.json
python scripts/build_si.py          # optional; needs GEMINI_API_KEY in keys.env
python scripts/build_insights.py    # optional; SI interpretation of the findings
python scripts/build_models.py      # fits, cross-validates and bootstraps the Fire model -> data/models.json
python scripts/build_site.py        # catalog + SI text -> docs/assets/data.js
node tests/parity.mjs               # checks the site's JavaScript against the Python
node tests/air.mjs                  # checks the cabin-air model against NASA's published numbers
```

Live SI needs a Gemini key. Either deploy [proxy/gemini-proxy.gs](proxy/gemini-proxy.gs) as a Google Apps Script web app (the key stays on Google's side; setup steps are at the top of the file) and put its URL in `docs/assets/config.js` as `FF_AI.proxy`, or let visitors paste their own key, which stays in their browser.

An earlier Streamlit version of the tool is kept in `app.py` (`streamlit run app.py`).

## Layout

| Path | Contents |
|---|---|
| `docs/` | The site: `index.html` (home), `tool.html` (the tool), `assets/` |
| `data/raw/` | NASA PSI experiment tables, as downloaded |
| `data/catalog.csv` | One row per test, harmonised units, source text kept |
| `data/reports/` | Result tables transcribed from NASA technical reports, with sources |
| `scripts/` | `build_catalog.py`, `build_findings.py`, `build_models.py`, `build_si.py`, `build_insights.py`, `build_reports.py`, `build_site.py` |
| `core.py`, `brief.py`, `si.py` | Scores, evidence logic, SI calls and checks |
| `tests/parity.mjs` | Fails if the site's JavaScript and the Python disagree |
| `tests/air.mjs` | Fails if the cabin-air model drifts from NASA's published prebreathe and oxygen numbers |

## Limits

- 21 PSI experiment tables are loaded: every experiment table PSI offers for its flight combustion investigations, as of Nov 15, 2026. A ground-based cool-flame study (PSI-142) has a summary table that is not loaded.
- The NASA report tables were typed in from the reports' pages by an SI assistant (Claude). Each row names its table and page, and the build recomputes the oxygen margins printed in the partial-gravity report, but other cells could still hold a copying error.
- No solid-fuel table lists pressure, so the material grade uses oxygen only.
- BASS and BASS-II list a fan setting or nothing for airflow, not a speed.
- 93 solid-fuel records name a shape but no material (for example "1/4" clear rod") and are not assigned to a material.
- The gravity bound rests on 9 samples at one oxygen level and one airflow, and the PSI table does not state the conditions of the normal-gravity tests.
- The cabin-air numbers are estimates from NASA's published limits, not test data: one body tissue, at rest, with the cabin's nitrogen in equilibrium. NASA's protocols also use exercise and staged pressures, and its current risk models are stricter (the stricter limit approximates them). Not medical or operational guidance.
- The hero flame on the home page is an illustration, not a simulation.

## Licence and credits

Code: MIT, see [LICENSE](LICENSE). Data: NASA Physical Science Informatics. Fonts: Space Grotesk, Inter and JetBrains Mono, from Google Fonts under the SIL Open Font License.

Not affiliated with or endorsed by NASA.
