import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { analyzeText, aiDeltaLabel, aiPivotLeadType, attachListedIssuer, classifyAiEvidence, expectedIndexSkipReason, isLegalNameExhibit, isLikelyBiographyEvidence, isNameChangeLead, legalNameChangeFromSubmissions, novelAiEvidence, operatingBridgeFromCompanyFacts, parseTickerExchange, relevantDocuments, revalidateRetainedLeads, revalidateRetainedLeadsFromSEC, reviewCues, scan, secFederalHolidays, selfTest } from '../automation/sec-filing-screen.mjs';

const moduleSource = await readFile(new URL('../public/ai-pivot-watch.js', import.meta.url), 'utf8');
const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const deltaFixture = JSON.parse(await readFile(new URL('./fixtures/sec-ai-language-delta.json', import.meta.url), 'utf8'));
const formerNamesFixture = JSON.parse(await readFile(new URL('./fixtures/sec-submissions-former-names.json', import.meta.url), 'utf8'));
const context = {window: {}};
vm.runInNewContext(moduleSource, context, {timeout: 1000});
const rendered = context.window.AIPivotWatch.render();

assert.match(html, /value="ai-watch">AI filing watch/);
assert.match(html, /href="#ai-watch" data-nav="ai-watch">AI filing watch/);
assert.match(html, /ai-pivot-watch\.js/);
assert.match(html, /ai-operating-bridge table/);
assert.match(app, /p==='ai-watch'\?window\.AIPivotWatch\.render\(\)/);
for (const term of ['Rocket One', 'Smartbird', 'BluSky AI', 'Greater Bay Area AI Computing Tech', 'AIB Data Centers']) {
  assert.ok(rendered.includes(term), `Missing AI pivot case: ${term}`);
}
for (const [market, url] of [
  ['United Kingdom', 'https://developer.company-information.service.gov.uk/overview/'],
  ['Hong Kong', 'https://www.hkex.com.hk/eng/market/sec_tradinfo/tradarng/etatgem.htm'],
  ['Taiwan', 'https://mops.twse.com.tw/'],
  ['South Korea', 'https://engopendart.fss.or.kr/'],
  ['Brazil', 'https://dados.cvm.gov.br/dataset/cia_aberta-doc-ipe'],
  ['Japan', 'https://disclosure2dl.edinet-fsa.go.jp/guide/static/disclosure/WEEK0060.html'],
  ['India', 'https://www.nseindia.com/companies-listing/corporate-filings-announcements'],
  ['Canada', 'https://systems.securities-administrators.ca/onlinehelp/general-help/getting-started/general-public-access/'],
  ['Australia', 'https://www.asx.com.au/asx/v2/statistics/announcements.do']
]) {
  assert.ok(rendered.includes(market), `Missing international source market: ${market}`);
  assert.ok(rendered.includes(url), `Missing official source link for ${market}`);
}
assert.match(rendered, /These adapters are not scheduled or connected to this public feed/);
assert.match(rendered, /Local adapter only\. Requires a free API key/);
assert.match(rendered, /Local adapter only\. Requires a user-held API key/);
assert.match(rendered, /Local prototype only\. Public annual archive, no API key/);
assert.match(rendered, /Implementation status checked 18 Oct 2026/);
assert.match(rendered, /No automated screen is connected for these markets/);
const feedTarget = {innerHTML: ''};
context.document = {querySelector: () => feedTarget};
context.fetch = async () => ({ok: true, json: async () => ({
  generatedAt: '2026-10-13T12:00:00Z', scanWindowStart: '2026-10-06', scanWindowEnd: '2026-10-13', coverage: 'test feed', unavailableIndexDays: [],
  lastSuccessfulScan: {completedAt: '2026-10-13T12:00:00Z', readableIndexDays: 5, unavailableIndexDays: []},
  qualityReview: {reviewedAt: '2026-10-18T17:25:41Z', scope: 'Saved SEC evidence excerpts reclassified with current filing-screen rules; this review did not fetch new filings.', newFilingScan: false, archivedForReview: 150},
  indexCoverage: {timeZone: 'America/New_York', checkedDays: [
    {date: '2026-10-10', status: 'expected-skip', reason: 'weekend'},
    {date: '2026-10-12', status: 'expected-skip', reason: 'SEC federal holiday'},
    {date: '2026-10-13', status: 'request-failed', httpStatus: 403, reason: 'SEC did not return a readable index; coverage could not be confirmed.'}
  ]},
  leads: [{cik: '0000000123', company: 'Example Co', mappedCompany: 'Example Co', ticker: 'EXMP', exchange: 'Nasdaq', form: '8-K', filingDate: '2026-10-13', filingUrl: 'https://www.sec.gov/Archives/edgar/data/123/000000012326000004/0000000123-26-000004.txt', label: 'New AI operating-disclosure wording', reviewStatus: 'full SEC filing screened; human review required', evidence: [{text: 'The issuer launched an AI-enabled product for customers.', evidenceClass: 'operating-disclosure', reviewCues: ['customer or contract wording']}], operatingBridge: {asOfDate: '2026-10-13', periodStart: '2026-04-01', periodEnd: '2026-06-30', durationDays: 91, unit: 'USD', taxonomy: 'us-gaap', grossMarginPct: 40, operatingMarginPct: 10, facts: {revenue: {value: 100, unit: 'USD', taxonomy: 'us-gaap', tag: 'RevenueFromContractWithCustomerExcludingAssessedTax', form: '10-Q', filed: '2026-08-01', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/123/000000012326000004/0000000123-26-000004.txt'}, grossProfit: {value: 40, unit: 'USD', taxonomy: 'us-gaap', tag: 'GrossProfit', form: '10-Q', filed: '2026-08-01', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/123/000000012326000004/0000000123-26-000004.txt'}, operatingIncome: null, netIncome: null}, priorYearComparison: {periodStart: '2025-04-01', periodEnd: '2025-06-30', durationDays: 91, facts: {revenue: {value: 80, unit: 'USD', taxonomy: 'us-gaap', tag: 'RevenueFromContractWithCustomerExcludingAssessedTax', form: '10-Q', filed: '2025-08-01', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/123/000000012325000003/0000000123-26-000003.txt'}}, metrics: {revenue: {change: 20, percentChange: 25, unit: 'USD'}}}}}],
  archivedLeads: [{company: 'Former AI Asset Co', form: '6-K', filingDate: '2026-10-10', filingUrl: 'https://www.sec.gov/Archives/edgar/data/123/000000012326000005/0000000123-26-000005.txt', archiveReason: 'Full filing no longer supports a current AI operating lead.'}]
})});
await context.window.AIPivotWatch.loadFeed();
assert.match(feedTarget.innerHTML, /Saved-evidence review/);
assert.match(feedTarget.innerHTML, /this review did not fetch new filings/);
assert.match(feedTarget.innerHTML, /Moved 150 records to the archive for review/);
assert.match(feedTarget.innerHTML, /Full filing no longer supports a current AI operating lead/);
assert.match(feedTarget.innerHTML, /Company-wide operating metrics and year-earlier comparison/);
assert.match(feedTarget.innerHTML, /Year-earlier period/);
assert.match(feedTarget.innerHTML, /not AI-segment results/);
assert.match(feedTarget.innerHTML, /2025-04-01 to 2025-06-30/);
assert.match(feedTarget.innerHTML, /25% YoY/);
assert.match(feedTarget.innerHTML, /RevenueFromContractWithCustomerExcludingAssessedTax/);
assert.match(feedTarget.innerHTML, /<th>Gross margin<\/th><td>40%<\/td>/);
assert.match(feedTarget.innerHTML, /Unavailable/);
assert.match(feedTarget.innerHTML, /Issuer operating disclosure wording/);
assert.match(feedTarget.innerHTML, /These are text matches, not verified operating facts/);
assert.match(feedTarget.innerHTML, /Expected index skips: 2026-10-10 \(weekend\), 2026-10-12 \(SEC federal holiday\)/);
assert.match(feedTarget.innerHTML, /5 filing index days read; 0 could not be confirmed/);
assert.match(feedTarget.innerHTML, /Coverage for these dates is unverified/);
assert.match(feedTarget.innerHTML, /does not establish that filings were missed/);
assert.doesNotMatch(feedTarget.innerHTML, /Results do not cover those dates/);
context.fetch = async () => ({ok: true, json: async () => ({
  generatedAt: '2026-10-13T12:00:00Z', scanWindowStart: '2026-10-06', scanWindowEnd: '2026-10-13',
  unavailableIndexDays: ['2026-10-10', '2026-10-11'], leads: []
})});
await context.window.AIPivotWatch.loadFeed();
assert.match(feedTarget.innerHTML, /An earlier scan listed 2026-10-10, 2026-10-11 without recording why/);
assert.match(feedTarget.innerHTML, /Coverage for those dates cannot be confirmed from that scan/);
assert.doesNotMatch(feedTarget.innerHTML, /Results do not cover those dates/);
for (const href of [
  'https://www.sec.gov/Archives/edgar/data/1711786/000121390026090048/ea0300119-10q_rocket.htm',
  'https://www.sec.gov/Archives/edgar/data/1653909/000143774926028446/bird20260630_10q.htm',
  'https://www.sec.gov/Archives/edgar/data/1416090/000149315226014362/form10-k.htm',
  'https://www.hkexnews.hk/listedco/listconews/sehk/2026/0515/2026051501223.pdf'
]) assert.ok(rendered.includes(href), `Missing primary filing link: ${href}`);
assert.match(rendered, /Manual review · not a live feed/);
assert.match(rendered, /or make a stock a short/);
assert.match(rendered, /company-ticker-exchange association file/);
assert.match(moduleSource, /repository Actions secret SEC_USER_AGENT/);
assert.equal(expectedIndexSkipReason('2026-10-10', '2026-10-14'), 'weekend');
assert.equal(expectedIndexSkipReason('2026-10-11', '2026-10-14'), 'weekend');
assert.equal(expectedIndexSkipReason('2026-10-12', '2026-10-14'), 'SEC federal holiday');
assert.match(expectedIndexSkipReason('2026-10-14', '2026-10-14'), /current ET date/);
assert.equal(expectedIndexSkipReason('2026-10-13', '2026-10-14'), null);
assert.ok(secFederalHolidays(2026).has('2026-10-12'), 'SEC holiday calendar must include Columbus Day 2026');
selfTest();
assert.equal(isNameChangeLead('Item 5.03. The company changed its corporate name from Old Co to New Co.', '8-K'), true);
assert.equal(isNameChangeLead('Item 5.03. No name change occurred.', '8-K'), false);
assert.equal(isNameChangeLead('The issuer changed its name from Old Holdings Limited to New AI Holdings Limited.', '6-K'), true, 'explicit 6-K name-change language is eligible for submissions-history verification');
assert.equal(isNameChangeLead('Item 5.03. The company adopted a new strategy.', '6-K'), false, '6-K requires explicit name-change wording');
assert.equal(isNameChangeLead('The issuer plans to change its name next year.', '6-K'), false, 'planned name changes do not count as completed name changes');
assert.equal(isNameChangeLead('The issuer changed its name from Old Inc. to New Inc.', '20-F'), false, 'annual reports do not independently trigger name-change candidates');
assert.deepEqual(reviewCues('AI data center capacity for customers under a proposed contract, with expected revenue and financing.'), [
  'financial-results wording', 'customer or contract wording', 'asset, capacity, or deployment wording', 'funding or dilution wording', 'forward-looking wording'
]);
assert.ok(analyzeText('The company sells machine learning services to enterprise customers.').length, 'machine-learning business wording should be screened');
const executiveBio = 'The board appointed Ms. Example as a director. She previously served as COO at HP, where she led AI-powered insights for enterprise customers. Her biography describes her career in technology.';
assert.equal(isLikelyBiographyEvidence(executiveBio), true);
assert.equal(analyzeText(executiveBio).length, 0, 'AI references in executive biographies should not create operating leads');
const bioNearOperatingDisclosure = 'The board appointed Ms. Example as a director. She previously served as COO at HP, where she led AI-powered insights for enterprise customers. Separately, the issuer launched an AI-enabled claims processing product for customers this quarter.';
assert.ok(analyzeText(bioNearOperatingDisclosure).some(hit => hit.term.toLowerCase() === 'ai-enabled'), 'a nearby executive biography must not suppress a separate operating disclosure');
assert.equal(isLikelyBiographyEvidence('She previously served as COO at HP, where she led AI-powered insights for enterprise customers. The issuer launched an AI-enabled claims processing product for customers.', 'AI-enabled'), false, 'stored evidence should be classified from the sentence containing the matched term');
const executiveBioWithExperienceSpan = 'She serves as senior vice president and chief operating officer of Global HP Solutions for HP Inc., where she leads operations and strategic execution across HP’s global Solutions portfolio, enabling intelligent platforms, AI-powered insights and collaboration across all HP global businesses. Her experience with HP spans over two decades during which she has held a number of leadership positions.';
assert.equal(isLikelyBiographyEvidence(executiveBioWithExperienceSpan), true);
assert.equal(analyzeText(executiveBioWithExperienceSpan).length, 0, 'AI references in filed executive biographies should not create operating leads');
const riskBoilerplate = 'Risks and uncertainties associated with our increasing use of artificial intelligence and other emerging technologies may affect the company\'s business operations.';
assert.equal(analyzeText(riskBoilerplate).length, 0, 'AI mentions inside an explicit risk-list sentence should not create operating leads');
assert.equal(classifyAiEvidence(riskBoilerplate, 'artificial intelligence'), 'risk-boilerplate', 'risk disclosures receive an explicit low-confidence classification');
const mixedRiskAndBusiness = 'Risks and uncertainties associated with our increasing use of artificial intelligence and other emerging technologies may affect results. Separately, we launched an AI-enabled claims processing product for customers this quarter.';
assert.ok(analyzeText(mixedRiskAndBusiness).some(hit => hit.term.toLowerCase() === 'ai-enabled'), 'risk boilerplate in one sentence should not suppress an operational AI hit elsewhere in the filing');
assert.ok(analyzeText('We launched an AI-powered analytics product for customers in September.').length, 'issuer product language should remain eligible');
const deniedAiLaunch = 'The company has not launched an AI-enabled product for customers.';
assert.equal(classifyAiEvidence(deniedAiLaunch, 'AI-enabled'), 'negative-or-not-current', 'an explicit denial cannot be classified as a completed AI launch');
assert.equal(analyzeText(deniedAiLaunch).length, 0, 'explicitly denied AI activity does not create an operating lead');
const deniedAiDeployment = 'We have not yet deployed AI-powered services for our customers.';
assert.equal(analyzeText(deniedAiDeployment).length, 0, 'negated issuer deployments do not create operating leads');
const deniedAiSales = 'The company does not sell AI products.';
assert.equal(analyzeText(deniedAiSales).length, 0, 'a denied AI product sale is not treated as a current pivot');
const internalAiUse = 'The issuer uses an AI platform for internal customer support.';
assert.equal(classifyAiEvidence(internalAiUse, 'AI platform'), 'internal-tool-use', 'internal-only AI assistance is separated from commercial AI offerings');
assert.equal(analyzeText(internalAiUse).length, 0, 'internal AI tools alone do not create an AI business pivot');
const internalAndExternalAi = 'The company launched an AI-enabled claims product for customers, while it also uses AI internally for administrative work.';
assert.ok(analyzeText(internalAndExternalAi).some(hit => hit.sentence.includes('launched an AI-enabled claims product')), 'an internal-use clause must not hide a separate external product launch');
assert.ok(analyzeText('The company launched an AI-enabled product for customers, while a board committee oversees AI governance.').length, 'positive operating disclosures remain eligible beside governance language');
const glossary = 'Artificial intelligence is a field of computer science that may affect many businesses.';
assert.equal(analyzeText(glossary).length, 0, 'glossary definitions do not become operating leads');
assert.equal(classifyAiEvidence(glossary, 'artificial intelligence'), 'glossary-or-definition');
assert.equal(classifyAiEvidence('Glossary of Defined Terms. Term Definition. ACL Allowance for credit losses. AI Artificial intelligence, including machine learning.', 'artificial intelligence'), 'glossary-or-definition', 'table-style glossary references are classified as boilerplate');
assert.equal(classifyAiEvidence('Cybersecurity risks include hacking, phishing, malware and AI-driven cyberattacks.', 'AI-driven'), 'risk-boilerplate', 'AI threat references in cybersecurity boilerplate are not operating signals');
assert.equal(classifyAiEvidence('Evolving privacy, biometric and artificial intelligence laws and regulations may affect our business.', 'artificial intelligence'), 'risk-boilerplate', 'AI regulation and privacy risk language does not establish a pivot');
assert.equal(analyzeText('Evolving privacy, biometric and artificial intelligence laws and regulations may affect our business.').length, 0);
assert.equal(classifyAiEvidence('Governance and framework for AI Strategy focused on efficiency, productivity and client experience opportunities.', 'AI Strategy'), 'governance-or-oversight', 'board governance wording is not issuer operating evidence');
assert.equal(analyzeText('Governance and framework for AI Strategy focused on efficiency, productivity and client experience opportunities.').length, 0);
const governedProduct = 'The company launched an AI-powered claims service for customers, while a board committee oversees AI governance and regulatory risk.';
assert.equal(classifyAiEvidence(governedProduct, 'AI-powered'), 'operating-disclosure', 'governance language must not suppress a concrete issuer service launch in the same sentence');
assert.ok(analyzeText(governedProduct).length);
assert.equal(classifyAiEvidence('The Company and its Subsidiaries have not included data in prompts into any third party AI Technology, except under enterprise level licenses.', 'AI Technology'), 'third-party-tool-use', 'internal use restrictions for third-party AI tools are not an AI business pivot');
assert.equal(analyzeText('The Company and its Subsidiaries have not included data in prompts into any third party AI Technology, except under enterprise level licenses.').length, 0);
assert.equal(classifyAiEvidence('Following the disposal of the subsidiaries that owned the software, the AI-Powered Travel Platform Software asset was removed from the Group.', 'AI-Powered'), 'disposed-or-former-asset', 'AI assets disposed of by the issuer are not current operating evidence');
assert.equal(analyzeText('Following the disposal of the subsidiaries that owned the software, the AI-Powered Travel Platform Software asset was removed from the Group.').length, 0);
const retainedProduct = 'The company launched an AI-powered logistics service for customers, while a separate AI platform it owned was sold.';
assert.equal(classifyAiEvidence(retainedProduct, 'AI-powered'), 'operating-disclosure', 'a disposal disclosure must not suppress an unrelated current commercial product');
assert.equal(classifyAiEvidence('Business and Operational Risks. The impact of innovation and technological change, including artificial intelligence, may affect the insurance industry.', 'artificial intelligence'), 'risk-boilerplate', 'saved snippets from a labeled risk section remain suppressed');
const externalQuote = 'According to our customer, the vendor launched an AI-powered analytics platform for retail businesses.';
assert.equal(analyzeText(externalQuote).length, 0, 'third-party product claims do not become issuer operating leads');
assert.equal(classifyAiEvidence(externalQuote, 'AI-powered'), 'third-party-mention');
const genericBoilerplate = 'AI may improve business operations, products, services, and customer experiences across the industry.';
assert.equal(analyzeText(genericBoilerplate).length, 0, 'generic AI boilerplate without a concrete issuer action is withheld');
assert.equal(classifyAiEvidence(genericBoilerplate, 'AI'), 'low-confidence-mention');
const unrelatedAcquisitionAfterAiStrategy = 'The issuer announced an AI strategy and acquired a regional software company with 40,000 existing customers.';
assert.equal(classifyAiEvidence(unrelatedAcquisitionAfterAiStrategy, 'AI strategy'), 'low-confidence-mention', 'an unrelated acquisition in a separate coordinated clause cannot establish AI-linked operating activity');
assert.equal(analyzeText(unrelatedAcquisitionAfterAiStrategy).length, 0, 'an AI strategy mention must not borrow an unrelated acquisition verb and customer base');
assert.ok(analyzeText('The company launched an AI-powered analytics service for customers and acquired a regional software business.').length, 'a concrete AI service launch remains eligible beside an unrelated acquisition');
const specificPlan = 'The issuer plans to build an AI data center and provide compute capacity to customers next year.';
assert.equal(classifyAiEvidence(specificPlan, 'AI'), 'planned-operating-disclosure');
assert.ok(analyzeText(specificPlan).some(hit => hit.evidenceClass === 'planned-operating-disclosure'), 'specific issuer plans remain visible but separately classified from completed operations');
assert.equal(analyzeText('Americas Gold and Silver Corporation, a North American producer of silver and other critical minerals supporting artificial intelligence, is increasing silver and antimony production.').length, 0, 'commodity demand exposure to AI should not be mistaken for an issuer AI business');
assert.equal(analyzeText('The company will increase silver and antimony output while supplying critical minerals needed to support the next generation of AI infrastructure.').length, 0, 'critical-mineral demand wording should not create an AI pivot lead');
assert.ok(analyzeText('The company is launching an AI data center business and will provide compute capacity to customers.').length, 'issuer-operated AI business language should remain eligible');
const verifiedNameChange = legalNameChangeFromSubmissions(formerNamesFixture, '2026-10-10', '123');
assert.deepEqual(verifiedNameChange, {
  oldName: 'Beta Manufacturing Inc.',
  newName: 'Current AI Systems Inc.',
  effectiveDate: '2026-10-01',
  source: 'SEC submissions formerNames history and current name',
  sourceUrl: 'https://data.sec.gov/submissions/CIK0000000123.json'
});
assert.ok(isNameChangeLead('The issuer changed its name from Beta Manufacturing Inc. to Current AI Systems Inc.', '6-K') && verifiedNameChange, '6-K wording is only eligible when the SEC submissions history independently confirms the transition');
const verifiedNonAiNameChange = legalNameChangeFromSubmissions({
  name: 'Current Widgets Inc.',
  formerNames: [{name: 'Beta Manufacturing Inc.', from: '2024-01-01', to: '2026-10-01'}]
}, '2026-10-10', '123');
assert.ok(verifiedNonAiNameChange, 'control case must contain a recent, independently verified legal name change');
assert.equal(aiPivotLeadType(verifiedNonAiNameChange, ''), null, 'a verified non-AI legal rename cannot create an AI pivot lead on its own');
assert.equal(aiPivotLeadType(verifiedNameChange, ''), 'ai-name-change', 'a verified legal rename to an AI-branded name should appear even when its filing lacks a separate AI-language match');
const legalExhibitFiling = relevantDocuments('<DOCUMENT><TYPE>8-K</TYPE><TEXT>Item 5.03. See attached certificate.</TEXT></DOCUMENT><DOCUMENT><TYPE>EX-3.1</TYPE><TEXT>The Company changed its corporate name from Beta Manufacturing Inc. to Current AI Systems Inc. The company also launched an AI-powered customer service platform.</TEXT></DOCUMENT>', '8-K');
assert.ok(legalExhibitFiling.some(doc => doc.type === 'EX-3.1'), 'legal name exhibit should be available for rename corroboration');
assert.ok(isNameChangeLead(legalExhibitFiling.map(doc => doc.text).join(' '), '8-K'), 'an 8-K with name-change item and legal exhibit should be corroborated');
assert.equal(aiPivotLeadType(verifiedNameChange, ''), 'ai-name-change', 'legal-name exhibit text is not itself an operating-language delta');
const aiEligibleLegalExhibitDocs = legalExhibitFiling.filter(doc => !isLegalNameExhibit(doc));
assert.ok(!aiEligibleLegalExhibitDocs.flatMap(doc => analyzeText(doc.text)).length, 'the name-exhibit filing should not create an operating-language lead from legal exhibit wording alone');
assert.equal(aiPivotLeadType(verifiedNonAiNameChange, 'AI language first detected versus prior same-form filing'), 'name-change-and-ai-language', 'a rename can accompany a lead only when the filing independently meets the AI-language screen');
assert.equal(aiPivotLeadType(null, 'New AI-business wording versus prior same-form filing'), 'ai-language-change', 'the AI-language screen remains sufficient when there is no verified name change');
assert.equal(aiPivotLeadType(null, 'AI operating-disclosure lead; prior filing comparison unavailable'), 'ai-language-review', 'an operating match with an unavailable prior comparison remains a review lead, not a verified pivot');
assert.equal(legalNameChangeFromSubmissions({name: 'Unrelated Current Inc.', formerNames: []}, '2026-10-10', '123'), null, '6-K text without a matching SEC name history cannot confirm a transition');
assert.equal(legalNameChangeFromSubmissions(formerNamesFixture, '2026-07-01', '123'), null, 'stale SEC name transitions should not be assigned to a recent filing');
assert.equal(legalNameChangeFromSubmissions(formerNamesFixture, '2026-11-15', '123')?.effectiveDate, '2026-10-01', 'a transition exactly 45 days before filing remains in scope');
assert.equal(legalNameChangeFromSubmissions(formerNamesFixture, '2026-11-16', '123'), null, 'a transition 46 days before filing is outside the matching window');
assert.equal(legalNameChangeFromSubmissions(formerNamesFixture, '2026-08-17', '123')?.effectiveDate, '2026-10-01', 'a transition exactly 45 days after filing remains in scope');
assert.equal(legalNameChangeFromSubmissions(formerNamesFixture, '2026-08-16', '123'), null, 'a transition 46 days after filing is outside the matching window');
assert.equal(legalNameChangeFromSubmissions({name: 'Same Name Inc.', formerNames: [{name: 'Same Name Inc.', from: '2026-10-01', to: '2026-10-08'}]}, '2026-10-10', '123'), null, 'identical legal names should not create a transition');
assert.equal(legalNameChangeFromSubmissions({name: 'Current Inc.', formerNames: [{name: 'No End Date Inc.', from: '2026-10-01'}]}, '2026-10-10', '123'), null, 'a former name without an end date cannot anchor an effective transition');
const mapping = parseTickerExchange({fields: ['cik', 'name', 'ticker', 'exchange'], data: [[123, 'Example Inc.', 'EXMP', 'Nasdaq']]});
const filings = [
  {cik: '0000000123', company: 'Example Old Inc.', form: '8-K'},
  {cik: '0000000456', company: 'Unmapped Private Co.', form: '8-K'}
];
const mappedFilings = attachListedIssuer(filings, mapping);
assert.equal(mappedFilings.length, 2, 'filers outside the current ticker map remain in the filing universe');
assert.equal(mappedFilings[0].ticker, 'EXMP');
assert.equal(mappedFilings[0].exchange, 'Nasdaq');
assert.equal(mappedFilings[0].mappedCompany, 'Example Inc.');
assert.equal(mappedFilings[1].ticker, null);
assert.equal(mappedFilings[1].issuerCoverage, 'No match in the current SEC ticker and exchange association file; issuer is identified by daily-index name and CIK.');
const priorHits = analyzeText(deltaFixture.prior);
const currentHits = analyzeText(deltaFixture.current);
assert.equal(priorHits.length, currentHits.length, 'fixture should preserve the raw AI keyword count');
assert.ok(novelAiEvidence(currentHits, priorHits).length > 0, 'screen should find a new AI-business phrase when raw counts stay flat');
assert.match(aiDeltaLabel(currentHits, priorHits), /^New AI operating-disclosure wording/);
const nearPriorHits = analyzeText(deltaFixture.nearDuplicatePrior);
const nearCurrentHits = analyzeText(deltaFixture.nearDuplicateCurrent);
assert.equal(novelAiEvidence(nearCurrentHits, nearPriorHits).length, 0, 'a near-duplicate phrase with one wording change should not be called new');
const retainedFixture = JSON.parse(await readFile(new URL('./fixtures/sec-ai-retained-leads.json', import.meta.url), 'utf8'));
const revalidated = revalidateRetainedLeads(retainedFixture);
assert.deepEqual(revalidated.map(row => row.accession), ['mixed-survives', 'verified-ai-rename-survives'], 'stale glossary, cyber-risk and biography-only leads are removed, while a surviving operating disclosure and independently verified AI rename remain');
assert.equal(revalidated[0].evidence.length, 1, 'only the substantive operating evidence remains on a mixed saved lead');
assert.equal(revalidated[0].evidence[0].evidenceClass, 'operating-disclosure', 'revalidated evidence stores its current classifier result');
assert.ok(deltaFixture.sourceFilings.every(url => /^https:\/\/www\.sec\.gov\/Archives\//.test(url)));

const oldFetch = globalThis.fetch;
const currentFilingUrl = 'https://www.sec.gov/Archives/edgar/data/123/000000012326000001/0000000123-26-000001.txt';
const priorFilingUrl = 'https://www.sec.gov/Archives/edgar/data/123/000000012326000000/0000000123-26-000000.txt';
const submissionHistory = {filings:{recent:{accessionNumber:['0000000123-26-000001','0000000123-26-000000'],form:['8-K','8-K'],filingDate:['2026-10-10','2026-08-10'],primaryDocument:['current.htm','prior.htm']}}};
const fullFilingLead = {cik:'0000000123',company:'Example Inc.',ticker:'EXMP',form:'8-K',filingDate:'2026-10-10',accession:'0000000123-26-000001',filingUrl:currentFilingUrl,evidence:[]};
const filingBody = text => `<DOCUMENT><TYPE>8-K</TYPE><TEXT>${text}</TEXT></DOCUMENT>`;
try {
  globalThis.fetch = async url => {
    const value = String(url);
    if (value === currentFilingUrl) return {ok:true,status:200,text:async()=>filingBody('The company launched an AI-powered logistics service for customers, while a board committee oversees AI governance and regulatory risk.'),headers:{get:()=>null}};
    if (value === priorFilingUrl) return {ok:true,status:200,text:async()=>filingBody('The company reported its quarterly financial results.'),headers:{get:()=>null}};
    throw new Error(`Unexpected SEC mock URL: ${value}`);
  };
  const verified = await revalidateRetainedLeadsFromSEC([fullFilingLead], 'Research contact analyst@example.com', new Map([['0000000123',submissionHistory]]));
  assert.equal(verified.retained.length, 1, 'whole-filing recheck should retain a new issuer service even when governance appears nearby');
  assert.equal(verified.retained[0].reviewStatus, 'full SEC filing rechecked; human review required');
  assert.equal(verified.archived.length, 0);

  const archivedWithEvidence = await revalidateRetainedLeadsFromSEC([{...fullFilingLead,archiveReason:'Archived in a prior review.'}], 'Research contact analyst@example.com', new Map([['0000000123',submissionHistory]]));
  assert.equal(archivedWithEvidence.retained.length, 0, 'a previously archived lead must not return to the active feed after a positive match');
  assert.equal(archivedWithEvidence.archived.length, 1);
  assert.equal(archivedWithEvidence.archived[0].archiveReason, 'Archived in a prior review.');
  assert.equal(archivedWithEvidence.archived[0].fullFilingClassifierVersion, '2026-10-18.3');
  assert.match(archivedWithEvidence.archived[0].reviewStatus, /archive status preserved/);

  globalThis.fetch = async url => {
    const value = String(url);
    if (value === currentFilingUrl) return {ok:true,status:200,text:async()=>filingBody('The company launched an AI-powered logistics service for customers.'),headers:{get:()=>null}};
    if (value === priorFilingUrl) return {ok:false,status:404,text:async()=>'',headers:{get:()=>null}};
    throw new Error(`Unexpected SEC mock URL: ${value}`);
  };
  const comparisonUnknown = await revalidateRetainedLeadsFromSEC([fullFilingLead], 'Research contact analyst@example.com', new Map([['0000000123',submissionHistory]]));
  assert.equal(comparisonUnknown.retained.length, 1, 'an unavailable prior filing must not archive an otherwise valid issuer activity match');
  assert.equal(comparisonUnknown.retained[0].leadType, 'ai-language-review');
  assert.match(comparisonUnknown.retained[0].reviewStatus, /comparison unavailable/);

  globalThis.fetch = async url => {
    assert.equal(String(url), currentFilingUrl);
    return {ok:true,status:200,text:async()=>filingBody('The company operates logistics facilities and reports customer volumes.'),headers:{get:()=>null}};
  };
  const archivedAgain = await revalidateRetainedLeadsFromSEC([{...fullFilingLead,archiveReason:'Pending full filing recheck.'}], 'Research contact analyst@example.com', new Map());
  assert.equal(archivedAgain.retained.length, 0);
  assert.equal(archivedAgain.archived.length, 1, 'a fully rechecked archive remains archived when no qualifying AI evidence remains');
  assert.equal(archivedAgain.archived[0].reviewStatus, 'archived after full filing recheck');

  let incompleteIndexCalls = 0;
  globalThis.fetch = async url => {
    const value = String(url);
    if (value === 'https://www.sec.gov/files/company_tickers_exchange.json') {
      return new Response(JSON.stringify({fields: ['cik', 'name', 'ticker', 'exchange'], data: [[123, 'Example Inc.', 'EXMP', 'Nasdaq']]}));
    }
    if (value.includes('/Archives/edgar/daily-index/')) {
      return new Response('CIK|Company Name|Form Type|Date Filed|Filename\n--------------------------------------------------------------------------------\n');
    }
    throw new Error(`Unexpected SEC mock URL during scan: ${value}`);
  };
  const reviewMetadata = {reviewedAt: '2026-10-18T17:25:41Z', scope: 'Saved excerpts only.', newFilingScan: false, archivedForReview: 150};
  const scanResult = await scan({
    now: '2026-10-19T15:00:00Z', lookbackDays: 3,
    userAgent: 'Research contact analyst@example.com',
    feed: {leads: [], archivedLeads: [], checkedAccessions: [], qualityReview: reviewMetadata},
  });
  assert.deepEqual(scanResult.qualityReview, reviewMetadata, 'a successful filing scan must preserve the saved-evidence review record');
  assert.equal(scanResult.lastSuccessfulScan.completedAt, '2026-10-19T15:00:00.000Z');
  assert.equal(scanResult.lastSuccessfulScan.readableIndexDays, 1);
  assert.deepEqual(scanResult.lastSuccessfulScan.unavailableIndexDays, []);
  assert.equal(scanResult.filingUniverse.eligibleFilingsInLookback, 0);
  assert.equal(scanResult.filingUniverse.perScanFilingCap, 250);

  const scanIndex = [
    'CIK|Company Name|Form Type|Date Filed|Filename',
    '--------------------------------------------------------------------------------',
    '456|Unmapped Public Issuer A|8-K|20261016|edgar/data/456/000000045626000001/0000000456-26-000001.txt',
    '789|Unmapped Public Issuer B|8-K|20261016|edgar/data/789/000000078926000001/0000000789-26-000001.txt',
    '123|Mapped Public Issuer|8-K|20261016|edgar/data/123/000000012326000005/0000000123-26-000005.txt',
  ].join('\n');
  globalThis.fetch = async url => {
    const value = String(url);
    if (value === 'https://www.sec.gov/files/company_tickers_exchange.json') {
      return new Response(JSON.stringify({fields: ['cik', 'name', 'ticker', 'exchange'], data: [[123, 'Mapped Public Issuer', 'MAP', 'Nasdaq']]}));
    }
    if (value.includes('/Archives/edgar/daily-index/')) return new Response(scanIndex);
    if (value === 'https://www.sec.gov/Archives/edgar/data/456/000000045626000001/0000000456-26-000001.txt') {
      return new Response('<DOCUMENT><TYPE>8-K<TEXT>The company launched an AI-enabled analytics service for customers.</TEXT></DOCUMENT>');
    }
    if (value === 'https://www.sec.gov/Archives/edgar/data/123/000000012326000005/0000000123-26-000005.txt') return new Response('', {status: 404});
    if (value === 'https://data.sec.gov/submissions/CIK0000000456.json' || value === 'https://data.sec.gov/api/xbrl/companyfacts/CIK0000000456.json') {
      return new Response('', {status: 404});
    }
    throw new Error(`Unexpected SEC mock URL during broad-universe scan: ${value}`);
  };
  const broadScan = await scan({
    now: '2026-10-19T15:00:00Z', lookbackDays: 3, maxFilingsToScreen: 2,
    userAgent: 'Research contact analyst@example.com',
    feed: {leads: [], archivedLeads: [], checkedAccessions: []},
  });
  assert.equal(broadScan.filingUniverse.eligibleFilingsInLookback, 3, 'eligible filings are drawn from the complete index, including CIKs missing from the ticker map');
  assert.equal(broadScan.filingUniverse.issuersMatchedToTickerExchangeFile, 1);
  assert.equal(broadScan.filingUniverse.unmatchedIssuersInLookback, 2);
  assert.equal(broadScan.filingUniverse.filingsSelectedForScreen, 2);
  assert.equal(broadScan.filingUniverse.filingsDeferredByPerScanCap, 1);
  assert.equal(broadScan.leads.length, 1);
  assert.equal(broadScan.leads[0].cik, '0000000456');
  assert.equal(broadScan.leads[0].ticker, null);
  assert.match(broadScan.leads[0].issuerCoverage, /No match in the current SEC ticker and exchange association file/);
  assert.ok(broadScan.filingUniverse.unmatchedFilers.some(filer => filer.cik === '0000000789' && filer.company === 'Unmapped Public Issuer B'), 'unmatched filers are explicitly listed with their daily-index CIK and name');

  globalThis.fetch = async url => {
    const value = String(url);
    if (value === 'https://www.sec.gov/files/company_tickers_exchange.json') {
      return new Response(JSON.stringify({fields: ['cik', 'name', 'ticker', 'exchange'], data: [[123, 'Example Inc.', 'EXMP', 'Nasdaq']]}));
    }
    if (value.includes('/Archives/edgar/daily-index/')) {
      incompleteIndexCalls++;
      return incompleteIndexCalls === 1
        ? new Response('CIK|Company Name|Form Type|Date Filed|Filename\n--------------------------------------------------------------------------------\n')
        : new Response('', {status: 404});
    }
    throw new Error(`Unexpected SEC mock URL during incomplete-index scan: ${value}`);
  };
  await assert.rejects(scan({
    now: '2026-10-20T15:00:00Z', lookbackDays: 4,
    userAgent: 'Research contact analyst@example.com',
    feed: {leads: [], archivedLeads: [], checkedAccessions: []},
  }), /daily-index coverage is incomplete.*existing feed was left unchanged/, 'a missing expected business-day index must abort before feed state can be replaced');
} finally {
  globalThis.fetch = oldFetch;
}

const fact = (val, start, end, filed, form = '10-Q', accn = '0000000123-26-000004') => ({val, start, end, filed, form, accn});
const usFacts = {facts: {'us-gaap': {
  RevenueFromContractWithCustomerExcludingAssessedTax: {units: {USD: [
    fact(100, '2026-04-01', '2026-06-30', '2026-08-01'),
    fact(70, '2025-04-01', '2025-06-30', '2025-08-01', '10-Q', '0000000123-25-000003'),
    fact(80, '2025-04-01', '2025-06-30', '2025-08-01'),
    fact(999, '2026-07-01', '2026-09-30', '2026-11-01')
  ], EUR: [fact(90, '2026-04-01', '2026-06-30', '2026-08-01')]}},
  Revenues: {units: {USD: [fact(110, '2026-04-01', '2026-06-30', '2026-08-01')]}},
  GrossProfit: {units: {USD: [fact(40, '2026-04-01', '2026-06-30', '2026-08-01'), fact(35, '2025-04-01', '2025-06-30', '2025-08-01', '10-Q', '0000000123-25-000003'), fact(900, '2026-01-01', '2026-06-30', '2026-08-01')]}},
  OperatingIncomeLoss: {units: {USD: [fact(10, '2026-04-01', '2026-06-30', '2026-08-01'), fact(7, '2025-04-01', '2025-06-30', '2025-08-01', '10-Q', '0000000123-25-000003')]}},
  NetIncomeLoss: {units: {USD: [fact(-5, '2026-04-01', '2026-06-30', '2026-08-01'), fact(-2, '2025-04-01', '2025-06-30', '2025-08-01', '10-Q', '0000000123-25-000003')]}},
  CashAndCashEquivalentsAtCarryingValue: {units: {USD: [
    {val: 9999, end: '2026-06-30', filed: '2026-08-01', form: '10-Q', accn: '0000000123-26-000004'},
    {val: 5000, end: '2025-06-30', filed: '2025-08-01', form: '10-Q', accn: '0000000123-25-000003'}
  ]}}
}}};
const bridge = operatingBridgeFromCompanyFacts(usFacts, '2026-08-15', '123');
assert.equal(bridge.periodStart, '2026-04-01');
assert.equal(bridge.periodEnd, '2026-06-30');
assert.equal(bridge.durationDays, 91);
assert.equal(bridge.facts.revenue.value, 100, 'alternative revenue tags must not be added together');
assert.equal(bridge.facts.revenue.tag, 'RevenueFromContractWithCustomerExcludingAssessedTax');
assert.equal(bridge.facts.grossProfit.value, 40, 'year-to-date gross profit must not be mixed with a quarterly revenue fact');
assert.equal(bridge.grossMarginPct, 40);
assert.equal(bridge.operatingMarginPct, 10);
assert.equal(bridge.facts.netIncome.value, -5);
assert.equal(bridge.facts.cash.value, 9999, 'point-in-time cash is matched to the income statement period end');
assert.equal(bridge.facts.revenue.unit, 'USD', 'multiple reported units resolve only to explicitly labeled USD');
assert.match(bridge.facts.revenue.sourceUrl, /000000012326000004/);
assert.ok(!Object.values(bridge.facts).some(value => value?.value === 999), 'facts filed after the signal date must not enter the bridge');
assert.equal(bridge.priorYearComparison.periodStart, '2025-04-01');
assert.equal(bridge.priorYearComparison.periodEnd, '2025-06-30');
assert.equal(bridge.priorYearComparison.facts.revenue.value, 70);
assert.match(bridge.priorYearComparison.facts.revenue.sourceUrl, /000000012325000003/);
assert.equal(bridge.priorYearComparison.metrics.revenue.change, 30);
assert.equal(bridge.priorYearComparison.metrics.revenue.percentChange, (30 / 70) * 100);
assert.equal(bridge.priorYearComparison.metrics.grossMarginPct.current, 40);
assert.equal(bridge.priorYearComparison.metrics.grossMarginPct.priorYear, 50);
assert.equal(bridge.priorYearComparison.metrics.grossMarginPct.changePercentagePoints, -10);
assert.equal(bridge.priorYearComparison.metrics.cash.change, 4999);
assert.equal(operatingBridgeFromCompanyFacts(usFacts, 'not-a-date', '123'), null);

const ifrsFacts = {facts: {'ifrs-full': {
  Revenue: {units: {EUR: [fact(200, '2026-01-01', '2026-06-30', '2026-08-01', '6-K')]}},
  GrossProfit: {units: {EUR: [fact(70, '2026-01-01', '2026-06-30', '2026-08-01', '6-K')]}},
  OperatingProfitLoss: {units: {EUR: [fact(20, '2026-01-01', '2026-06-30', '2026-08-01', '6-K')]}},
  ProfitLoss: {units: {EUR: [fact(15, '2026-01-01', '2026-06-30', '2026-08-01', '6-K')]}}
}}};
const ifrsBridge = operatingBridgeFromCompanyFacts(ifrsFacts, '2026-08-15', '456');
assert.equal(ifrsBridge.taxonomy, 'ifrs-full');
assert.equal(ifrsBridge.facts.revenue.value, 200);
assert.equal(ifrsBridge.facts.revenue.unit, 'EUR');
assert.equal(ifrsBridge.operatingMarginPct, 10);
assert.equal(ifrsBridge.priorYearComparison, null, 'do not invent a year-earlier comparator when no matching fiscal period exists');
const zeroSales = {facts: {'us-gaap': {Revenues: {units: {USD: [fact(0, '2026-01-01', '2026-03-31', '2026-05-01')]}}, GrossProfit: {units: {USD: [fact(2, '2026-01-01', '2026-03-31', '2026-05-01')]}}}}};
assert.equal(operatingBridgeFromCompanyFacts(zeroSales, '2026-06-01', '789').grossMarginPct, null, 'zero revenue leaves margin unavailable');
console.log('AI filing watch checks passed: filing screens, international source links, and as-of CompanyFacts operating-bridge selection across US-GAAP and IFRS fixtures.');
