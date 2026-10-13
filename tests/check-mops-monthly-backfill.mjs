import assert from 'node:assert/strict';
import {mkdtemp, readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ATTRIBUTION, backfillOptionsFromCli, parseMonthlyReport, reportUrl, runBackfill} from '../automation/mops-monthly-backfill.mjs';

assert.deepEqual(backfillOptionsFromCli({from:'2026-07',to:'2026-09',out:'/tmp/history'}), {
  from:'2026-07',to:'2026-09',outDir:'/tmp/history',markets:['sii','otc','rotc','pub'],issuerTypes:['0','1'],
  maxRequests:8,delayMs:3000,retries:3,recheckCompleted:false
}, 'CLI defaults must cover every MOPS report family and domestic/foreign issuer population');

const fixture = await readFile(new URL('./fixtures/mops-monthly-sii-114-9.html', import.meta.url), 'utf8');
const parsed = parseMonthlyReport(fixture, {reportMonth: '2025-09', market: 'sii', issuerType: '0'});

assert.match(parsed.title, /114年9月份/);
assert.equal(parsed.records.length, 2, 'aggregate rows must not become company rows');
assert.deepEqual(parsed.records.map(row => row.companyCode), ['1101', '1102']);
assert.deepEqual(parsed.records[0], {
  market: 'sii', issuerType: 'domestic', companyCode: '1101', companyName: '台泥', industry: '水泥工業',
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
assert.equal(reportUrl('otc', '2024-01', '1'), 'https://mopsov.twse.com.tw/nas/t21/otc/t21sc03_113_1_1.html');
assert.throws(() => parseMonthlyReport(fixture, {reportMonth: '2025-08', market: 'sii', issuerType: '0'}), /does not match/);
assert.throws(() => parseMonthlyReport('<html><title>上市公司114年9月份</title><table><tr><td>not a report</td></tr></table></html>', {reportMonth: '2025-09', market: 'sii', issuerType: '0'}), /No valid company rows/);
assert.equal(reportUrl('rotc', '2025-09', '0'), 'https://mopsov.twse.com.tw/nas/t21/rotc/t21sc03_114_9_0.html');
assert.equal(reportUrl('pub', '2025-09', '1'), 'https://mopsov.twse.com.tw/nas/t21/pub/t21sc03_114_9_1.html');
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
