# Field Signals implementation log, 12 October 2026

## Completed in this pass

- **#2, tracked signals:** Source cards now have a follow control. The overview shows followed sources and hand-entered dated observations. No provider polling is implied.
- **#4, source and freshness receipts:** Research receipts now retain the date checked, provider-reported date or period, geography, measure definition and unit, revision note, evidence URL, interpretation, falsifier, and operating-metric bridge.
- **#6, operating-metric bridge:** Bridge fields are carried into each saved evidence receipt with the source URL and dates so readers can review the bridge alongside the underlying observation.
- **#10, messy-data collection kit:** The importer now lets a user select a header row after title or note rows. The selected header row and number of skipped preamble rows are preserved in the saved import.
- **#12, supply-chain and capacity map:** The capacity page now includes a local project and corridor register for manually linking a named project to public evidence, region, sponsor, stage, and reported timing.

## Limits to keep visible

Followed-source observations and capacity records are manual and local to one browser profile. They do not sync to peers or update from provider pages. Anyone using the same browser profile can view the saved notes. The importer still expects long-format data, retains duplicate date/category rows, and does not infer joins between capacity sources. A project record is an analyst-maintained crosswalk, not a verified provider-to-provider match.

## Verification

`node --check public/app.js`, `tests/check-app-functions.mjs`, `tests/check-source-cards.mjs`, `tests/check-workflow-additions.mjs`, and `git diff --check` passed before visual review.
