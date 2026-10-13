import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { analyzeText, aiDeltaLabel, attachListedIssuer, isNameChangeLead, legalNameChangeFromSubmissions, novelAiEvidence, operatingBridgeFromCompanyFacts, parseTickerExchange, reviewCues, selfTest } from '../automation/sec-filing-screen.mjs';

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
  ['Japan', 'https://disclosure2dl.edinet-fsa.go.jp/guide/static/disclosure/WEEK0060.html'],
  ['India', 'https://www.nseindia.com/companies-listing/corporate-filings-announcements'],
  ['Canada', 'https://systems.securities-administrators.ca/onlinehelp/general-help/getting-started/general-public-access/'],
  ['Australia', 'https://www.asx.com.au/asx/v2/statistics/announcements.do']
]) {
  assert.ok(rendered.includes(market), `Missing international source market: ${market}`);
  assert.ok(rendered.includes(url), `Missing official source link for ${market}`);
}
assert.match(rendered, /Only the SEC is automated here/);
const feedTarget = {innerHTML: ''};
context.document = {querySelector: () => feedTarget};
context.fetch = async () => ({ok: true, json: async () => ({
  generatedAt: '2026-10-13T12:00:00Z', scanWindowStart: '2026-10-06', scanWindowEnd: '2026-10-13', coverage: 'test feed', unavailableIndexDays: [],
  leads: [{cik: '0000000123', company: 'Example Co', mappedCompany: 'Example Co', ticker: 'EXMP', exchange: 'Nasdaq', form: '8-K', filingDate: '2026-10-13', filingUrl: 'https://www.sec.gov/Archives/edgar/data/123/000000012326000004/0000000123-26-000004.txt', label: 'New AI-business wording', evidence: [], operatingBridge: {asOfDate: '2026-10-13', periodStart: '2026-04-01', periodEnd: '2026-06-30', durationDays: 91, unit: 'USD', taxonomy: 'us-gaap', grossMarginPct: 40, operatingMarginPct: 10, facts: {revenue: {value: 100, unit: 'USD', taxonomy: 'us-gaap', tag: 'RevenueFromContractWithCustomerExcludingAssessedTax', form: '10-Q', filed: '2026-08-01', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/123/000000012326000004/0000000123-26-000004.txt'}, grossProfit: {value: 40, unit: 'USD', taxonomy: 'us-gaap', tag: 'GrossProfit', form: '10-Q', filed: '2026-08-01', sourceUrl: 'https://www.sec.gov/Archives/edgar/data/123/000000012326000004/0000000123-26-000004.txt'}, operatingIncome: null, netIncome: null}}}]
})});
await context.window.AIPivotWatch.loadFeed();
assert.match(feedTarget.innerHTML, /Reported operating metrics/);
assert.match(feedTarget.innerHTML, /RevenueFromContractWithCustomerExcludingAssessedTax/);
assert.match(feedTarget.innerHTML, /Gross margin:<\/strong> 40%/);
assert.match(feedTarget.innerHTML, /Unavailable/);
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
const verifiedNameChange = legalNameChangeFromSubmissions(formerNamesFixture, '2026-10-10', '123');
assert.deepEqual(verifiedNameChange, {
  oldName: 'Beta Manufacturing Inc.',
  newName: 'Current AI Systems Inc.',
  effectiveDate: '2026-10-01',
  source: 'SEC submissions formerNames history and current name',
  sourceUrl: 'https://data.sec.gov/submissions/CIK0000000123.json'
});
assert.ok(isNameChangeLead('The issuer changed its name from Beta Manufacturing Inc. to Current AI Systems Inc.', '6-K') && verifiedNameChange, '6-K wording is only eligible when the SEC submissions history independently confirms the transition');
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
assert.equal(mappedFilings.length, 1);
assert.equal(mappedFilings[0].ticker, 'EXMP');
assert.equal(mappedFilings[0].exchange, 'Nasdaq');
assert.equal(mappedFilings[0].mappedCompany, 'Example Inc.');
const priorHits = analyzeText(deltaFixture.prior);
const currentHits = analyzeText(deltaFixture.current);
assert.equal(priorHits.length, currentHits.length, 'fixture should preserve the raw AI keyword count');
assert.ok(novelAiEvidence(currentHits, priorHits).length > 0, 'screen should find a new AI-business phrase when raw counts stay flat');
assert.match(aiDeltaLabel(currentHits, priorHits), /^New AI-business wording/);
const nearPriorHits = analyzeText(deltaFixture.nearDuplicatePrior);
const nearCurrentHits = analyzeText(deltaFixture.nearDuplicateCurrent);
assert.equal(novelAiEvidence(nearCurrentHits, nearPriorHits).length, 0, 'a near-duplicate phrase with one wording change should not be called new');
assert.ok(deltaFixture.sourceFilings.every(url => /^https:\/\/www\.sec\.gov\/Archives\//.test(url)));

const fact = (val, start, end, filed, form = '10-Q', accn = '0000000123-26-000004') => ({val, start, end, filed, form, accn});
const usFacts = {facts: {'us-gaap': {
  RevenueFromContractWithCustomerExcludingAssessedTax: {units: {USD: [
    fact(100, '2026-04-01', '2026-06-30', '2026-08-01'),
    fact(80, '2025-04-01', '2025-06-30', '2025-08-01'),
    fact(999, '2026-07-01', '2026-09-30', '2026-11-01')
  ], EUR: [fact(90, '2026-04-01', '2026-06-30', '2026-08-01')]}},
  Revenues: {units: {USD: [fact(110, '2026-04-01', '2026-06-30', '2026-08-01')]}},
  GrossProfit: {units: {USD: [fact(40, '2026-04-01', '2026-06-30', '2026-08-01'), fact(900, '2026-01-01', '2026-06-30', '2026-08-01')]}},
  OperatingIncomeLoss: {units: {USD: [fact(10, '2026-04-01', '2026-06-30', '2026-08-01')]}},
  NetIncomeLoss: {units: {USD: [fact(-5, '2026-04-01', '2026-06-30', '2026-08-01')]}},
  CashAndCashEquivalentsAtCarryingValue: {units: {USD: [{val: 9999, end: '2026-06-30', filed: '2026-08-01', form: '10-Q', accn: '0000000123-26-000004'}]}}
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
const zeroSales = {facts: {'us-gaap': {Revenues: {units: {USD: [fact(0, '2026-01-01', '2026-03-31', '2026-05-01')]}}, GrossProfit: {units: {USD: [fact(2, '2026-01-01', '2026-03-31', '2026-05-01')]}}}}};
assert.equal(operatingBridgeFromCompanyFacts(zeroSales, '2026-06-01', '789').grossMarginPct, null, 'zero revenue leaves margin unavailable');
console.log('AI filing watch checks passed: filing screens, international source links, and as-of CompanyFacts operating-bridge selection across US-GAAP and IFRS fixtures.');
