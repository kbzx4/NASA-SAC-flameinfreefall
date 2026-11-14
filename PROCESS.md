# Process log

How the project took shape, in order. Times are local (Asia/Kolkata).

## Nov 13, evening: preparation

- Read the challenge statement and listed the PSI investigations to download.
- Downloaded ten PSI experiment tables.
- First look at the data. Saffire-II turned out to list microgravity and normal-gravity burn lengths side by side. The challenge statement says the two "could bound what occurs at intermediate gravity levels", so this became the first candidate for a main chart.

## Nov 14, morning: data and a first version

- Built `data/catalog.csv`: one row per test, units harmonised, source text kept, nothing estimated.
- Built a first Streamlit dashboard: a gravity chart, a relevance ranking (HFRI), an oxygen coverage chart and a compare view.
- Changed HFRI so a condition the NASA table does not list scores 0. With a neutral 0.5, a table with no oxygen column outranked tables tested far from the scenario.

## Nov 14, late morning: finding the product

- Asked what would make this different from a ranked list plus a chatbot.
- Considered leading with "what should NASA test next". Re-read the challenge statement: it asks for a tool that summarises, ranks and interprets, and that helps users find relevant investigations, extract data for modelling and highlight research for safety equipment. It does not ask for gap-finding. Dropped that as the headline.
- Read the 2024 and 2025 Global Winner descriptions. Most winning tools give an answer for the user's own case, not a browser of data. Our first version handed the user a list.
- New product: describe a habitat and its materials, get a graded evidence brief to download.

## Nov 14, midday: the brief, and SI that is checked

- Built the evidence brief: a grade per material, the gravity comparison, droplet and gas-flame counts near the habitat's oxygen level, and downloads.
- Added SI-written interpretations with a number check: any sentence containing a number not found in the facts is removed.
- Downloaded six more PSI tables (BASS, CFI, ACME Flame Design, ACME BRE, ACME E-FIELD Flames, DAFT). The catalog grew from 741 to 1,196 records.

## Nov 14, afternoon: the site

- The Streamlit version looked unfinished, and free Streamlit hosting puts apps to sleep. Rebuilt the product as a static site with a home page and a tool page. The Python stays as the data pipeline.
- `tests/parity.mjs` checks that the site's JavaScript returns the same evidence, grades and rankings as the Python for every preset habitat.
- Home page hero: a flame that changes from a blue sphere to a teardrop as gravity goes from 0 to 1 g. It is labelled as an illustration, and the Moon and Mars positions say "no data".

## Nov 14, afternoon: what the number check missed

Reading every SI-written text showed that checking numbers is not enough. Errors that passed it:

- "10 tests within 0.2 points", where the facts said 10 tests within 2 points and a nearest gap of 0.2.
- "Arizona Road Dust was burned". DAFT measured dust; nothing burned.
- "BASS burned 33 solid fuels". The table has 33 distinct sample descriptions, not 33 fuels.
- A Nomex text that used the burn length of the PMMA half of a two-part sample.
- A pressure range said to miss a value it contains.

Changes made:

- Fact keys now say exactly what each number is.
- The two-part sample is split into its sections before the model sees it.
- Each investigation's facts now state whether anything was burned.
- The atmosphere texts were dropped; plain computed sentences already say the same thing.
- A second SI pass re-reads every sentence against the facts and removes unsupported ones. It was first set to use Gemma, which often returned server errors or took 20 seconds or more, so it now uses Gemini 3.5 Flash Lite, with Gemma and the writing model as fallbacks. The cache file records which model re-read each text.
- A later read of the texts found two more errors that both checks had passed: the fabric text said two samples "burned a different length" in microgravity and normal gravity when the whole sample burned in both ("29 cm" of a 29 cm sample, and "Complete"), and the BASS-II text said airflow varied and also that airflow was not listed. Code now states each finding as a finished clause (how many tests are near the habitat's oxygen level, what gravity changed and for how many samples, what each table lists and leaves out), and the model only joins the clauses into sentences. Letting the model infer anything, even "same" or "different" from two burn lengths, produced errors. The BASS-II facts now say that a fan setting is listed but no air speed.
- The site now says "numbers found in the data", not "checked", and states that neither check is proof.

## Still open

- The gravity bound assumes burning changes steadily with gravity. That is NASA's stated possibility, not a result in this data.
- The PSI table does not state the conditions of the Saffire-II normal-gravity tests. The Saffire-II paper should.
- The 85% oxygen CFI-G tests named in the challenge statement are in a table we have not loaded.
