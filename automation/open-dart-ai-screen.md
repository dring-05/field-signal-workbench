# Korea OpenDART AI and name-change screen

This adapter searches OpenDART disclosure metadata for KOSPI, KOSDAQ, and KONEX classes, reads selected original filing archives, and emits review leads in the same general shape as the SEC AI watch. It uses official OpenDART endpoints. It does not produce an investment conclusion.

Official endpoint references:

- [Disclosure search API](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019001)
- [Corporate code registry API](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019018)
- [Original filing document API](https://opendart.fss.or.kr/guide/detail.do?apiGrpCd=DS001&apiId=2019003)
- [OpenDART access terms](https://opendart.fss.or.kr/intro/terms.do)

## Turn it on

1. Create an OpenDART account and obtain an API key from the official site. The user supplies and controls this key. The adapter does not collect, prompt for, or store it.
2. In the terminal or runner that will execute the scan, set `OPENDART_API_KEY` to that key. For a local one-time run in zsh, enter `export OPENDART_API_KEY='your key'` in the terminal session. Do not add the key to source files, the feed, or version control.
3. From the repository root, run `node automation/open-dart-ai-screen.mjs --feed public/open-dart-ai-watch.json`.
4. To choose a date window, pass `--from YYYYMMDD --to YYYYMMDD`. The interval cannot exceed 90 days. The default scans the most recent seven calendar dates.
5. Run deterministic offline tests with `node tests/check-open-dart-ai-screen.mjs`. The tests use fixtures and a mocked fetch implementation. They make no API requests.

If this is later run in GitHub Actions, add the key through repository Settings, Secrets and variables, Actions, with the name `OPENDART_API_KEY`, and expose that secret only to the scheduled scan step. This adapter does not create that workflow or configure the repository secret.

## Feed fields and interpretation

Leads contain `company`, `mappedCompany`, `ticker`, `stockCode`, `exchange`, `form`, `filingDate`, `filingUrl`, `label`, and `evidence`, plus `source: OpenDART`, `market: KRX`, `corpCode`, `accession`, a lead type, match counts, and `reviewedByHuman: false`. `filingUrl` opens the official DART receipt page. `corpRegistry` stores the registry snapshot needed to compare issuer names on a later run. The API key is not copied into the result.

AI terms include selected English and Korean spellings, including `인공지능`, `생성형 AI`, and common AI business, product, service, semiconductor, and data-center contexts. The filter screens only text extracted from HTML, XML, and text files in the original filing ZIP. It filters nearby risk-only mentions. New wording is reported only when a comparable prior report family can be found and downloaded within the preceding 90 days. When no comparable prior filing is available, the lead says so instead of asserting novelty.

The legal-name signal needs both a changed name in the saved registry baseline and corroboration of the old name, new name, and name-change wording in an original filing. On the first run, the registry is only a baseline. OpenDART's `modify_date` alone is not treated as a name change.

The implementation bounds each run to 150 selected filings and 1,200 API requests by default. It scans the listed-company registry and searches the three listed-company classes. The OpenDART search endpoint permits at most 100 rows per page. A capped scan records truncation in `scanStats`; rerun with an adjusted date window or limits if coverage is incomplete. The registry and filing APIs return ZIP archives. This adapter skips PDFs and unsupported/encrypted/Zip64 archives. Korean-language terminology, OCR, filing classification, subsidiaries, and documents outside OpenDART are not comprehensively covered. A matched phrase is a prompt to read the filing, not evidence of revenue, commercial success, or investment merit.
