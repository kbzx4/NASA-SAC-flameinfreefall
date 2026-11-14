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

## Nov 14, evening: from evidence coverage to findings

Measured against the challenge sentence ("an interactive, SI-powered dashboard that summarizes, ranks and interprets those findings to deliver fire safety insights"), the build fell short. It reported how much evidence existed near a habitat, but not what the experiments found, and SI only reworded clauses that code wrote.

Changes made:

- `scripts/build_findings.py` computes nine findings from the tables' outcome columns: droplet flames going out on their own by oxygen level (FLEX), droplet burn times at low oxygen, CO2 and helium against nitrogen only, gas flames by oxygen level (CFI-G), cool flames, the Saffire-II gravity comparison, Saffire-I flame spread with and against the airflow, carbon monoxide from the BASS-II burns, and the SAME-R smoke runs. Each finding splits its tests into oxygen groups and lists what else varied between them.
- The findings are ranked for the user's habitat by how close the nearest group of tests comes to its oxygen level and pressure. The same ranking runs in Python and in the site's JavaScript, and `tests/parity.mjs` checks they agree.
- `scripts/build_insights.py` has a Gemini model interpret each finding (headline, what was found, what it suggests for a crewed habitat, its limit) and write a briefing for each preset habitat. A different model re-reads every sentence.
- First run: the second pass removed every "what it suggests" sentence, because the facts never mentioned habitats. The facts now carry a short context (closed cabins with fans moving the air; the challenge statement's 30% oxygen at 10.2 psi) and a list of design questions, and the second pass accepts a sentence that links a finding to them.
- Second run: the interpretations were correct but empty ("this points to the design question of what oxygen level to run the cabin at"). The prompt now asks what the result suggests would happen to a fire of that kind in a cabin, and why it bears on a design question, with a worked example for a different finding.
- The model is told the tests vary several things at once and must not claim cause and effect, and the second pass removes sentences that do.
- Third run: replies from Gemini 3 Flash were cut off mid-sentence (thinking used up the output limit), and one interpretation said droplet fires at 30 to 34% oxygen "may keep burning until the fuel is gone" when 18 of 24 of those tests ended with the droplet disrupted. Both checks passed it; reading found it. The output limit was raised, cut-off replies are now rejected, and a code-written caveat now states the disruption count.
- The free API tier allows 20 requests a day for the stronger Gemini models, and the reruns used them up. In a side-by-side test Gemini 4 Hydrogen wrote the most careful interpretation, so it wrote the final texts, with Gemini 3.5 Flash Lite as the second pass.
- Reading the final texts: the gas-flame facts said "the burner reached" a temperature, and the model wrote that a fire may "stay cooler"; the fact now says the burner hardware, not the flame. The cool-flame interpretation was removed by the second pass because "harder to see" was not in the facts; the definition now says so. The second pass removed the Spacesuit briefing's main gap sentence over the words "most important"; that briefing was regenerated once.
- One known stretch is left as written: the gas-flame interpretation says "30% oxygen or more" where the tests ran at 33.2 to 40%. The exact range sits beside it on the card.

## Still open

- The gravity bound assumes burning changes steadily with gravity. That is NASA's stated possibility, not a result in this data.
- The PSI table does not state the conditions of the Saffire-II normal-gravity tests. The Saffire-II paper should.
- The 85% oxygen CFI-G tests named in the challenge statement are in a table we have not loaded.
