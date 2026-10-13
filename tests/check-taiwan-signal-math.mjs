import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = await readFile(new URL('../automation/taiwan-sheets-importer.gs', import.meta.url), 'utf8');
const context = {};
vm.runInNewContext(`${source}\nglobalThis.helpers = {signals: SIGNALS, feedHeaders: FEED_HEADERS, marginDependencySignatures_, issuerIdentityKey_, monthlyMarketPriority_, quarterPeriod_, quarterIndex_, finiteDifferencesAtEnd_, yoyMarginSeries_, differencesForQuarterSeries_, marginSignalsMap_, rebuildSiteFeed_, appendMonthlyRevisions_, fetchMonthlyRows_, normalizeMonthly_, normalizeMonthlyMarket_, normalizeMonthlyPeriod_, monthDistance_, mopsHistoryDataKey_, writeLog_};`, context, {timeout: 1000});
const h = context.helpers;
assert.equal(h.feedHeaders[1], 'Issuer series key');
assert.equal(h.issuerIdentityKey_('2330', '台積電股份有限公司'), h.issuerIdentityKey_('2330', '台積電 股份有限公司'), 'identity matching should normalize spacing without dropping issuer-name evidence');

assert.deepEqual(Array.from(h.signals.monthlySources, source => [source.market, source.endpoint, source.csvUrl]), [
  ['Listed (TWSE)', 't187ap05_L', 'https://mopsfin.twse.com.tw/opendata/t187ap05_L.csv'],
  ['OTC (TPEx)', 't187ap05_O', 'https://mopsfin.twse.com.tw/opendata/t187ap05_O.csv'],
  ['Emerging (MOPS)', 't187ap05_R', 'https://mopsfin.twse.com.tw/opendata/t187ap05_R.csv'],
  ['Publicly issued (MOPS)', 't187ap05_P', 'https://mopsfin.twse.com.tw/opendata/t187ap05_P.csv']
]);
assert.equal(h.monthlyMarketPriority_('Emerging (MOPS)'), 2);
assert.equal(h.monthlyMarketPriority_('Publicly issued (MOPS)'), 3);
assert.equal(h.normalizeMonthlyPeriod_(46174), '2026-06', 'Google Sheets date serials must normalize to report months');
assert.equal(h.normalizeMonthlyPeriod_(new Date(2026, 5, 1)), '2026-06', 'Date values from Sheets must normalize to report months');
assert.equal(h.monthDistance_(46174, 46266), 3, 'serial dates must preserve monthly continuity');
assert.equal(h.mopsHistoryDataKey_('Listed (TWSE)', '2330', '台積電', 46266, [100, 90, 80, 10.1234, 5.6789, 500, 450, 11.2345]), h.mopsHistoryDataKey_('Listed (TWSE)', '2330', '台積電', '2026-09', [100, 90, 80, 10.12, 5.68, 500, 450, 11.23]), 'archive and API snapshots should deduplicate rounded percentages and Sheet date cells');

const fetchCalls = [];
const fetchContext = {
  UrlFetchApp: {fetch(url) {
    fetchCalls.push(url);
    const bodies = {
      'https://openapi.twse.com.tw/v1/opendata/t187ap05_L': '[{"公司代號":"2330"}]',
      'https://openapi.twse.com.tw/v1/opendata/t187ap05_O': '503',
      'https://mopsfin.twse.com.tw/opendata/t187ap05_O.csv': '公司代號,公司名稱\n6488,環球晶',
      'https://openapi.twse.com.tw/v1/opendata/t187ap05_R': '503',
      'https://mopsfin.twse.com.tw/opendata/t187ap05_R.csv': '公司代號,公司名稱\n5274,信驊',
      'https://openapi.twse.com.tw/v1/opendata/t187ap05_P': '503',
      'https://mopsfin.twse.com.tw/opendata/t187ap05_P.csv': '503'
    };
    const body = bodies[url] ?? '404';
    const status = body === '503' ? 503 : body === '404' ? 404 : 200;
    return {getResponseCode: () => status, getContentText: () => body};
  }},
  Utilities: {parseCsv(body) { return body.split('\n').map(line => line.split(',')); }}
};
context.UrlFetchApp = fetchContext.UrlFetchApp;
context.Utilities = fetchContext.Utilities;
const multiSource = h.fetchMonthlyRows_();
assert.equal(fetchCalls.length, 7, 'each source should try the API and only failed APIs should use the CSV fallback');
assert.deepEqual(Array.from(multiSource.records, row => row.market), ['Listed (TWSE)', 'OTC (TPEx)', 'Emerging (MOPS)']);
assert.equal(multiSource.records[1].url, 'https://mopsfin.twse.com.tw/opendata/t187ap05_O.csv');
assert.equal(multiSource.records[2].url, 'https://mopsfin.twse.com.tw/opendata/t187ap05_R.csv');
assert.deepEqual(Array.from(multiSource.sources, row => row.status), ['success', 'success', 'success', 'failed']);
assert.equal(multiSource.sources[3].rows, 0);
assert.match(multiSource.sources[3].error, /API: HTTP 503.*CSV: HTTP 503/);
assert.equal(h.normalizeMonthly_(multiSource.records[0].record, multiSource.records[0].url, multiSource.records[0].market).market, 'Listed (TWSE)');
assert.equal(h.normalizeMonthlyMarket_('Taiwan public issuers'), 'Publicly issued (MOPS)', 'legacy rows from the P feed should retain a continuous history under its explicit source label');
const legacyRaw = JSON.stringify({公司代號: '2330', 資料年月: '11509'});
const legacyMonthlyRow = Array(17).fill('');
legacyMonthlyRow[0] = 'Taiwan public issuers'; legacyMonthlyRow[1] = '2330'; legacyMonthlyRow[4] = '2026-09'; legacyMonthlyRow[16] = legacyRaw;
let legacyAppendRows = [];
const legacyAppendSheet = {getLastRow: () => 5, getRange: () => ({getValues: () => [legacyMonthlyRow], setValues: rows => {legacyAppendRows = rows;}})};
const legacyNormalized = h.normalizeMonthly_(JSON.parse(legacyRaw), 'https://openapi.twse.com.tw/v1/opendata/t187ap05_P', 'Publicly issued (MOPS)');
assert.equal(h.appendMonthlyRevisions_(legacyAppendSheet, [legacyNormalized]), 0, 'same P-feed snapshot should not be re-appended under its normalized label');
assert.equal(legacyAppendRows.length, 0);

const repeatedSnapshot = {公司代號: '2330', 公司名稱: '台積電', 產業別: '半導體業', 資料年月: '11509', '營業收入-當月營收': '100', '營業收入-去年同月增減(%)': '20'};
const repeatedNormalized = h.normalizeMonthly_(repeatedSnapshot, 'https://example.test/monthly', 'Listed (TWSE)');
const repeatedSheetRow = ['Listed (TWSE)', '2330', '台積電', '半導體業', new Date(2026, 8, 1), 100, '', '', '', 20, '', '', '', 'TWD thousands', 'https://example.test/monthly', new Date(), JSON.stringify(repeatedSnapshot)];
let repeatedAppendRows = [];
const repeatedAppendSheet = {getLastRow: () => 5, getRange: () => ({getValues: () => [repeatedSheetRow], setValues: rows => {repeatedAppendRows = rows;}})};
assert.equal(h.appendMonthlyRevisions_(repeatedAppendSheet, [repeatedNormalized]), 0, 'same monthly source record must deduplicate when the stored report month is a Sheets Date');
assert.equal(repeatedAppendRows.length, 0);
let provenanceRows = [];
const provenanceSheet = {getLastRow: () => 4, getRange: () => ({setValues: rows => {provenanceRows = rows;}})};
const provenanceInputs = ['Listed (TWSE)', 'OTC (TPEx)', 'Emerging (MOPS)', 'Publicly issued (MOPS)'].map((market, i) => h.normalizeMonthly_({公司代號: '2330', 公司名稱: 'Example Co.', 資料年月: '11509', '營業收入-當月營收': 100 + i}, `https://example.test/${market}`, market));
assert.equal(h.appendMonthlyRevisions_(provenanceSheet, provenanceInputs), 4, 'retain each original feed record and its source market in the append-only table');
assert.deepEqual(Array.from(provenanceRows, row => row[0]), ['Listed (TWSE)', 'OTC (TPEx)', 'Emerging (MOPS)', 'Publicly issued (MOPS)']);

const allFailedContext = {
  UrlFetchApp: {fetch: () => ({getResponseCode: () => 503, getContentText: () => 'unavailable'})},
  Utilities: {parseCsv(body) { return body.split('\n').map(line => line.split(',')); }}
};
context.UrlFetchApp = allFailedContext.UrlFetchApp;
context.Utilities = allFailedContext.Utilities;
const allFailed = h.fetchMonthlyRows_();
assert.equal(allFailed.records.length, 0);
assert.deepEqual(Array.from(allFailed.sources, row => row.status), ['failed', 'failed', 'failed', 'failed']);

let loggedRow = null;
const logRange = {
  setValues: rows => { if (rows.length === 1 && rows[0][0] === 'Run time') loggedHeaders = rows[0]; return logRange; },
  setFontWeight: () => logRange,
  setBackground: () => logRange,
  setWrap: () => logRange
};
let loggedHeaders = null;
const logSheet = {getLastRow: () => 4, getRange: () => logRange, setFrozenRows: () => {}, appendRow: row => { loggedRow = row; }};
context.SpreadsheetApp = {openById: () => ({getSheetByName: () => logSheet})};
h.writeLog_('Partial success', '2026-09', 14, 10, 10, 'OTC source failed', 'Listed: success, 8 rows; OTC: failed, 0 rows; Publicly issued: success, 6 rows');
assert.equal(loggedRow.length, 8);
assert.match(loggedRow[7], /OTC: failed, 0 rows/);
assert.equal(loggedHeaders[7], 'Monthly feed status');

assert.equal(h.quarterPeriod_({年度: '115', 季別: '第2季'}), '2026-Q2');
assert.equal(h.quarterPeriod_({年度: '2025', 季別: '04'}), '2025-Q4');
assert.equal(h.quarterPeriod_({年度: '115'}), '');
assert.equal(h.quarterIndex_('2025-Q1') - h.quarterIndex_('2024-Q1'), 4);

assert.deepEqual({...h.finiteDifferencesAtEnd_([10, 12], 2)}, {d1: 2, d2: '', d3: ''});
assert.deepEqual({...h.finiteDifferencesAtEnd_([10, 12, 16], 3)}, {d1: 4, d2: 2, d3: ''});
assert.deepEqual({...h.finiteDifferencesAtEnd_([10, 12, 16, 22], 4)}, {d1: 6, d2: 2, d3: 0});

const margins = [20, 21, 22, 23, 21, 23, 26, 30];
const series = margins.map((gross, i) => ({key: h.quarterIndex_('2024-Q1') + i, gross, operating: gross / 2}));
const yoy = h.yoyMarginSeries_(series, 'gross');
assert.deepEqual(Array.from(yoy), ['', '', '', '', 1, 2, 4, 7]);
assert.deepEqual({...h.differencesForQuarterSeries_(series, yoy)}, {yoy: 7, d1: 3, d2: 1, d3: 0});
const shortSeries = series.slice(1);
const shortYoy = h.yoyMarginSeries_(shortSeries, 'gross');
assert.equal(h.differencesForQuarterSeries_(shortSeries, shortYoy).d3, '');

const monthRows = ['2026-06', '2026-07', '2026-08', '2026-09'].map((period, i) => {
  const row = Array(17).fill('');
  row[0] = 'Taiwan public issuers'; row[1] = '1234'; row[2] = 'Example Co.'; row[3] = 'General'; row[4] = period;
  row[5] = 100 + i; row[6] = 90 + i; row[7] = 80 + i; row[8] = 10; row[9] = [10, 12, 16, 22][i];
  row[10] = 1000 + i; row[11] = 900 + i; row[12] = 11.1; row[14] = 'https://example.test/monthly'; row[16] = '{}';
  return row;
});
let generated = [];
const monthlySheet = {getLastRow: () => 8, getRange: () => ({getValues: () => monthRows})};
const rawSheet = {getLastRow: () => 4};
const marginAuditRows = [];
const marginAuditSheet = {getLastRow: () => 4, getRange: () => ({getDisplayValues: () => [], setValues: rows => marginAuditRows.push(...rows)})};
const feedSheet = {getLastRow: () => 4, getRange: () => ({setValues: rows => {generated = rows}})};
const book = {getSheetByName: name => ({'Taiwan Monthly': monthlySheet, 'Raw Statements': rawSheet, SiteFeed: feedSheet, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(book);
assert.equal(generated.length, 1);
assert.equal(generated[0].length, 33);
assert.deepEqual(Array.from(generated[0].slice(8, 11)), [6, 2, 0]);
assert.deepEqual(Array.from(generated[0].slice(27, 33)), [93, 83, 10, 1003, 903, 11.1], 'the public feed should carry the reported monthly and YTD revenue comparison bases');
assert.match(generated[0][23], /Revenue Δ3 available/);
assert.equal(generated[0][1], 'TW|1234|exampleco');

// Sheets returns a real Date for date-formatted YYYY-MM cells. The actual
// Taiwan workbook stores month cells that way, so test the full feed path.
const dateBackfillRows = monthRows.map((row, i) => {
  const copy = row.slice();
  copy[4] = new Date(2026, 5 + i, 1);
  return copy;
});
let dateBackfillGenerated = [];
const dateBackfillSheet = {getLastRow: () => 4 + dateBackfillRows.length, getRange: () => ({getValues: () => dateBackfillRows})};
const dateBackfillFeed = {getLastRow: () => 4, getRange: () => ({setValues: rows => {dateBackfillGenerated = rows}})};
const dateBackfillBook = {getSheetByName: name => ({'Taiwan Monthly': dateBackfillSheet, 'Raw Statements': rawSheet, SiteFeed: dateBackfillFeed, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(dateBackfillBook);
assert.equal(dateBackfillGenerated[0][5], '2026-09', 'the public feed should use a stable YYYY-MM period');
assert.equal(dateBackfillGenerated[0][11], 4, 'date-formatted Sheet rows should produce four contiguous monthly observations');
assert.deepEqual(Array.from(dateBackfillGenerated[0].slice(8, 11)), [6, 2, 0]);

const multiMarketMonthlyRows = [];
for (const [market, yields, name] of [['Listed (TWSE)', [1, 2, 4, 7], 'Example Co.'], ['OTC (TPEx)', [10, 14, 19, 25], 'Other Issuer Ltd.'], ['Publicly issued (MOPS)', [20, 30, 40, 50], 'Example Co.']]) {
  yields.forEach((yoyValue, i) => {
    const row = Array(17).fill('');
    row[0] = market; row[1] = '1234'; row[2] = name; row[3] = 'General'; row[4] = ['2026-06', '2026-07', '2026-08', '2026-09'][i];
    row[5] = 100 + i; row[9] = yoyValue; row[14] = `https://example.test/${market}`; row[16] = '{}';
    multiMarketMonthlyRows.push(row);
  });
}
// An issuer found only in the public-issuer feed must remain visible.
const publicOnly = Array(17).fill('');
publicOnly[0] = 'Publicly issued (MOPS)'; publicOnly[1] = '9999'; publicOnly[2] = 'Unlisted Public Co.'; publicOnly[3] = 'General'; publicOnly[4] = '2026-09';
publicOnly[5] = 50; publicOnly[9] = 5; publicOnly[14] = 'https://example.test/public'; publicOnly[16] = '{}';
multiMarketMonthlyRows.push(publicOnly);
let multiMarketGenerated = [];
const multiMarketSheet = {getLastRow: () => 4 + multiMarketMonthlyRows.length, getRange: () => ({getValues: () => multiMarketMonthlyRows})};
const multiMarketFeed = {getLastRow: () => 4, getRange: () => ({setValues: rows => {multiMarketGenerated = rows}})};
const multiMarketBook = {getSheetByName: name => ({'Taiwan Monthly': multiMarketSheet, 'Raw Statements': rawSheet, SiteFeed: multiMarketFeed, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(multiMarketBook);
assert.equal(multiMarketGenerated.length, 3, 'same-name overlaps merge, while a conflicting issuer name stays separate');
const canonicalListed = multiMarketGenerated.find(row => row[2] === '1234' && row[0] === 'Listed (TWSE)');
assert.equal(canonicalListed[0], 'Listed (TWSE)', 'prefer the exchange-specific feed over the broad MOPS public-issuer feed');
assert.equal(canonicalListed[8], 3, 'same-name overlaps form one continuous revenue history');
assert.equal(canonicalListed[7], 7, 'the canonical revenue-growth observation must come from the preferred source');
assert.match(canonicalListed[23], /different names/);
const separateIssuer = multiMarketGenerated.find(row => row[2] === '1234' && row[0] === 'OTC (TPEx)');
assert.equal(separateIssuer[8], 6, 'different names sharing a code must not be merged');
assert.equal(multiMarketGenerated.find(row => row[2] === '9999')[0], 'Publicly issued (MOPS)', 'retain a public-only company when no exchange-specific row exists');

const cumulativeInputs = [
  [2024, 1, 100, 40, 10], [2024, 2, 230, 91, 24], [2024, 3, 390, 150, 42], [2024, 4, 580, 232, 64],
  [2025, 1, 120, 48, 14], [2025, 2, 280, 114, 34], [2025, 3, 480, 205, 62], [2025, 4, 760, 349, 112]
];
const statementRows = cumulativeInputs.map(([year, q, revenue, gross, operating], i) => {
  const record = {年度: String(year - 1911), 季別: `第${q}季`, 公司代號: '2330', 公司名稱: 'Example Semiconductor', 營業收入: revenue, '營業毛利（毛損）淨額': gross, '營業利益（損失）': operating, 出表日期: `${year}${String(q * 3).padStart(2, '0')}15`};
  return ['Taiwan public issuers', 'Quarterly income statement', 't187ap06_X_ci', '2330', 'Example Semiconductor', `${year}-Q${q}`, new Date(Date.UTC(year, q * 3, 1 + i)), JSON.stringify(record), 'https://openapi.twse.com.tw/v1/opendata/t187ap06_X_ci', `sig-${year}-Q${q}`];
});
const statementSheet = {getLastRow: () => 4 + statementRows.length, getRange: () => ({getValues: () => statementRows})};
const marginBook = {getSheetByName: name => name === 'Raw Statements' ? statementSheet : name === 'Margin Signals' ? marginAuditSheet : null};
const derivedMargins = h.marginSignalsMap_(marginBook).get('2330');
assert.ok(Math.abs(derivedMargins.gross - (144 / 280 * 100)) < 1e-9, 'Q4 gross margin must subtract Q3 YTD from annual YTD');
assert.ok(Math.abs(derivedMargins.operating - (50 / 280 * 100)) < 1e-9, 'Q4 operating margin must subtract Q3 YTD from annual YTD');
assert.ok(Math.abs(derivedMargins.grossYoY - ((144 / 280 * 100) - (82 / 190 * 100))) < 1e-9);
assert.notEqual(derivedMargins.grossD3, '', 'eight contiguous standalone quarters should support a third difference in same-quarter YoY margin changes');
assert.equal(marginAuditRows.length, 8);
const q2Key = h.quarterIndex_('2025-Q2');
const dependencyMap = new Map([[q2Key, {signature:'current-q2'}], [q2Key - 1, {signature:'current-q1'}], [q2Key - 4, {signature:'prior-q2'}], [q2Key - 5, {signature:'prior-q1'}]]);
assert.equal(h.marginDependencySignatures_(dependencyMap, {q:'2025-Q2', key:q2Key}), `${q2Key}:current-q2|${q2Key-1}:current-q1|${q2Key-4}:prior-q2|${q2Key-5}:prior-q1`, 'margin calculation signature includes the same-quarter prior-year inputs and both YTD subtraction inputs');
assert.equal(marginAuditRows[1][17], 130, 'Q2 standalone revenue must be Q2 YTD less Q1 YTD');
assert.equal(marginAuditRows[3][17], 190, 'Q4 standalone revenue must be annual YTD less Q3 YTD');
assert.match(marginAuditRows[3][24], /cumulative YTD/i);

const differentlyNamedMonthlyRows = [Array(17).fill('')];
differentlyNamedMonthlyRows[0][0] = 'Listed (TWSE)';
differentlyNamedMonthlyRows[0][1] = '2330';
differentlyNamedMonthlyRows[0][2] = 'TSMC';
differentlyNamedMonthlyRows[0][3] = 'Semiconductors';
differentlyNamedMonthlyRows[0][4] = '2026-09';
differentlyNamedMonthlyRows[0][5] = 100;
differentlyNamedMonthlyRows[0][9] = 10;
differentlyNamedMonthlyRows[0][14] = 'https://example.test/monthly';
let matchedNameVariantOutput = [];
const differentlyNamedMonthlySheet = {getLastRow: () => 5, getRange: () => ({getValues: () => differentlyNamedMonthlyRows})};
const matchedNameVariantFeed = {getLastRow: () => 4, getRange: () => ({setValues: rows => {matchedNameVariantOutput = rows}})};
const nameVariantBook = {getSheetByName: name => ({'Taiwan Monthly': differentlyNamedMonthlySheet, 'Raw Statements': statementSheet, SiteFeed: matchedNameVariantFeed, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(nameVariantBook);
assert.ok(Math.abs(matchedNameVariantOutput[0][12] - derivedMargins.gross) < 1e-9, 'a unique issuer code must connect quarterly margins when monthly and quarterly provider names differ');
assert.ok(!/name did not match/.test(matchedNameVariantOutput[0][23]), 'a unique-code match should not be labeled as an unresolved name mismatch');

const missingPriorRows = statementRows.filter(row => row[5] !== '2024-Q1');
const missingPriorSheet = {getLastRow: () => 4 + missingPriorRows.length, getRange: () => ({getValues: () => missingPriorRows})};
const missingAuditRows = [];
const missingAuditSheet = {getLastRow: () => 4, getRange: () => ({getDisplayValues: () => [], setValues: rows => missingAuditRows.push(...rows)})};
const missingPriorBook = {getSheetByName: name => name === 'Raw Statements' ? missingPriorSheet : name === 'Margin Signals' ? missingAuditSheet : null};
const missingQ1 = h.marginSignalsMap_(missingPriorBook).get('2330');
assert.equal(missingQ1.grossD3, '', 'discontinuous history must not produce third differences');
const missingQ2 = missingAuditRows.find(row => row[3] === '2024-Q2');
assert.equal(missingQ2[17], '', 'Q2 cannot be derived when Q1 cumulative revenue is missing');
assert.match(missingQ2[24], /prior cumulative quarter is missing/);

console.log('Taiwan signal math checks passed: ROC quarter normalization, finite differences, quarter matching, feed shape, and status generation.');
