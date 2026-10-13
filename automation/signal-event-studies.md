# Signal event studies module

`public/signal-event-studies.js` provides a browser-only tool for describing how one operating series changes around dated events. It sends no requests and does not write pasted inputs to browser storage.

## Inputs and rules

- Signal and event tables accept comma-separated or tab-separated rows. Signal rows use `period,value`; event rows use `date,event`. Headers are optional.
- Supported period keys are `YYYY`, `YYYY-MM`, and `YYYY-MM-DD`. The event period must match a signal period exactly. Monthly and annual series are expanded onto a regular calendar grid so omitted periods count as missing data. Daily series use the submitted observation order because market calendars include weekends and holidays.
- The pre-event baseline can be the mean of the selected pre-event window or its last observation. The post window begins with the event period. The displayed change is post-window mean minus baseline. Percent change divides by the signed baseline, and is omitted when baseline is zero.
- A window must meet the chosen coverage percentage on both sides. Overlapping event windows are excluded by default to limit dependence. Duplicate periods are excluded because the intended value or event identity is ambiguous.
- Aggregate summary is withheld unless the selected minimum number of qualifying independent events is reached and signal/event frequencies match. This is a modest screen, not a statistical-power threshold.

## Limits

Results are descriptive, not causal. Event dates can be endogenous or inaccurately aligned, operating definitions can change, and common shocks, seasonality, revisions, selected events, and small samples can dominate the pattern. A return series can be pasted, but the module does not calculate market-adjusted returns, factor exposures, confidence intervals, or a causal control-group estimate. If returns are supplied, the analyst must make units explicit. Use a control series and pre-specify event selection when possible.

## Integration hook

Load `public/signal-event-studies.js` after the app's module registry exists. It registers `FieldSignalsModules.eventStudy` with `title`, `render()`, and `attach(container)`, following the module contract used by `public/divergence-validation.js`. The shell/router can add a tab or tool entry and invoke `render()` plus `attach()` without changing the analysis functions. The pure functions are exported in CommonJS for Node tests.

Run `node tests/check-signal-event-studies.mjs` to check parsing, baselines, regular-period gaps, missingness, overlapping-event exclusion, frequency matching, and minimum sample safeguards.
