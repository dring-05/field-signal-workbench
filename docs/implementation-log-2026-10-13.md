# Implementation log, 2026-10-13

Added four analyst workflows to the Analyst Tools page:

- **Messy-data staging inbox:** local CSV/TSV intake, column mapping, provenance, and correction history.
- **Capacity constraint tracker:** source-linked records for power, permits and construction, equipment lead times, and skilled labor. Review dates are reminders, not proof that a source is current.
- **Hardware market change log:** seven manual source reviews covering memory, compute, MLCC, and advanced substrates. Each entry links the event, review date, source, and operating-metric implication. It is not an automated feed.
- **Thesis evidence ledger:** company thesis claims with dated supporting or challenging observations, source links, operating-metric implications, and a next check.
- **Open tools directory:** a separate tab with the 220-record public directory snapshot, 76-record curated starting list, sector and hardware-niche filters, and dated local screenshots. The Dashboard brand is used in the interface.

The modules store analyst entries in browser local storage and offer export/import where documented. They do not provide password protection or cross-device synchronization. Read each module's documentation for data handling and source limitations.

Checks run: `node tests/check-thesis-evidence-ledger.mjs`, `node tests/check-hardware-market-changes.mjs`, `node tests/check-hardware-market-change-log-ui.mjs`, `node tests/check-capacity-constraint-tracker.mjs`, `node tests/check-messy-data-inbox.mjs`, `node tests/check-new-workflow-integration.mjs`, `node tests/check-open-tools-directory.mjs`, `node tests/check-app-functions.mjs`, plus JavaScript syntax checks and `git diff --check`.

## Usability and preservation pass

- Kept Open tools as the landing page, but removed the hardcoded count from navigation. Its count is read from the current local directory data.
- Collapsed long per-source access, freshness, coverage, and evidence notes until opened. Search now also checks account/access scope and update cadence.
- Restored direct access to other-market references and saved research notes through a secondary menu and the mobile selector. Capacity, source freshness, evidence, and the capacity-to-revenue bridge remain Analyst Tools features.
- Put the capacity-to-revenue bridge and data-staging inbox first in the Analyst Tools jump bar. Sorted dated hardware updates newest first. Fixed ambiguous duplicate-ID handling in imported bridge backups.
- Removed the store-by-store retail pricing form from the loaded interface. The data-staging inbox remains for batch CSV/TSV files.
- The earlier note that Taiwan rows were absent is superseded below. The current private workbook now holds 9,985 June to September 2026 archive rows across four issuer populations, in addition to its September live feed. The public SiteFeed contains 2,587 issuer series. Four consecutive months are available for 2,461 issuers.
- Kept the private paper books, Taiwan source history and calculation definitions, AI filing watch, 220-source directory, saved research notes, and existing analysis modules. No files were deleted.

Full verification: every `tests/check-*.mjs` passed, as did `node --check` for the changed JavaScript and `git diff --check`.

## Taiwan history and usability pass

- Imported the official MOPS `_0` combined domestic and foreign monthly revenue archives for listed, OTC, emerging, and publicly issued companies, June to September 2026. The preview validated 16 reports and 9,987 rows; 9,985 distinct rows were appended after exact economic matches were skipped.
- Fixed the public feed rebuild to normalize Google Sheets date cells to `YYYY-MM` before counting consecutive observations. This enables Δ1 to Δ3 only when the issuer has four consecutive monthly reports. The refreshed SiteFeed has 2,587 issuer series, including 2,461 with four consecutive observations.
- The four-month series was verified for TSMC, MediaTek, and Delta Electronics. Those are source-reported revenue growth changes, not forecasts.
- The feed includes English names or abbreviations for 2,556 issuers and a Mandarin pronunciation lookup for all 2,587. Thirty-one issuers have only the pronunciation lookup.
- The Taiwan page copy and table were revised to show the loaded history, format report months, keep pronunciation and source links, and tuck trend details under a row expander.
- The next daily refresh retained 1,110 September API snapshots as separate source-provenance revisions after the archive import. Both versions remain in the append-only history, and the SiteFeed uses the newest retrieved row. Exact underlying monthly values were preserved, not removed.

## Taiwan feed bridge and name display follow-up

- Expanded the published feed with reported prior-month revenue, year-ago month revenue, reported MoM change, YTD revenue, prior-year YTD revenue, and YTD growth. The source comparison bases stay visible in the website row details.
- Updated the live Apps Script and rebuilt the published SiteFeed. It now has 33 fields and 2,587 issuer rows. A fresh read confirmed all six revenue bridge fields for the September 2026 records.
- Re-ran the official exchange profile lookup: 2,556 of 2,587 issuer rows have an English company name or abbreviation, and all 2,587 have a Mandarin pronunciation lookup. The Website feed table had a header-name mismatch that hid the pronunciation link; the local app now reads the exact Sheet header.
- Changed stale feed notes that described the workbook as an empty template. The page and CSV note now identify the observations as monthly reported data, not real time.
- Formatted revenue and rate values for scanning, updated the issuer count after feed load, and fixed the checked-in monthly import helper so it no longer calls an optional fallback function that is absent from the repository.

## Filing bridges and Taiwan margin match

- Added an SEC CompanyFacts bridge to AI filing leads. Facts are filtered to what was public by the lead date, retain the original taxonomy, concept, period, unit, filing form and source link, and do not combine alternative revenue concepts. Gross and operating margins are shown only when period and unit match. Cash and debt are treated as period-end balances. Old leads are backfilled at a maximum of 20 per run. Missing facts remain unavailable.
- Added official manual filing links and access notes for eight non-US markets. Only the SEC feed is automated. See [international issuer sources](international-issuer-watch-2026-10-13.md) and [SEC operating bridge rules](sec-operating-bridge-2026-10-13.md).
- Fixed Taiwan margin attachment when the monthly company name differs from MOPS quarterly statements. Code-only matching is permitted only if the quarterly records contain a single distinct issuer identity for that code. A regression test covers the unique-code case.
- Verified the private SiteFeed currently includes September 2026 and showed four consecutive monthly observations for sampled September rows. The public feed remains restricted, so the site has not been verified against this current Sheet data.
- Checks: `node tests/check-ai-pivot-watch.mjs`, `node automation/sec-filing-screen.mjs --self-test`, `node tests/check-taiwan-signal-math.mjs`, `node tests/check-mops-monthly-backfill.mjs`, and `git diff --check`.
