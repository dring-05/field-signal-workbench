import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const sec = require(path.join(here, '..', 'automation', 'paper-book-sec-facts.gs'));
assert.equal(sec.PAPER_SEC.headerRow, 5);
assert.equal(sec.PAPER_SEC.firstDataRow, 6);

const tickerMap = sec.parseTickerMap_({
  fields: ['cik', 'name', 'ticker', 'exchange'],
  data: [
    [1045810, 'NVIDIA CORP', 'NVDA', 'Nasdaq'],
    [320193, 'Apple Inc.', 'AAPL', 'Nasdaq'],
    [789019, 'Other Apple', 'AAPL', 'NYSE']
  ]
});
assert.equal(sec.resolveTickerFromRows_(tickerMap, 'NVDA', 'NASDAQ').cik, '1045810');
assert.equal(sec.resolveTickerFromRows_(tickerMap, 'AAPL', 'NASDAQ').cik, '320193');
assert.throws(() => sec.resolveTickerFromRows_(tickerMap, 'AAPL'), /Ambiguous SEC ticker/);
assert.throws(() => sec.resolveTickerFromRows_(tickerMap, 'NVDA', 'NYSE'), /exchange listings match/);
assert.equal(sec.parseTickerMap_({0: {cik_str: 12345, ticker: 'XYZ', title: 'Example'}})[0].cik, '12345');

const point = (start, end, val, filed = end, form = '10-Q') => ({start, end, val, filed, form, accn: end.replaceAll('-', '') + '001'});
const quarterly = [
  point('2025-01-01', '2025-03-31', 100),
  point('2025-04-01', '2025-06-30', 150),
  point('2025-07-01', '2025-09-30', 150),
  point('2025-10-01', '2025-12-31', 200, '2026-02-15', '10-K')
];
const direct = sec.ttmSeries_({label: 'Revenue', units: {USD: quarterly}});
assert.equal(direct.value, 600);
assert.equal(direct.period, '2025-01-01 to 2025-12-31');

const cumulative = [
  point('2025-01-01', '2025-03-31', 100),
  point('2025-01-01', '2025-06-30', 250),
  point('2025-01-01', '2025-09-30', 400),
  point('2025-01-01', '2025-12-31', 600, '2026-02-15', '10-K')
];
assert.equal(sec.ttmSeries_({label: 'Revenue YTD', units: {USD: cumulative}}).value, 600);
assert.equal(sec.ttmSeries_({label: 'Incomplete', units: {USD: cumulative.slice(0, 3)}}), null);

const revised = [...quarterly, point('2025-01-01', '2025-03-31', 110, '2025-08-01', '10-Q/A')];
assert.equal(sec.ttmSeries_({units: {USD: revised}}).value, 610, 'latest reported revision for a period should win');

const instant = (end, val, form = '10-K') => ({end, val, filed: end, form});
const fact = (label, points, unit = 'USD') => ({label, units: {[unit]: points}});
const companyFacts = {
  cik: 123,
  facts: { 'us-gaap': {
    EntityCommonStockSharesOutstanding: fact('EntityCommonStockSharesOutstanding', [instant('2025-12-31', 1000)], 'shares'),
    NetIncomeLoss: fact('NetIncomeLoss', quarterly.map((p, i) => ({...p, val: [20, 30, 30, 40][i]}))),
    RevenueFromContractWithCustomerExcludingAssessedTax: fact('Revenue', quarterly),
    OperatingIncomeLoss: fact('OperatingIncomeLoss', quarterly.map((p, i) => ({...p, val: [10, 20, 20, 30][i]}))),
    DepreciationDepletionAndAmortization: fact('D&A', quarterly.map((p, i) => ({...p, val: [5, 5, 5, 5][i]}))),
    CashAndCashEquivalentsAtCarryingValue: fact('Cash', [instant('2025-12-31', 90)]),
    LongTermDebtCurrent: fact('Current debt', [instant('2025-12-31', 20)]),
    LongTermDebtNoncurrent: fact('Noncurrent debt', [instant('2025-12-31', 80)]),
    StockholdersEquity: fact('Equity', [instant('2025-12-31', 300)])
  }}
};
const derived = sec.deriveSecFundamentals_(companyFacts, new Date('2026-03-01T00:00:00Z'));
assert.equal(derived.sharesOutstanding, 1000);
assert.equal(derived.ttmNetIncome, 120);
assert.equal(derived.ttmRevenue, 600);
assert.equal(derived.ttmEbitda, 100);
assert.equal(derived.cash, 90);
assert.equal(derived.totalDebt, 100);
assert.equal(derived.totalEquity, 300);
assert.ok(derived.sourceNote.includes('2025-12-31'));

const valuationHeaders = [
  'Valuation record ID', 'Idea ID', 'Ticker / exchange', 'As-of date', 'Price',
  'Price source', 'Shares outstanding', 'Share-count date/source', 'Market cap',
  'TTM net income', 'P/E TTM', 'Cash & equivalents', 'Total debt', 'TTM EBITDA',
  'Enterprise value', 'EV / EBITDA', 'Metric choice / exception', 'TTM revenue',
  'Total equity', 'TTM FFO / AFFO', 'P / Sales', 'P / Book', 'P / FFO',
  'Suggested metric', 'Suggested multiple', 'Input currency', 'Fundamentals source and period'
];
const ideaHeaders = ['Book ID', 'Idea ID', 'Company name', 'Ticker', 'Exchange', 'Sector', 'Niche', 'Side', 'Size % NAV', 'Conviction', 'Thesis', 'Status', 'Entry date', 'Exit date', 'Materials URL', 'Related links', 'Valuation record ID', 'What changes mind', 'Operating signal', 'Metric-to-financial bridge', 'Find source links'];
const ideaRow = ['Main', '', 'NVIDIA Corporation', 'NVDA', 'Nasdaq', 'Technology', 'Semiconductors', 'Long', '0.02', '4', 'Manual thesis text'];
const paperValuation = [];
const paperValuationFormulas = [];
const ideaSheet = {
  getName: () => 'Ideas',
  getLastColumn: () => ideaHeaders.length,
  getRange: (row, col, numRows = 1, numCols = 1) => ({
    getDisplayValues: () => row === 5 ? [ideaHeaders] : [ideaRow.slice(col - 1, col - 1 + numCols)],
    setValue: value => { ideaRow[col - 1] = value; }
  })
};
const valuationSheet = {
  getLastRow: () => paperValuation.length ? 6 : 5,
  getLastColumn: () => valuationHeaders.length,
  getRange: (row, col, numRows = 1, numCols = 1) => ({
    getDisplayValues: () => row === 5 ? [valuationHeaders] : [paperValuation.slice(col - 1, col - 1 + numCols)],
    getFormulas: () => [paperValuationFormulas.slice(col - 1, col - 1 + numCols)],
    setValues: values => { paperValuation[row - 6] = values[0].slice(); },
    setValue: value => { paperValuation[row - 6][col - 1] = value; },
    setFormulaR1C1: formula => { paperValuationFormulas[col - 1] = formula; }
  })
};
const fetchCalls = [];
globalThis.Utilities = {getUuid: () => 'abcdef12-3456-7890-abcd-ef1234567890'};
globalThis.LockService = {getDocumentLock: () => ({waitLock: () => {}, releaseLock: () => {}})};
globalThis.PropertiesService = {getScriptProperties: () => ({getProperty: key => ({PAPER_BOOK_SPREADSHEET_ID: 'private-test-book', SEC_USER_AGENT: 'Field Signals test analyst test@example.org'})[key] || ''})};
globalThis.CacheService = {getScriptCache: () => ({get: () => null, put: () => {}})};
globalThis.UrlFetchApp = {fetch: url => {
  fetchCalls.push(url);
  const payload = url.includes('company_tickers_exchange.json')
    ? {fields: ['cik', 'name', 'ticker', 'exchange'], data: [[123, 'NVIDIA Corporation', 'NVDA', 'Nasdaq']]}
    : companyFacts;
  return {getContentText: () => JSON.stringify(payload)};
}};
const toasts = [];
const paperBook = {
  getId: () => 'private-test-book',
  getSheetByName: name => ({Ideas: ideaSheet, 'Valuation Inputs': valuationSheet}[name]),
  toast: message => toasts.push(message)
};
sec.paperBookOnEdit({
  source: paperBook,
  range: {getSheet: () => ideaSheet, getRow: () => 6, getColumn: () => 3, getNumColumns: () => 1, getNumRows: () => 1}
});
assert.equal(ideaRow[1], 'IDEA-ABCDEF123456', 'submission should create an ID only when it is blank');
assert.equal(ideaRow[10], 'Manual thesis text');
assert.equal(paperValuation[0][0], 'VAL-IDEA-ABCDEF123456');
assert.equal(paperValuation[0][1], 'IDEA-ABCDEF123456');
assert.equal(paperValuation[0][2], 'NVDA / Nasdaq');
assert.equal(paperValuation[0][4], '', 'submission trigger must not populate or overwrite a share price');
assert.equal(paperValuation[0][6], 1000);
assert.equal(paperValuation[0][9], 120);
assert.equal(paperValuation[0][13], 100);
assert.equal(fetchCalls.length, 2, 'automatic SEC refresh uses one cached ticker-map request and one Company Facts request');
assert.ok(toasts[0].includes('refreshed'));

const writes = [];
const mockSheet = {
  getLastColumn: () => valuationHeaders.length,
  getRange: (row, col) => ({
    getDisplayValues: () => [valuationHeaders],
    setValue: value => writes.push({row, col, value})
  })
};
sec.writeSecFields_(mockSheet, 6, derived);
assert.deepEqual(writes.map(write => write.col).sort((a, b) => a - b), [7, 8, 10, 12, 13, 14, 18, 19, 27]);
assert.ok(writes.every(write => write.row === 6));
assert.ok(!writes.some(write => [5, 6, 9, 11, 15, 16, 20, 24, 25].includes(write.col)), 'SEC refresh must leave manual price and formula columns unchanged');

const createdRows = [];
const formulaCols = new Set([9, 11, 15, 16, 21, 22, 23, 24, 25]);
const blankValuationRows = Array.from({length: 2}, () => new Array(valuationHeaders.length).fill(''));
const formulaPrefilledRows = blankValuationRows.map(() => valuationHeaders.map((_, index) => formulaCols.has(index + 1) ? '=1' : ''));
const mockValuation = {
  getLastRow: () => 7,
  getLastColumn: () => valuationHeaders.length,
  getRange: (row, col, numRows = 1, numCols = 1) => ({
    getDisplayValues: () => row === 5 ? [valuationHeaders] : blankValuationRows.slice(row - 6, row - 6 + numRows).map(values => values.slice(col - 1, col - 1 + numCols)),
    getFormulas: () => formulaPrefilledRows.slice(row - 6, row - 6 + numRows).map(values => values.slice(col - 1, col - 1 + numCols)),
    setValues: values => createdRows.push({row, values}),
    setFormulaR1C1: () => {}
  })
};
const mockBook = {getSheetByName: name => name === 'Valuation Inputs' ? mockValuation : null};
const linked = sec.findOrCreateValuationRow_(mockBook, {ideaId: 'IDEA-7', ticker: 'NVDA', exchange: 'Nasdaq'});
assert.equal(linked.rowNumber, 6, 'formula-only prefilled rows are reusable');
assert.equal(linked.created, true);
assert.equal(createdRows[0].values[0][0], 'VAL-IDEA-7');
assert.equal(createdRows[0].values[0][1], 'IDEA-7');
assert.equal(createdRows[0].values[0][2], 'NVDA / Nasdaq');

const missing = sec.deriveSecFundamentals_({facts: {'us-gaap': {}}}, new Date('2026-03-01T00:00:00Z'));
assert.equal(missing.ttmRevenue, '');
assert.equal(missing.sharesOutstanding, '');
assert.ok(missing.missing.some(item => item.includes('four comparable reported quarters')));
assert.ok(missing.missing.some(item => item.includes('total debt')));
console.log('Paper-book SEC Company Facts checks passed.');
