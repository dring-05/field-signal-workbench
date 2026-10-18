import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = await readFile(new URL('../automation/taiwan-sheets-importer.gs', import.meta.url), 'utf8');
const context = {};
vm.runInNewContext(`${source}\nglobalThis.helpers = {signals: SIGNALS, feedHeaders: FEED_HEADERS, quarterlyStatementMarkets: QUARTERLY_STATEMENT_MARKETS, quarterlyStatementIndustries: QUARTERLY_STATEMENT_INDUSTRIES, statementSourceUrl_, quarterlyStatementMarket_, quarterlyMarginIdentity_, appendRawStatementRevisions_, marginDependencySignatures_, issuerIdentityKey_, monthlyMarketPriority_, quarterPeriod_, quarterIndex_, finiteDifferencesAtEnd_, contiguousMonthlyObservations_, monthlyYoYBaseIsTiny_, revenueDenominatorQuality_, revenueGrowthOutlierStatus_, yoyMarginSeries_, differencesForQuarterSeries_, marginSignalsMap_, rebuildSiteFeed_, appendMarginAudit_, appendMonthlyRevisions_, fetchMonthlyRows_, normalizeMonthly_, normalizeMonthlyMarket_, normalizeMonthlyPeriod_, monthDistance_, mopsHistoryDataKey_, taiwanMopsBackfillMonths_, writeLog_};`, context, {timeout: 1000});
const h = context.helpers;
context.Utilities = {formatDate: () => '2026-10'};
let activeSpreadsheet = {getId: () => 'personal-workbook'};
let lockedWorkbookId = 'personal-workbook';
const guardContext = {
  SpreadsheetApp: {getActiveSpreadsheet: () => activeSpreadsheet},
  PropertiesService: {getScriptProperties: () => ({getProperty: () => lockedWorkbookId})}
};
vm.runInNewContext(`${source}\nglobalThis.getGuardedWorkbook = signalsWorkbook_;`, guardContext, {timeout: 1000});
assert.equal(guardContext.getGuardedWorkbook(), activeSpreadsheet, 'scheduled writes resolve only the workbook recorded during setup');
activeSpreadsheet = {getId: () => 'another-workbook'};
assert.throws(() => guardContext.getGuardedWorkbook(), /locked to a different Taiwan workbook/, 'refuse accidental writes to another open spreadsheet');
activeSpreadsheet = null;
assert.throws(() => guardContext.getGuardedWorkbook(), /Bind this script to your private Taiwan Monthly Signals workbook/, 'refuse to run without its bound workbook');
activeSpreadsheet = {getId: () => 'personal-workbook'};
assert.deepEqual(Array.from(h.taiwanMopsBackfillMonths_(16)), ['2025-06','2025-07','2025-08','2025-09','2025-10','2025-11','2025-12','2026-01','2026-02','2026-03','2026-04','2026-05','2026-06','2026-07','2026-08','2026-09'], 'bootstrap should include the sixteen latest completed months needed for YoY third differences');
assert.equal(h.feedHeaders[1], 'Issuer series key');
assert.equal(h.issuerIdentityKey_('2330', '台積電股份有限公司'), h.issuerIdentityKey_('2330', '台積電 股份有限公司'), 'identity matching should normalize spacing without dropping issuer-name evidence');

assert.deepEqual(Array.from(h.signals.monthlySources, source => [source.market, source.endpoint, source.csvUrl]), [
  ['Listed (TWSE)', 't187ap05_L', 'https://mopsfin.twse.com.tw/opendata/t187ap05_L.csv'],
  ['OTC (TPEx)', 't187ap05_O', 'https://mopsfin.twse.com.tw/opendata/t187ap05_O.csv'],
  ['Emerging (MOPS)', 't187ap05_R', 'https://mopsfin.twse.com.tw/opendata/t187ap05_R.csv'],
  ['Publicly issued (MOPS)', 't187ap05_P', 'https://mopsfin.twse.com.tw/opendata/t187ap05_P.csv']
]);
assert.deepEqual(Array.from(h.quarterlyStatementMarkets, market => [market.market, market.code, market.source]), [
  ['Listed (TWSE)', 'L', 'openapi'], ['OTC (TPEx)', 'O', 'mopsfin'],
  ['Emerging (MOPS)', 'U', 'mopsfin'], ['Publicly issued (MOPS)', 'X', 'mopsfin']
]);
assert.deepEqual(Array.from(h.quarterlyStatementIndustries), ['basi', 'bd', 'ci', 'fh', 'ins', 'mim']);
assert.equal(h.statementSourceUrl_({endpoint:'t187ap06_L_ci', source:'openapi'}), 'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci');
assert.equal(h.statementSourceUrl_({endpoint:'t187ap06_O_ci', source:'mopsfin'}), 'https://mopsfin.twse.com.tw/opendata/t187ap06_O_ci.csv');
assert.equal(h.statementSourceUrl_({endpoint:'t187ap06_U_ci', source:'mopsfin'}), 'https://mopsfin.twse.com.tw/opendata/t187ap06_U_ci.csv');
assert.equal(h.statementSourceUrl_({endpoint:'t187ap06_X_ci', source:'mopsfin'}), 'https://mopsfin.twse.com.tw/opendata/t187ap06_X_ci.csv');
assert.equal(h.quarterlyStatementMarket_('t187ap06_U_ci', 'Taiwan public issuers'), 'Emerging (MOPS)', 'quarterly U is emerging even though monthly emerging uses R');
assert.equal(h.quarterlyStatementMarket_('t187ap06_X_ci', 'Taiwan public issuers'), 'Publicly issued (MOPS)');
assert.throws(() => h.statementSourceUrl_({endpoint:'t187ap06_Z_ci', source:'mopsfin'}), /Unsupported MOPS quarterly statement endpoint/);
const statementFetches = [];
let importedRawRows = [];
context.UrlFetchApp = {fetch(url) {
  statementFetches.push(url);
  const body = url.includes('openapi.twse.com.tw')
    ? '[{"年度":"115","季別":"第2季","公司代號":"2330","公司名稱":"測試公司"}]'
    : '年度,季別,公司代號,公司名稱\n115,第2季,2330,測試公司';
  return {getResponseCode: () => 200, getContentText: () => body};
}};
context.Utilities = {parseCsv: body => body.split('\n').map(line => line.split(','))};
const rawImportSheet = {getLastRow: () => 4, getRange: () => ({setValues: rows => {importedRawRows = rows;}})};
h.appendRawStatementRevisions_({getSheetByName: () => rawImportSheet}, []);
assert.ok(statementFetches.includes('https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci'));
assert.ok(statementFetches.includes('https://mopsfin.twse.com.tw/opendata/t187ap06_O_ci.csv'));
assert.ok(statementFetches.includes('https://mopsfin.twse.com.tw/opendata/t187ap06_U_ci.csv'));
assert.ok(statementFetches.includes('https://mopsfin.twse.com.tw/opendata/t187ap06_X_ci.csv'));
assert.deepEqual(Array.from(importedRawRows.filter(row => row[2].startsWith('t187ap06_') && row[2].endsWith('_ci')), row => [row[0], row[2]]), [
  ['Listed (TWSE)', 't187ap06_L_ci'], ['OTC (TPEx)', 't187ap06_O_ci'],
  ['Emerging (MOPS)', 't187ap06_U_ci'], ['Publicly issued (MOPS)', 't187ap06_X_ci']
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
context.SpreadsheetApp = {getActiveSpreadsheet: () => ({getSheetByName: () => logSheet})};
context.PropertiesService = {getScriptProperties: () => ({getProperty: () => null})};
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
assert.equal(h.monthlyYoYBaseIsTiny_(1815362, 53), true, 'a 53k TWD comparison base is materially small relative to 1.8bn TWD current revenue');
assert.equal(h.monthlyYoYBaseIsTiny_(1000, 5), true, 'a base below 1% of current revenue is excluded from trend derivatives');
assert.equal(h.monthlyYoYBaseIsTiny_(1000, 10), false, 'a base at exactly 1% of revenue remains eligible for trend derivatives');
assert.equal(h.monthlyYoYBaseIsTiny_(1000, 0), true, 'a zero comparison base cannot support meaningful growth derivatives');
assert.equal(h.monthlyYoYBaseIsTiny_(1000, ''), true, 'a missing comparison base cannot support derivatives');
assert.equal(h.revenueDenominatorQuality_(1000, 5).status, 'Low base below 1% of current revenue');
assert.equal(h.revenueDenominatorQuality_(1000, 10).status, 'Usable');
assert.match(h.revenueGrowthOutlierStatus_(500), /at least 500%/);
assert.equal(h.revenueGrowthOutlierStatus_(499), 'None');
const tinyBaseSource = {'公司代號':'4113', '公司名稱':'聯上', '產業別':'建材營造', '資料年月':'11509', '營業收入-當月營收':'1,815,362', '營業收入-去年當月營收':'53', '營業收入-去年同月增減(%)':'3,425,111.32'};
const normalizedTinyBase = h.normalizeMonthly_(tinyBaseSource, 'https://example.test/mops', 'OTC (TPEx)');
assert.equal(normalizedTinyBase.yoy, 3425111.32, 'the unusual source YoY value remains visible without being capped or rewritten');
assert.equal(normalizedTinyBase.current, 1815362);
assert.equal(normalizedTinyBase.yearAgo, 53);
assert.equal(h.contiguousMonthlyObservations_(['2026-06', '2026-07', '2026-08', '2026-09'], [10, 12, '', 22], 3), 1, 'a month with missing YoY growth must break the usable observation run');
assert.equal(h.contiguousMonthlyObservations_(['2026-06', '2026-07', '2026-09', '2026-10'], [10, 12, 16, 22], 3), 2, 'a missing calendar month must break the usable observation run');

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
let generatedHeaders = [];
const monthlySheet = {getLastRow: () => 8, getRange: () => ({getValues: () => monthRows})};
const rawSheet = {getLastRow: () => 4};
const marginAuditRows = [];
const marginAuditSheet = {getLastRow: () => 4, getRange: () => ({getDisplayValues: () => [], setValues: rows => marginAuditRows.push(...rows)})};
const feedSheet = {getLastRow: () => 4, getRange: (row) => ({setValues: rows => {if (row === 4) generatedHeaders = rows[0]; else generated = rows}})};
const book = {getSheetByName: name => ({'Taiwan Monthly': monthlySheet, 'Raw Statements': rawSheet, SiteFeed: feedSheet, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(book);
assert.deepEqual(Array.from(generatedHeaders), Array.from(h.feedHeaders), 'every feed rebuild must write the complete quality and freshness schema');
assert.equal(generated.length, 1);
assert.equal(generated[0].length, 38);
assert.deepEqual(Array.from(generated[0].slice(8, 11)), [6, 2, 0]);
assert.deepEqual(Array.from(generated[0].slice(27, 33)), [93, 83, 10, 1003, 903, 11.1], 'the public feed should carry the reported monthly and YTD revenue comparison bases');
assert.match(generated[0][23], /Revenue Δ1\/Δ2\/Δ3 available/);
assert.equal(generated[0][1], 'TW|1234|exampleco');
assert.equal(generated[0][34], 'Usable');
assert.equal(generated[0][35], 'None');
assert.equal(generated[0][36], '2026-09');
assert.match(generated[0][37], /^Current/);

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

const missingYoyRows = dateBackfillRows.map(row => row.slice());
missingYoyRows[2][9] = '';
let missingYoyGenerated = [];
const missingYoySheet = {getLastRow: () => 4 + missingYoyRows.length, getRange: () => ({getValues: () => missingYoyRows})};
const missingYoyFeed = {getLastRow: () => 4, getRange: () => ({setValues: rows => {missingYoyGenerated = rows}})};
const missingYoyBook = {getSheetByName: name => ({'Taiwan Monthly': missingYoySheet, 'Raw Statements': rawSheet, SiteFeed: missingYoyFeed, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(missingYoyBook);
assert.equal(missingYoyGenerated[0][11], 1, 'the feed should report only consecutive months with a usable YoY observation');
assert.deepEqual(Array.from(missingYoyGenerated[0].slice(8, 11)), ['', '', ''], 'a missing YoY observation must prevent derivatives from bridging across the gap');
assert.match(missingYoyGenerated[0][23], /Revenue trend history: 1\/4/);

const tinyBaseRows = dateBackfillRows.map(row => row.slice());
tinyBaseRows[3][1] = '4113'; tinyBaseRows[3][2] = '聯上'; tinyBaseRows[3][3] = '建材營造';
tinyBaseRows[3][5] = 1815362; tinyBaseRows[3][7] = 53; tinyBaseRows[3][9] = 3425111.32;
let tinyBaseGenerated = [];
const tinyBaseSheet = {getLastRow: () => 4 + tinyBaseRows.length, getRange: () => ({getValues: () => tinyBaseRows})};
const tinyBaseFeed = {getLastRow: () => 4, getRange: () => ({setValues: rows => {tinyBaseGenerated = rows}})};
const tinyBaseBook = {getSheetByName: name => ({'Taiwan Monthly': tinyBaseSheet, 'Raw Statements': rawSheet, SiteFeed: tinyBaseFeed, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(tinyBaseBook);
assert.equal(tinyBaseGenerated[0][7], 3425111.32, 'preserve the exact reported percentage in SiteFeed');
assert.deepEqual(Array.from(tinyBaseGenerated[0].slice(8, 11)), ['', '', ''], 'suppress derivatives built from a near-zero comparison base');
assert.match(tinyBaseGenerated[0][23], /below 1%/);
assert.equal(tinyBaseGenerated[0][34], 'Low base below 1% of current revenue');
assert.match(tinyBaseGenerated[0][35], /at least 500%/);

const subOnePercentRows = dateBackfillRows.map((row, i) => {
  const copy = row.slice();
  copy[1] = '5678'; copy[2] = 'Low Base Co.'; copy[5] = i === 3 ? 1000 : 100 + i;
  copy[7] = i === 3 ? 5 : 50; copy[9] = i === 3 ? 19900 : [10, 12, 16, 22][i];
  return copy;
});
let subOnePercentGenerated = [];
const subOnePercentSheet = {getLastRow: () => 4 + subOnePercentRows.length, getRange: () => ({getValues: () => subOnePercentRows})};
const subOnePercentFeed = {getLastRow: () => 4, getRange: () => ({setValues: rows => {subOnePercentGenerated = rows;}})};
const subOnePercentBook = {getSheetByName: name => ({'Taiwan Monthly': subOnePercentSheet, 'Raw Statements': rawSheet, SiteFeed: subOnePercentFeed, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(subOnePercentBook);
assert.equal(subOnePercentGenerated[0][7], 19900, 'preserve a reported extreme growth rate for review');
assert.deepEqual(Array.from(subOnePercentGenerated[0].slice(8, 11)), ['', '', ''], 'a base below 1% suppresses derivatives even when it is above the former 0.1% cutoff');
assert.equal(subOnePercentGenerated[0][34], 'Low base below 1% of current revenue');

const multiMarketMonthlyRows = [];
for (const [market, yields, name] of [['Listed (TWSE)', [1, 2, 4, 7], 'Example Co.'], ['OTC (TPEx)', [10, 14, 19, 25], 'Other Issuer Ltd.'], ['Publicly issued (MOPS)', [20, 30, 40, 50], 'Example Co.']]) {
  yields.forEach((yoyValue, i) => {
    const row = Array(17).fill('');
    row[0] = market; row[1] = '1234'; row[2] = name; row[3] = 'General'; row[4] = ['2026-06', '2026-07', '2026-08', '2026-09'][i];
    row[5] = 100 + i; row[7] = 50; row[9] = yoyValue; row[14] = `https://example.test/${market}`; row[16] = '{}';
    multiMarketMonthlyRows.push(row);
  });
}
// An issuer found only in the public-issuer feed must remain visible.
const publicOnly = Array(17).fill('');
publicOnly[0] = 'Publicly issued (MOPS)'; publicOnly[1] = '9999'; publicOnly[2] = 'Unlisted Public Co.'; publicOnly[3] = 'General'; publicOnly[4] = '2026-09';
publicOnly[5] = 50; publicOnly[7] = 25; publicOnly[9] = 5; publicOnly[14] = 'https://example.test/public'; publicOnly[16] = '{}';
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

const stalePartitionRows = multiMarketMonthlyRows.map(row => row.slice()).filter(row => row[0] !== 'OTC (TPEx)' || row[4] !== '2026-09');
let stalePartitionGenerated = [];
const stalePartitionSheet = {getLastRow: () => 4 + stalePartitionRows.length, getRange: () => ({getValues: () => stalePartitionRows})};
const stalePartitionFeed = {getLastRow: () => 4, getRange: (row, col) => ({setValues: values => {if (row === 5 && col === 1) stalePartitionGenerated = values;}})};
const stalePartitionBook = {getSheetByName: name => ({'Taiwan Monthly': stalePartitionSheet, 'Raw Statements': rawSheet, SiteFeed: stalePartitionFeed, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(stalePartitionBook);
const staleOtc = stalePartitionGenerated.find(row => row[0] === 'OTC (TPEx)');
assert.equal(staleOtc[36], '2026-08');
assert.match(staleOtc[37], /Stale partition.*2026-08.*2026-09/);

let failedRefreshGenerated = [];
const failedRefreshFeed = {getLastRow: () => 4, getRange: (row, col) => ({setValues: values => {if (row === 5 && col === 1) failedRefreshGenerated = values;}})};
const failedRefreshBook = {getSheetByName: name => ({'Taiwan Monthly': dateBackfillSheet, 'Raw Statements': rawSheet, SiteFeed: failedRefreshFeed, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(failedRefreshBook, [{market: 'Publicly issued (MOPS)', status: 'failed'}]);
assert.match(failedRefreshGenerated[0][37], /^Source refresh failed/);

const cumulativeInputs = [
  [2024, 1, 100, 40, 10], [2024, 2, 230, 91, 24], [2024, 3, 390, 150, 42], [2024, 4, 580, 232, 64],
  [2025, 1, 120, 48, 14], [2025, 2, 280, 114, 34], [2025, 3, 480, 205, 62], [2025, 4, 760, 349, 112]
];
const statementRows = cumulativeInputs.map(([year, q, revenue, gross, operating], i) => {
  const record = {年度: String(year - 1911), 季別: `第${q}季`, 公司代號: '2330', 公司名稱: 'Example Semiconductor', 營業收入: revenue, '營業毛利（毛損）淨額': gross, '營業利益（損失）': operating, 出表日期: `${year}${String(q * 3).padStart(2, '0')}15`};
  return ['Listed (TWSE)', 'Quarterly income statement', 't187ap06_L_ci', '2330', 'Example Semiconductor', `${year}-Q${q}`, new Date(Date.UTC(year, q * 3, 1 + i)), JSON.stringify(record), 'https://openapi.twse.com.tw/v1/opendata/t187ap06_L_ci', `sig-${year}-Q${q}`];
});
const statementSheet = {getLastRow: () => 4 + statementRows.length, getRange: () => ({getValues: () => statementRows})};
const marginBook = {getSheetByName: name => name === 'Raw Statements' ? statementSheet : name === 'Margin Signals' ? marginAuditSheet : null};
const listedMarginMap = h.marginSignalsMap_(marginBook);
const derivedMargins = listedMarginMap.get('Listed (TWSE)|2330');
assert.ok(derivedMargins, 'a quarterly L-family general-industry series should be addressable by its market and issuer code');
assert.ok(Math.abs(derivedMargins.gross - (144 / 280 * 100)) < 1e-9, 'Q4 gross margin must subtract Q3 YTD from annual YTD');
assert.ok(Math.abs(derivedMargins.operating - (50 / 280 * 100)) < 1e-9, 'Q4 operating margin must subtract Q3 YTD from annual YTD');
assert.ok(Math.abs(derivedMargins.grossYoY - ((144 / 280 * 100) - (82 / 190 * 100))) < 1e-9);
assert.notEqual(derivedMargins.grossD3, '', 'eight contiguous standalone quarters should support a third difference in same-quarter YoY margin changes');
assert.equal(marginAuditRows.length, 8);
let expandedRowsAfter = 0;
let capacityWriteRows = [];
const largeAudit = {
  getLastRow: () => 1000,
  getMaxRows: () => 1000,
  getMaxColumns: () => 26,
  insertRowsAfter: (after, count) => { assert.equal(after, 1000); expandedRowsAfter = count; },
  getRange: (row, col, count) => ({getDisplayValues: () => [], setValues: values => { capacityWriteRows = values; assert.equal(row, 1001); assert.equal(col, 1); assert.equal(count, values.length); }}),
};
h.appendMarginAudit_({getSheetByName: () => largeAudit}, Array.from({length: 1200}, (_, index) => { const row = Array(26).fill(''); row[9] = `large-${index}`; return row; }));
assert.equal(expandedRowsAfter, 1200, 'margin audit expands before appending beyond the default 1,000 rows');
assert.equal(capacityWriteRows.length, 1200);
const q2Key = h.quarterIndex_('2025-Q2');
const dependencyMap = new Map([[q2Key, {signature:'current-q2'}], [q2Key - 1, {signature:'current-q1'}], [q2Key - 4, {signature:'prior-q2'}], [q2Key - 5, {signature:'prior-q1'}]]);
assert.equal(h.marginDependencySignatures_(dependencyMap, {q:'2025-Q2', key:q2Key}), `${q2Key}:current-q2|${q2Key-1}:current-q1|${q2Key-4}:prior-q2|${q2Key-5}:prior-q1`, 'margin calculation signature includes the same-quarter prior-year inputs and both YTD subtraction inputs');
assert.equal(marginAuditRows[1][17], 130, 'Q2 standalone revenue must be Q2 YTD less Q1 YTD');
assert.equal(marginAuditRows[3][17], 190, 'Q4 standalone revenue must be annual YTD less Q3 YTD');
assert.match(marginAuditRows[3][24], /cumulative YTD/i);
assert.ok(marginAuditRows.every(row => row[0] === 'Listed (TWSE)' && row[4] === 't187ap06_L_ci'), 'margin audit rows retain explicit listed-market metadata and source endpoint');

const marketStatementRows = [];
for (const [market, endpoint, revenueScale, grossScale] of [
  ['Listed (TWSE)', 't187ap06_L_ci', 1, 1],
  ['OTC (TPEx)', 't187ap06_O_ci', 2, 1.5],
  ['Emerging (MOPS)', 't187ap06_U_ci', 3, 2],
  ['Publicly issued (MOPS)', 't187ap06_X_ci', 4, 2.5]
]) {
  statementRows.forEach((row, index) => {
    const copy = row.slice();
    const record = JSON.parse(copy[7]);
    record.營業收入 *= revenueScale;
    record['營業毛利（毛損）淨額'] *= grossScale;
    record['營業利益（損失）'] *= grossScale;
    copy[0] = market; copy[2] = endpoint; copy[7] = JSON.stringify(record);
    copy[8] = endpoint.startsWith('t187ap06_L_') ? `https://openapi.twse.com.tw/v1/opendata/${endpoint}` : `https://mopsfin.twse.com.tw/opendata/${endpoint}.csv`;
    copy[9] = `${market}-${index}`;
    marketStatementRows.push(copy);
  });
}
const marketAuditRows = [];
const marketStatementSheet = {getLastRow: () => 4 + marketStatementRows.length, getRange: () => ({getValues: () => marketStatementRows})};
const marketAuditSheet = {getLastRow: () => 4, getRange: () => ({getDisplayValues: () => [], setValues: rows => marketAuditRows.push(...rows)})};
const marketMarginBook = {getSheetByName: name => name === 'Raw Statements' ? marketStatementSheet : name === 'Margin Signals' ? marketAuditSheet : null};
const allMarketMargins = h.marginSignalsMap_(marketMarginBook);
for (const [market, expectedGross] of [
  ['Listed (TWSE)', derivedMargins.gross],
  ['OTC (TPEx)', (144 * 1.5) / (280 * 2) * 100],
  ['Emerging (MOPS)', (144 * 2) / (280 * 3) * 100],
  ['Publicly issued (MOPS)', (144 * 2.5) / (280 * 4) * 100]
]) {
  const signal = allMarketMargins.get(`${market}|2330`);
  assert.ok(signal, `${market} margin series should be represented`);
  assert.ok(Math.abs(signal.gross - expectedGross) < 1e-9, `${market} should use its own source rows`);
}
assert.equal(marketAuditRows.length, 32, 'audit history remains separate by market and quarter');
assert.equal(new Set(marketAuditRows.map(row => row[9])).size, marketAuditRows.length, 'margin audit calculation signatures are unique across issuer, market, and quarter');
assert.ok(marketAuditRows.every(row => row[9].startsWith(`MARGIN_YTD_DIFF_V3|${row[0]}|`)), 'margin audit signatures include market metadata to prevent cross-market deduplication');
const otcOnlySheet = {getLastRow: () => 4 + statementRows.length, getRange: () => ({getValues: () => statementRows.map(row => {const copy=row.slice();copy[0]='OTC (TPEx)';copy[2]='t187ap06_O_ci';return copy;})})};
const otcOnlyBook = {getSheetByName: name => name === 'Raw Statements' ? otcOnlySheet : name === 'Margin Signals' ? {getLastRow: () => 4, getRange: () => ({getDisplayValues: () => [], setValues: () => {}})} : null};
const otcOnlyMap = h.marginSignalsMap_(otcOnlyBook);
assert.ok(otcOnlyMap.get('OTC (TPEx)|2330'));
assert.equal(otcOnlyMap.has('Listed (TWSE)|2330'), false, 'a quarterly identity must not leak across market partitions');
let crossMarketFeedRows = [];
const crossMarketFeed = {getLastRow: () => 4, getRange: (row, col) => ({setValues: values => {if (row === 5 && col === 1) crossMarketFeedRows = values;}})};
const crossMonthlyRows = [Array(17).fill('')];
crossMonthlyRows[0][0] = 'Listed (TWSE)'; crossMonthlyRows[0][1] = '2330'; crossMonthlyRows[0][2] = 'Example Semiconductor';
crossMonthlyRows[0][3] = 'Semiconductors'; crossMonthlyRows[0][4] = '2026-09'; crossMonthlyRows[0][5] = 100; crossMonthlyRows[0][9] = 20;
const crossMonthlySheet = {getLastRow: () => 5, getRange: () => ({getValues: () => crossMonthlyRows})};
const crossMarketBook = {getSheetByName: name => ({'Taiwan Monthly': crossMonthlySheet, 'Raw Statements': otcOnlySheet, SiteFeed: crossMarketFeed, 'Margin Signals': {getLastRow: () => 4, getRange: () => ({getDisplayValues: () => [], setValues: () => {}})}}[name])};
h.rebuildSiteFeed_(crossMarketBook);
assert.equal(crossMarketFeedRows[0][12], '', 'a Listed monthly issuer must not inherit an OTC margin series with the same company code');
assert.match(crossMarketFeedRows[0][23], /no matched general-industry statements/);

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
const missingQ1 = h.marginSignalsMap_(missingPriorBook).get('Listed (TWSE)|2330');
assert.equal(missingQ1.grossD3, '', 'discontinuous history must not produce third differences');
const missingQ2 = missingAuditRows.find(row => row[3] === '2024-Q2');
assert.equal(missingQ2[17], '', 'Q2 cannot be derived when Q1 cumulative revenue is missing');
assert.match(missingQ2[24], /prior cumulative quarter is missing/);

console.log('Taiwan signal math checks passed: ROC quarter normalization, finite differences, quarter matching, feed shape, and status generation.');
