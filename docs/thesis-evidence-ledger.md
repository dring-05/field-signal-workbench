# Thesis evidence ledger

The analyst-entered ledger stores a company and thesis claim alongside each dated observation, source link, direction, operating metric, possible read-through, confidence, and next check. It is a separate record per observation so a later contradiction does not overwrite earlier evidence. A correction can refer to an earlier record ID and is also retained.

The module makes no network requests. Records stay in the active browser profile and are not password protected, encrypted, backed up, or synchronized. JSON export/import is the portable backup path. Import appends valid entries and remaps colliding IDs.

Run `node tests/check-thesis-evidence-ledger.mjs` for validation, local storage, safe URL, backup merge, and registration checks.
