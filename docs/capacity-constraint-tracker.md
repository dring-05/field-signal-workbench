# Capacity constraint tracker

`public/capacity-constraint-tracker.js` is a standalone Analyst tools module for manually recording constraints across power and grid access, permits and construction, equipment lead times, and skilled labor. Each observation includes an entity/site and geography, signal or issue, optional numeric reading and unit, source period, source date, date checked, next review date, status, evidence confidence, source name and URL, and an optional manually selected prior observation, open gap, and scope caveat.

The next-check date is a reminder only. “Review date reached” does not mean the provider's page is stale or the constraint persists. The module has no network connection and does not poll sources. Entries stay in browser local storage under `field-signals-capacity-constraints-v1`; JSON export/import is provided for backups. There is no automatic project matching or summing across observations. Units and periods should be consistent before comparing records.

## Integration hook

Load the module script from `public/index.html` alongside other Analyst tools modules. It registers as `window.FieldSignalsModules.capacityConstraintTracker`, which the existing Analyst tools renderer discovers by enumerating the module registry. The application shell is intentionally unchanged in this feature branch.

## Test

Run `node tests/check-capacity-constraint-tracker.mjs` for validation of evidence URLs, dates and quantities, reminder status, missing-data flags, local storage, backup ID remapping, and module registration.
