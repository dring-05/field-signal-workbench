# Taiwan public-issuer Sheets refresh

`taiwan-sheets-importer.gs` is the Google Apps Script source for the native workbook linked from Field Signals. It keeps the Sheet as the data store and publishes only the curated `SiteFeed` tab to the website.

## What it imports

- The official TWSE OpenAPI public-issuer monthly revenue feed, with the MOPS CSV feed as a fallback.
- Public-issuer quarterly income-statement and balance-sheet feeds split by industry.
- The public-issuer director and supervisor ownership feed.
- Full source records, report periods, retrieval times, endpoint names, and source links in `Raw Statements`.

Monthly history is append-only by company and report month. A changed source record is kept as a later revision. `SiteFeed` uses the latest revision for each company and period. The first, second, and third finite differences of source-reported monthly YoY revenue growth require 2, 3, and 4 consecutive monthly YoY observations. The importer does not backfill a verified historical series, so history accumulates from the first successful run unless a separate history source is validated.

Quarterly statement periods are keyed by fiscal year and quarter. For general-industry issuers, the importer derives gross and operating margin from the revenue, gross profit, and operating income fields in the same public-issuer income-statement record. It compares a quarter's reported margin with the same fiscal quarter one year earlier. The source may report year-to-date amounts, so check the period basis before interpreting quarter-to-quarter movement. Margin differences use the YoY margin-change series and require 2, 3, or 4 consecutive quarter comparisons. A third difference therefore needs 8 consecutive quarter statements. Generic gross and operating margins remain blank for financial holding companies, insurers, and securities/futures firms until sector-specific denominators are validated.

## Setup

1. Open the Google Apps Script project created for this workbook while signed in as an account that can edit the Sheet.
2. Replace the starter contents of `Code.gs` with `taiwan-sheets-importer.gs`.
3. Run `setupTaiwanSignals` once. Google will show the scopes required for the script to edit this Sheet, fetch the official public TWSE and MOPS feeds, and create a daily trigger under the authorizing account.
4. Run `refreshTaiwanSignals` once and inspect `Import Log`, `Taiwan Monthly`, `Raw Statements`, and `SiteFeed` for source periods, row counts, endpoint errors, quarter keys, and margin coverage.
5. Publish only the `SiteFeed` worksheet as CSV when the owner approves public access, then set the CSV URL in the website configuration.

The trigger checks the sources daily at about 07:00 America/New_York. The providers publish on their own schedules, so a daily check does not imply a daily data observation. `Import Log` records the actual source period and retrieval result. Partial statement-feed failures are logged as partial success; monthly revenue can still refresh if a statement endpoint is unavailable.

## SEC AI and legal-name filing leads

`sec-filing-screen.mjs` is a separate, scheduled first-pass screen. The GitHub Actions workflow in `.github/workflows/sec-filing-screen.yml` checks EDGAR daily indexes on a rolling seven-day window, examines new 8-K, 10-K, 10-Q, 6-K, and 20-F primary documents plus EX-99 exhibits, and writes public-source leads to `public/sec-ai-watch.json`. It can also be run manually with `workflow_dispatch`.

### What a match means

- A possible legal name change requires an 8-K, text matching Item 5.03, and name-change wording. The feed links the filing and labels it for review. It does not claim the change is legally effective or infer the former and new name.
- AI-language leads require an operationally relevant AI phrase outside an obvious risk-factor section. The scanner compares the mention count with the prior filing of the same form for that CIK where available. A first detection or a large increase is only a lead. It can still reflect boilerplate, a marketing announcement, a third-party reference, or unrelated AI adoption. Review the linked filing, section, exhibit, and prior filing before using it.
- Each record includes the filing date, form, CIK, accession, filing link, matched term context, and whether a human has reviewed it. No record is classified as fraud, deception, or a short recommendation.

### Coverage and limits

- This is SEC-filer coverage, not a complete US or international company register. It includes foreign issuers that file with the SEC, can include non-listed reporting entities, and omits issuers that do not file in EDGAR. Non-US reporting formats vary, and 6-K filings may be especially noisy.
- The first version screens primary filing documents and EX-99 exhibits for a small phrase list. It does not parse every exhibit, determine business materiality, identify all name-change formats, or establish operating evidence. It does not yet filter the feed to listed companies.
- The SEC submissions API supplies filer metadata and filing history. Company Facts can supply standardized financial facts, but this first version does not add those metrics. The full-text-search website is useful for manual review; this workflow does not depend on an undocumented search endpoint.
- The SEC requests an identifying User-Agent with contact information and limits automated access to 10 requests per second. The script validates the contact address and spaces requests at least 220 ms apart, with bounded retries for throttling and transient server errors.
- Before enabling the scheduled workflow, create a GitHub Actions repository variable named `SEC_USER_AGENT` containing an identifying label and a real contact email, for example `Field Signals research analyst@example.com`. Do not put credentials or private investment notes in the public feed. The workflow commits only the SEC-derived JSON feed. GitHub Actions must be allowed to push to the default branch, and the repository's Cloudflare build connection must include that branch for the public site to refresh.

### Local check

Run `node automation/sec-filing-screen.mjs --self-test`. To run a live seven-day scan, set `SEC_USER_AGENT` to the identifying string above, then run `node automation/sec-filing-screen.mjs --feed public/sec-ai-watch.json`. The live scan makes SEC requests and should be run once, not repeatedly polled.
