# Flamebound

**Describe a crewed habitat. See what NASA's microgravity fire experiments say about it, and how close those tests come to your conditions.**

Built for the NASA International Space Apps Challenge 2026, challenge [Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/).

Flamebound is an evidence summary, not a safety assessment. It reports which NASA tests exist near a set of conditions. It does not predict whether a material will burn.

## The problem

NASA's Physical Science Informatics (PSI) archive holds decades of microgravity combustion results. They sit in separate tables with different units and free-text cells, so it is hard to tell how close any of them comes to a new habitat design. Moon bases and pressurized rovers are expected to run at 30% oxygen or more, and the archive has no combustion data in Moon or Mars gravity.

## What it does

1. **You describe a habitat**: oxygen, pressure, airflow, gravity, and the materials on board.
2. **It ranks what NASA's experiments found.** Code computes nine fire-safety findings from the NASA tables (how often droplet and gas flames went out on their own at each oxygen level, how long they burned at low oxygen, what CO2 and helium did, cool flames, what gravity changed, flame spread with and against the airflow, carbon monoxide from burning samples, and the smoke tests). They are ranked by how close their tests came to your habitat, with the result nearest your oxygen level picked out and charted.
3. **Fire model.** Models fitted to every FLEX droplet test (261) and every lit CFI-G gas flame (132) predict outcomes at your exact conditions, with a 90% range from 300 bootstrap refits: the chance a droplet flame goes out on its own, burns until the fuel is used up or disrupts; its burning rate; the oxygen level where going out on its own becomes a 50-50 chance; and the chance a lit gas flame goes out on its own. Checked on tests they never saw (5-fold cross-validation): droplet AUC 0.88, gas AUC 0.84. Whether a gas flame lights could not be predicted better than guessing, so the site does not predict it. Inputs beyond the tested range are flagged. A simulation draws 60 droplets from the model and plays them next to the real tests nearest your oxygen level.
4. **Test replay.** NASA's own FLEX droplet tests and CFI-G gas-flame tests replay side by side in time-lapse at two oxygen levels. Each droplet starts at its recorded size, shrinks by the d² law and ends at its recorded burn time the way the table says it ended (flame out with fuel left, burned to nothing, or disrupted); live counters tally the outcomes. The look of each flame is drawn, not measured.
5. **Ask Flamebound (live SI).** Ask a question about your habitat, or have SI write a briefing for any values you set. Gemini 3.1 Flash Lite answers from the facts computed for that habitat only and cites the findings it used; the number check and a second model (Gemini 3.5 Flash Lite) run in the browser before the answer is shown.
6. **SI interprets each finding** for a crewed habitat: a headline, what the tests found, what it suggests, and its main limit, plus a briefing for each preset habitat and a computed list of what the data cannot tell you. You can filter the findings by fire type and search them.
7. **It grades the evidence for each material**: flame-tested near your oxygen level, tested but not near it, smoke tests only, or not tested.
8. **It shows the gravity bound.** NASA's Saffire-II experiment burned the same materials in orbit and on the ground. The challenge statement says those two results could bound what happens at intermediate gravity. Flamebound shows where that bound is tight and where it is wide open.
9. **It ranks and compares investigations** by how close their test conditions come to yours.
10. **You download a brief** and the exact test records behind it, with units harmonised and NASA's original text beside every converted value.

## Three scores, each shown with its formula

| Score | Formula | What it means |
|---|---|---|
| Gravity Sensitivity Index | `GSI = \|L_1g − L_µg\| ÷ L_sample` (L is burn length) | 0: microgravity and normal gravity agree. 1: the sample burned fully in one and not at all in the other. |
| Habitat Fire Relevance Index | `HFRI = M_conditions × M_fuel × W_evidence` | How close an investigation's tests come to your conditions. A condition the NASA table does not list counts as 0. |
| Finding relevance | `C_oxygen × ½ (1 + C_pressure) × W_tests` | How close the group of tests nearest your oxygen level comes to your habitat. Oxygen gates the score; an unlisted pressure halves it. W is 1 for 10 or more tests, 0.7 for fewer. |

None of the scores predicts flammability.

## What the data shows

- In FLEX, 58 of 84 droplet flames at 20 to 21% oxygen went out on their own before the fuel was used up; at 30 to 34% oxygen, 2 of 24 did.
- In CFI-G, every gas flame that lit at 18 to 23.4% oxygen went out on its own (median burn 8 s); at 33.2 to 40% oxygen, 30 of the 91 that lit burned until the fuel was cut off (median burn 50 s).
- At about 21% oxygen, 13 of 14 droplet flames went out on their own with helium added and 28 of 36 with CO2 added, against 17 of 34 with nitrogen only.
- In BASS-II, carbon monoxide rose in 117 of 118 burns, by up to 575 ppm.
- Gravity changed the outcome for 4 of 9 Saffire-II samples. Thin silicone did not burn in microgravity and burned completely in normal gravity. Cotton-fiberglass fabric burned completely in both.
- In the 16 investigations loaded, no solid-material flame test lists an oxygen level above 22.2%. Liquid-droplet tests reach 34% and gas-flame tests 40%.
- No loaded investigation ran in partial gravity.

## NASA data used

1,196 records from 16 PSI experiment tables: Saffire I, II and III, BASS, BASS-II, FLEX, FLEX-2, CFI, CFI-G, ACME Flame Design, ACME BRE, ACME E-FIELD Flames, SLICE, SAME, SAME-R and DAFT. The site's "Data and method" page lists each table with a link to its PSI record. The raw tables are in [data/raw](data/raw), the harmonised table in [data/catalog.csv](data/catalog.csv), and every cleaning decision in [DATA_NOTES.md](DATA_NOTES.md).

Source: [NASA Physical Science Informatics](https://psi.nasa.gov/physci/repo/search?q=combustion).

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

Neither check is proof. [data/insight_cache.json](data/insight_cache.json) and [data/si_cache.json](data/si_cache.json) hold every SI text the site shows, with what each check removed, and every text was also read by hand. Findings, grades, counts, rankings and charts are computed without SI.

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
```

Live SI needs a Gemini key. Either deploy [proxy/gemini-proxy.gs](proxy/gemini-proxy.gs) as a Google Apps Script web app (the key stays on Google's side; setup steps are at the top of the file) and put its URL in `docs/assets/config.js` as `FF_AI.proxy`, or let visitors paste their own key, which stays in their browser.

An earlier Streamlit version of the tool is kept in `app.py` (`streamlit run app.py`).

## Layout

| Path | Contents |
|---|---|
| `docs/` | The site: `index.html` (home), `tool.html` (the tool), `assets/` |
| `data/raw/` | NASA PSI experiment tables, as downloaded |
| `data/catalog.csv` | One row per test, harmonised units, source text kept |
| `scripts/` | `build_catalog.py`, `build_findings.py`, `build_si.py`, `build_insights.py`, `build_site.py` |
| `core.py`, `brief.py`, `si.py` | Scores, evidence logic, SI calls and checks |
| `tests/parity.mjs` | Fails if the site's JavaScript and the Python disagree |

## Limits

- 16 PSI tables are loaded. PSI holds more.
- No solid-fuel table lists pressure, so the material grade uses oxygen only.
- BASS and BASS-II list a fan setting or nothing for airflow, not a speed.
- 93 solid-fuel records name a shape but no material (for example "1/4" clear rod") and are not assigned to a material.
- The gravity bound rests on 9 samples at one oxygen level and one airflow, and the PSI table does not state the conditions of the normal-gravity tests.
- The hero flame on the home page is an illustration, not a simulation.

## Licence and credits

Code: MIT, see [LICENSE](LICENSE). Data: NASA Physical Science Informatics. Fonts: Space Grotesk, Inter and JetBrains Mono, from Google Fonts under the SIL Open Font License.

Not affiliated with or endorsed by NASA.
