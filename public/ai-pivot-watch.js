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

  function leadCard(item) {
    const href = /^https:\/\//i.test(String(item.filingUrl || '')) ? item.filingUrl : '';
    return `<article class="card card-pad"><div class="industry-card-head"><div><span class="tag amber">${esc(item.form)} · ${esc(item.filingDate)} · CIK ${esc(item.cik)}</span><h2 style="margin:7px 0 0;font-size:16px">${esc(item.company)}</h2></div>${href ? `<a class="btn" href="${esc(href)}" target="_blank" rel="noreferrer">Open filing ↗</a>` : ''}</div><p>${esc(item.label)}</p>${item.evidence?.length ? `<details><summary>Matched filing text</summary>${item.evidence.map(e => `<blockquote class="footnote">${esc(e.text)}</blockquote>`).join('')}</details>` : ''}<p class="footnote">Automated match, not a verified name change or investment conclusion. Review the full filing and prior-period evidence.</p></article>`;
  }

  window.AIPivotWatch = {
    render() {
      return `<section class="page-head"><div><p class="eyebrow">SEC FILINGS · AUTOMATED FIRST PASS</p><h1>AI name and filing watch</h1><p class="sub">Recent filings with possible legal-name changes or new AI operating language.</p></div><span class="tag amber">Unreviewed leads</span></section><section class="card card-pad"><p>A filing match is a research lead. Confirm the event, compare prior filings, and look for operating evidence such as customers, revenue, margin, assets, funding needs, and dilution.</p><p class="footnote">The automated feed covers SEC filers, not a complete US or global listed-company universe. Private reporting entities can appear, and many international companies are outside SEC reporting.</p><div class="card-actions"><a class="btn" href="https://www.sec.gov/edgar/search/" target="_blank" rel="noreferrer">Search SEC filings ↗</a><a class="btn" href="https://www1.hkexnews.hk/search/titlesearch.xhtml" target="_blank" rel="noreferrer">Search HKEX announcements ↗</a><a class="btn" href="https://www.sec.gov/edgar/search/efts-faq.html" target="_blank" rel="noreferrer">EDGAR full-text search ↗</a></div></section><section id="sec-lead-feed" class="industry-cards ai-watch-cases" aria-live="polite"><p class="callout">Loading SEC feed…</p></section><section class="section"><div class="section-title"><div><h2>Reviewed examples</h2><p>Manual review · not a live feed. Filing-linked examples show how the operating bridge changes the read.</p></div></div><div class="industry-cards ai-watch-cases">${cases.map(card).join('')}</div></section><p class="footnote">A name change or rising AI mentions do not establish deception or make a stock a short. Check the primary filing, latest reported financials, and whether claimed capacity or customers are operating.</p>`;
    },
    async loadFeed() {
      const target = document.querySelector('#sec-lead-feed');
      if (!target) return;
      try {
        const response = await fetch('./sec-ai-watch.json', { cache: 'no-store' });
        if (!response.ok) throw new Error(`Feed request returned ${response.status}`);
        const data = await response.json();
        if (!data.generatedAt) {
          target.innerHTML = '<p class="callout">The SEC screen has not completed its first run. The scheduled job needs a contact email in the repository Actions variable SEC_USER_AGENT.</p>';
          return;
        }
        const date = new Date(data.generatedAt);
        const ageDays = (Date.now() - date.getTime()) / 86400000;
        const status = `<div class="card card-pad"><p><strong>Last scan:</strong> ${esc(date.toLocaleString())} · window ${esc(data.scanWindowStart)} to ${esc(data.scanWindowEnd)} · ${Array.isArray(data.leads) ? data.leads.length : 0} retained leads</p><p class="footnote">${ageDays > 2 ? 'Feed may be stale. ' : ''}${esc(data.coverage || '')}</p></div>`;
        const leads = Array.isArray(data.leads) ? data.leads : [];
        target.innerHTML = status + (leads.length ? leads.map(leadCard).join('') : '<p class="empty-receipts">No matches in the completed scan window. This is a keyword screen, so it can miss events and does not establish that filings contain no AI activity.</p>');
      } catch (error) {
        target.innerHTML = `<p class="callout">Could not load the SEC feed: ${esc(error.message)}. The current manual examples remain available below.</p>`;
      }
    }
  };
})();
