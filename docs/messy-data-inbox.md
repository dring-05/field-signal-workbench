# Messy data inbox module

`public/messy-data-inbox.js` is a standalone browser module for staging tabular research data. It accepts pasted text or a local CSV/TSV file, keeps the raw parsed table, lets the user select a header row and map common fields, and stores source name, source URL, observation date, metric/unit, and coverage with each batch. Users can correct visible cells; each edit is recorded with its original value, replacement, row, column, and timestamp.

The module writes only to browser `localStorage`. It makes no network requests and does not send staged research material to a server. The user must click “Export batch JSON” to create a local download. Browser storage can be cleared or run out of space, so exports are the durable backup. Large batches retain all rows, while manual corrections are limited to the first 100 rows in the current interface.

The integration contract is `window.FieldSignalsMessyInbox.render()` for the section markup and `window.FieldSignalsMessyInbox.attach(container)` after that markup is mounted. The host page should load this file before calling those methods. This module is not wired into the site navigation yet.

Run `node tests/check-messy-data-inbox.mjs` for parser, mapping, and local-only checks.
