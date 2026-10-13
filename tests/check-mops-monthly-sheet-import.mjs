import assert from 'node:assert/strict';
import {prepareSheetImport, SHEET_HEADERS} from '../automation/mops-monthly-sheet-import.mjs';

const base = {
  market: 'sii', issuerType: 'domestic', companyCode: '2330', companyName: '台積電', industry: '半導體業',
  reportMonth: '2026-09', revenue: 330000000, priorMonthRevenue: 300000000, yearAgoRevenue: 280000000,
  monthChangePct: 10, yearChangePct: 17.86, ytdRevenue: 2600000000, priorYearYtdRevenue: 2300000000,
  ytdChangePct: 13.04, currency: 'TWD', unit: 'thousand', sourceUrl: 'https://example.test/mops',
  retrievedAt: '2026-10-13T12:00:00.000Z', reportTitle: 'test report', sourceSha256: 'abc'
};
const headers = SHEET_HEADERS.join(',');
const current = [
  'Listed (TWSE)', '2330', '台積電', '半導體業', '2026-09', '330,000,000', '300,000,000', '280,000,000',
  '10', '17.86', '2,600,000,000', '2,300,000,000', '13.04', 'TWD thousand',
  'https://example.test/mops', '2026-10-13T12:00:00.000Z', '{"old":"record, with comma"}'
].map(value => /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value).join(',');
const emptyExport = `Taiwan monthly revenue\n\n\n${headers}\n`;
const currentExport = `Taiwan monthly revenue\n\n\n${headers}\n${current}\n`;

const imported = prepareSheetImport([base], emptyExport);
assert.equal(imported.rows.length, 1);
assert.equal(imported.rows[0].length, 17);
assert.equal(imported.rows[0][0], 'Listed (TWSE)');
assert.equal(imported.rows[0][4], '2026-09');
assert.equal(JSON.parse(imported.rows[0][16]).sourceSha256, 'abc');

const unchanged = prepareSheetImport([base], currentExport);
assert.equal(unchanged.rows.length, 0, 'same issuer, period, and economics should not be appended again');
assert.equal(unchanged.unchanged, 1);

const legacyRecord = {...base, market: 'pub'};
const legacyRow = current.replace('Listed (TWSE)', 'Taiwan public issuers');
const legacyExisting = `Taiwan monthly revenue\n\n\n${headers}\n${legacyRow}\n`;
const legacyDeduped = prepareSheetImport([legacyRecord], legacyExisting);
assert.equal(legacyDeduped.rows.length, 0, 'legacy public-issuer labels should deduplicate against the normalized MOPS label');

const restated = prepareSheetImport([{...base, revenue: 331000000}], currentExport);
assert.equal(restated.rows.length, 1, 'changed values should append as a revision');
assert.equal(restated.revisions, 1);
assert.equal(restated.rows[0][5], 331000000);

const duplicates = prepareSheetImport([base, base], emptyExport);
assert.equal(duplicates.rows.length, 1, 'duplicate rows in a backfill should be emitted once');
assert.equal(duplicates.duplicateInput, 1);

assert.throws(() => prepareSheetImport([base], 'wrong,headers\n'), /Could not find the Taiwan Monthly header row/);
assert.throws(() => prepareSheetImport([{...base, market: 'unknown'}], emptyExport), /Unsupported MOPS market/);
assert.throws(() => prepareSheetImport([{...base, revenue: null}], emptyExport), /lacks numeric revenue or YoY growth/);

console.log('MOPS Sheet import checks passed: header validation, exact dedupe, append-only revisions, duplicate filtering, and issuer mapping.');
