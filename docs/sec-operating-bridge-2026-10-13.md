# SEC lead operating-metric bridge

Reviewed 13 October 2026. New SEC AI-language or verified name-change leads can carry a compact filing-as-of operating snapshot. Existing saved leads are filled gradually, with no more than 20 old records checked in one daily run.

## Inputs and rules

- Source: [SEC CompanyFacts API](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), fetched server-side with the existing SEC request pacing and declared User-Agent.
- As-of cutoff: only facts with `filed` on or before the lead's filing date are eligible. A later filing cannot change the historical information set for that lead.
- Income statement: revenue, gross profit, operating income, and net income are matched to the same exact period, taxonomy, and unit. A reported 3-month fact is preferred when it is the latest reported period. A 6-month or 9-month cumulative fact keeps its actual start/end dates and is not relabeled as a quarter.
- Balance sheet: cash and current/long-term debt are matched to the same end date and unit as the selected income statement period.
- Margins: gross profit divided by revenue and operating income divided by revenue, only when the numerator and denominator match exactly. Zero revenue leaves the margin unavailable.
- Provenance: every metric retains taxonomy, tag, unit, form, filing date, accession, and source link. Alternative revenue concepts are not summed. USD is selected only when that same concept and period is also reported in USD. Other units remain explicitly labeled.
- Missing facts are blank. No imputation or currency conversion occurs.

## Limits

CompanyFacts contains standard taxonomy concepts that apply to the filer as a whole. It does not include custom concepts or segment-only facts. Some 8-K and 6-K filings have no usable statements. IFRS reporters may use a different taxonomy and filing cadence. The snapshot is a triage bridge, not a trend series, and it does not establish that a recently announced AI business has begun operations.

## Test coverage

`tests/check-ai-pivot-watch.mjs` includes synthetic US-GAAP and IFRS examples, alternative revenue tags, USD/EUR units, quarterly versus year-to-date periods, instant balance sheet facts, a filing-date cutoff, source links, and a zero-revenue margin case. It also checks that the dashboard renders the metric source details and missing-value text. These tests do not prove that live SEC requests will return complete facts for every issuer.
