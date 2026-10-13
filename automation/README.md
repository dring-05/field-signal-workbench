# Taiwan public-issuer Sheets refresh

`taiwan-sheets-importer.gs` is the Google Apps Script source for the native workbook linked from Field Signals. It keeps the Sheet as the data store and publishes only the curated `SiteFeed` tab to the website.

## What it imports

- The official TWSE OpenAPI public-issuer monthly revenue feed, with the MOPS CSV feed as a fallback.
- Public-issuer quarterly income-statement and balance-sheet feeds split by industry.
- The public-issuer director and supervisor ownership feed.
- Full source records, report periods, retrieval times, endpoint names, and source links in `Raw Statements`.

Monthly history is append-only by company and report month. A changed source record is kept as a later revision. `SiteFeed` uses the latest revision for each company and period. The first, second, and third finite differences of source-reported monthly YoY revenue growth require 2, 3, and 4 consecutive monthly YoY observations. The importer does not backfill a verified historical series, so history accumulates from the first successful run unless a separate history source is validated.

Quarterly statement periods are keyed by fiscal year and quarter. The official MOPS financial-comparison documentation says income-statement fields are available as cumulative year-to-date amounts and distinguishes these from standalone-quarter amounts. For general-industry issuers, the importer therefore derives standalone flows as Q1 YTD, Q2 YTD minus Q1 YTD, Q3 YTD minus Q2 YTD, and annual Q4 YTD minus Q3 YTD. It leaves a quarter blank when the preceding same-year cumulative report is missing. Gross and operating margin are computed from standalone-quarter numerator and revenue, then compared with the same fiscal quarter a year earlier. Margin Δ1, Δ2, and Δ3 are finite differences of this same-quarter YoY margin-change series. They require 6, 7, and 8 consecutive standalone quarterly margins, respectively. The append-only `Margin Signals` tab records the input YTD values, prior-quarter values, derived standalone amounts, calculated margins, source signatures, source URL, raw statement, and transformation status. Its calculation signature depends on both the current and preceding-quarter source versions, so a restatement of the preceding quarter creates a new auditable derived row.

The official MOPS notes explicitly say generic gross margin and operating margin are not applicable to financial, insurance, securities/futures, and financial-holding issuers. The importer does not force these ratios onto those sectors. They remain blank in the margin fields and are marked in `Data status`; relevant alternatives include net interest income, fee income, underwriting results, credit quality, and capital adequacy, which require separate sector-specific definitions and source fields. Source references: [TWSE OpenAPI schema](https://openapi.twse.com.tw/v1/swagger.json), [MOPS financial-comparison definitions and coverage](https://mopsfin.twse.com.tw/terms), and [government dataset field list](https://data.gov.tw/dataset/97152).

The OpenAPI quarterly endpoints are current snapshots. An optional separate historical monthly revenue downloader is staged in [`mops-monthly-backfill.mjs`](mops-monthly-backfill.mjs). It requests MOPS month reports serially, saves raw responses under content-hash filenames, and appends parsed, attributed observations and run checkpoints to a caller-selected directory. It is bounded to eight requests per run by default, waits at least three seconds between requests, and can resume the same explicit date range. It does not change the daily Apps Script importer, write to the live Sheet, or publish data to the site.

**Important validation limit:** the report page and column values were inspected for listed-company reports in August 2025, September 2025, and January 2024. The committed parser fixture is a small reconstruction of the visible official table fields, not a byte-for-byte HTML response. This sandbox could not fetch the raw MOPS response body for a local exact fixture, nor retrieve an OTC historical report. As a result, the parser is tested against a representative fixture and fails closed on mismatched periods, missing columns, malformed company rows, or conflicting duplicate rows, but the script is not yet validated for unattended historical backfill. Run one small listed-market smoke test first. OTC support is wired to the official MOPS route pattern but remains unverified; do not include it in a research series until a real OTC response has passed the same parser checks.

Example, for one domestic listed-market month only:

```sh
node automation/mops-monthly-backfill.mjs \
  --from 2025-09 --to 2025-09 --markets sii --issuer-types 0 \
  --max-requests 1 --out /path/to/private/taiwan-monthly-history
```

For a larger backfill, rerun with the same explicit range and a higher request budget after reviewing the first raw HTML and parsed records. `--recheck-completed` refetches already completed partitions so source revisions can be recorded. Raw snapshots and JSONL rows are never overwritten; changes append new row signatures. Attribution is included with each observation under the Open Government Data License v1.0. The license permits reuse subject to attribution: [data.gov.tw/license](https://data.gov.tw/license). Official monthly data references: [listed company dataset](https://data.gov.tw/dataset/18420), [OTC company dataset](https://data.gov.tw/en/datasets/56510), and [MOPS monthly report example](https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_114_9_0.html).

The ordinary importer still accumulates history from current official snapshots. Margin YoY and its finite differences remain blank until enough consecutive source quarters have accumulated. MOPSfin documents quarterly financial coverage back to IFRS adoption (2013 for listed, OTC, emerging issuers and regulated financial firms, 2015 for public issuers), but a validated, repeatable bulk route for historical statements is still needed before quarterly backfill can be called automated. Its historical service has a daily refresh lag and some non-listed public issuers report only Q2 and Q4, so quarterly derivatives can remain unavailable for those issuers.

## Setup

1. Open the Google Apps Script project created for this workbook while signed in as an account that can edit the Sheet.
2. Replace the starter contents of `Code.gs` with `taiwan-sheets-importer.gs`.
3. Run `setupTaiwanSignals` once. Google will show the scopes required for the script to edit this Sheet, fetch the official public TWSE and MOPS feeds, and create a daily trigger under the authorizing account.
4. Run `refreshTaiwanSignals` once and inspect `Import Log`, `Taiwan Monthly`, `Raw Statements`, `Margin Signals`, and `SiteFeed` for source periods, row counts, endpoint errors, quarter keys, standalone-quarter derivations, and margin coverage.
5. Publish only the `SiteFeed` worksheet as CSV when the owner approves public access, then set the CSV URL in the website configuration.

The trigger checks the sources daily at about 07:00 America/New_York. The providers publish on their own schedules, so a daily check does not imply a daily data observation. `Import Log` records the actual source period and retrieval result. Partial statement-feed failures are logged as partial success; monthly revenue can still refresh if a statement endpoint is unavailable.

## SEC AI and legal-name filing leads

`sec-filing-screen.mjs` is a separate, scheduled first-pass screen. The GitHub Actions workflow in `.github/workflows/sec-filing-screen.yml` checks EDGAR daily indexes on a rolling seven-day window, limits review to filers in the SEC company-ticker-exchange association file, examines new 8-K, 10-K, 10-Q, 6-K, and 20-F primary documents plus EX-99 exhibits, and writes public-source leads to `public/sec-ai-watch.json`. Each lead shows the mapped ticker and exchange beside the filing-index name. It can also be run manually with `workflow_dispatch`.

### What a match means

- A possible legal name change requires an 8-K, text matching Item 5.03, and name-change wording in the primary filing or an EX-99 exhibit. Straightforward negated phrases such as "no name change" are excluded. The feed links the filing and labels it for review. It does not claim the change is legally effective or infer the former and new name.
- AI-language leads require an operationally relevant AI phrase outside an obvious risk-factor section. The scanner compares the mention count with the prior filing of the same form for that CIK where available. A first detection or a large increase is only a lead. It can still reflect boilerplate, a marketing announcement, a third-party reference, or unrelated AI adoption. Review the linked filing, section, exhibit, and prior filing before using it.
- Each record includes the filing date, form, CIK, accession, filing link, matched term context, and whether a human has reviewed it. No record is classified as fraud, deception, or a short recommendation.

### Coverage and limits

- This is an SEC-filer screen restricted to filers in the SEC company-ticker-exchange association file. The SEC says those associations may not be complete or fully accurate. This is not a complete US or global company register. It can include OTC associations, includes foreign issuers that file with the SEC, and omits issuers that do not file in EDGAR. Non-US reporting formats vary, and 6-K filings may be especially noisy.
- The screen examines primary filing documents and EX-99 exhibits for a small phrase list. It does not parse every exhibit, determine business materiality, identify every name-change format, or establish operating evidence. A filing document returning 404 remains unchecked so a later run can retry it.
- The SEC submissions API supplies filer metadata and filing history. Company Facts can supply standardized financial facts, but this first version does not add those metrics. The full-text-search website is useful for manual review; this workflow does not depend on an undocumented search endpoint.
- The SEC requests an identifying User-Agent with contact information and limits automated access to 10 requests per second. The script validates the contact address and spaces requests at least 220 ms apart, with bounded retries for throttling and transient server errors.
- Before enabling the scheduled workflow, create a GitHub Actions repository secret named `SEC_USER_AGENT` containing an identifying label and a real contact email. Store it as a secret so the contact address is not exposed as a repository variable. Do not put credentials or private investment notes in the public feed. The workflow commits only the SEC-derived JSON feed. GitHub Actions must be allowed to push to the default branch, and the repository's Cloudflare build connection must include that branch for the public site to refresh.

## Private Paper Book fundamentals

The private Sheets-based paper book has a separate Apps Script module for guided idea entry, per-idea private materials folders, SEC-reported fundamentals, and idea-to-valuation-row linking. Add both `paper-book-sec-facts.gs` and `paper-book-idea-form.html` as described in [paper-book-sec-facts.md](paper-book-sec-facts.md). The helper is not installed in the live Sheet. It needs a one-time Apps Script authorization; SEC fundamentals require a contact-bearing User-Agent, and per-idea folders require a private parent-folder ID. It leaves price manual and does not publish the private book.

### Local check

Run `node automation/sec-filing-screen.mjs --self-test`. To run a live seven-day scan, set `SEC_USER_AGENT` to the identifying string above, then run `node automation/sec-filing-screen.mjs --feed public/sec-ai-watch.json`. The live scan makes SEC requests and should be run once, not repeatedly polled. Local source checks include `node tests/check-taiwan-signal-math.mjs` and `node tests/check-mops-monthly-backfill.mjs`.
