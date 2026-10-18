# Field Signals review log

## 2026-10-13

### Taiwan issuer revenue

- Added the emerging-company monthly revenue source to the local Apps Script importer: MOPS `t187ap05_R`, with a CSV fallback and separate source-market provenance.
- Verified the official government dataset page identifies the emerging-company monthly revenue series as free and licensed under Open Government Data License v1.0: https://data.gov.tw/en/datasets/94025.
- Verified the official September 2026 emerging-company MOPS report at https://mopsov.twse.com.tw/nas/t21/rotc/t21sc03_115_9_0.html. The visible report is dated 115/10/13, identifies the emerging-company population, and shows current-month, prior-month, year-ago, cumulative-revenue, and change fields in thousand TWD.
- `node tests/check-taiwan-signal-math.mjs` and `node tests/check-mops-monthly-backfill.mjs` pass. The importer now covers listed, OTC, emerging, and publicly issued reporting populations.
- The Google Sheet still contains headers only in `Taiwan Monthly`, `SiteFeed`, and `Import Log`. No source observations or derivatives have been imported. The live report was inspected in the browser, but its raw HTML has not yet been run through the backfill parser. Three monthly observations are not enough for the third finite difference. Four consecutive monthly YoY observations are required.
- Scope remains public reporting issuers with available filings, not every private Taiwanese company.

### AI name and disclosure screen

- The local branch has an SEC filing screen and GitHub Actions workflow, but the workflow is not on remote `main`. The public site still shows manual examples. There is no verified scheduled scan or live lead feed.
- The local SEC feed has no scan timestamp or leads. The workflow needs the repository secret `SEC_USER_AGENT` with an identifying label and contact email before its first run.
- South Korea's OpenDART and Brazil's CVM modules remain local prototypes. DART requires a user-owned API key. The CVM parser has not been validated against a live archive. Neither is scheduled or connected to the public feed.
- Treat every keyword or legal-name match as a review lead. It does not establish a sham pivot, fraud, or a short recommendation.

## 2026-10-17

### Public Taiwan feed write safety

- Updated the local Apps Script feed-sync source to write the complete new snapshot before clearing rows left over from a larger prior snapshot. A failed replacement write therefore does not clear the existing public feed first.
- Added a failure-path test that confirms the old public rows are not cleared when the replacement write fails. This is a repository change only. The current personal Apps Script project has not been updated with this source.

### Taiwan monthly automation audit

- The live Dashboard loaded the published Taiwan feed with 2,621 issuer rows and a latest report month of September 2026. The underlying MOPS history has June through September observations, enough for revenue growth differences where each issuer has four consecutive months.
- The Columbia Apps Script trigger page shows three scheduled jobs: `refreshTaiwanSignals`, `refreshTaiwanCompanyNames`, and `refreshTaiwanVerifiedEnglishNameFallbacks`. The latest listed runs are October 17 and show Completed. There is no scheduled rolling MOPS archive import or public-feed sync, and the source workbook import log has no `Public feed synced` entry.
- The bound Apps Script editor currently shows a four-line `Code.gs` containing only `myFunction` and a `1.gs` source truncated at 500 characters inside `refreshTaiwanCompanyNames`. Apps Script history has one current version dated October 14, so no prior full source version was available to restore from the project history. The historical Completed executions do not prove the current saved source is valid.
- Local `taiwan-sheets-importer.gs` now deduplicates monthly rows by market, issuer, period, and reported economics, while preserving changed reported values as append-only revisions. Raw statement signatures ignore export and retrieval timestamps. `tests/check-taiwan-import-dedup.mjs`, `tests/check-taiwan-signal-math.mjs`, and the public-feed schema test pass. These local files have not been installed into Apps Script.
- Margin derivatives remain blank until enough matched quarterly statements exist to derive standalone margins and year-over-year comparisons. Do not present the current feed as having margin coverage.

### AI-branded legal name events

- The local SEC screen now keeps a recent legal-name transition when the SEC submissions history verifies it and the new legal name includes AI, artificial intelligence, machine learning, or generative AI branding. It labels that as a name signal, not operating proof. A non-AI rename alone remains excluded.
- `tests/check-ai-pivot-watch.mjs` and `node automation/sec-filing-screen.mjs --self-test` pass. The local SEC scanner differs from GitHub `main`; these local changes have not been published.
