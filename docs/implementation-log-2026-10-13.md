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
- Changed the Taiwan page to say the workbook has no imported company rows and its public feed is not connected. The live Google Sheet was verified empty; quarterly, ownership, and trade categories are labeled unpopulated.
- Kept the private paper books, Taiwan source history and calculation definitions, AI filing watch, 220-source directory, saved research notes, and existing analysis modules. No files were deleted.

Full verification: every `tests/check-*.mjs` passed, as did `node --check` for the changed JavaScript and `git diff --check`.
