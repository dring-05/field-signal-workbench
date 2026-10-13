# Taiwan public-issuer Sheets refresh

`taiwan-sheets-importer.gs` is the Google Apps Script source for the native workbook linked from Dashboard. It keeps the Sheet as the data store and publishes only the curated `SiteFeed` tab to the website.

## What it imports

- Four official monthly revenue feeds: listed companies (TWSE, `t187ap05_L`), OTC companies (TPEx, `t187ap05_O`), emerging companies (MOPS, `t187ap05_R`), and publicly issued companies (MOPS, `t187ap05_P`). These are reporting issuer populations, not every private company in Taiwan. Each snapshot feed is fetched separately and records its source market; each OpenAPI request falls back to its dataset CSV when the API route is unavailable.
- Public-issuer quarterly income-statement and balance-sheet feeds split by industry.
- The public-issuer director and supervisor ownership feed.
- Full source records, report periods, retrieval times, endpoint names, and source links in `Raw Statements`.

Monthly history is append-only by source market, company code, and report month. A changed source record is kept as a later revision. `SiteFeed` uses the latest revision for each market, company, and period. Source markets remain separate, so a code present in more than one provider feed cannot silently combine histories. The four feeds can have different coverage and may overlap; the workbook preserves provider labels instead of asserting that cross-feed rows are unique legal entities. The first, second, and third finite differences of source-reported monthly YoY revenue growth require 2, 3, and 4 consecutive monthly YoY observations. The importer does not backfill a verified historical series, so history accumulates from the first successful run unless a separate history source is validated.

Quarterly statement periods are keyed by fiscal year and quarter. The official MOPS financial-comparison documentation says income-statement fields are available as cumulative year-to-date amounts and distinguishes these from standalone-quarter amounts. For general-industry issuers, the importer therefore derives standalone flows as Q1 YTD, Q2 YTD minus Q1 YTD, Q3 YTD minus Q2 YTD, and annual Q4 YTD minus Q3 YTD. It leaves a quarter blank when the preceding same-year cumulative report is missing. Gross and operating margin are computed from standalone-quarter numerator and revenue, then compared with the same fiscal quarter a year earlier. Margin Δ1, Δ2, and Δ3 are finite differences of this same-quarter YoY margin-change series. They require 6, 7, and 8 consecutive standalone quarterly margins, respectively. The append-only `Margin Signals` tab records the input YTD values, prior-quarter values, derived standalone amounts, calculated margins, source signatures, source URL, raw statement, and transformation status. Its calculation signature depends on both the current and preceding-quarter source versions, so a restatement of the preceding quarter creates a new auditable derived row.

The official MOPS notes explicitly say generic gross margin and operating margin are not applicable to financial, insurance, securities/futures, and financial-holding issuers. The importer does not force these ratios onto those sectors. They remain blank in the margin fields and are marked in `Data status`; relevant alternatives include net interest income, fee income, underwriting results, credit quality, and capital adequacy, which require separate sector-specific definitions and source fields. Source references: [TWSE OpenAPI schema](https://openapi.twse.com.tw/v1/swagger.json), [MOPS financial-comparison definitions and coverage](https://mopsfin.twse.com.tw/terms), and [government dataset field list](https://data.gov.tw/dataset/97152).

The OpenAPI quarterly endpoints are current snapshots. A separate historical monthly revenue downloader is staged in [`mops-monthly-backfill.mjs`](mops-monthly-backfill.mjs). It requests the four MOPS report families (`sii`, `otc`, `rotc`, `pub`) for domestic (`0`) and foreign (`1`) issuers, saves raw responses under content-hash filenames, and appends parsed, attributed observations and run checkpoints to a caller-selected directory. Defaults include all four families and both issuer populations. It is bounded to eight requests per run, waits at least three seconds between requests, and resumes the same explicit date range. It does not change the daily Apps Script importer, write to the live Sheet, or publish data to the site. No verified July to September 2026 backfill has been imported yet.

**Important validation limit:** the committed parser fixture is a reconstruction of visible official table fields, not a byte-for-byte MOPS response. The parser is tested against that fixture and fails closed on mismatched periods, missing columns, malformed company rows, or conflicting duplicate rows. Browser fetches of the official CSV and historical report bodies have failed in this environment, so real-body parsing for all four report families and both issuer types remains unverified. Do not describe this as a completed historical import. First fetch and inspect one real raw response per family and issuer type, then test staged output before relying on broader coverage.

Example, for a four-family domestic and foreign three-month starter window (24 report partitions):

```sh
node automation/mops-monthly-backfill.mjs \
  --from 2026-07 --to 2026-09 \
  --max-requests 24 --out /path/to/private/taiwan-monthly-history
```

Three months of YoY revenue growth produce two first differences and one second difference. Include June 2026 to derive a third difference for July through September. `--recheck-completed` refetches completed partitions so source revisions can be recorded. Raw snapshots and JSONL rows are never overwritten; changes append new row signatures. Attribution is included with each observation under the Open Government Data License v1.0. Official monthly data references: [listed companies](https://data.gov.tw/dataset/18420), [OTC companies](https://data.gov.tw/en/datasets/56510), [emerging companies](https://data.gov.tw/dataset/94025), [publicly issued companies](https://data.gov.tw/dataset/94026), and [MOPS monthly report example](https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_114_9_0.html).

The ordinary importer still accumulates history from current official snapshots. Each monthly source is fetched independently. A failed feed is recorded in `Import Log` while successful feeds continue; all four failures leave the run failed and retain per-feed error detail. Margin YoY and its finite differences remain blank until enough consecutive source quarters have accumulated. MOPSfin documents quarterly financial coverage back to IFRS adoption (2013 for listed, OTC, emerging issuers and regulated financial firms, 2015 for public issuers), but a validated, repeatable bulk route for historical statements is still needed before quarterly backfill can be called automated. Its historical service has a daily refresh lag and some non-listed public issuers report only Q2 and Q4, so quarterly derivatives can remain unavailable for those issuers.

## Setup

1. Open the Google Apps Script project created for this workbook while signed in as an account that can edit the Sheet.
2. Replace the starter contents of `Code.gs` with `taiwan-sheets-importer.gs`.
3. Run `setupTaiwanSignals` once. Google will show the scopes required for the script to edit this Sheet, fetch the official public TWSE and MOPS feeds, and create a daily trigger under the authorizing account.
4. Run `refreshTaiwanSignals` once and inspect `Import Log`, `Taiwan Monthly`, `Raw Statements`, `Margin Signals`, and `SiteFeed` for source periods, row counts, endpoint errors, quarter keys, standalone-quarter derivations, and margin coverage.
5. Publish only the `SiteFeed` worksheet as CSV when the owner approves public access. In the published link settings, select the `SiteFeed` tab and CSV format, then copy its public CSV URL.
6. Set `window.FIELD_SIGNAL_TAIWAN_FEED_URL` in [`public/config.js`](../public/config.js) to that exact CSV URL. Commit and push the site change so the browser can fetch the public feed. Keep `Taiwan Monthly`, `Raw Statements`, `Margin Signals`, and `Import Log` private.

The current local `config.js` intentionally has an empty URL. The website table remains empty until the importer has populated `SiteFeed`, the owner publishes that one tab, and the CSV URL is configured. The staged MOPS history downloader writes to a local output directory only; it does not import that history into the Sheet or publish it. Review the backfill limits above before treating the first three months as complete.

The trigger checks the sources daily at about 07:00 America/New_York. The providers publish on their own schedules, so a daily check does not imply a daily data observation. `Import Log` records the actual source period and retrieval result. Partial statement-feed failures are logged as partial success; monthly revenue can still refresh if a statement endpoint is unavailable.

## SEC AI and legal-name filing leads

`sec-filing-screen.mjs` is a separate, scheduled first-pass screen. The GitHub Actions workflow in `.github/workflows/sec-filing-screen.yml` checks EDGAR daily indexes on a rolling seven-day window, limits review to filers in the SEC company-ticker-exchange association file, examines new 8-K, 10-K, 10-Q, 6-K, and 20-F primary documents plus EX-99 exhibits, and writes public-source leads to `public/sec-ai-watch.json`. Each lead shows the mapped ticker and exchange beside the filing-index name. It can also be run manually with `workflow_dispatch`.

### What a match means

- A possible legal name change requires an 8-K, text matching Item 5.03 and name-change wording in the primary filing or an EX-99 exhibit, plus a recent former-name transition in the SEC submissions history. The feed includes prior and current legal names, the history date, and the SEC source link. It remains a lead for review and does not establish why a company changed its name or whether an AI strategy is material.
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
