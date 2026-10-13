# Brazil CVM AI and name-change leads

This is an experimental, local first-pass screen for CVM-registered Brazilian issuers. It downloads the official annual IPE archive, selects filings by delivery date, follows public document links, and flags selected English and Portuguese AI-business language for review. It stores links and excerpts, not the full filing. A match does not establish an AI pivot, revenue, commercial traction, deception, or a short thesis.

The CVM Open Data portal describes IPE as issuer periodic and event filings. Its archive is open under the Open Data Commons Open Database License (ODbL), grouped by delivery year. The current and prior year are refreshed weekly. The official archive index listed the 2026 archive at about 2 MB with an October 11, 2026 timestamp when checked October 12, 2026. Sources: [CVM IPE dataset](https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe), [official IPE archive index](https://dados.cvm.gov.br/dados/cia_aberta/DOC/IPE/DADOS/), [CVM open-data plan](https://www.gov.br/cvm/pt-br/assuntos/noticias/2026/cvm-publica-plano-de-dados-abertos-2026-2028).

## Run it

From the repository root:

```sh
node automation/brazil-cvm-ai-screen.mjs --feed public/brazil-cvm-ai-watch.json
node automation/brazil-cvm-ai-screen.mjs --year 2026 --from 2026-10-01 --to 2026-10-12 --feed public/brazil-cvm-ai-watch.json
node tests/check-brazil-cvm-ai-screen.mjs
```

It scans only one calendar year's IPE archive per run. Document requests are capped at 500 by default; adjust with `--max-docs`. A feed file stores completed filing protocol and version keys so successful reads are not downloaded again. Failed document requests remain eligible for retry. The feed can retain up to 20,000 checked keys and 1,000 current-year leads. The archive is re-downloaded on each run.

The scanner checks text-based HTML, XML, and text files. It attempts PDF extraction only if `pdftotext` is installed locally. `scanStats` reports PDFs that could not be parsed, failed requests, and truncated date-window coverage. PDF extraction is not built into Node, and scanned/image-only PDFs are outside scope. It does not OCR documents. The phrase rules cover common English and Portuguese terms but do not comprehensively analyze Portuguese filing language. Risk-section suppression is not implemented for this market, so risk disclosures can surface as false positives.

## Name changes and metadata leads

The feed keeps the issuer name associated with CVM code or CNPJ and can flag a later name that differs from the previous local snapshot and includes AI language. The snapshot is first established on the first successful run, so a name change predating that run is not detectable this way. A name change lead requires manual verification against the original filing and CVM registry.

If an IPE index row's category, type, or subject includes an AI business phrase, the scanner can emit a metadata lead even if the document itself is not readable. It labels the lead as metadata-based and links to the original when a link is present. Text extracted from a readable source document is separately identified by its excerpt. This is an alert queue, not a full-text search index and not a record of every filing.

## Access, licensing, and operational limits

No API key is needed for the public annual archive or linked public documents. The CVM's separate historical “Download Múltiplo” service requires a CVM-issued login, so this script does not use it. The public archive is preferable for a no-secret workflow, but its index and documents are not validated here against a byte-for-byte live archive fixture. Shell network access was unavailable during implementation. The offline end-to-end test builds a small reconstructed archive using the publicly reported IPE field names; it validates zip parsing, index normalization, document fetching, extraction, lead output, and duplicate suppression, but it does not prove the live archive's precise delimiter, filenames, encodings, or link behavior. Before scheduling this, perform one live run and inspect its coverage counters and sample leads.

The dataset is ODbL. Attribute CVM and review the license's attribution and share-alike obligations before redistributing a derived database. This adapter does not publish a feed, create a scheduled workflow, write Google Sheets, or access paid data.
