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

## Nov 14, night: high oxygen and live SI

- At 85.5% oxygen the tool showed results from 20 to 21% oxygen and no "no close evidence" warning. No test is within 20 points of 85.5%, so oxygen closeness was 0 for every finding, a pressure match alone gave 0.5, and the tie between oxygen groups went to the first one. Each finding now uses its group of tests nearest the habitat's oxygen level, oxygen gates the score (`C_oxygen × ½ (1 + C_pressure) × W_tests`), and ties go to the nearer oxygen level. The cards say how far away the nearest tests are. A sweep of 10,860 slider settings checks that the nearest group is always the one used. The Spacesuit briefing had been written from the wrong groups and was dropped.
- Live SI: "Ask Airburn" answers questions, and "Write an SI briefing" covers any habitat, from the facts the page computed for it. Gemini 3.1 Flash Lite answers in 3 to 6 seconds; in tests the second pass (Gemini 3.5 Flash Lite) caught a misattributed oxygen range and a wrong "lower than". Gemma 4 26B timed out three times in a row, so it is only the last fallback.
- The free tier allows 20 requests a day for the stronger models (Gemini 4 Hydrogen included), so live SI uses the Flash Lite models.

## Nov 14, late: test replay

- The site was mostly text and bar charts. Rather than an invented fire simulation, the new Test replay plays back NASA's own tests: every FLEX droplet test and CFI-G gas-flame test at two chosen oxygen levels, side by side, in time-lapse. Each droplet starts at its listed diameter, shrinks by the d² law, and ends at its listed burn time in the listed way. For the extinction tests that list a burning rate, the d² law predicts the recorded burn time to within about 5% for most (median ratio 0.95).
- 256 of 274 droplet tests and all 179 gas-flame tests have what a replay needs; the page says how many are left out at each oxygen level.
- The look of each flame is drawn and labelled as drawn. Heptane flames are drawn with a warm core because heptane makes soot; that is the only fuel difference drawn.

## Nov 15, early: from presenting data to predicting

- Feedback: the tool still only re-presented the tables. The new Fire model fits models to the tests and predicts at the user's own conditions.
- Droplets (FLEX, 261 tests with oxygen, pressure and size): a multinomial logistic regression on oxygen, CO2, helium, pressure, droplet size and fuel predicts how a test ends. On unseen tests (5-fold cross-validation) it ranks flames that went out above those that did not with AUC 0.88, and names the right ending 78% of the time against 69% for always guessing the commonest. Each extra point of oxygen multiplies the odds that the flame goes out on its own by 0.67; each extra millimetre of droplet by 3.2. A linear model of log burning rate explains 60% of the spread between unseen tests.
- Gas flames (CFI-G): whether a lit flame goes out on its own is predicted with AUC 0.84. Whether a flame lights at all could not be predicted better than guessing (71% right against 74% for always guessing "lights"), so the site says so and does not predict it.
- Uncertainty: every model is refitted on 300 bootstrap resamples; the site shows the middle 90% of their answers. Inputs outside the tested range are named on the page.
- `tests/parity.mjs` now also checks the site's predictions against the Python fit (170 checks).
- A simulation draws 60 droplets from the model (each from a random bootstrap refit, with the burning-rate scatter) and plays them next to the real tests nearest the user's oxygen level, so the model can be compared with the data by eye.
- Live SI now receives the model's predictions for the habitat, labelled as model output, and cites them as [model].

## Nov 15, night: the Atmosphere map

- Feedback: still not a winner. The tool had many views and no single result to remember. The data had one: every microgravity test that lists oxygen and pressure (754) sits at 40% oxygen or less and 7.35 psi or more, and half the atmospheres crews have breathed sit outside that.
- The Atmosphere map plots those tests by oxygen and pressure (pressure on a log scale) with eight crew atmospheres pinned. "Near" is within 2 points of oxygen (the site's existing window) and 25% of pressure. Solid-material tests list oxygen but not pressure, so they sit on a rail under the axis instead of being placed at a guessed pressure.
- Counts near each atmosphere: ISS 191, Shuttle pre-spacewalk 6, Moon base 8, exploration atmosphere 9; Mercury to Apollo, Apollo 1, Skylab and the spacesuit 0.
- It is the landing page's lead figure and a tool tab, where clicking a pin or a point sets the habitat. Live SI receives the coverage numbers and cites them as [map]; asked about a spacesuit, it answered that no test came near, from the 40% and 7.4 psi limits.
- Crew atmospheres come from NASA history (the Apollo 1 cabin was pure oxygen at about 16.7 psi) and the Exploration Atmospheres Working Group (34%, 8.2 psi). They are context, not data, and are not used in any score.

- The Spacesuit briefing was regenerated. On the first try the second pass removed its gap sentence, judging "no test ran below 7.35 psi" unsupported when the facts state exactly that; without it the briefing described 33 to 40% oxygen tests with no warning that a suit runs at 100%, so it was discarded. The second try kept all four sentences, and every number was checked by hand against the facts.

## Nov 15, early morning: leading with the self-extinction line

- A review against the judging guide, past winners and 77 public competitor repos found that at least five other entries lead with the same coverage gap (no solid tested above 22.2% oxygen, an oxygen-pressure map with mission pins), and one shares the name. The agent brief had warned against leading with it.
- The home page now leads with a finding no competitor seen leads with: between ISS air and Moon-base air, droplet flames stop going out on their own. The first raw comparison (58 of 84 against 2 of 24) mixed in tests with CO2 or helium added, which go out more often; the page uses nitrogen-only tests (17 of 32 against 2 of 23), and the home replay now shows only those, so its counters end on the same numbers.
- Checks before publishing: every FLEX oxygen band includes tests from about 10 to 15 psi, so oxygen and pressure are not confounded; Moon-base pressure moves the model's lines by at most 1.6 points; the real nitrogen-only tests sit on or near the model lines (methanol 11 of 15 at 21% against 74% predicted for a 3 mm droplet).
- The coverage map stays as supporting evidence, reworded: the challenge statement says CFI-G inverse flames flowed up to 85% oxygen, so claims are now limited to "the loaded data" and the 85% tests are named. Other fixes: "1,196 microgravity records" (9 are normal-gravity) is now "combustion test records"; the disclaimers no longer say the site never predicts, since the Fire model does.

## Nov 15, late morning: five more NASA tables

- The PSI investigation pages show each experiment table in the browser. Reading them there (a real Chrome window, driven over its DevTools connection) found five tables that had never been downloaded: CFI-G Inverse Flames (154 tests, the up-to-85%-oxygen tests the challenge statement mentions), ACME Flame Design Inverse Flame (120), ACME CLD Flame (32 test days), ACME s-Flame (18 test days) and SPICE (469 flame settings). The catalog grows from 1,196 to 1,989 records.
- Inverse flames feed oxygen out of the burner into a chamber of fuel and nitrogen. Their surrounding gas holds no oxygen, so the burner's oxygen goes in its own column (`o2_supply_pct`) and these tests are kept off the Atmosphere map and out of the models, which describe flames burning in an oxygen atmosphere. The findings and models came out unchanged.
- The SI wrote summaries for the five new investigations; all numbers checked, and each text was read. The lowest tested pressure is now 6.24 psi (an inverse-flame test), which changed the Spacesuit briefing's facts; the first regenerated text had its pressure-gap sentence removed by the second pass, so it was discarded and regenerated once more.

## Nov 15, midday: NASA's reports

- The PSI tables were exhausted: every remaining combustion investigation was checked in the browser, and no flight investigation had a table not already loaded (a ground-based cool-flame study, PSI-142, has a summary table that is not about fire safety). The gaps the site names (no solid above 22.2% oxygen, no solid with pressure, no partial gravity, nothing near pure oxygen) were then searched for in NASA's Technical Reports Server.
- Seven reports had result tables that close part of each gap: Saffire IV to VI (solids in a Cygnus spacecraft at up to 31% oxygen and 7.8 psi), the Shuttle's SSCE (solids at 35 to 70% oxygen), NASA Glenn drop-tower tests at Moon and Mars gravity, and two White Sands reports (NASA's standard material test at 10.2 psi and in 99.8% oxygen). Claude (the SI coding assistant) rendered the PDFs page by page, read the tables and typed them in, each row citing its table and page; the build recomputes the partial-gravity report's printed margins from the copied limits. They are kept out of the PSI catalog, so no finding, model or SI text changed.
- Checks that caught errors before publishing: "lowest at Moon gravity for all three materials" was false (Nomex is lowest at Mars), so the chart says what holds: at Moon gravity all three are below both Earth and microgravity. Saffire VI's 54.1 kPa first showed as 7.9 psi through double rounding; it is 7.85. The pure-oxygen tile first used the half-the-time pressure (up to 1.8 psi); it now uses the report's own conclusion (0.4 to 0.9 psi, where every sample still went out). Two SSCE reports disagree on the pressure of the 35% flight; the one with the measured spread rate is used. Saffire VI looked like a Moon-base test but falls just outside the map's own "near" rule, so the site says it lies between the Moon-base and exploration plans.
- The partial-gravity data tests the site's own Gravity section: the challenge statement says microgravity and normal-gravity results could bound partial gravity, and for these three materials' oxygen limits they did not. The home page now shows the hypothesis and then the test of it.

- Above about 60% oxygen every PSI finding scored 0 (relevance falls to zero 20 points from the nearest test, and PSI stops at 40%), so the Insights page only said that nothing was close. It now ranks the NASA report evidence the same way, by how far its tests are from the habitat's oxygen, and leads with it whenever PSI has nothing within 20 points: at 70% oxygen, a Shuttle SSCE fire at exactly 70%; at a spacesuit's 100% and 4.3 psi, the White Sands pure-oxygen result. The evidence badge counts in-orbit report tests too, and live SI receives the report evidence as R1, R2 and so on and cites it. The report results are computed from the transcribed tables and labelled as not SI-written.

## Nov 15, afternoon: a second full review

The whole site was read again as a judge would, against the challenge statement, the judging guide and other teams' public repositories (at least 131 by now, several of them also using NASA's report data). What it caught:
- The tool started every habitat in Moon gravity, so the ISS preset showed Moon-gravity evidence pinned first. The ISS, and past crew atmospheres opened from the map, now start in orbit; the Moon-base preset sets Moon gravity. In orbit, the drop-tower results now rank after the fires burned in orbit.
- The Insights page contradicted itself: its gaps said no solid burned above 22.2% oxygen and nothing ran in Moon gravity, while the report cards on the same page showed both. The gaps now say they are gaps in the PSI tables, with what NASA's reports add under each, and every preset briefing gets the same computed line.
- The Insights replay counted CO2 and helium tests on the ISS side only (every test at 30 to 34% is nitrogen only). It now compares nitrogen-only tests, as the home page does, and its note says which.
- The home page said 21 investigations; it is 21 tables from 19 investigations (the README said 18). It said solids burned in orbit only up to 22.2%, one paragraph above the reports showing 31% and 70%; that sentence is now limited to the PSI tables.
- The headline counts (17 of 32, 2 of 23) are the tests the model was fitted to, while the findings count every test (17 of 34, 2 of 24). The home page now says so.
- Renamed from Flamebound, because another team's project is also called FlameBound: first to Burnline, then to Airburn (see the next section).
- Smaller: the hero says Moon and Mars have drop tests only, not "no data"; the White Sands 34% tile says it ran at 10.2 psi; Saffire-II's "037 mm" thickness is marked as NASA's own text; "at or just above today's air" became "right around" it, since the 50-50 point spans 20.4 to 23.4%.

## Nov 15, afternoon: the trade-off

- To find something no other entry has, every competitor README we could reach was read (117 of 148 public repos for this challenge). Common: an SI chat (89), NASA reports beyond PSI (52), 3D views or simulations (47), oxygen-pressure maps (29), machine-learning models (27). One team had already published predictions for NASA's FM2 Moon experiment. Eleven mentioned the prebreathe that is the reason the Moon base runs high oxygen; none computed it.
- So the site now computes it: NASA's decompression index R (Shuttle and ISS protocols accepted at R = 1.65) and inspired oxygen (NASA's exploration atmosphere: 128 mmHg), on one chart with the burn line from the FLEX droplet model. With 4.3 psi suits, no cabin below 27.6% oxygen skips the prebreathe with enough oxygen to breathe; the burn line is 20.4 to 23.4%. A 5.3 psi suit would let a cabin at the burn line skip it.
- Checked against NASA before publishing (tests/air.mjs, 6 checks): 4.3 hours from ISS air against NASA's 4-hour protocol; with a stricter limit set only from NASA's 6.5-hour estimate, the least-oxygen no-prebreathe cabin lands at 33.5% and 8.2 psi, next to the 34% and 8.2 psi NASA chose. The first chart drawing put two labels on top of lines; both moved.
- Renamed from Burnline to Airburn: a team called FIRELINE exists, and the new headline is about the air. "The burn line" stays as the name of the finding.

## Nov 15, evening: the demo video

- The 30-second demo is a screen recording of the site's own pages. Claude Code scripted it: headless Chrome recorded each scene, with the cursor moves and clicks written as code, and FFmpeg cut the scenes to the narration and burned in the captions. A team member reads the captions as the voice-over.
- For the recording only, the home-page replay ran faster (its own label says so) and held its last frame, and the hero carried a title card.
- Recording the live SI turned up two weaknesses, both fixed on the site:
  - Asked why a habitat runs its air past the burn line, it said the context never mentioned a burn line. The air facts now carry the burn line, where the habitat sits against it, the prebreathe from ISS air and the saving, and the suit pressure for a cabin at the line.
  - Its gap sentences said "no test in the data ran in Moon gravity" right after citing NASA's drop-tower tests at Moon gravity. The gaps it gets now name NASA's PSI tables, and a rule asks it to say when a report goes beyond a gap.

## Nov 15, evening: the suit

- Asked whether the project stood out yet, the honest answer was no: the trade-off was ours alone, but it read as one chart among many and its punchline was jargon.
- Working the numbers further gave a sharper finding. The least-oxygen cabin with no prebreathe falls about 2 points of oxygen for each half psi of suit pressure. At 5.8 psi, a cabin at 21.7% oxygen and 12.2 psi needs none: inside the burn line, with droplet flames going out on their own 67% of the time against 14% at today's 4.3 psi. Each hour of prebreathe buys back about 2.4 points; 1 h 47 min reaches the burn line.
- 5.8 psi is not a made-up number: NASA's NESC history of the prebreathe gives it as the Russian Orlan suit's operating pressure, and records that the Shuttle suit's makers proposed raising the suit to 5.8 psi with an 11.8 psi cabin (R 1.6) so crews could skip the prebreathe. NASA turned it down on cost. The model's 5.8 psi cabin lands at 12.2 psi, next to that 11.8, now a seventh check in tests/air.mjs.
- Under the stricter planetary limit the suit helps less (26.7% at 5.8 psi; the burn line needs 6.9 psi), and the site says so.
- The home page now opens on it: "Moon-base fire safety starts with the spacesuit."

## Nov 15, the last hour

- The suit finding was two numbers, 14% and 67%. A suit curve on the home page now shows the whole relation: for each suit pressure from 4.3 to 6 psi, the least-oxygen cabin that needs no prebreathe and the droplet model's chance, with its 90% range, that a flame goes out on its own there. It is dashed where the cabin pressure is below the pressures FLEX tested, and stops where the cabin would hold less oxygen than Earth's air. Same limits, same model, no new data.
- A suit dial sits right under the home page's headline: drag the suit pressure from today's 4.3 psi to the Orlan's 5.8 psi and it shows the least-oxygen cabin that needs no prebreathe and, as 20 model droplets, how many flames go out on their own there (3 of 20 at 4.3 psi, 13 of 20 at 5.8 psi). It plays once when it scrolls into view. Same limits and model as the trade-off section.
- Of 120 team pages read for this challenge on the Space Apps site, 59 had submitted; none mentions prebreathe or decompression, which is why the suit finding now leads.
- The demo video's file metadata now says how it was made (a screen recording scripted with Claude Code, narrated by a team member).
- The official submission guide says the project page takes images, so five screenshots of the site's own pages and charts went onto it.

## Still open

- The prebreathe estimate is one tissue at rest. NASA's current planetary risk models are stricter; the stricter limit approximates them but does not reproduce them.

- The gravity bound assumes burning changes steadily with gravity. NASA's drop-tower tests contradict it for three materials' oxygen limits; whether it holds for flame spread, or for other materials, is open.
- The PSI table does not state the conditions of the Saffire-II normal-gravity tests. The Saffire-II paper should.
- The 85% oxygen CFI-G inverse-flame tests are loaded, but they feed oxygen from the burner into fuel and nitrogen, so they say nothing direct about a cabin's surrounding air.
