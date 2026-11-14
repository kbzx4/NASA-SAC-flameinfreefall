# Flamebound

**Describe a crewed habitat. See what NASA's microgravity fire experiments say about it, and how close those tests come to your conditions.**

Built for the NASA International Space Apps Challenge 2026, challenge [Flame in Freefall: SI-Powered Fire Safety Insights from Microgravity Combustion Data](https://www.spaceappschallenge.org/2026/challenges/flame-in-freefall/).

Flamebound is an evidence summary, not a safety assessment. It reports which NASA tests exist near a set of conditions. It does not predict whether a material will burn.

## The problem

NASA's Physical Science Informatics (PSI) archive holds decades of microgravity combustion results. They sit in separate tables with different units and free-text cells, so it is hard to tell how close any of them comes to a new habitat design. Moon bases and pressurized rovers are expected to run at 30% oxygen or more, and the archive has no combustion data in Moon or Mars gravity.

## What it does

1. **You describe a habitat**: oxygen, pressure, airflow, gravity, and the materials on board.
2. **It grades the evidence for each material**: flame-tested near your oxygen level, tested but not near it, smoke tests only, or not tested.
3. **It shows the gravity bound.** NASA's Saffire-II experiment burned the same materials in orbit and on the ground. The challenge statement says those two results could bound what happens at intermediate gravity. Flamebound shows where that bound is tight and where it is wide open.
4. **It ranks and compares investigations** by how close their test conditions come to yours.
5. **You download a brief** and the exact test records behind it, with units harmonised and NASA's original text beside every converted value.

## Two scores, both shown with their formulas

| Score | Formula | What it means |
|---|---|---|
| Gravity Sensitivity Index | `GSI = \|L_1g − L_µg\| ÷ L_sample` (L is burn length) | 0: microgravity and normal gravity agree. 1: the sample burned fully in one and not at all in the other. |
| Habitat Fire Relevance Index | `HFRI = M_conditions × M_fuel × W_evidence` | How close an investigation's tests come to your conditions. A condition the NASA table does not list counts as 0. |

Neither score predicts flammability.

## What the data shows

- Gravity changed the outcome for 4 of 9 Saffire-II samples. Thin silicone did not burn in microgravity and burned completely in normal gravity. Cotton-fiberglass fabric burned completely in both.
- In the 16 investigations loaded, no solid-material flame test lists an oxygen level above 22.2%. Liquid-droplet tests reach 34% and gas-flame tests 40%.
- No loaded investigation ran in partial gravity.

## NASA data used

1,196 records from 16 PSI experiment tables: Saffire I, II and III, BASS, BASS-II, FLEX, FLEX-2, CFI, CFI-G, ACME Flame Design, ACME BRE, ACME E-FIELD Flames, SLICE, SAME, SAME-R and DAFT. The site's "Data and method" page lists each table with a link to its PSI record. The raw tables are in [data/raw](data/raw), the harmonised table in [data/catalog.csv](data/catalog.csv), and every cleaning decision in [DATA_NOTES.md](DATA_NOTES.md).

Source: [NASA Physical Science Informatics](https://psi.nasa.gov/physci/repo/search?q=combustion).

## How SI is used

| Tool | Used for |
|---|---|
| Gemini 3.1 Flash Lite | Wrote the short interpretation on each material card and the two-sentence summary of each investigation, from facts computed by code. |
| Gemma 4 31B | Re-read each of those sentences against the facts and flagged unsupported ones for removal. |
| Claude (Claude Code) | Wrote the data pipeline, the site code and the site and repository text, working with the team. |

Checks on the SI-written text:

1. Code looks up every number in a text in the facts it was written from, and removes any sentence containing a number that is not there.
2. A second model re-reads each remaining sentence against the facts and removes any it judges unsupported.

Neither check is proof. [data/si_cache.json](data/si_cache.json) holds every SI-written text the site shows, with the sentences each check removed. Grades, counts, rankings and charts are computed without SI.

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
python scripts/build_si.py          # optional; needs GEMINI_API_KEY in keys.env
python scripts/build_site.py        # catalog + SI text -> docs/assets/data.js
node tests/parity.mjs               # checks the site's JavaScript against the Python
```

An earlier Streamlit version of the tool is kept in `app.py` (`streamlit run app.py`).

## Layout

| Path | Contents |
|---|---|
| `docs/` | The site: `index.html` (home), `tool.html` (the tool), `assets/` |
| `data/raw/` | NASA PSI experiment tables, as downloaded |
| `data/catalog.csv` | One row per test, harmonised units, source text kept |
| `scripts/` | `build_catalog.py`, `build_si.py`, `build_site.py` |
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
