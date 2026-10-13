# International issuer-language sources

Reviewed 13 October 2026. This is a source map for the AI name and filing watch, not a claim that these markets are being monitored automatically. The scheduled feed still covers SEC-mapped filers only.

| Market | Primary source | Practical access and limit |
| --- | --- | --- |
| United Kingdom | [Companies House API](https://developer.company-information.service.gov.uk/overview/) | Free API access requires a key. Match events by company number and registered filing date. The registry covers UK-registered companies, not every issuer listed in London. |
| Hong Kong | [HKEX issuer announcements](https://www.hkex.com.hk/eng/market/sec_tradinfo/tradarng/etatgem.htm) | Public notices identify registered company-name and trading-name changes. Confirm each event in the linked announcement. |
| Taiwan | [MOPS](https://mops.twse.com.tw/) | Public issuer profiles, announcements, and financial reports. Automated document discovery and English-language coverage remain unvalidated. |
| South Korea | [OpenDART](https://engopendart.fss.or.kr/) | Official disclosure search and structured data/API entry point. A country adapter and separate credential handling would be needed. |
| Japan | [EDINET API materials](https://disclosure2dl.edinet-fsa.go.jp/guide/static/disclosure/WEEK0060.html) | Official API v2 for document discovery and retrieval. API-key registration is required and specifications are Japanese. |
| India | [NSE corporate announcements](https://www.nseindia.com/companies-listing/corporate-filings-announcements) | Public search by company, subject, and date with document downloads. Bulk machine ingestion is not implemented. |
| Canada | [SEDAR+ public access](https://systems.securities-administrators.ca/onlinehelp/general-help/getting-started/general-public-access/) | Public filings are available, but searchable text coverage is limited. It is not a complete text-screening source. |
| Australia | [ASX announcement search](https://www.asx.com.au/asx/v2/statistics/announcements.do) | Public announcement search includes name and code changes. Bulk machine access has not been verified. |

## Implementation decision

Keep the live product labels precise: registered legal-name change, change in the issuer's own business description, and AI keyword mention are separate events. A keyword match does not establish an AI pivot or a short thesis. The live SEC feed is the only scheduled market feed. The dashboard now links the official portals above for country-by-country manual checks and shows the main access limits beside each link.

Next automation candidates are Companies House, federal Canadian corporations, and NSE India, after their APIs, identifier matching, and update coverage are verified against real issuer examples. Taiwan, Hong Kong, Korea, Japan, and Australia require dedicated language and document-format validation first. Do not combine issuer counts across sources without a stable legal-entity and listing identifier crosswalk.

## Sources checked

- [SEC API overview](https://www.sec.gov/search-filings/edgar-application-programming-interfaces), [EDGAR full-text search](https://www.sec.gov/edgar/search/), and [Form 8-K](https://www.sec.gov/divisions/corpfin/forms/8-k.htm).
- [Companies House API](https://developer.company-information.service.gov.uk/overview/) and [UK name change rules](https://www.gov.uk/make-changes-to-your-limited-company/company-name).
- [EDINET API materials](https://disclosure2dl.edinet-fsa.go.jp/guide/static/disclosure/WEEK0060.html) and [API registration guidance](https://disclosure2dl.edinet-fsa.go.jp/week0020.aspx).
- [OpenDART](https://engopendart.fss.or.kr/) and [Taiwan MOPS](https://mops.twse.com.tw/).
- [NSE filings](https://www.nseindia.com/companies-listing/corporate-filings-announcements), [HKEX announcements](https://www.hkex.com.hk/eng/market/sec_tradinfo/tradarng/etatgem.htm), [SEDAR+ public access](https://systems.securities-administrators.ca/onlinehelp/general-help/getting-started/general-public-access/), and [ASX announcements](https://www.asx.com.au/asx/v2/statistics/announcements.do).
