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

## 2026-10-18

### SEC saved-evidence quality review

- Reclassified the 199 saved SEC leads with the current evidence rules. The review removed 150 leads whose saved excerpts no longer passed; 49 remain. This was a saved-evidence review, not a new filing scan. The underlying scan window still ends October 17.
- Updated the AI filing watch to show the saved-evidence review date and scope separately from the last filing scan. This prevents a feed cleanup from looking like a fresh SEC search.
- `node tests/check-ai-pivot-watch.mjs`, `node automation/sec-filing-screen.mjs --self-test`, JavaScript syntax checks, and `git diff --check` pass. Changes remain local and unpublished.

### Taiwan backfill and margin coverage audit

- The importer is designed to backfill 16 completed monthly reports across listed, OTC, emerging, and publicly issued MOPS populations. Tests cover the bounded period, append-only revisions, and the first through third differences of monthly YoY revenue growth. No data was imported into the personal workbook during this review.
- Quarterly margin calculations currently consume only the general-industry (`ci`) income-statement feed. The other financial-statement industry feeds are fetched but not used for generic margin ratios. Sector-specific measures need separate definitions before claiming margin coverage for banks, insurers, brokers, or diversified issuers.
- At the time of this audit the personal workbook was private and empty. The local Apps Script import and scheduled triggers were not installed there.

### Follow-up implementation and account check

- Confirmed in Chrome that the active browser account is Dillon’s personal Google account; the private workbook is `Taiwan Monthly Signals` and the separate publication workbook is `Taiwan Public Feed`. The connected Drive connector uses the institutional account and returns 403 for the personal workbook. No personal Sheet write has been made through that connector.
- Hardened the local importer so its first setup records the bound spreadsheet ID in Script Properties and later runs refuse to write to a different active workbook. Expanded `Margin Signals` before appending audit rows, avoiding a failure after source rows have already been appended. Missing quarterly history now reports unavailable coverage rather than an issuer-name mismatch.
- The MOPS archive parser previously failed an entire monthly report when one issuer had revenue but no YoY percentage. It now retains reported revenue and leaves YoY unavailable. Parser tests pass, and a live June 2025 probe verified all four official report populations, totaling 2,414 issuer rows. The 16-month, four-population historical backfill is running separately under `/tmp`; it has not yet been imported into Sheets.
- The SEC saved-evidence review now preserves the 150 screened-out records in a reversible archive and labels all 199 saved records as provisional until full filings are fetched. If same-form prior evidence cannot be retrieved, an operating match stays a review candidate instead of being treated as a negative. Existing archived and aged-out filing records remain available for revalidation.
- Local checks pass for Taiwan signal math, live-archive parser fixtures, Taiwan feed schema, SEC filing screens, and the rendered AI watch. Neither the personal workbook installation nor the public deployment is verified yet.

### Personal workbook import and account correction

- Verified in the live Google Sheets UI that `Taiwan Monthly Signals` is open under Dillon Ring’s personal account and marked private to the owner. The MOPS import ran in this workbook. No workbook write was made from the institutional account.
- The personal workbook's `Import Log` records `Setup complete`, `Names refreshed`, and `MOPS history imported`. The history import reports 39,423 records across June 2025 through September 2026. The local archive pull counted 39,444 source records for the same range, so the 21-row difference still needs reconciliation before claiming a complete source-to-sheet match.
- The personal `SiteFeed` tab visibly has 2,522 rows by 33 columns, including September 2026 observations and the first, second, and third differences of monthly YoY revenue growth. The workbook's screen-reader sheet summary says 2,522 rows; this includes the four-row presentation header, so it is not an issuer count.
- `Raw Statements` and `Margin Signals` are still empty. Margin growth derivatives are therefore not populated. The existing setup log says daily snapshot refresh is configured; the scheduled MOPS archive job must still be confirmed from trigger or subsequent run evidence.
- A separate personal `Taiwan Public Feed` workbook exists and is shared with one person, but public access and sync from the private workbook were not verified. The Worker still points to the prior published Google Sheet URL. The SiteFeed is not yet proven to be the dataset served by the public Dashboard.

## 2026-10-18 follow-up

### Personal workbook row reconciliation and site connection

- The 21-row difference is accounted for: the live import accepted only numeric issuer codes, excluding `0009A0` 永豐金證 for all 16 imported months and `0009B0` 台新證券 for May through September 2026. The local Apps Script parser now accepts 4 to 6 character alphanumeric codes and preserves leading zeroes. Regression tests cover both codes. The live bound script has not been updated, and the personal history import has not been rerun.
- Confirmed in the personal `Taiwan Public Feed` workbook that the original `SiteFeed` tab contains a small prior snapshot. Added a separate `LiveSiteFeed` tab with an `IMPORTRANGE` limited to the private workbook's curated `SiteFeed!A1:AG3000`. Google returns `#REF!` and asks for a desktop browser connection. The formula has not produced visible values, and the tab is not published. The Mac locked before the one-time desktop connection could be completed.
- The Worker endpoint still returns its prior published CSV with 2,621 issuer rows and September 2026 data. Codes `0009A0` and `0009B0` appear as current-month rows with one observation, so their derivatives are blank. Do not claim the personal workbook is wired to Dashboard until the new linked tab resolves and the Worker source is changed and verified.
- The SEC feed is still a saved October 17 scan with 49 active and 150 archived records. An October 18 saved-excerpt review did not fetch new filings. All 199 saved records remain provisional without a stored full-filing classifier version or review timestamp. Current coverage is not verified. The local scanner now preserves prior quality-review metadata and records the date and completeness of a successful future scan. Archived leads with positive matches remain archived. Tests cover these rules.
- `node tests/check-taiwan-mops-archive-parser.mjs`, `node tests/check-mops-monthly-backfill.mjs`, `node tests/check-taiwan-signal-math.mjs`, `node tests/check-taiwan-import-dedup.mjs`, `node tests/check-taiwan-public-feed-sync.mjs`, `node tests/check-ai-pivot-watch.mjs`, and `node automation/sec-filing-screen.mjs --self-test` pass. Local changes are not yet installed in Apps Script or published to Dashboard.

### Taiwan tiny-base handling, margin coverage, and SEC precision

- Verified the personal `SiteFeed` row for OTC issuer 4113 (聯上): September 2026 revenue is NT$1,815,362 thousand and YoY is 3,425,111.32%. Yahoo's issuer announcement reports prior-year revenue of NT$53 thousand and caps its displayed growth at 999,999.99%; Cnyes reports the uncapped calculated percentage. The arithmetic is correct, but the minuscule base makes it an unstable trend signal.
- The local importer preserves the reported percentage and comparison base, marks zero, negative, or less-than-0.1%-of-current bases, and suppresses revenue Δ1/Δ2/Δ3 for the affected observation. Regression tests use the reported 4113 values. This local change is not installed in the private Apps Script project.
- Quarterly general-industry income statements are now fetched for listed (L), OTC (O), emerging (U), and public issuers (X). Emerging and public monthly archive suffixes remain R and P. Margin calculations are scoped by market and use the general-industry `ci` table. This does not add appropriate bank, insurance, or securities profitability measures.
- Quarterly source endpoints are current snapshots. Since the private `Raw Statements` tab was empty on inspection, margin time series still require source history and a successful private-workbook run. Derivatives will populate gradually without a validated historical quarterly backfill.
- The local SEC classifier now suppresses explicit denials and internal-only AI assistance as operating-pivot evidence. Tests cover negative launch, deployment, and sales statements, internal customer support tools, and a separate positive customer product disclosure. Version 2026-10-18.3 passes the classifier and feed tests. No fresh live filing scan was run, and the saved public JSON remains older evidence.
