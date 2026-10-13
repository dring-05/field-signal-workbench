# Capacity to revenue bridge module

The standalone module in `public/capacity-revenue-bridge.js` adds analyst-entered records for power and grid access, permits, equipment, labor and construction, commissioning, utilization, customer contracts, and recognized revenue. Each record keeps its entity or project label, optional quantity and unit, source period, source name and URL, source date, evidence confidence, optional manual link to an earlier record, link confidence, and open gap or notes.

The module performs no web requests and stores data under `field-signals-capacity-revenue-bridge-v1` in the current browser profile. Exported JSON is a user-managed backup. Import adds validated records and remaps colliding record IDs while preserving links among imported records. There is no automatic company or project matching, no automatic arithmetic across stages, and no claim that a sequence is causal. Similar names or timing alone are not a link. A quantity with no unit is rejected. Qualitative observations can omit quantity and unit.

## Proposed integration hook

Load `public/capacity-revenue-bridge.js` before the main application boot. The module registers as `window.FieldSignalsModules.capacityRevenueBridge`; the existing Analyst tools renderer enumerates registered modules and mounts their `render()` and `attach()` methods. The future integration change should add the script next to other tool-module scripts in `public/index.html`, then verify that the Analyst tools navigation includes “Capacity to revenue bridge.” This module was intentionally left unintegrated pending that separate app-shell change.

## Checks

Run `node tests/check-capacity-revenue-bridge.mjs`. The test covers input validation, safe evidence URLs, explicit links, missing-link flags, local storage behavior, backup imports with ID collisions, and browser module registration.
