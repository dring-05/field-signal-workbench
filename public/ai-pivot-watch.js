(() => {
  const cases = [
    {
      market: 'NASDAQ · RKTO',
      name: 'Rocket One, formerly Hoth Therapeutics',
      event: 'May 2026 · name and strategy change',
      change: 'The company announced an AI semiconductor infrastructure strategy, licensed technology, changed its legal name, and began trading as RKTO.',
      bridge: 'Its August 2026 10-Q still identifies its SIC as Pharmaceutical Preparations. The filing says it has not commercialized products and reports no product-sales revenue since inception. Six-month net loss was $6.527 million and operating cash use was $6.019 million. It also describes technology licenses and a $210,000 technology acquisition.',
      read: 'A documented pivot with early assets, no demonstrated product sales, and a legacy-business classification that had not caught up in the latest filing. The next checks are a customer contract, deployed product, revenue recognition, and cash runway.',
      links: [
        ['Pivot announcement', 'https://www.sec.gov/Archives/edgar/data/1711786/000121390026060075/ea029183701ex99-1.htm'],
        ['Name change announcement', 'https://www.sec.gov/Archives/edgar/data/1711786/000121390026061252/ea029221301ex99-1.htm'],
        ['August 2026 10-Q', 'https://www.sec.gov/Archives/edgar/data/1711786/000121390026090048/ea0300119-10q_rocket.htm'],
        ['Filing metadata and SIC', 'https://www.sec.gov/Archives/edgar/data/1711786/000121390026090048/0001213900-26-090048-index-headers.html']
      ]
    },
    {
      market: 'NASDAQ · BIRD',
      name: 'Smartbird, formerly Allbirds',
      event: 'June to August 2026 · asset sale, name change, first AI infrastructure results',
      change: 'After selling its footwear assets, the company changed its name and pursued AI compute infrastructure. The earlier $50 million convertible facility was later expanded to as much as $100 million.',
      bridge: 'The August 2026 10-Q reports $2.758 million of second-quarter AI infrastructure revenue and the same $2.758 million in cost of revenue, implying zero gross profit on that line. Quarterly SG&A was $10.695 million. The filing describes the transition as early-stage and details financing and cost actions.',
      read: 'The new business has reported revenue, but the first quarter shown had no gross profit and a substantial operating-cost gap. Track repeat customer revenue, utilization, gross profit, financing terms, and dilution.',
      links: [
        ['Name change and transaction 8-K', 'https://www.sec.gov/Archives/edgar/data/1653909/000119312526273417/d178962d8k.htm'],
        ['August 2026 10-Q', 'https://www.sec.gov/Archives/edgar/data/1653909/000143774926028446/bird20260630_10q.htm'],
        ['April pivot and financing announcement', 'https://www.sec.gov/Archives/edgar/data/1653909/000119312526164338/d34261dex991.htm']
      ]
    },
    {
      market: 'OTC · BSAI',
      name: 'BluSky AI, formerly Inception Mining',
      event: 'March 2026 · annual filing after AI data-center plan',
      change: 'The 2025 annual report describes plans for AI data-center infrastructure after the company left its prior mining activity.',
      bridge: 'The filing reports no sales revenue line, $2.666 million of operating expenses, a $4.516 million net loss, a $34.4 million accumulated deficit, and an auditor going-concern warning. The SEC filing index still identifies SIC 1040, Gold and Silver Ores.',
      read: 'The filing shows plans without disclosed AI operating revenue, alongside losses and financing risk. That is a research lead, not proof of deception or a short recommendation.',
      links: [
        ['FY2025 Form 10-K', 'https://www.sec.gov/Archives/edgar/data/1416090/000149315226014362/form10-k.htm'],
        ['SEC filing index and SIC', 'https://www.sec.gov/Archives/edgar/data/1416090/000149315226014362/0001493152-26-014362-index.htm']
      ]
    },
    {
      market: 'HKEX · 01396',
      name: 'Greater Bay Area AI Computing Tech',
      event: 'April to May 2026 · listed-company name change and proposed use of proceeds',
      change: 'Formerly Guangdong-Hong Kong Greater Bay Area Holdings. The new name was registered on April 17, 2026. A March filing said roughly 90% of planned share-subscription proceeds could go toward potential AI computing projects.',
      bridge: 'The proceeds disclosure is a planned allocation, not evidence that projects were funded, built, or earning revenue. The interim report and subsequent project announcements need to be checked before treating AI as an operating segment.',
      read: 'International filing lead. The name change and stated capital allocation are verified. Operating performance from the AI projects has not been verified in this review.',
      links: [
        ['Name change announcement', 'https://www.hkexnews.hk/listedco/listconews/sehk/2026/0515/2026051501223.pdf'],
        ['Share-subscription proceeds announcement', 'https://www.hkexnews.hk/listedco/listconews/sehk/2026/0330/2026033004430.pdf'],
        ['HKEX issuer announcement search', 'https://www1.hkexnews.hk/search/titlesearch.xhtml?category=0&market=SEHK&stockId=95197']
      ]
    },
    {
      market: 'NYSE AMERICAN · AIB',
      name: 'AIB Data Centers, formerly BlockchAIn Digital Infrastructure',
      event: 'June to October 2026 · AI/data-center rebrand with capacity evidence',
      change: 'The legal name changed on June 25, 2026. The earlier business already involved digital-asset and high-performance-computing infrastructure, so this is a weaker legacy mismatch than a move from an unrelated consumer or biotech business.',
      bridge: 'An October 7 shareholder letter reports a 12-year agreement with Nebius for 50 MW of critical IT capacity at its CLT1 campus, plus expected customer prepayments. Earlier filings describe a 65,000 kVA power agreement and a $63.25 million June offering. These are development and financing milestones, not proof that 50 MW is energized or producing revenue.',
      read: 'Include as a control against naive name-change screens. Verify construction, commissioning, customer start dates, funded capex, and recognized revenue.',
      links: [
        ['June name-change 8-K', 'https://www.sec.gov/Archives/edgar/data/2070542/000121390026073221/ea0296132-8k_aibdata.htm'],
        ['June-quarter 10-Q', 'https://www.sec.gov/Archives/edgar/data/2070542/000121390026089151/ea0301093-10q_aibdata.htm'],
        ['October 7 shareholder letter', 'https://www.sec.gov/Archives/edgar/data/2070542/000121390026107421/ea030792301ex99-1.htm'],
        ['October 2026 capacity contract announcement', 'https://www.sec.gov/Archives/edgar/data/2070542/000121390026105865/ea030737801ex99-1.htm']
      ]
    }
  ];

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const linkList = links => links.map(([label, url]) => `<a href="${esc(url)}" target="_blank" rel="noreferrer">${esc(label)} ↗</a>`).join(' · ');
  const card = item => `<article class="card card-pad"><div class="industry-card-head"><div><span class="tag">${esc(item.market)}</span><p class="footnote" style="margin:7px 0 0">${esc(item.event)}</p><h2 style="margin:5px 0 0;font-size:17px">${esc(item.name)}</h2></div></div><div class="ai-watch-grid"><div><h3>What changed</h3><p>${esc(item.change)}</p></div><div><h3>Operating-metric bridge</h3><p>${esc(item.bridge)}</p></div></div><p><strong>Read:</strong> ${esc(item.read)}</p><p class="footnote">${linkList(item.links)}</p></article>`;

  window.AIPivotWatch = {
    render() {
      return `<section class="page-head"><div><p class="eyebrow">FILING REVIEW · CHECKED 12 OCT 2026</p><h1>AI name and filing watch</h1><p class="sub">Company name changes and AI strategy claims, checked against filings and operating evidence.</p></div><span class="tag amber">Manual review · not a live feed</span></section><section class="card card-pad"><p>A name change or AI mention is a lead. The useful test is whether filings show customers, operating assets, recognized revenue, margins, cash needs, and dilution. These cases are source-linked examples, not a short list.</p><p class="footnote">Scope: US SEC filers and one HKEX example. SEC coverage includes foreign issuers that file with the SEC, not every international company. The review is not exhaustive or continuously refreshed.</p><div class="card-actions"><a class="btn" href="https://www.sec.gov/edgar/search/" target="_blank" rel="noreferrer">Search SEC filings ↗</a><a class="btn" href="https://www1.hkexnews.hk/search/titlesearch.xhtml" target="_blank" rel="noreferrer">Search HKEX announcements ↗</a><a class="btn" href="https://www.sec.gov/edgar/search/efts-faq.html" target="_blank" rel="noreferrer">How EDGAR full-text search works ↗</a></div></section><div class="industry-cards ai-watch-cases">${cases.map(card).join('')}</div><p class="footnote">Screen logic for the next automation pass: compare current and former names, detect new AI-related language in filings, then check source sector, commercial status, assets or contracts, revenue and gross profit, cash runway, capital raised, dilution, and auditor or going-concern language. A keyword match alone does not establish a pivot, deception, or a short thesis.</p>`;
    }
  };
})();
