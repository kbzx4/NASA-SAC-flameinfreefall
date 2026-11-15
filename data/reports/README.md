# NASA technical report data

Result tables from NASA reports on the NASA Technical Reports Server (NTRS), for results the PSI experiment tables do not hold. The site shows them beside the PSI results. They are never mixed into `data/catalog.csv`, the findings, the models or the SI texts.

**SI disclosure.** These tables were transcribed by Claude, the SI coding assistant that helped build this project. It read each report's rendered PDF pages and typed the values in. Each row names its report (`source`, a key into `sources.csv`) and the table and page it came from (`where`). `scripts/build_reports.py` recomputes the oxygen margins printed in the partial-gravity report from the transcribed limits, and the build stops if any disagree. Check a row against its linked report before relying on it.

| File | What it holds | NTRS |
|---|---|---|
| `sources.csv` | One row per report: citation, NTRS ID, link, and what was used | |
| `saffire.csv` | Saffire IV to VI: large solid-material fires in a Cygnus spacecraft, 22 to 31% oxygen | 20210011521, 20240002981 |
| `ssce.csv` | Space Shuttle SSCE: paper and PMMA burned in orbit at 35 to 70% oxygen | 19930011017, 19970020608 |
| `partial_gravity.csv` | Oxygen limits of three materials at Earth, Mars, Moon and microgravity, from drop-tower tests | 20130010991 |
| `wstf_10psi.csv` | NASA-STD-6001 Test 1 oxygen thresholds at 10.2 psi, Earth gravity | 20070018178 |
| `wstf_pure_oxygen.csv` | Pressure thresholds in 99.8% oxygen, Earth gravity | 20100015582 |

A 2026 abstract (NTRS 20260000646) is cited for context only; no values are taken from it.
