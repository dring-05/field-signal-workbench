# Messy importer QA fixtures

All observations in this folder are synthetic. They do not contain user notes or copied provider data. Use them only to check the browser importer in `public/index.html`.

## Run

From this project directory, validate the fixture files with:

```sh
node tests/check-fixtures.mjs
node tests/check-source-cards.mjs
node tests/check-app-functions.mjs
```

Then open `public/index.html`, navigate to **Messy data importer**, and import each file below. For each file, map the date/period, numeric measure, and optional group columns. Keep the fixture's expected behavior beside you while checking the rendered preview and chart. The fixture check validates fixture integrity, not production importer behavior. The source-card check validates required fields, HTTPS links, IDs, and broad-sector coverage. The app-function check exercises date handling and question-to-source routing.

## Browser acceptance checklist

| Fixture | Map | Expected result to check |
| --- | --- | --- |
| `01_quoted_fields.csv` | `period`, `visits`, `region` | Three rows survive. `Washington, DC`, the escaped quote in the note, and the embedded newline remain in their respective cells. Delimiter is comma. |
| `02_utf8_bom.csv` | `date`, `value`, `region` | Header is `date`, without a visible replacement character or hidden BOM. Two rows survive. |
| `03_locale_numbers.csv` | `date`, `amount`, `region` | US thousands/decimal, European thousands/decimal, parenthesized negative currency, and percent formats are each parsed correctly or rejected with an explicit explanation. Do not silently accept a wrong magnitude. |
| `04_dates_and_missing.csv` | `period`, `value`, `region` | ISO and month labels remain in sensible chronological order. Ambiguous `01/02/2026` is skipped in auto mode and accepted only after choosing US or day-first. Excel serial `45292` requires Excel mode. Blank date and value rows are skipped. |
| `05_duplicates_and_ragged.csv` | `date`, `wage`, `local` | Missing wage is skipped. Short and extra-cell rows are counted as ragged and excluded. Same-date/same-local duplicate is counted and retained, so check whether repeated observations are appropriate for the measure. |
| `06_wide_table.csv` | `period`, one regional value column | Check whether the interface can reshape a wide table into regional series. If it cannot, record that as unsupported rather than treating another column as the location field. |
| `07_tab_separated.tsv` | `date`, `open_calls`, `local` | Tab delimiter is detected, including the space in `Local 26`. Four rows chart in date order. |
| `08_unclosed_quote.csv` | Any mapping | The file is rejected or the malformed row is clearly isolated. It must not silently absorb the remaining file into one field. |

For every successful import, check x-spacing, y-axis units, visible gaps, the 180-point chart cap, 10-row table preview, source metadata, browser refresh persistence, and that the file never uploads. Reload the page and confirm the saved import is labeled. After selecting an invalid file, confirm any previously saved series is clearly marked as a saved import. Clear local browser storage between runs only if you do not need its current notes or import.

## What counts as a pass

The importer must either preserve and chart the observation correctly or report why it cannot. It should not silently coerce ambiguous dates or locale-specific numbers, hide truncated rows, conceal malformed records, or make irregular time intervals appear evenly spaced. A test that the fixtures load is not evidence that every public dataset format is supported.
