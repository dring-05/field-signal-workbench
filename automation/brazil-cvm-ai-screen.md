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

The scanner checks text-based HTML, XML, and text files. For PDFs it tries `pdftotext` first, then a Python `pypdf` fallback. Install `pypdf` into the Python environment selected by `PYTHON` (default `python3`) if `pdftotext` is unavailable. Extraction is capped at 100 pages, 2 MB of text, 20 seconds for the fallback, and the downloaded document is capped at 16 MB. Encrypted, oversized, malformed, or image-only PDFs remain unreadable; the scanner does not OCR them. `scanStats` reports PDFs that could not be parsed, failed requests, and truncated date-window coverage. The phrase rules cover common English and Portuguese terms but do not comprehensively analyze Portuguese filing language. Risk-section suppression is not implemented for this market, so risk disclosures can surface as false positives.

The PDF fallback has fixture coverage for its command selection and scanner integration. On 2026-10-17, a bounded scan of the official 2026 CVM IPE archive selected five recent documents: four official PDFs downloaded and extracted successfully through `pypdf`; one document request failed. This validates extraction on live PDFs, not complete archive coverage or the AI screen's recall. Any scheduled run should install `pypdf` or `pdftotext` explicitly and monitor `failedDocuments`, `unparsedPdf`, and `truncated` before treating a scan as complete.

## Name changes and metadata leads

The feed keeps the issuer name associated with CVM code or CNPJ and can flag a later name that differs from the previous local snapshot and includes AI language. The snapshot is first established on the first successful run, so a name change predating that run is not detectable this way. A name change lead requires manual verification against the original filing and CVM registry.

If an IPE index row's category, type, or subject includes an AI business phrase, the scanner can emit a metadata lead even if the document itself is not readable. If readable document text produces the match, the lead labels its evidence as filing text. The two sources remain separate when both match. Narrow English and Portuguese denial phrases near the AI term are suppressed, but this is not Portuguese-language sentiment analysis. This is an alert queue, not a full-text search index and not a record of every filing.

## Access, licensing, and operational limits

No API key is needed for the public annual archive or linked public documents. The CVM's separate historical “Download Múltiplo” service requires a CVM-issued login, so this script does not use it. The public archive is preferable for a no-secret workflow, but its index and documents are not validated here against a byte-for-byte live archive fixture. Shell network access was unavailable during implementation. The offline end-to-end test builds a small reconstructed archive using the publicly reported IPE field names; it validates zip parsing, index normalization, document fetching, extraction, lead output, and duplicate suppression, but it does not prove the live archive's precise delimiter, filenames, encodings, or link behavior. Before scheduling this, perform one live run and inspect its coverage counters and sample leads.

The dataset is ODbL. Attribute CVM and review the license's attribution and share-alike obligations before redistributing a derived database. This adapter does not publish a feed, create a scheduled workflow, write Google Sheets, or access paid data.
