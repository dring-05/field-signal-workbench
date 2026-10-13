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
