# Hardware market change log, reviewed 2026-10-13

This file records a manual review of public information on memory, compute, MLCCs, and advanced substrates. The structured rows live in [`public/hardware-market-changes.json`](../public/hardware-market-changes.json). Dates distinguish when the source published an update from when this review checked it.

## What changed

- **Memory:** TrendForce's free press-center summaries forecast 4Q26 contract-price increases for conventional DRAM and NAND and faster enterprise SSD pricing growth. A separate HBM summary raised its 2027 blended ASP forecast and described possible 8-high versus 12-high stack tradeoffs. These are analyst forecasts, not realized prices or supplier guidance.
- **Compute:** ComputePulse displayed H100 at $2.78 per GPU-hour and Blackwell B200/GB200 at $6.19. It showed 45 and 11 source counts respectively. Its page stated a 2026-10-11 update time when checked on 2026-10-13. The charts were loading, so this is a dated page snapshot. The claimed 60-second refresh is provider-stated, not independently verified here.
- **MLCC:** A public TrendForce summary estimated 4Q26 OEM/ODM price increases by product grade and named suppliers reportedly holding prices. Those estimates are not confirmed supplier price letters. Murata separately announced mass production of a 100Vdc, 10μF lead-type MLCC aimed at 48V systems, an identifiable company product event.
- **ABF and advanced substrates:** AT&S reported a customer-backed Chongqing expansion for high-end IC substrates and supplied capex and FY2026/27 outlook metrics. IBIDEN announced a multi-year substrate-capacity investment plan with planned production starting in FY2027. The cited expansion notices do not specify ABF material. Their inclusion under this niche is contextual, and the entries preserve that limitation instead of claiming ABF-specific capacity.

## Source and update limits

The sources linked here were readable public pages when checked; no paid report content is reproduced. TrendForce's open press-center summaries link to deeper reports that may require subscriptions. This log uses only the open summaries. Company releases and product announcements are primary sources for their own actions and forecasts, while TrendForce estimates remain secondary research.

The JSON is manually curated. It does not poll providers, detect changes, fetch history, or promise a refresh schedule. A page's own real-time or refresh claim is identified as a provider claim. `observedAt` is the date this review checked the page, not the underlying data timestamp. In particular, the ComputePulse page timestamp preceded this review and its charts did not load, so it should not be treated as a verified live feed.

## Practical follow-up metrics

For memory, compare supplier ASP, shipped bits, mix, inventory, and enterprise SSD share. For GPU compute, compare normalized GPU-hour prices with source timestamps, spot/on-demand mix, utilization, and realized discounts. For MLCCs, track grade-level ASP, utilization, orders, and qualification. For substrates, compare capex and commissioning milestones with yield, qualification, utilization, depreciation, shipments, and operating cash flow.

## Validation

Run `node tests/check-hardware-market-changes.mjs` from the repository root. The test checks stable unique IDs, dates, source URLs, manual-update labeling, key reported values, and caveats where substrate material is not specified.
