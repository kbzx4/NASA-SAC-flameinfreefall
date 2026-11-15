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

**CFI-G (PSI-159, "Normal Flames" table).** 179 tests. Oxygen is "XO2 before test". Outcome combines "Hot ignition" and "Self-ext or flow term" (SE = self-extinguished, FT = flow terminated). This table reaches about 40% oxygen; the tests up to 85% that the challenge statement mentions are in the Inverse Flames table below.

**ACME Flame Design (PSI-10, "Normal Flame" table).** 207 tests. Oxygen is "XO2 (init)", pressure "pinit". "RAMPED" cells are kept as text.

**CFI-G inverse flames (PSI-159, "Inverse Flames" table).** 154 tests; the PSI table view pads the file with 862 empty lines, which are dropped. In an inverse flame, oxygen (diluted with nitrogen) flows out of the spherical burner into a chamber of fuel and nitrogen. The surrounding gas holds no oxygen, so `o2_pct`, `o2_min` and `o2_max` stay empty and the burner's oxygen (XO2, 12 to 85%) goes in `o2_supply_pct`. These tests are not placed on the Atmosphere map and are not used by the models. Hot ignition is read case-insensitively ("Yes", "yes"); "flash" is kept as listed.

**ACME Flame Design inverse flames (PSI-10, "Inverse Flame" table).** 120 tests, ethylene in the chamber, 21 to 85% oxygen from the burner, handled as above. The table lists no outcome.

**ACME CLD Flame (PSI-21).** One line per test day: fuel bottle, fuel dilution range and flames ignited. No oxygen, pressure or outcome per flame.

**ACME s-Flame (PSI-23).** One line per test day. Oxygen is read from the "Atmosphere" cell ("~21% O2 with N2"); the "~" is dropped as elsewhere. The table notes the chamber is about 1 atm, with pressure rising and oxygen falling as products build up; no per-line pressure is stored.

**SPICE (PSI-107).** 469 lines, one per flame setting: fuel, nozzle, fuel rate and coflow air speed (stored as airflow, cm/s). The table lists no oxygen, pressure or outcome. 34 lines repeat an earlier line exactly; they are scattered through the table, not at page boundaries, and are kept as listed. Air rates listed below zero are kept as source text and not used as a speed.

The five tables above were read from the experiment-table view on each PSI investigation page on Nov 15, 2026, which shows the same CSV files offered for download.

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

## NASA technical reports (data/reports)

These tables are not in PSI. They were transcribed from NASA reports on the NASA Technical Reports Server (NTRS) by Claude, the SI coding assistant, reading the rendered report pages, and are kept out of `data/catalog.csv`: the findings, models and SI texts do not use them. `scripts/build_reports.py` reads them for the site.

- Every row names its source (`sources.csv`) and the table and page it came from. Cells are as printed; where a report gives only a figure, no number is read off the figure.
- **Saffire IV to VI** (`saffire.csv`). Conditions from Table 1 of ICES-2021-266 (IV-1, IV-2, V-2, V-3, V-4) and Table 1 of ICES-2024-365 (VI-2, VI-3, VI-4). Burn duration, heat release and CO2 and CO rise from Table 2 of ICES-2024-365; flame sizes from Table 2 of ICES-2021-266. Heat release is the average from fuel-consumption calorimetry where that is all the table gives (IV-1, V-2) and the peak from oxygen-consumption calorimetry otherwise; the column says which. Outcomes are summarised from the paper text. Saffire IV and V flew on Cygnus NG-13 (May 2020) and NG-14 (January 2021); the Saffire VI paper does not give its flight date, so none is stated. kPa is converted to psi at 14.6959/101.325.
- **SSCE** (`ssce.csv`). The four thin-fuel flights (ashless filter paper, 0.165 mm thick) and their spread rates are from N93-20206, p. 2, which gives the 35% flight (STS-50/USML-1) as 1.5 atm. A later report says thin samples spread steadily at 35% and 1 atm, citing an earlier paper; that may be a fifth flight, but no spread rate for it was found, so it is not included. The three PMMA flights are from the thick-fuel report, which shows spread only in a figure; their spread rate is left empty.
- **Partial gravity** (`partial_gravity.csv`). Table I of Olson and Ferkul (ICES 2012), which reprints the Moon-gravity values from Ferkul and Olson (2011). ULOI is the lowest oxygen at which the flame burned for the whole drop; MOC is the highest at which it went out (in 1g, the NASA-STD-6001 definitions). The microgravity rows had a 30 cm/s airflow. `g` is used only to order the columns (Moon taken as 0.165 g). The report's oxygen margins (its Eq. 1) are recomputed in the build and must match the printed values.
- **White Sands, 10.2 psi** (`wstf_10psi.csv`). Table 2 of Hirsch et al. (2007), at 70.1 kPa, Earth gravity, NASA-STD-6001 Test 1. Bounds such as "<30" and ">40" are kept as bounds; "*" marks MOCs the report says passed on 5 samples. A material "kept burning" at an oxygen level above its MOC; "<30" means it failed even at 30%, the lowest level run. Nomex HT90-40 appears four times because the report tested it in four layouts.
- **White Sands, 99.8% oxygen** (`wstf_pure_oxygen.csv`). Tables 1 and 2 of Hirsch et al. (2010). ULPI is the pressure at which a material passes about half the time; MTP is the highest pressure at which every sample (at least five) went out. The site quotes the report's conclusion that the materials become flammable in oxygen between 0.4 and 0.9 psia.
- On the Atmosphere map, the Saffire and SSCE tests are drawn as squares and counted separately from the PSI tests, with the same "near" rule (2 points of oxygen, 25% of pressure). Saffire VI (7.8 to 8.0 psi) falls just outside 25% of both the Moon-base (10.2 psi) and exploration (8.2 psi, but 3 points of oxygen away) atmospheres, so it is not counted near either.

## The cabin-air model (estimates from NASA's published limits, not test data)

The "Choose the air" view, the air line on each briefing and the home page's trade-off chart combine three things. The functions are in `docs/assets/logic.js` (`airAt`, `prebreathe`, `pio2`, `airCorner`, `suitFor`, `budgetCorner`, `minutesTo`).

- **Decompression.** NASA's R index is the nitrogen tension in the 360-minute half-time tissue divided by the suit pressure. After days in a cabin, that tension is taken as the cabin's nitrogen partial pressure, pressure × (1 − oxygen fraction); other gases are ignored. Breathing pure oxygen it decays with a 360-minute half-time, so the prebreathe to reach a limit R_max is 360 ÷ ln 2 × ln(R ÷ R_max) minutes. Limits: 1.65, at which NASA accepted the Shuttle and ISS prebreathe protocols (Gernhardt et al., NASA EVA operations, 2013), and 1.275, a stricter limit set so the model gives NASA's 2024 planetary estimate of about 6.5 hours from sea-level air (NTRS 20240014714).
- **Breathing.** Inspired oxygen PIO2 = oxygen fraction × (cabin pressure − 47 mmHg). The floor is 127 mmHg: the Shuttle's staged denitrogenation (10.2 psi, 26.5%) and NASA's exploration atmosphere (8.2 psi, 34%, 128 mmHg; Aerospace Medicine and Human Performance 89(9), 2018). The altitude shown is where Earth's standard atmosphere, at 20.95% oxygen, gives the same PIO2.
- **Fire.** The FLEX droplet model (3 mm droplets, nitrogen only). Its tests ran at 10.1 to 44.8 psi, so the chart extrapolates below 10.1 psi; the 50-50 points move by under 0.3 points of oxygen between 14.7 and 8.2 psi.
- **Checks** (`node tests/air.mjs`): 256 minutes from ISS air (NASA's resting protocol: 240); 128.2 mmHg at 8.2 psi and 34% (NASA: 128); 127.3 mmHg for the Shuttle's 10.2 psi and 26.5%; with the stricter limit, the least-oxygen no-prebreathe cabin at 33.5% and 8.2 psi (NASA chose 34% and 8.2 psi). Only the 6.5-hour figure was used to set the stricter limit.
- **Suits and short prebreathes.** The least-oxygen cabin for a prebreathe budget of t minutes is `airCorner` with the R limit raised by 2^(t/360); `minutesTo` finds the budget that reaches an oxygen level. The 5.8 psi suit is Russia's Orlan, from NASA NESC, *Solving the Pressure Problem* (prebreathe history: the Orlan's 5.8 psi, and the 5.8 psi Shuttle-suit proposal turned down on cost), https://nescacademy.nasa.gov/downloadFile/1269. That document also records a proposal to raise the Shuttle suit to 5.8 psi with an 11.8 psi cabin (R 1.6, no prebreathe); the model's 5.8 psi no-prebreathe cabin is 12.2 psi, which `tests/air.mjs` checks.
- **Simplified on purpose.** One tissue compartment, at rest. NASA's protocols also use exercise, staged pressures and in-suit prebreathe, and its current risk models differ. Not medical or operational guidance.
