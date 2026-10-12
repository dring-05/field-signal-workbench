# Taiwan public-issuer Sheets refresh

`taiwan-sheets-importer.gs` is the Google Apps Script source for the native workbook linked from Field Signals. It keeps the Sheet as the data store and publishes only the curated `SiteFeed` tab to the website.

## What it imports

- The official TWSE OpenAPI public-issuer monthly revenue feed, with the MOPS CSV feed as a fallback.
- Public-issuer quarterly income-statement and balance-sheet feeds split by industry.
- The public-issuer director and supervisor ownership feed.
- Full source records, report periods, retrieval times, endpoint names, and source links in `Raw Statements`.

Monthly history is append-only by company and report month. A changed source record is kept as a later revision. `SiteFeed` uses the latest revision for each company and period. It calculates month-on-month differences of year-on-year revenue growth only when the required consecutive history is present. A third difference requires 16 consecutive monthly revenue observations. Margin fields remain blank until compatible quarterly statement fields can be matched safely.

## Setup

1. Open the Google Apps Script project created for this workbook while signed in as an account that can edit the Sheet.
2. Replace the starter contents of `Code.gs` with `taiwan-sheets-importer.gs`.
3. Run `setupTaiwanSignals` once. Google will show the scopes required for the script to edit this Sheet, fetch the official public TWSE and MOPS feeds, and create a daily trigger under the authorizing account.
4. Run `refreshTaiwanSignals` once and inspect `Import Log`, `Taiwan Monthly`, `Raw Statements`, and `SiteFeed` for source periods, row counts, and endpoint errors.
5. Publish only the `SiteFeed` worksheet as CSV when the owner approves public access, then set the CSV URL in the website configuration.

The trigger checks the sources daily at about 07:00 America/New_York. The providers publish on their own schedules, so a daily check does not imply a daily data observation. `Import Log` records the actual source period and retrieval result.
