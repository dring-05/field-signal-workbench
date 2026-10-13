# Source freshness monitor

## Purpose

This analyst tool keeps a manually verified release log for public data sources. Each record stores the provider, sector or coverage, stated cadence, expected period, expected release date, grace days, and source URL. Each check appends the latest observed period, date checked, revision flag, evidence URL, and note. Source settings and the expected period can be edited later without replacing check history.

It does not poll a website or API, determine the provider's real release calendar, notice a revision automatically, or certify that a dataset is complete. The late, missing, revised, and stale labels are derived from user-entered fields. “Current at last check” means the last recorded check is within the configured cadence window. It is not a guarantee the source is current today.

## Integration hook

The module is `public/source-freshness.js`. It registers itself at `window.FieldSignalsModules.sourceFreshness` with the `title`, `render()`, and `attach(container)` interface used by the analyst-tools renderer in `public/app.js`.

To integrate, add this deferred script before `app.js` in `public/index.html`:

```html
<script src="source-freshness.js" defer></script>
```

The existing analyst-tools page enumerates registered modules and attaches them automatically. This module should be added to that page. It should not replace the static source library's existing source-freshness notes or the `#sources` route.

## Status rules

- **Late:** the expected release date plus grace days has passed and the last observed period does not equal the entered expected period.
- **Missing:** an expected release date plus grace days has passed with no check logged, or the latest check explicitly records that the release is missing.
- **Revised:** the analyst marked that the observation changed since the previous check.
- **Check overdue:** elapsed days since the last manual check exceed cadence days plus grace days. Event-driven sources do not age into this label.
- **Not checked:** no check has been recorded and the expected release date has not passed.
- **Current at last check:** none of those conditions applies. This describes the log, not a live connection to the provider.

Multiple flags can apply. The expected period uses exact text matching, so keep period labels consistent, for example `2026 Q2` or `2026-09`.

## Storage and backups

Records use local storage key `fieldSignals.sourceFreshness.v1` in the current browser profile. The panel includes JSON export and import. Import adds valid records with new IDs and leaves existing IDs untouched. The data is not password-protected, synced, or uploaded to the Field Signals site. Do not put private research in the notes.

## Test

Run `node tests/check-source-freshness.mjs` from the repository root. The test covers input validation, status calculation, browser storage helpers, safe evidence URLs, and module registration.
