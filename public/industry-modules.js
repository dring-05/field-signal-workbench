/*
 * Public-source cards for the Field Signals workbench.
 *
 * These are research leads, not direct measures of company revenue or earnings.
 * Keep provider access terms and the stated limits attached to every metric.
 */
window.industryModules = {
  reviewedAt: "2026-10-12",
  sectors: [
    {
      id: "hardware-compute",
      name: "Information Technology: hardware and compute",
      description: "Compute prices and infrastructure labor signals. Neither is a direct measure of a cloud provider's realized cost or utilization.",
      cards: [
        {
          id: "computepulse-gpu-prices",
          title: "ComputePulse GPU price tracker",
          provider: "ComputePulse",
          url: "https://www.computepulse.net/",
          whatItMeasures: "A public aggregation of quoted GPU rental prices, including H100 and Blackwell GPU-hour indices, provider observations, and short historical views. Its methodology says index inputs are dynamically fetched provider APIs; static rate cards are shown separately.",
          accessAndReuse: "The visible dashboard is publicly accessible without a paid account. Provider data and rate cards are public or quoted prices. The site's copyright notice reserves its own content, and I found no blanket license for copying or redistributing its index. Link to the site and do not scrape or republish its charts without permission.",
          freshness: "The site claims provider APIs are polled every 60 seconds. On review, its displayed last-updated timestamp was 2026-10-02, ten days before this review. Treat the snapshot as stale until a newer timestamp is visible; do not call this live based only on the advertised cadence.",
          operatingMetricBridge: {
            metric: "Quoted GPU rental price per GPU-hour, split by GPU generation and provider tier.",
            hypothesis: "If comparable H100 or B200 rental prices fall across several providers and remain lower, marginal compute supply may be easing. That could pressure neocloud pricing or improve customer economics, depending on contract mix.",
            limits: "Quoted marketplace rates are not private contract prices, utilization, realized revenue per GPU, or total cost of ownership. Provider mix, region, hardware configuration, and service level can move the index. Confirm against company disclosures and the underlying provider quotes."
          },
          evidenceReviewed: "Provider homepage and methodology, checked 2026-10-12. The displayed data timestamp was 2026-10-02."
        },
        {
          id: "goherebro-ibew-calls",
          title: "GoHereBro IBEW job call map",
          provider: "GoHereBro",
          url: "https://goherebro.com/map",
          whatItMeasures: "Open electrician job calls, local union journeyman scale, out-of-work book counts, and local outlook across roughly 300 IBEW locals. The page says dispatch pages are re-scraped throughout the day.",
          accessAndReuse: "Public map with free signup available. The site is not affiliated with IBEW. No open bulk-data license was found, so use the page as a research interface and link to it rather than copying its dataset. Confirm individual calls with the local hall.",
          freshness: "The page was marked updated 2026-10-11 when reviewed on 2026-10-12, and describes multiple scrapes per day. Local hall postings can change sooner.",
          operatingMetricBridge: {
            metric: "Local open-call count and posted journeyman hourly scale.",
            hypothesis: "A sustained rise in open calls or scale across labor markets near announced projects could indicate tighter union electrician availability or stronger local bargaining rates. This may be relevant to construction schedules and labor costs for data centers, fabs, utilities, and industrial projects.",
            limits: "Union dispatch calls are not total electrician vacancies, filled jobs, payroll wages, or project-specific hiring. Local coverage and job-call conventions vary. Posted scale is a union rate, not necessarily all-in compensation or realized earnings."
          },
          evidenceReviewed: "Provider map and FAQ, checked 2026-10-12. The page showed an update date of 2026-10-11."
        }
      ]
    },
    {
      id: "semiconductor-capacity",
      name: "Semiconductor capacity",
      description: "Separate announced manufacturing projects, industry shipments, and company revenue. None alone establishes qualified wafer capacity or utilization.",
      cards: [
        {
          id: "fed-semiconductor-industrial-production",
          title: "U.S. semiconductor and electronic-component production",
          provider: "Federal Reserve Board via FRED",
          url: "https://fred.stlouisfed.org/series/IPG3344S",
          whatItMeasures: "Monthly seasonally adjusted U.S. industrial production index for NAICS 3344, semiconductor and other electronic components. August 2026 was 190.0987 (2017=100); the August year-over-year change was 12.9% on the not-seasonally-adjusted series.",
          accessAndReuse: "Free public series and downloads, no paid account required. Attribute the Federal Reserve Board and FRED. Check the series notes and copyright terms before redistributing data.",
          freshness: "Monthly. August 2026 was updated 2026-09-18; the next G.17 release was scheduled for 2026-10-16 when checked 2026-10-12. Values are revised.",
          operatingMetricBridge: {
            metric: "National real industrial production index for semiconductor and other electronic components.",
            hypothesis: "A sustained change in domestic component output can serve as a production-side cross-check for fab, equipment, and materials demand estimates.",
            limits: "NAICS 3344 includes other electronic components and is not semiconductor-only. It is not wafer starts, equipment orders, capacity, yield, utilization, or company revenue. Cross-check the broad national series against company disclosures and more specific shipment data."
          },
          evidenceReviewed: "Federal Reserve G.17 release and FRED series, checked 2026-10-12; latest observation August 2026."
        },
        {
          id: "nist-chips-funding-updates",
          title: "CHIPS for America funding and award updates",
          provider: "NIST, U.S. Department of Commerce",
          url: "https://www.nist.gov/chips/funding-updates",
          whatItMeasures: "Award announcements, recipients, locations, funding amounts, and stated purposes for U.S. semiconductor manufacturing and R&D projects. Individual award links often describe supported fab, equipment, materials, or packaging investments.",
          accessAndReuse: "Public federal program pages with no paid account required. Attribute NIST and Commerce when summarizing. The page is an announcement index, not a live project database, and award amounts are not the same as cash disbursed or completed capex.",
          freshness: "Irregular updates when awards or funding actions are announced. The page is reviewed 2026-10-12; its entries should be checked against company releases and project filings for status changes.",
          operatingMetricBridge: {
            metric: "Announced project location, award amount, technology purpose, and project milestone language.",
            hypothesis: "If awards are followed by construction progress, equipment installation, and company-reported start-of-production milestones, future domestic capacity in the targeted node or packaging process may increase.",
            limits: "An award or announced investment does not prove a project is financed fully, on schedule, equipped, qualified, or producing at saleable yield. Track each milestone as separate evidence and avoid summing planned capacity as operating capacity."
          },
          evidenceReviewed: "NIST funding updates and linked award entries, checked 2026-10-12."
        },
        {
          id: "sia-wsts-monthly-sales",
          title: "Global semiconductor sales",
          provider: "Semiconductor Industry Association and WSTS",
          url: "https://www.semiconductors.org/policies/tax/market-data/",
          whatItMeasures: "Monthly global semiconductor sales by region, compiled by WSTS and published by SIA. The monthly figures are a three-month moving average.",
          accessAndReuse: "Public press releases, no paid account required. Attribute SIA and WSTS. The public page provides headline figures and releases; it is not a free granular company or end-market shipment database.",
          freshness: "Monthly, typically released with a reporting lag. The latest release found on review was for August 2026, published October 5, 2026.",
          operatingMetricBridge: {
            metric: "Three-month-average semiconductor revenue growth by broad region.",
            hypothesis: "A sustained acceleration in regional chip sales may support a thesis of improving industry demand, which could precede stronger supplier shipments or utilization.",
            limits: "This is nominal sell-in revenue across the industry, not unit shipments, fab utilization, company share, or end demand. Pricing, product mix, FX, channel inventory, and the moving-average window matter."
          },
          evidenceReviewed: "SIA market-data page and August 2026 release, checked 2026-10-12."
        },
        {
          id: "tsmc-monthly-revenue",
          title: "TSMC monthly revenue",
          provider: "Taiwan Semiconductor Manufacturing Company",
          url: "https://investor.tsmc.com/english/monthly-revenue/2026",
          whatItMeasures: "TSMC consolidated monthly net revenue in New Taiwan dollars and year-over-year change, directly from the company's investor-relations page.",
          accessAndReuse: "Public investor-relations information, no paid account required. Figures are unaudited for the current year; cite TSMC and link to the original table. No separate open data license was identified.",
          freshness: "Released monthly, usually around the tenth of the following month. The page showed September 2026 revenue on review dated 2026-10-12.",
          operatingMetricBridge: {
            metric: "Monthly foundry revenue and year-over-year growth.",
            hypothesis: "If monthly revenue growth accelerates and the next quarterly report also shows stronger wafer shipments or utilization, that would support a thesis of improving foundry demand or production mix.",
            limits: "Revenue is affected by price, node mix, customer mix, exchange rates, and timing. It is not wafer starts, good dies, utilization, or industry-wide capacity. Use quarterly operating disclosures to test the interpretation."
          },
          evidenceReviewed: "TSMC monthly revenue page and financial calendar, checked 2026-10-12."
        }
      ]
    },
    {
      id: "media-entertainment",
      name: "Media and entertainment",
      description: "Use public audience and engagement series as partial indicators. They do not reveal paid subscribers, total hours across devices, or revenue by title.",
      cards: [
        {
          id: "nielsen-the-gauge",
          title: "The Gauge: U.S. TV viewing by platform",
          provider: "Nielsen",
          url: "https://www.nielsen.com/data-center/the-gauge/",
          whatItMeasures: "Monthly U.S. share of TV-screen viewing across broadcast, cable, and streaming platforms, with platform and media-distributor comparisons.",
          accessAndReuse: "Public monthly charts and summaries are viewable without a paid account. Nielsen retains rights to its charts and data; link and attribute rather than republishing the underlying data or graphics without permission.",
          freshness: "Monthly release with a reporting lag. The page reviewed 2026-10-12 presented recent monthly reports; check the displayed month before comparing periods.",
          operatingMetricBridge: {
            metric: "Share of measured U.S. television viewing time by platform or distributor.",
            hypothesis: "A sustained increase in a platform's share of TV viewing could support a thesis of stronger engagement or ad inventory opportunity, particularly if the company's own ad-tier disclosures move in the same direction.",
            limits: "This is TV-set viewing, not viewing on phones or computers, subscriber adds, churn, monetization, or global usage. Distributor groupings combine businesses and must be read from Nielsen's current methodology."
          },
          evidenceReviewed: "Nielsen The Gauge page and methodology summaries, checked 2026-10-12."
        },
        {
          id: "netflix-top10",
          title: "Netflix weekly Top 10",
          provider: "Netflix Tudum",
          url: "https://www.netflix.com/tudum/top10",
          whatItMeasures: "Weekly title rankings with views and hours viewed, searchable by country and language for Netflix films and shows.",
          accessAndReuse: "Public chart pages are viewable without a paid account. Netflix's site content is copyrighted; use its built-in pages, attribute, and do not bulk copy or republish the charts without permission.",
          freshness: "Weekly viewing periods run Monday through Sunday, with lists published on Tuesday. The page reviewed 2026-10-12 showed the week ending 2026-10-04.",
          operatingMetricBridge: {
            metric: "Weekly title-level Netflix views and hours viewed in charted markets.",
            hypothesis: "A title's sustained reach across weeks and countries may support a thesis about content engagement, franchise demand, or a programming slate's ability to attract viewing.",
            limits: "Only charted titles and markets are visible in these tables. The data covers Netflix viewing only and does not establish subscriber growth, retention, total viewing, or title profitability."
          },
          evidenceReviewed: "Netflix weekly Top 10 and published methodology, checked 2026-10-12."
        },
        {
          id: "spotify-charts",
          title: "Spotify daily and weekly charts",
          provider: "Spotify",
          url: "https://charts.spotify.com/",
          whatItMeasures: "Top songs, albums, and artists by global and country charts. Spotify states that chart stream counts use a filtering formula and publishes daily and weekly chart periods.",
          accessAndReuse: "Chart pages are free to view; Spotify says a free account unlocks expanded chart detail. Spotify controls the underlying chart data and its use. Do not scrape or redistribute bulk chart data without permission.",
          freshness: "Daily charts use UTC calendar days; weekly charts run Friday through Thursday. Check the chart date and market before comparison.",
          operatingMetricBridge: {
            metric: "Song or artist chart rank and the platform's chart-qualified stream counts, where displayed.",
            hypothesis: "A sustained rise in an artist's chart streams across markets may support a thesis about audience momentum, which could matter for label or live-event exposure.",
            limits: "These are filtered Spotify streams and chart ranks, not total music consumption, paid subscribers, royalty revenue, or market share across platforms. Chart eligibility and Spotify's counting formula affect what appears."
          },
          evidenceReviewed: "Spotify Charts and Spotify for Artists chart guidance, checked 2026-10-12."
        },
        {
          id: "steamdb-player-charts",
          title: "SteamDB player charts",
          provider: "SteamDB",
          url: "https://steamdb.info/charts/",
          whatItMeasures: "Concurrent Steam players by game, including intraday peaks, historical charts, and all-time peaks. SteamDB says counts come from Steam and its top games update every five minutes, with other games every ten minutes.",
          accessAndReuse: "Public charts are free to view. SteamDB explicitly prohibits automated scraping and crawling and provides no public data dump. Use the site manually; do not ingest or republish its data without permission.",
          freshness: "Five-minute refresh for the top 800 games and ten-minute refresh for other games, according to SteamDB's FAQ. Steam's own player-count cache may add delay.",
          operatingMetricBridge: {
            metric: "Concurrent players for a title on Steam.",
            hypothesis: "Higher or more durable concurrent-player peaks after a release, update, or discount may support a thesis of stronger engagement for a publisher with meaningful Steam exposure.",
            limits: "Steam is only one distribution platform, concurrency is not unique monthly users or sales, and visibility is biased toward titles with enough players to track. Seasonality and promotions can dominate short windows."
          },
          evidenceReviewed: "SteamDB charts and FAQ, checked 2026-10-12."
        }
      ]
    },
    {
      id: "consumer-retail",
      name: "Consumer and retail",
      description: "Free consumer-demand context is strongest at category level. Public sources rarely reveal timely chain-level transactions.",
      cards: [
        {
          id: "census-monthly-retail-trade",
          title: "U.S. monthly retail trade and e-commerce",
          provider: "U.S. Census Bureau",
          url: "https://www.census.gov/retail/index.html",
          whatItMeasures: "Monthly U.S. retail sales and inventories by business category, plus quarterly e-commerce sales and e-commerce share of total retail sales.",
          accessAndReuse: "Public federal statistics and downloadable tables, no paid account required. Cite Census Bureau. Check table notes for revisions, sampling error, and coverage changes.",
          freshness: "Monthly retail releases and quarterly e-commerce reports. The Q2 2026 e-commerce release was published 2026-08-18; it reported a 17.1% seasonally adjusted e-commerce share, not adjusted for price changes.",
          operatingMetricBridge: {
            metric: "Nominal category sales, inventories, and e-commerce share.",
            hypothesis: "If a retailer's exposed category grows faster than the retail market and its reported sell-through or inventory confirms the direction, category demand may be improving.",
            limits: "This is broad U.S. category data, not chain-level sales, unit volume, or market share. Dollar growth includes price and mix effects. Census revises estimates and changed nonemployer coverage in 2025."
          },
          evidenceReviewed: "Census retail page and Q2 2026 e-commerce release, checked 2026-10-12."
        },
        {
          id: "google-trends-consumer-interest",
          title: "Google Trends search interest",
          provider: "Google",
          url: "https://trends.google.com/trends/",
          whatItMeasures: "Relative Google search interest for selected terms over time and geography, including short-window trending queries and longer historical comparisons.",
          accessAndReuse: "Public tool with no paid account required. Google provides sampled, normalized index values rather than raw search counts. Follow Google's terms; do not represent the index as transaction data or republish bulk data without checking current reuse terms.",
          freshness: "Trending queries can update within the day; longer historical series vary by query and selected window. Search sampling and normalization mean repeated downloads may differ.",
          operatingMetricBridge: {
            metric: "Normalized search-interest index for brands, products, or categories by place and period.",
            hypothesis: "A sustained search-interest increase ahead of earnings may be consistent with rising consumer awareness or purchase consideration; test against company traffic, sales, or category data.",
            limits: "Search interest is not unique consumers, intent to buy, store traffic, units, or sales. News events, ambiguity in search terms, seasonality, and normalization can create misleading moves."
          },
          evidenceReviewed: "Google Trends landing page and linked data guidance, checked 2026-10-12."
        }
      ]
    },
    {
      id: "energy",
      name: "Energy",
      description: "Weekly petroleum balances and natural-gas storage show different parts of the U.S. energy balance. Neither is a company-level volume series.",
      cards: [
        {
          id: "eia-weekly-natural-gas-storage",
          title: "Weekly natural-gas storage",
          provider: "U.S. Energy Information Administration",
          url: "https://www.eia.gov/dnav/ng/NG_STOR_WKLY_S1_W.htm",
          whatItMeasures: "Weekly working-gas inventories for the Lower 48 and regions. The October 8, 2026 release showed 3,500 Bcf for the week ending October 2.",
          accessAndReuse: "Free public data and downloads, no paid account required. Attribute EIA and read its methodology and revision notes.",
          freshness: "Weekly, usually Thursday with holiday delays. The observation typically refers to the prior week. Latest verified observation was October 2, released October 8, 2026.",
          operatingMetricBridge: {
            metric: "Lower 48 and regional underground working-gas stocks and weekly net changes.",
            hypothesis: "Regional storage draws during a cold period or high gas-fired generation can inform a supply tightness and fuel-cost hypothesis for producers, pipelines, utilities, and LNG exporters.",
            limits: "Storage is not current consumption, deliverable pipeline capacity, spot pricing, or company inventory. Reported changes can reflect reclassifications and estimation or sampling error; temperature and injection seasonality matter."
          },
          evidenceReviewed: "EIA weekly natural-gas storage table and release, checked 2026-10-12; latest observation was week ending 2026-10-02."
        },
        {
          id: "eia-weekly-petroleum-status",
          title: "Weekly Petroleum Status Report",
          provider: "U.S. Energy Information Administration",
          url: "https://www.eia.gov/petroleum/supply/weekly/",
          whatItMeasures: "U.S. crude and product inventories, production, refinery inputs and utilization, imports and exports, product supplied, and selected spot and retail prices.",
          accessAndReuse: "Free public federal tables and downloads, including CSV and XLS, with no paid account required. Attribute EIA and check the agency's data-use terms when redistributing derived files.",
          freshness: "Intended weekly, usually released Wednesday with holiday delays. The latest visible observation on 2026-10-12 was the week ending 2026-10-07; the page listed 2026-10-15 as the next release. Release cadence is weekly, while the data refer to the prior week.",
          operatingMetricBridge: {
            metric: "Weekly U.S. crude and product stock changes, refinery utilization, production, and product supplied.",
            hypothesis: "Persistent inventory draws alongside stronger product supplied and refinery runs could support a tighter-balance or improving-demand hypothesis, with different implications for producers, refiners, and midstream operators.",
            limits: "National estimates are not company-level volumes. Weekly survey estimates, seasonality, exports, imports, product mix, and revisions can move the series; product supplied is an implied proxy, not observed end-user consumption."
          },
          evidenceReviewed: "EIA weekly report and release schedule, checked 2026-10-12; latest visible observation was week ending 2026-10-07."
        }
      ]
    },
    {
      id: "materials",
      name: "Materials",
      description: "USGS mineral data help track selected commodity supply and domestic exposure. Publication timing varies by commodity.",
      cards: [
        {
          id: "usgs-mineral-statistics",
          title: "USGS mineral statistics and commodity summaries",
          provider: "U.S. Geological Survey",
          url: "https://www.usgs.gov/centers/national-minerals-information-center/mineral-commodity-summaries/",
          whatItMeasures: "Annual summaries for more than 90 minerals with domestic and global production, consumption, trade, and supply context. Linked commodity pages may also publish monthly Mineral Industry Surveys; the gold page, for example, listed monthly data through June 2026.",
          accessAndReuse: "Free public federal reports and data, with no paid account required. Attribute USGS. Check each report's citation and reuse notes, especially for third-party material.",
          freshness: "The Mineral Commodity Summaries are annual; commodity-specific Mineral Industry Surveys vary and can be monthly with a lag. The 2026 annual summaries were available on review, while the verified gold monthly series extended through June 2026. Do not assume one commodity's cadence applies to another.",
          operatingMetricBridge: {
            metric: "Commodity-specific domestic production, apparent consumption, imports, exports, and import reliance.",
            hypothesis: "A sustained change in domestic output or import reliance could support a supply-availability or downstream input-cost hypothesis for miners and materials consumers, if corroborated by prices and company disclosures.",
            limits: "Annual data are slow, monthly releases differ by commodity, and reported production is not immediately saleable capacity. These series do not provide current spot prices, customer inventories, or individual-company output."
          },
          evidenceReviewed: "USGS 2026 Mineral Commodity Summaries hub and gold statistics page, checked 2026-10-12; gold monthly survey page showed data through June 2026."
        }
      ]
    },
    {
      id: "industrials",
      name: "Industrials",
      description: "Port activity, airline operations, and factory orders cover different parts of industrial demand and execution. All are broad operating indicators.",
      cards: [
        {
          id: "bts-airline-on-time-performance",
          title: "Airline on-time performance by flight",
          provider: "U.S. Bureau of Transportation Statistics",
          url: "https://transtats.bts.gov/DL_SelectFields.aspx?QO_fu146_anzr=&gnoyr_VQ=FGJ",
          whatItMeasures: "Monthly flight-level domestic nonstop schedules and actual operations, including departure and arrival delays, cancellations, diversions, taxi times, and reported delay causes by carrier, airport, and route. July 2026 was the latest file checked, added September 21.",
          accessAndReuse: "Free public download, no paid account required. Attribute BTS and review reporting-carrier definitions and file documentation.",
          freshness: "Monthly with a lag. July 2026 was the latest verified observation on 2026-10-12. It does not update in real time.",
          operatingMetricBridge: {
            metric: "Flight completion, on-time performance, delay minutes, taxi times, and diversions by carrier, airport, and route.",
            hypothesis: "Persistent operational disruption or improving completion rates may help explain airline capacity utilization, schedule reliability, and cost pressure when paired with company disclosures.",
            limits: "Coverage is limited to reporting carriers and domestic nonstop flights. It is not passenger demand, fare yield, international operations, or airline revenue. Weather, airport mix, route length, and schedule padding affect comparisons."
          },
          evidenceReviewed: "BTS TranStats on-time performance download page and monthly release information, checked 2026-10-12; latest data were July 2026."
        },
        {
          id: "census-m3-orders-inventories",
          title: "Manufacturers' shipments, inventories, and orders (M3)",
          provider: "U.S. Census Bureau",
          url: "https://www.census.gov/manufacturing/m3/current/index.html",
          whatItMeasures: "Monthly U.S. manufacturing shipments, new orders, unfilled orders, and inventories, including durable-goods industry detail such as transportation equipment. The August 2026 advance report was released September 25 and the full report October 2.",
          accessAndReuse: "Free public federal tables and downloads, no paid account required. Attribute Census and retain the table, vintage, and seasonal-adjustment definitions.",
          freshness: "Monthly estimates with revisions. The latest verified period was August 2026; the advance report was released September 25 and the full report October 2. The next advance release was scheduled for October 27.",
          operatingMetricBridge: {
            metric: "Industry-level new orders, shipments, inventories, and unfilled orders in current dollars.",
            hypothesis: "A sustained rise in new orders and backlog with stable inventory can support an industry-demand hypothesis for exposed equipment and transport manufacturers.",
            limits: "These are national survey estimates, not a named company's order book, unit volume, or realized revenue. Prices, mix, cancellations, revisions, and industry aggregation can change the signal."
          },
          evidenceReviewed: "Census M3 August 2026 advance and full reports plus release schedule, checked 2026-10-12."
        },
        {
          id: "port-la-container-statistics",
          title: "Port of Los Angeles container statistics",
          provider: "Port of Los Angeles",
          url: "https://portoflosangeles.org/business/statistics/container-statistics",
          whatItMeasures: "Monthly loaded import and export containers and empty containers handled at the Port of Los Angeles, reported in TEUs.",
          accessAndReuse: "Free public statistics with no account required. The Port asks users to credit Port of Los Angeles. This card covers the port's container-statistics tables only; separately presented supplemental Trade Data is a WorldCity product and may have different access terms.",
          freshness: "Monthly. August 2026 was the latest visible observation on 2026-10-12: 955,906.5 TEUs, down 0.26% year over year. September was not yet posted. The observation month therefore trails the review date.",
          operatingMetricBridge: {
            metric: "Monthly loaded import/export and empty-container TEUs, with year-over-year comparisons.",
            hypothesis: "A sustained shift in loaded imports or exports, alongside empty-container repositioning, could inform a hypothesis about shipping activity, importer inventories, and intermodal demand for exposed industrial or logistics companies.",
            limits: "This is one port, not total U.S. trade or retail sell-through. Port diversion, front-loading, seasonality, and cargo/customer mix can dominate the signal."
          },
          evidenceReviewed: "Port of Los Angeles 2026 TEU statistics and statistics access page, checked 2026-10-12; latest visible month was August 2026."
        }
      ]
    },
    {
      id: "consumer-discretionary",
      name: "Consumer discretionary",
      description: "BEA spending data show broad real demand by product category, with a reporting lag and no company-level detail.",
      cards: [
        {
          id: "bea-personal-consumption-expenditures",
          title: "Personal Consumption Expenditures by category",
          provider: "U.S. Bureau of Economic Analysis",
          url: "https://www.bea.gov/data/consumer-spending/main",
          whatItMeasures: "Monthly personal consumption expenditures in current and chained dollars, with detailed product and service categories such as motor vehicles, recreation, lodging, and transportation.",
          accessAndReuse: "Free public federal tables and downloads; no paid account required. A BEA API key may be needed for API use. Attribute BEA and retain table definitions when using detailed categories.",
          freshness: "Monthly, with releases and revisions. The August 2026 report was published 2026-09-30; the next release was scheduled for 2026-10-29. Latest observation is August, not October. BEA cautions that detailed category estimates are less reliable than major aggregates.",
          operatingMetricBridge: {
            metric: "Real monthly PCE growth for product or service categories relevant to a company's customers.",
            hypothesis: "If real spending in an exposed category accelerates and company disclosures or other demand evidence point the same way, that could support a demand-improvement hypothesis for discretionary businesses.",
            limits: "These are national category estimates, not company sales, unit volumes, or market share. They are revised, lagged, and can hide shifts in price, mix, and customer cohorts."
          },
          evidenceReviewed: "BEA consumer spending page and August 2026 release schedule, checked 2026-10-12; latest observation was August 2026."
        }
      ]
    },
    {
      id: "consumer-staples",
      name: "Consumer staples",
      description: "The free grocery promotion series is narrow and updates weekly with a reporting lag.",
      cards: [
        {
          id: "usda-egg-feature-activity",
          title: "Grocery egg feature activity and advertised prices",
          provider: "USDA Agricultural Marketing Service",
          url: "https://mymarketnews.ams.usda.gov/viewReport/2757",
          whatItMeasures: "Weekly advertised egg prices and grocery-store feature activity gathered from retailer circulars and digital promotions.",
          accessAndReuse: "Free public USDA Market News report with no paid account required. Attribute USDA AMS and check report-specific terms before bulk reuse or republication.",
          freshness: "The latest report index verified on 2026-10-12 listed report 2757, published 2026-10-09 for the week ending 2026-10-03. This is a weekly series with a reporting lag; recheck the index before relying on the latest observation.",
          operatingMetricBridge: {
            metric: "Share of observed grocery promotions featuring eggs and advertised egg prices.",
            hypothesis: "A persistent change in advertised prices or feature intensity could inform a hypothesis about category pricing pressure or retailer promotional posture, especially when paired with reported food-company pricing and volume trends.",
            limits: "This is a narrow egg-only sample of advertised promotions, not transactions, unit volume, realized shelf prices, or retailer margins. The series may not represent the broader staples category."
          },
          evidenceReviewed: "USDA AMS report index, checked 2026-10-12; report 2757 was published 2026-10-09 for the week ending 2026-10-03."
        }
      ]
    },
    {
      id: "health-care",
      name: "Health Care",
      description: "Trial records describe pipeline activity. Medicare drug claims add a lagged product-uptake view for one payer segment.",
      cards: [
        {
          id: "cms-quarterly-partd-spending",
          title: "Medicare Part D spending by drug",
          provider: "Centers for Medicare & Medicaid Services",
          url: "https://data.cms.gov/summary-statistics-on-use-and-payments/medicare-medicaid-spending-by-drug/medicare-quarterly-part-d-spending-by-drug",
          whatItMeasures: "Drug-level Medicare Part D spending, claims, beneficiaries, and manufacturer details. CMS listed Q1 2026 as the latest period on review.",
          accessAndReuse: "Free public use file and documentation, no paid account required. Attribute CMS and follow the public-use-file documentation.",
          freshness: "Quarterly. CMS says the current cadence provides the latest quarter about three months after quarter-end and captures more than 99% of its records. Recent periods remain preliminary as claims mature.",
          operatingMetricBridge: {
            metric: "Medicare Part D gross spending, claims, and beneficiaries by drug and manufacturer.",
            hypothesis: "Changes in beneficiaries and claims for a marketed drug can inform a Medicare uptake or product-mix hypothesis when checked against prescriptions, company disclosures, and payer changes.",
            limits: "Part D covers only one payer segment and generally self-administered outpatient drugs. Gross spending excludes rebates, fewer than 11 claims are redacted, and immature periods can change. This is not total prescriptions, net sales, or patient adherence."
          },
          evidenceReviewed: "CMS Part D drug-spending dataset description, download and cadence notes, checked 2026-10-12; latest period listed was 2026 Q1."
        },
        {
          id: "clinicaltrials-gov-registry",
          title: "ClinicalTrials.gov trial records and API",
          provider: "U.S. National Library of Medicine",
          url: "https://clinicaltrials.gov/",
          whatItMeasures: "Registered study sponsors, phases, recruitment status, enrollment, sites, primary completion dates, record updates, and posted results, searchable through the site and v2 API.",
          accessAndReuse: "Public search and API are free and do not require an API key. Trial information is submitted by responsible parties; review record-specific notices and federal data-use terms before redistribution.",
          freshness: "The API data-build endpoint reported 2026-10-09 09:00 UTC on review date 2026-10-12. The registry build timestamp is not a promise that each trial record was updated recently; record-level update dates vary.",
          operatingMetricBridge: {
            metric: "Sponsor-specific changes in trial status, enrollment, site count, completion dates, and posted results.",
            hypothesis: "A verified change in a company's trial timeline or site footprint could update a pipeline execution hypothesis and help focus follow-up on company disclosures or regulatory events.",
            limits: "Records are sponsor- or investigator-maintained and may be stale. Recruitment status and enrollment are not continuously independently verified; registry changes do not establish efficacy, regulatory approval, or commercial success."
          },
          evidenceReviewed: "ClinicalTrials.gov search, API documentation, and API version endpoint, checked 2026-10-12; dataTimestamp was 2026-10-09T09:00:05."
        }
      ]
    },
    {
      id: "financials",
      name: "Financials",
      description: "Weekly Federal Reserve aggregates add a high-frequency bank-system read. FDIC filings remain the bank-level source.",
      cards: [
        {
          id: "federal-reserve-h8-bank-assets-liabilities",
          title: "H.8 commercial bank assets and liabilities",
          provider: "Board of Governors of the Federal Reserve System",
          url: "https://www.federalreserve.gov/releases/h8/current/default.htm",
          whatItMeasures: "Weekly aggregate U.S. commercial-bank assets and liabilities, including loans, deposits, and cash, with selected bank-size breakdowns. The latest release checked was October 9, 2026, with balances generally as of the prior Wednesday.",
          accessAndReuse: "Free public release tables, downloads, and XML, no paid account required. The Federal Reserve says its Build Your Package feature is scheduled for removal in November 2026; release files and other interfaces remain available.",
          freshness: "Weekly, generally released Friday for the prior Wednesday. The release uses a voluntary reporting panel supplemented with Call Report data and represents about 90% of U.S. commercial-bank assets.",
          operatingMetricBridge: {
            metric: "System and bank-size-group changes in deposits, loans, cash, and other balance-sheet categories.",
            hypothesis: "A sustained shift in deposit growth, loan balances, or cash at the system or bank-size level can frame funding and credit-cycle hypotheses for banks and lenders.",
            limits: "This is an aggregate series, not data for individual banks. Panel composition, Call Report updates, seasonality, and revisions matter. Use FDIC or company filings for institution-specific conclusions."
          },
          evidenceReviewed: "Federal Reserve H.8 release page and methodology notes, checked 2026-10-12; latest release was October 9, 2026."
        },
        {
          id: "fdic-bankfind-financial-reports",
          title: "FDIC BankFind quarterly financial reports",
          provider: "Federal Deposit Insurance Corporation",
          url: "https://banks.data.fdic.gov/bankfind-suite/financialreporting/report",
          whatItMeasures: "Quarterly Call Report and bank financial data for U.S. insured depository institutions, including deposits, net interest income, loans, delinquencies, charge-offs, reserves, capital, and liquidity measures.",
          accessAndReuse: "Free public report queries, bulk downloads, and API; no payment required. Login.gov is needed to save custom reports. Cite FDIC and check dataset documentation for definitions and revisions.",
          freshness: "Quarterly. On 2026-10-12 the reporting interface offered 2026-06-30 as the latest period, covering 4,247 institutions. The period end is not the same as filing or publication date; verify the chosen report's period and release status.",
          operatingMetricBridge: {
            metric: "Quarterly deposit mix and cost, net interest income, loan growth and concentration, charge-offs, reserves, capital, and liquidity by bank.",
            hypothesis: "If deposit costs rise faster than asset yields or credit losses accelerate in an exposed loan category, that could support a margin-compression or credit-quality hypothesis for a bank, subject to its own filings.",
            limits: "Regulatory filings are quarterly and may be revised. The dataset covers U.S. insured banks, not brokers or insurers, and regulatory definitions may differ from investor presentation metrics."
          },
          evidenceReviewed: "FDIC BankFind financial reporting interface and data-download guide, checked 2026-10-12; latest selectable period observed was 2026-06-30."
        }
      ]
    },
    {
      id: "utilities",
      name: "Utilities",
      description: "Track hourly load, planned generation, and plant operations as separate stages. None identifies a data center's contracted or energized load.",
      cards: [
        {
          id: "eia-hourly-grid-monitor",
          title: "Hourly Electric Grid Monitor",
          provider: "U.S. Energy Information Administration",
          url: "https://www.eia.gov/electricity/gridmonitor/",
          whatItMeasures: "Hourly actual and forecast demand, generation by fuel, and electricity interchange at national, regional, and selected balancing-authority levels. EIA says prior-hour demand is updated hourly, forecasts are posted each morning, and generation and interchange have about a one-day lag.",
          accessAndReuse: "Free public dashboard with downloadable data and no paid account required. Custom dashboards can be saved and shared. Attribute EIA. EIA states that it does not publish hourly electricity prices in this dashboard; observations are preliminary and as reported.",
          freshness: "Demand updates hourly for the prior hour; forecasts are posted each morning; generation and interchange have an approximately one-day lag. Dashboard timestamps can be stale or have gaps, so check the displayed latest observation before use. The page was checked 2026-10-12.",
          operatingMetricBridge: {
            metric: "Hourly regional electricity demand, forecast, generation mix, and interchange.",
            hypothesis: "Persistent load growth or tighter regional supply patterns may inform power-availability, utility investment, data-center commissioning, or colocation lease-up questions.",
            limits: "Temperature, time of day, and calendar patterns drive much of demand. The data do not identify data-center load, customer contracts, local interconnection capacity, congestion prices, or a company's utilization. Compare with utility filings, named projects, and queue data."
          },
          evidenceReviewed: "EIA dashboard, data notes, and update cadence, checked 2026-10-12. Displayed dashboard observation dates varied by view."
        },
        {
          id: "eia-860m-generator-inventory",
          title: "Monthly electric generator inventory (EIA-860M)",
          provider: "U.S. Energy Information Administration",
          url: "https://www.eia.gov/electricity/data/eia860m/",
          whatItMeasures: "Preliminary generator-level inventory of existing, proposed, and retired units at plants with at least 1 MW combined nameplate capacity, including status, fuel, capacity, and planned in-service information. August 2026 was released September 24; the next release was scheduled for October 23.",
          accessAndReuse: "Free public XLS files and documentation, with no paid account required. Attribute EIA. The series includes U.S. and Puerto Rico generators.",
          freshness: "Monthly preliminary inventory. August 2026 was the latest available file on 2026-10-12. EIA may revise estimates without a specific explanation in later monthly files.",
          operatingMetricBridge: {
            metric: "Generator MW and unit status by plant, fuel, and planned in-service timing.",
            hypothesis: "Changes in proposed, active, and retired generation around a constrained region may inform the timing of future supply additions and utility build needs.",
            limits: "Proposed MW is not committed or available supply. Capacity estimates are preliminary and may change; a listed unit does not establish permits, financing, interconnection, completion, or power available to a particular customer. Pair with queue and project evidence."
          },
          evidenceReviewed: "EIA-860M release page and August 2026 workbook metadata, checked 2026-10-12."
        },
        {
          id: "nerc-long-term-reliability-assessment",
          title: "Long-Term Reliability Assessment",
          provider: "North American Electric Reliability Corporation",
          url: "https://www.nerc.com/globalassets/our-work/assessments/nerc_ltra_2025.pdf",
          whatItMeasures: "Annual regional grid-planner assessment of projected demand, resource additions, and reliability over a ten-year horizon. The 2025 assessment forecast 224 GW of North American summer peak-demand growth over 2025-2035, with data centers cited as a major driver.",
          accessAndReuse: "Free public report and infographic, no paid account required. Attribute NERC and retain the assessment year and forecast horizon.",
          freshness: "Annual planning assessment, not a live tracker. The 2025 edition was released January 2026 and uses forecasts submitted by planners during 2025. Recheck the next edition and regional updates before relying on it.",
          operatingMetricBridge: {
            metric: "Regional forecast changes in peak demand, approved supply, and prospective resource additions.",
            hypothesis: "Rising load forecasts alongside limited approved resources can frame regional power-availability and utility-capex scenarios for large-load projects.",
            limits: "This is a planner forecast, not metered demand, committed data-center load, or a project-level schedule. Prospective resources are uncertain; geography, reserve criteria, and forecast vintages matter."
          },
          evidenceReviewed: "NERC 2025 Long-Term Reliability Assessment and infographic, checked 2026-10-12."
        },
        {
          id: "eia-923-plant-operations",
          title: "EIA-923 power plant operations",
          provider: "U.S. Energy Information Administration",
          url: "https://www.eia.gov/electricity/data/eia923/",
          whatItMeasures: "Plant-level monthly and annual electricity generation, fuel consumption, fossil fuel stocks, receipts, and costs for covered U.S. power plants.",
          accessAndReuse: "Free public federal data files, with no paid account required. Attribute EIA and check the dataset documentation for survey coverage and revisions.",
          freshness: "Monthly files are released with roughly a two-month lag. On 2026-10-12 the latest posted monthly data were June 2026, released 2026-09-24; the schedule showed the next release for late October, covering August. Cadence is monthly, not real time. Annual files have broader coverage than the monthly sample.",
          operatingMetricBridge: {
            metric: "Plant-level generation, fuel burn and receipts, fuel costs, and operating stocks by month.",
            hypothesis: "A sustained change in a generator's fleet output, fuel mix, or fuel cost could support a utilization, dispatch-cost, or capacity-availability hypothesis when checked against company disclosures and regional conditions.",
            limits: "Monthly values lag activity and the monthly sample is narrower than the annual survey. The data do not provide real-time load, wholesale prices, or outage causality; regulated utility earnings also depend on rate cases and allowed returns."
          },
          evidenceReviewed: "EIA-923 download page and release schedule, checked 2026-10-12; latest posted monthly observation was June 2026."
        }
      ]
    },
    {
      id: "real-estate",
      name: "Real Estate",
      description: "Zillow's public housing datasets offer frequent residential market context, with platform and model coverage limits.",
      cards: [
        {
          id: "zillow-research-housing-data",
          title: "Zillow Research housing and rental data",
          provider: "Zillow Research",
          url: "https://www.zillow.com/research/data/",
          whatItMeasures: "Downloadable residential home-value, rent, inventory, listing, and sale-price series, with market-level dashboards and documented definitions.",
          accessAndReuse: "Public CSV downloads and dashboards are free without payment; some separate Zillow Economic Data features may require an account. Follow Zillow's stated terms and attribute Zillow; do not assume an open redistribution license for the compiled datasets.",
          freshness: "Most downloadable series update monthly; Zillow's documentation says monthly data are generally updated by the 16th. The latest monthly values verified on 2026-10-12 were for August 2026. Some dashboard indicators may refresh more often, so check each metric's date rather than assuming a common cadence.",
          operatingMetricBridge: {
            metric: "Market-level rent, home-value, inventory, new-listing, and pending-sale trends where available.",
            hypothesis: "A sustained shift in rents, listings, or inventory could help frame residential leasing, homebuilder competition, or housing transaction conditions for exposed REITs and housing companies.",
            limits: "The series rely on Zillow listings and models, with coverage varying by metric and geography. They are not a full transaction census, do not measure commercial real estate, and engagement does not equal leases or closings."
          },
          evidenceReviewed: "Zillow Research download page, market data dashboard, and metric definitions, checked 2026-10-12; latest monthly observation verified was August 2026."
        }
      ]
    },
    {
      id: "communication-services",
      name: "Communication Services",
      description: "FCC availability data track reported broadband footprint and advertised speeds, not subscriber take-up or realized performance.",
      cards: [
        {
          id: "fcc-national-broadband-map",
          title: "FCC National Broadband Map and availability downloads",
          provider: "Federal Communications Commission",
          url: "https://broadbandmap.fcc.gov/",
          whatItMeasures: "Provider-reported fixed broadband availability by location, technology, and advertised speed, plus mobile coverage maps and downloadable area or national datasets.",
          accessAndReuse: "Public map and downloadable fixed CSV and mobile GIS data are available without payment or an account. Attribute FCC and review the current dataset documentation and map terms before republishing provider-submitted data.",
          freshness: "Providers file availability data twice a year. FCC filing materials reviewed 2026-10-12 referenced the 2026-06-30 data vintage. I did not confirm that vintage was already visible on the public map by the review date. Map verification, challenges, and location updates can occur between filing cycles, but the underlying provider filing is not real time.",
          operatingMetricBridge: {
            metric: "Provider footprint by serviceable location, technology, advertised speed, geography, and data vintage.",
            hypothesis: "Growth in reported fiber or cable availability within a provider's footprint could support a network buildout or competitive-coverage hypothesis, if consistent with capex and subscriber disclosures.",
            limits: "Availability is not subscriptions, penetration, ARPU, actual delivered speed, or revenue. Fixed data are provider-reported and challenge-corrected; mobile maps are coverage estimates for outdoor or in-vehicle service and do not show indoor performance."
          },
          evidenceReviewed: "FCC National Broadband Map, BDC download documentation, and June 2026 filing materials, checked 2026-10-12; 2026-06-30 is the filing vintage, not a confirmed public-map release date."
        }
      ]
    }
  ]
};
