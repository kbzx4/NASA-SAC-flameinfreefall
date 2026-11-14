# Data notes

Every decision made in turning the NASA PSI experiment tables into `data/catalog.csv`. The code is `scripts/build_catalog.py`.

## Rules applied to every table

- One catalog row per test where the PSI table has one row per test. Where the table is a summary, one catalog row per table line, and `row_level` says so.
- A cell is left empty wherever the PSI table is silent. No value is estimated or filled from another source.
- Every converted number keeps its source text beside it (`o2_raw`, `pressure_raw`, `flow_raw`).
- Units: oxygen in % by volume, pressure in psi, airflow in cm/s.
- Conversions: 1 atm = 14.6959 psi; 1 bar = 14.5038 psi; 760 mmHg = 14.6959 psi; mole fraction × 100 = %.
- Where a cell gives a range (for example "21.5 - 21.7"), `o2_min` and `o2_max` hold the ends and `o2_pct` their midpoint.
- "~" (approximately) is dropped from the number and kept in the source-text column.
- PSI record links follow the address the four known DOIs redirect to: `https://psi.nasa.gov/physci/repo/data/investigations/PSI-<n>`.

## Material names

`material` is filled only when the fuel cell names a material. The rules are in `core.MATERIAL_RULES`: PMMA, SIBAL or cotton-fiberglass, silicone, Nomex, Kapton, Teflon, lampwick, Pyrell, dibutyl phthalate, Japan wax, paraffin wax, Ultem.

93 solid-fuel rows in BASS and BASS-II name a shape but no material (for example "1/4" clear rod", "2 cm sphere", "candle"). They are left without a material and are not counted for any material.

## By table

**Saffire-I (PSI-98).** Two burn tests kept. The two "pre-test flow visualisation" lines are dropped. Length and width are recorded as listed (40.6 × 94 cm); Saffire-III lists the same sample the other way round.

**Saffire-II (PSI-99).**
- Nine samples. Each gives one microgravity row and one "1g" row. The table states no oxygen, pressure or airflow for the 1g tests, so those cells are empty.
- The header reads "?-g" where "µ-g" was lost in export; read as microgravity.
- Blank material cells (samples 2-6 and 2-9) take the material of the row above, as in a merged spreadsheet cell.
- Thickness "037 mm" is shown as listed. It may mean 0.37 mm; it is not corrected.
- For the gravity chart, "Complete" is plotted as the full sample length (29 cm) and "~ 0" as 0.
- Sample 2-7 is PMMA (5 cm) followed by Nomex (24 cm). It is split into two chart rows. Source note 2 says the PMMA was consumed and the Nomex did not ignite. The 1g column covers the Nomex only, so the PMMA section has no 1g value and no GSI.
- Flow-visualisation lines and footnotes are dropped from the catalog; the footnotes are quoted in the site's caveats.

**Saffire-III (PSI-100).** Two tests. The table lists no oxygen, pressure or outcome.

**BASS-II (PSI-25).** 129 tests. Oxygen is the "calibrated initial O2" column. The table lists a fan display value, not an air speed, so airflow is empty and the fan value is kept as source text. No pressure and no outcome column.

**BASS (PSI-26).** 121 tests. One "SOOT Cleaning" line is dropped. The table lists only the sample; no oxygen, pressure, airflow or outcome.

**FLEX (PSI-69).**
- 274 tests. The composition headers read "O", "N", "CO", "He" where subscripts were lost; read as O2, N2, CO2 and He. A CO mole fraction of 0.7 would not be plausible, and the experiment added CO2 and helium.
- Test 114 lists a pressure of 0 mmHg; treated as missing.
- Outcome is the "Test end" column: Extinction, Completion or Disruption.

**FLEX-2 (PSI-68).** A test matrix per fuel, not one row per test. Ranges are stored as min and max.

**CFI (PSI-39).** 87 tests. Pressure cells such as "1 atm" are converted to psi.

**CFI-G (PSI-159, "Normal Flames" table).** 179 tests. Oxygen is "XO2 before test". Outcome combines "Hot ignition" and "Self-ext or flow term" (SE = self-extinguished, FT = flow terminated). This table reaches about 40% oxygen; the challenge statement mentions tests up to 85%, which are not in this table.

**ACME Flame Design (PSI-10, "Normal Flame" table).** 207 tests. Oxygen is "XO2 (init)", pressure "pinit". "RAMPED" cells are kept as text.

**ACME BRE (PSI-20).** One line per test day. Oxygen cells list several approximate levels ("21; 26.5; 40"); stored as min and max. Two cells read "3400%" and "2100%"; read as 34% and 21%, on the assumption that a spreadsheet percent format was applied to 34 and 21.

**ACME E-FIELD Flames (PSI-22).** One line per test day. Continuation lines that list extra fuel concentrations are merged into the day above. Test day 18319 appears twice in the source and is kept once.

**SLICE (PSI-106).** One line per test day; fuel mix only.

**SAME (PSI-102) and SAME-R (PSI-101).** Smoke-particle measurements from overheated materials, not flame tests. Fuel class "smoke source".

**DAFT (PSI-47).** Two dust-measurement sessions. Fuel class "dust". Nothing was burned.

## Not loaded

`PSI-117_Analyzed Data_ReadMe_List_of_Data.xlsx` is a list of analysed data files, not an experiment table, and is not in the catalog.

## Scores

- **HFRI.** Closeness per condition is 1 inside the tested range and falls linearly to 0 at 20 points of oxygen, 10 psi or 30 cm/s away. A condition the table does not list scores 0. Fuel match: 1 same class, 0.5 related (solid and smoke source; liquid and gas; smoke source and dust), 0.2 otherwise. Evidence weight: 1 for per-test tables, 0.6 for summaries. The ranges and weights are our choices, not NASA values.
- **Material grade.** "Near" means a flame test within 2 points of the habitat's oxygen level. Pressure is not used, because no solid-fuel table lists it.
- **Atmosphere counts.** FLEX and CFI-G tests within 3 points of the habitat's oxygen level.
