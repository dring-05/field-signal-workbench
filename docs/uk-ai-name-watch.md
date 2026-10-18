# UK AI name-change watch

The Companies House company-profile stream can support a forward-looking screen for UK legal-name changes that newly add wording such as “AI,” “generative AI,” “machine learning,” or “artificial intelligence.” The adapter is at `automation/uk-ai-name-watch.mjs` and emits review leads with the before and after name, registry link, change date, company type, status, and stream checkpoint.

## Access

Companies House public company data is free to access. Live API requests still require a Companies House user account and an API key. Create a live API key in the official [developer portal](https://developer.company-information.service.gov.uk/how-to-create-an-application/), then set it as `CH_API_KEY` in the environment where the script runs. The script does not save or print the key. Without a key, live mode cannot run. Offline `--input` mode can inspect a saved newline-delimited stream file without a key.

The official stream sends events as they occur and accepts a `timepoint` checkpoint for reconnecting. Start a short bounded session with:

```sh
CH_API_KEY='your-key' node automation/uk-ai-name-watch.mjs --seconds 45 --max-events 1000 --output uk-ai-name-leads.json
```

The output's `latestTimepoint` is the checkpoint to pass to the next run using `--timepoint N`. This is a forward monitor, not a historical dump. The first connection without a timepoint receives events from the point of connection onward. Resume from saved timepoints to avoid gaps. A bounded run may return zero events if no registry updates arrive before its time or event limit.

## What a lead means

The screen only flags an observed company-profile update where the current name contains AI-related wording and the latest prior name does not. The previous name's `ceased_on` date must fall within the selected window. It ignores unrelated profile updates when the event's `fields_changed` list does not include a name field. It does not read filing documents, so it cannot identify AI language newly inserted into reports or announcements. It does not determine whether a company is listed on an exchange. A `plc` legal form is not proof of a listing. Cross-check the candidate against an exchange or issuer IR site before treating it as public-equity coverage.

Name changes can be cosmetic or unrelated to operations. A lead is not evidence that the company has an AI business, revenue, or a short thesis. Read the linked registry entry and the filed name-change documents, then inspect the company's filings and operating evidence.

## Official source and schema

- [Companies House basic company information stream](https://developer-specs.company-information.service.gov.uk/streaming-api/reference/company-information/stream) documents the stream endpoint, API-key requirement, and resumable `timepoint` parameter.
- [Companies House companyProfileStream schema](https://developer-specs.company-information.service.gov.uk/streaming-api/resources/companyprofilestream) documents `company_name`, `company_number`, `type`, `previous_company_names`, `event.fields_changed`, `event.published_at`, and `event.timepoint`.
- [Companies House API authentication](https://developer.company-information.service.gov.uk/authentication/) documents API-key authentication.
- [Companies House developer guidelines](https://developer.company-information.service.gov.uk/developer-guidelines/) documents rate limits. The adapter limits each connection by event count and duration.

The fixture test validates the adapter against the official documented field structure. No live Companies House key was available for an authenticated request, so live connectivity and current stream delivery have not been verified here.
