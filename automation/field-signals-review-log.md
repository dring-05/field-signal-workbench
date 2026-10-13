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
