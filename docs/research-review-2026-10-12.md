# Source review, 12 October 2026

Reviewed 21 sector source cards across all 11 broad equity sectors, with separate groups for hardware and compute, semiconductor capacity, and the consumer and retail reference set. The library is uneven by sector. Most non-core groups have one source, so the index should be read as starting coverage rather than a complete industry dataset catalog.

## Accepted source cards

- Information Technology, hardware and compute: ComputePulse GPU price tracker; GoHereBro IBEW job call map.
- Semiconductor capacity: CHIPS for America award updates; SIA and WSTS global sales; TSMC monthly revenue.
- Media and entertainment: Nielsen The Gauge; Netflix weekly Top 10; Spotify charts; SteamDB player charts.
- Consumer and retail: Census retail trade and e-commerce; Google Trends.
- Energy: EIA Weekly Petroleum Status Report.
- Materials: USGS mineral statistics and commodity summaries.
- Industrials: Port of Los Angeles container statistics.
- Consumer discretionary: BEA Personal Consumption Expenditures by category.
- Consumer staples: USDA grocery egg feature activity and advertised prices.
- Health Care: ClinicalTrials.gov trial records and API.
- Financials: FDIC BankFind quarterly financial reports.
- Utilities: EIA-923 power plant operations.
- Real Estate: Zillow Research housing and rental data.
- Communication Services: FCC National Broadband Map and availability downloads.

## Corrections and limits

- ComputePulse says it polls provider APIs every 60 seconds, but its displayed timestamp was 2 October, ten days before review. The card calls the snapshot stale.
- GoHereBro showed an 11 October map date. Its calls measure union-hall dispatch activity, not project-site hiring. The map offers a free account; paid extras are excluded. Confirm individual calls with the local hall.
- The USDA AMS report index listed report 2757, published 9 October for the week ending 3 October. This is a narrow advertised egg-promotion sample with a reporting lag, not transactions or unit volume.
- The Port of Los Angeles container-statistics page showed August 2026 at 955,906.5 TEUs, down 0.26% year over year. September had not yet been posted on 12 October. This single port is not total U.S. trade.
- FCC materials confirmed 30 June 2026 as a provider filing vintage. The public map's display of that vintage was not confirmed as of review. The card treats it as a filing date, not a confirmed map release date.
- Berkeley Lab interconnection queues, US Energy Map, BLS electrician wages, Census construction spending, ONS footfall, city pedestrian counters, and the data-center project map remain distinct references in the capacity and source register because their measures and coverage differ.
- US Energy Map's public map view is linked. Its paid download feed is excluded. dcmap.us stays labeled as an overlapping alternative.
- No universal free cross-platform subscriber-growth series for music or video streaming was found. Public charts here measure viewing, chart positions, or game activity, not subscriber additions.

The cards are research leads and operating-metric hypotheses. Their review date does not imply that the source is current today. Check each provider's latest observation, access terms, coverage, and units before relying on a signal. No existing project files or source entries were removed in this review.

## Capacity and semiconductor additions, 12 October 2026

Four primary-source cards were added after a second review of capacity and semiconductor operating data:

- **EIA Hourly Electric Grid Monitor:** prior-hour demand updates hourly, morning forecasts, and generation/interchange with about a one-day lag. Dashboard timestamps vary by view; it does not identify data-center load or provide hourly prices.
- **EIA-860M generator inventory:** monthly preliminary unit-level status and capacity, including proposed and retired units. August 2026 was released September 24. Proposed MW is not committed or customer-available supply.
- **NERC 2025 Long-Term Reliability Assessment:** annual planning context, including 224 GW forecast North American summer peak-demand growth over 2025-2035. This is a planner forecast based on mid-2025 inputs, not a live load tracker.
- **Federal Reserve G.17 / FRED NAICS 3344 production index:** August 2026 index observation adds a domestic production-side check alongside SIA/WSTS sales and TSMC revenue. It includes electronic components beyond semiconductors and is not wafer capacity or utilization.

The capacity view now presents project announcements, build constraints, grid and supply evidence, and operating results as a diligence sequence. It is not a geographic crosswalk and does not join provider records to the same project. Each arrow remains a hypothesis that needs project and company evidence.

USITC DataWeb was reviewed but not added in this pass. It can answer detailed product and country trade questions, but requires analyst-maintained tariff codes and may require a free login for some saved or advanced functions. It is a useful follow-up when a specific hardware code and supply-chain question are defined, rather than a ready-to-use broad tracker.

## Additional industry additions, 12 October 2026

Five sources widen industry-level and operating coverage:

- **CMS Medicare Part D drug spending:** Q1 2026 was the latest available period. Quarterly drug-level gross spending, claims, and beneficiaries add a product-uptake signal for one payer segment. Rebates are excluded, recent claims mature, and it is not total market demand.
- **Federal Reserve H.8:** weekly aggregate assets, liabilities, deposits, and loans, with balances generally dated to the prior Wednesday. The October 9 release was current as checked. It is a banking-system series, not bank-level data; the Fed plans to remove its Build Your Package feature in November 2026.
- **BTS airline on-time performance:** July 2026 flight-level domestic nonstop operating data were the latest available. This tracks flight completion, delays, and taxi times, not passenger demand or revenue.
- **Census M3 manufacturing orders and backlog:** August 2026 shipments, inventories, new orders, and unfilled orders provide a monthly industrial demand measure. It is a broad U.S. survey estimate, not a named company's order book.
- **EIA weekly natural-gas storage:** the October 8 release showed Lower 48 working gas through October 2. Storage complements petroleum balances, but is not deliverable pipeline capacity or company inventory.

TSA checkpoint data were held because the provider page returned 403 during the review and current observations could not be confirmed. No source was added from that lead.

The library now has 30 source cards across the existing 14 groups, covering all 11 broad equity sectors plus hardware and semiconductor niches. This remains a selective starting set, not equally deep industry coverage.
