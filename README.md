# Field Signals

Field Signals is a research workbench for tracking operating signals and connecting them to company metrics. It includes a question planner, a source freshness register, sector source cards, a capacity view, an evidence notebook, an operating-metric bridge, and a local messy-data importer.

The source library has cards across all 11 broad equity sectors, with additional detail for compute, semiconductors, media, and capacity. Some sectors have only one narrow public source, and coverage is not equally deep. The capacity map lays out evidence from project announcements through labor, grid supply, and operating results. It does not connect provider records to the same project or establish causality.

## Run locally

Open `public/index.html` in a browser. The question planner, notes, evidence receipts, and CSV imports run in the browser. They are saved only in that browser's local storage. They are not uploaded to this site and do not sync across devices.

Deploy the static assets to a Cloudflare Worker with:

```sh
npx wrangler deploy
```

## Data notes

- The source cards record when the provider page was checked, the latest observation or release visible, free-access limits, and reuse caveats.
- Advertised update frequency is not proof that a source is current. For example, ComputePulse describes frequent polling, but its displayed timestamp was older than the review date. Its card flags that discrepancy.
- GoHereBro reports IBEW open calls and local wage scales. It is not affiliated with IBEW. Calls are not proof of hiring at a named project, and the listed base scale is not take-home pay.
- The messy-data importer expects a header row and long-format data with one date, one value, and optionally one category per row. It handles CSV, TSV, and semicolon-delimited text, exports normalized rows for the selected category, but does not reshape wide tables or identify preamble rows. Monthly and annual period labels keep their original precision. Review skipped, ragged, duplicate, and truncated row counts before using a chart.
- Charts and source updates are not refreshed automatically. Imported files remain in the browser where they were opened. Review units, dates, sampling, and coverage before making a company-level inference.
- Sector cards are dated research leads. A provider page may change after its review date; the freshness note records the observation or cadence checked on that date.

This project does not provide investment advice or an earnings estimate.
