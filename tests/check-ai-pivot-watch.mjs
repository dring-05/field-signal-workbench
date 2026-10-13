import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { analyzeText, aiDeltaLabel, attachListedIssuer, isNameChangeLead, legalNameChangeFromSubmissions, novelAiEvidence, parseTickerExchange, reviewCues, selfTest } from '../automation/sec-filing-screen.mjs';

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
assert.match(app, /p==='ai-watch'\?window\.AIPivotWatch\.render\(\)/);
for (const term of ['Rocket One', 'Smartbird', 'BluSky AI', 'Greater Bay Area AI Computing Tech', 'AIB Data Centers']) {
  assert.ok(rendered.includes(term), `Missing AI pivot case: ${term}`);
}
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
console.log('AI filing watch checks passed: SEC listed-issuer mapping, ticker display, name-change wording, novel AI-business language at flat keyword counts, near-duplicate suppression, international examples, filing links, and manual-review disclosure.');
