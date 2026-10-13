# Field Signals implementation log, 12 October 2026

## Completed in this pass

- **#2, tracked signals:** Source cards now have a follow control. The overview shows followed sources and hand-entered dated observations. No provider polling is implied.
- **#4, source and freshness receipts:** Research receipts now retain the date checked, provider-reported date or period, geography, measure definition and unit, revision note, evidence URL, interpretation, falsifier, and operating-metric bridge.
- **#6, operating-metric bridge:** Bridge fields are carried into each saved evidence receipt with the source URL and dates so readers can review the bridge alongside the underlying observation.
- **#10, messy-data collection kit:** The importer now lets a user select a header row after title or note rows. The selected header row and number of skipped preamble rows are preserved in the saved import.
- **#12, supply-chain and capacity map:** The capacity page now includes a local project and corridor register for manually linking a named project to public evidence, region, sponsor, stage, and reported timing.

## Completed in the follow-up pass

- **#1, question-to-measure planner:** Added a structured planner for the research question, measure, unit, geography, time window, expected direction, and falsifier. The original homepage planner remains available.
- **#3 and #7, signal notebooks and mind-change tests:** Added multiple question notebooks with dated observations, evidence that supports or weakens the thesis, a source link, and a stated falsifier.
- **#5 and #13, retail traffic and pricing:** Added manual series for retail-footfall observations and item-level prices or promotions. Public reference points identify what each source measures. Winter's Starbucks history is labeled as openings and closures, not visits.
- **#8 and #15, peer divergence and signal validation:** Added pasted-series comparison with period alignment, missing and duplicate checks, growth gaps, correlations, and shifted correlations. The page flags small samples and false-alarm risk.
- **#9 and #11, catalyst calendar and source-change watcher:** Added dated catalyst records and manual source-check snapshots. Neither uses automatic monitoring.
- **#14, source-grounded AI prompt:** Added an editable prompt builder using only receipts pasted by the analyst. It asks the chosen model to separate reported observations from inference and disclose gaps. No AI request is sent by the site.
- **Usability:** Added an Analyst tools navigation page with a jump list so the additional workflows do not require a long scroll.

## Taiwan feed and filing coverage follow-up

- Expanded the published `SiteFeed` schema to 24 columns. It carries monthly revenue growth differences through third order and same-quarter year-over-year margin changes and differences when matched filings support them.
- Corrected the monthly series history gate: the source already supplies YoY growth, so revenue differences require 2, 3, or 4 consecutive YoY observations for first, second, or third order. Quarterly margin third differences need eight consecutive statements to form four same-quarter YoY changes.
- Added the Hong Kong and Brazil issuer filing systems to the Sheet and the separate Other markets page. The page says what is and is not comparable with Taiwan's monthly revenue series. Hong Kong's monthly return tracks securities capital, and Japanese monthly sales releases are voluntary and issuer-specific.
- Added a manual AI name-change filing watch with five source-linked examples. It is labeled as a reviewed list, not an exhaustive or live feed, and treats filings as candidate leads rather than investment conclusions.

## Limits to keep visible

Followed-source observations, catalyst records, source checks, retail observations, price logs, notebooks, plans, and capacity records are manual and local to one browser profile. They do not sync to peers or update from provider pages. Anyone using the same browser profile can view the saved notes. The importer still expects long-format data, retains duplicate date/category rows, and does not infer joins between capacity sources. A project record is an analyst-maintained crosswalk, not a verified provider-to-provider match. The divergence tool accepts pasted values and cannot normalize differing definitions or frequencies for the analyst.

## Verification

All tests in `tests/*.mjs`, `node --check public/*.js`, and `git diff --check` passed before final browser review.
