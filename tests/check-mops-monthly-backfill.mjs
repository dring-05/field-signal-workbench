import assert from 'node:assert/strict';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import {ATTRIBUTION, backfillOptionsFromCli, parseMonthlyReport, reportUrl, runBackfill} from '../automation/mops-monthly-backfill.mjs';

const sheetsImporter = await readFile(new URL('../automation/taiwan-sheets-importer.gs', import.meta.url), 'utf8');
assert.match(sheetsImporter, /getProjectTriggers\(\)\.filter\(t => t\.getHandlerFunction\(\) === 'refreshRecentTaiwanMopsArchive'\)[\s\S]*?if \(!archiveTriggers\.length\) ScriptApp\.newTrigger\('refreshRecentTaiwanMopsArchive'\)\.timeBased\(\)\.everyDays\(1\)\.atHour\(10\)\.inTimezone\('Asia\/Taipei'\)\.create\(\)/, 'setup adds one idempotent daily archive trigger at the Taiwan-local 10:00 hour');
const archiveUrls = [];
const archiveSleeps = [];
let archiveFailureUrl = '';
let workbookOpened = false;
let importedReports = null;
let mockMonthlyRows = [];
let appendedMonthlyRows = [];
const formatTaipeiMonth = (date, timezone, format) => {
  assert.equal(timezone, 'Asia/Taipei');
  assert.equal(format, 'yyyy-MM');
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {timeZone: timezone, year: 'numeric', month: '2-digit'}).formatToParts(date).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}`;
};
const appsScriptTestContext = {
  Utilities: {formatDate: formatTaipeiMonth, sleep: ms => archiveSleeps.push(ms)},
  UrlFetchApp: {fetch: url => {
    archiveUrls.push(url);
    return {getResponseCode: () => url === archiveFailureUrl ? 503 : 200, getContentText: () => '<fixture>'};
  }},
  SpreadsheetApp: {openById: () => {
    workbookOpened = true;
    return {getSheetByName: () => ({
      getLastRow: () => 4 + mockMonthlyRows.length,
      getRange: (start, column, rowCount) => ({
        getValues: () => mockMonthlyRows.slice(start - 5, start - 5 + rowCount),
        setValues: rows => { appendedMonthlyRows.push(...rows); mockMonthlyRows.push(...rows); }
      })
    })};
  }},
  refreshedNames: 0,
};
vm.runInNewContext(`${sheetsImporter}
parseTaiwanMopsArchive_ = function (html, month, group) {
  return {records: Array.from({length: 20}, (_, i) => ({code: String(i + 1), month, market: group.market}))};
};
globalThis.nativeImportTaiwanMopsReports = importTaiwanMopsReports_;
rebuildSiteFeed_ = function () {};
refreshTaiwanCompanyNames = function () { globalThis.refreshedNames += 1; };
writeLog_ = function () {};
importTaiwanMopsReports_ = function (reports) { globalThis.importedReports = reports; return {result: 'imported', reports: reports.length}; };
globalThis.testMopsSchedule = {months: recentTaiwanMopsHistoryMonths_, fetch: fetchTaiwanMopsHistory_, refresh: refreshRecentTaiwanMopsArchive, importReports: nativeImportTaiwanMopsReports};`, appsScriptTestContext, {timeout: 3000});
const mopsSchedule = appsScriptTestContext.testMopsSchedule;
assert.deepEqual(Array.from(mopsSchedule.months(new Date('2026-09-30T15:59:59Z'))), ['2026-07', '2026-08'], 'window follows the Asia/Taipei calendar before the month boundary');
assert.deepEqual(Array.from(mopsSchedule.months(new Date('2026-09-30T16:00:00Z'))), ['2026-08', '2026-09'], 'window advances at midnight in Asia/Taipei');
assert.deepEqual(Array.from(mopsSchedule.months(new Date('2026-01-01T00:00:00Z'))), ['2025-11', '2025-12'], 'window rolls back across the year boundary');
archiveUrls.length = 0;
archiveSleeps.length = 0;
const archiveReports = mopsSchedule.fetch(['2026-08', '2026-09']);
assert.equal(archiveReports.length, 8, 'two recent completed months are fetched from all four report groups');
assert.deepEqual([...new Set(archiveReports.map(report => report.market))], ['Listed (TWSE)', 'OTC (TPEx)', 'Emerging (MOPS)', 'Publicly issued (MOPS)']);
assert.ok(archiveUrls.every(url => /\/nas\/t21\/(sii|otc|rotc|pub)\/t21sc03_115_(8|9)_0\.html$/.test(url)), 'archive URLs use the requested dynamic Taiwan-month window');
assert.deepEqual(archiveSleeps, Array(7).fill(1000), 'requests are spaced by one second');
archiveUrls.length = 0;
archiveFailureUrl = 'https://mopsov.twse.com.tw/nas/t21/pub/t21sc03_115_9_0.html';
workbookOpened = false;
appsScriptTestContext.importedReports = null;
assert.throws(() => mopsSchedule.refresh(), /HTTP 503/, 'one unavailable archive must fail the complete scheduled refresh');
assert.equal(archiveUrls.length, 8, 'the failing final report is still validated as part of the complete window');
assert.equal(workbookOpened, false, 'a failed report validation never opens or writes the workbook');
assert.equal(appsScriptTestContext.importedReports, null, 'a failed report validation never reaches the append/import step');
archiveFailureUrl = '';
archiveUrls.length = 0;
const scheduledResult = mopsSchedule.refresh();
assert.equal(scheduledResult.result, 'imported');
assert.equal(scheduledResult.reports, 8);
assert.equal(archiveUrls.length, 8);
assert.equal(appsScriptTestContext.importedReports.length, 8, 'all validated reports are handed to the existing append-only import step together');

const oldRow = ['Listed (TWSE)', '2330', 'Example Co.', 'Semiconductors', '2026-08', 100, 90, 80, 11.11, 25, 800, 700, 14.29, 'TWD thousands', '', new Date(), '{}'];
mockMonthlyRows = [oldRow];
appendedMonthlyRows = [];
appsScriptTestContext.refreshedNames = 0;
const appendResult = mopsSchedule.importReports([{market: 'Listed (TWSE)', month: '2026-08', url: 'https://example.test/archive', records: [
  {code: '2330', name: 'Example Co.', industry: 'Semiconductors', month: '2026-08', current: 100, prior: 90, yearAgo: 80, mom: 11.11, yoy: 25, ytd: 800, priorYtd: 700, ytdGrowth: 14.29},
  {code: '2330', name: 'Example Co.', industry: 'Semiconductors', month: '2026-08', current: 120, prior: 90, yearAgo: 80, mom: 33.33, yoy: 50, ytd: 820, priorYtd: 700, ytdGrowth: 17.14}
]}]);
assert.equal(appendResult.unchanged, 1, 'exact existing economic data is skipped');
assert.equal(appendResult.added, 1, 'a changed source observation is kept as an append-only revision');
assert.equal(appendedMonthlyRows.length, 1);
assert.equal(appendedMonthlyRows[0][5], 120);
assert.equal(appsScriptTestContext.refreshedNames, 1, 'the existing post-import English-name enrichment remains in the import path');

assert.deepEqual(backfillOptionsFromCli({from:'2026-07',to:'2026-09',out:'/tmp/history'}), {
  from:'2026-07',to:'2026-09',outDir:'/tmp/history',markets:['sii','otc','rotc','pub'],issuerTypes:['0'],
  maxRequests:8,delayMs:3000,retries:3,recheckCompleted:false
}, 'CLI defaults must cover every MOPS report family and domestic/foreign issuer population');

const fixture = await readFile(new URL('./fixtures/mops-monthly-sii-114-9.html', import.meta.url), 'utf8');
const parsed = parseMonthlyReport(fixture, {reportMonth: '2025-09', market: 'sii', issuerType: '0'});

assert.match(parsed.title, /114年9月份/);
assert.equal(parsed.records.length, 2, 'aggregate rows must not become company rows');
assert.deepEqual(parsed.records.map(row => row.companyCode), ['1101', '1102']);
assert.deepEqual(parsed.records[0], {
  market: 'sii', issuerType: 'combined', companyCode: '1101', companyName: '台泥', industry: '水泥工業',
  reportMonth: '2025-09', revenue: 13306676, priorMonthRevenue: 12214776, yearAgoRevenue: 13325249,
  monthChangePct: 8.93, yearChangePct: -0.13, ytdRevenue: 109438297, priorYearYtdRevenue: 105591346,
  ytdChangePct: 3.64, notes: '', currency: 'TWD', unit: 'thousand',
  sourceUrl: 'https://mopsov.twse.com.tw/nas/t21/sii/t21sc03_114_9_0.html',
  sourceAgency: 'Financial Supervisory Commission, Securities and Futures Bureau',
  sourceDataset: 'Monthly Business Income Summary Table (MOPS)',
  license: 'Open Government Data License v1.0', attribution: ATTRIBUTION,
  reportTitle: '上市公司114年9月份(累計與當月)營業收入統計表'
});
assert.equal(parsed.records[1].yearChangePct, -1.66);
const titleWithoutHeading = fixture.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<h1>[\s\S]*?<\/h1>/i, '<div>上市公司114年9月份(累計與當月)營業收入統計表</div><p>本資料由各公司提供</p>');
assert.equal(parseMonthlyReport(titleWithoutHeading, {reportMonth: '2025-09', market: 'sii', issuerType: '0'}).records.length, 2);
assert.equal(reportUrl('otc', '2024-01', '0'), 'https://mopsov.twse.com.tw/nas/t21/otc/t21sc03_113_1_0.html');
assert.throws(() => parseMonthlyReport(fixture, {reportMonth: '2025-08', market: 'sii', issuerType: '0'}), /does not match/);
assert.throws(() => parseMonthlyReport('<html><title>上市公司114年9月份</title><table><tr><td>not a report</td></tr></table></html>', {reportMonth: '2025-09', market: 'sii', issuerType: '0'}), /No valid company rows/);
assert.equal(reportUrl('rotc', '2025-09', '0'), 'https://mopsov.twse.com.tw/nas/t21/rotc/t21sc03_114_9_0.html');
assert.equal(reportUrl('pub', '2025-09', '0'), 'https://mopsov.twse.com.tw/nas/t21/pub/t21sc03_114_9_0.html');
assert.throws(() => reportUrl('sii', '2025-09', '1'), /Unsupported issuer type/);
for (const [market, label] of [['otc', '上櫃公司'], ['rotc', '興櫃公司'], ['pub', '公開發行公司']]) {
  const familyFixture = fixture.replaceAll('上市公司', label);
  assert.equal(parseMonthlyReport(familyFixture, {reportMonth:'2025-09',market,issuerType:'0'}).records.length, 2, `${market} report family title and rows should parse`);
}

// Keep this isolated smoke output under the OS temp directory. The test does not
// touch production Sheets or remove any generated files.
const outputDir = await mkdtemp(path.join(tmpdir(), 'field-signals-mops-backfill-'));
let fetchCalls = 0;
const responseFor = body => new Response(body, {status: 200, headers: {'content-type': 'text/html; charset=utf-8'}});
const options = {
  from: '2025-09', to: '2025-09', outDir: outputDir, markets: ['sii'], issuerTypes: ['0'],
  maxRequests: 1, delayMs: 1000, retries: 0, sleep: async () => {},
  fetchImpl: async () => { fetchCalls += 1; return responseFor(fixture); }
};
const firstRun = await runBackfill(options);
assert.equal(firstRun.result, 'complete');
assert.equal(firstRun.addedRecords, 2);
assert.equal(fetchCalls, 1);
const beforeRevision = (await readFile(path.join(outputDir, 'records.jsonl'), 'utf8')).trim().split('\n');
assert.equal(beforeRevision.length, 2);

const resumed = await runBackfill({...options, fetchImpl: async () => { throw new Error('completed partition should resume without a request'); }});
assert.equal(resumed.skipped, 1);
assert.equal(resumed.attempts, 0);

const revisedFixture = fixture.replace('13,306,676', '14,306,676');
const revised = await runBackfill({...options, recheckCompleted: true, fetchImpl: async () => responseFor(revisedFixture)});
assert.equal(revised.addedRecords, 1, 'changed records append as revisions, unchanged rows deduplicate');
const afterRevision = (await readFile(path.join(outputDir, 'records.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
assert.equal(afterRevision.length, 3);
assert.equal(afterRevision[2].revenue, 14306676);
const checkpoints = (await readFile(path.join(outputDir, 'checkpoints.jsonl'), 'utf8')).trim().split('\n').map(JSON.parse);
assert.equal(checkpoints.length, 2);
assert.ok(checkpoints.every(row => row.status === 'complete'));
assert.notEqual(checkpoints[0].sourceSha256, checkpoints[1].sourceSha256);

console.log('MOPS monthly backfill checks passed: parsing, attribution, fail-closed validation, bounded run, resume, and append-only revisions.');
