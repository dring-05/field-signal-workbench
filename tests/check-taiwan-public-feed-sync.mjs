import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const importerSource = await readFile(new URL('../automation/taiwan-sheets-importer.gs', import.meta.url), 'utf8');
const feedSource = await readFile(new URL('../automation/taiwan-public-feed-sync.gs', import.meta.url), 'utf8');
const appSource = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const helperSource = appSource.match(/function taiwanAccelerationValue\(row\)[\s\S]*?function renderTaiwanRows\(query\)/)?.[0];
assert.ok(helperSource, 'Taiwan acceleration sort helpers must remain available to the dashboard');
const sortContext = {};
vm.runInNewContext(`${helperSource.replace(/function renderTaiwanRows\(query\)$/, '')}\nglobalThis.sortHelpers = {taiwanAccelerationValue, compareTaiwanAcceleration};`, sortContext);
const {taiwanAccelerationValue, compareTaiwanAcceleration} = sortContext.sortHelpers;
const zero = {'Revenue YoY Δ1 (pp/month)': '0', 'Revenue YoY %': '900'};
const rising = {'Revenue YoY Δ1 (pp/month)': '5', 'Revenue YoY %': '20'};
const missing = {'Revenue YoY Δ1 (pp/month)': '', 'Revenue YoY %': '300'};
assert.equal(taiwanAccelerationValue(zero), 0, 'a real zero first difference must stay zero');
assert.ok(compareTaiwanAcceleration(rising, zero) < 0, 'sort should rank the larger first difference first');
assert.ok(compareTaiwanAcceleration(zero, missing) < 0, 'rows without Δ1 should sort after rows with a reported Δ1');
assert.ok(appSource.includes("base '+esc(taiwanMetric(r['Revenue year-ago month']))+' TWD k"), 'show the prior-year revenue base beside YoY growth');

const sourceHeaders = ['Market', 'Issuer series key', 'Company code', 'Company name', 'Industry', 'Report month', 'Revenue', 'Revenue YoY %', 'Revenue YoY Δ1 (pp/month)', 'Revenue YoY Δ2 (pp/month²)', 'Revenue YoY Δ3 (pp/month³)', 'Consecutive monthly observations', 'Gross margin %', 'Gross margin YoY change (pp)', 'Gross margin Δ1 (pp/quarter)', 'Gross margin Δ2 (pp/quarter²)', 'Gross margin Δ3 (pp/quarter³)', 'Operating margin %', 'Operating margin YoY change (pp)', 'Operating margin Δ1 (pp/quarter)', 'Operating margin Δ2 (pp/quarter²)', 'Operating margin Δ3 (pp/quarter³)', 'Latest statement date', 'Data status', 'Monthly source URL', 'English company name or official abbreviation', 'Mandarin pronunciation lookup', 'Revenue prior month', 'Revenue year-ago month', 'Revenue MoM %', 'Revenue YTD', 'Revenue prior-year YTD', 'Revenue YTD growth %'];
assert.equal(sourceHeaders.length, 33);
const row = ['Listed (TWSE)', 'TW|2330|台積電', '2330', '台積電', 'Semiconductors', '2026-09', 1, 20, 0, 1, 2, 4, '', '', '', '', '', '', '', '', '', '', '', 'status', 'https://example.test', 'TSMC', 'https://translate.google.com', 1, 2, 3, 4, 5, 6];
const validRows = [sourceHeaders, ...Array.from({length: 4}, () => row)];
let activeBook = null;
const testScriptProperties = {};
const context = {
  SpreadsheetApp: {getActiveSpreadsheet: () => activeBook},
  PropertiesService: {getScriptProperties: () => ({getProperty: key => testScriptProperties[key] || ''})}
};
vm.runInNewContext(`${importerSource}\n${feedSource}\nglobalThis.validate = validateTaiwanPublicFeed; globalThis.feedHeaders = FEED_HEADERS; globalThis.syncTaiwanPublicFeed = syncTaiwanPublicFeed; globalThis.taiwanPublicFeedSyncConfig = TAIWAN_PUBLIC_FEED_SYNC;`, context);
const makeBook = (values, lastRow = values.length + 3) => ({
  getSheetByName: () => ({
    getLastRow: () => lastRow,
    getRange: (startRow, startColumn, rowCount, columnCount) => ({
      getValues: () => values.slice(startRow - 4, startRow - 4 + rowCount).map(item => item.slice(0, columnCount))
    })
  })
});
activeBook = makeBook(validRows);
const result = context.validate();
assert.deepEqual(JSON.parse(JSON.stringify(result)), {result: 'ready to publish', tab: 'SiteFeed', rows: 4, columns: 33, note: 'Publish only the SiteFeed tab as CSV. Keep all other tabs private.'});

const alteredHeaders = [...sourceHeaders];
alteredHeaders[19] = 'Unapproved source field';
activeBook = makeBook([alteredHeaders, row], 6);
assert.throws(() => context.validate(), /does not match the approved public schema/, 'refuse an unapproved public column');

activeBook = makeBook([sourceHeaders], 4);
assert.throws(() => context.validate(), /does not contain a header and issuer rows/, 'do not publish an empty feed');

activeBook = makeBook([sourceHeaders, ['Listed (TWSE)', 'TW|2330|台積電', '', '台積電', 'Semiconductors', '2026-09', 1]], 6);
assert.throws(() => context.validate(), /no complete issuer row/, 'require a ticker and report month before publish');

activeBook = null;
assert.throws(() => context.validate(), /Bind this script to the private Taiwan Monthly Signals workbook/, 'refuse to check a feed without the private workbook');

const sourceBookId = 'source-workbook-test-id';
const publicBookId = 'public-feed-test-id';
const lowBaseRow = [...row];
lowBaseRow[6] = '1815362';
lowBaseRow[7] = '3425111.32';
lowBaseRow[8] = '3422859.03';
lowBaseRow[9] = '4516997.3';
lowBaseRow[10] = '6706905.19';
lowBaseRow[23] = 'Revenue Δ3 available';
lowBaseRow[28] = '53';
const sourceValues = [['Website data feed'], ['Monthly issuer data'], [], sourceHeaders, row, lowBaseRow];
const sourceTab = {
  getLastRow: () => sourceValues.length,
  getRange: () => ({getDisplayValues: () => sourceValues})
};
let publishedValues = null;
const destinationTab = {
  getMaxRows: () => 3000,
  getMaxColumns: () => 33,
  getLastRow: () => publishedValues ? publishedValues.length : 1,
  getRange: () => ({
    setValues: values => { publishedValues = values; },
    clearContent: () => { publishedValues = null; }
  })
};
const sourceBook = {getId: () => sourceBookId, getSheetByName: () => sourceTab};
const destinationBook = {getSheetByName: () => destinationTab, getUrl: () => `https://docs.google.com/spreadsheets/d/${publicBookId}/edit`};
context.SpreadsheetApp.getActiveSpreadsheet = () => sourceBook;
testScriptProperties.TAIWAN_SOURCE_SPREADSHEET_ID = sourceBookId;
testScriptProperties.TAIWAN_PUBLIC_FEED_SPREADSHEET_ID = publicBookId;
context.SpreadsheetApp.openById = id => {
  if (id === sourceBookId) return sourceBook;
  assert.equal(id, publicBookId, 'write only to the public-feed workbook');
  return destinationBook;
};
context.SpreadsheetApp.flush = () => {};
context.taiwanPublicFeedSyncConfig.expectedRowsMinimum = 1;
context.taiwanPublicFeedSyncConfig.maxRows = 10;
const syncResult = context.syncTaiwanPublicFeed();
assert.equal(syncResult.status, 'success');
assert.equal(syncResult.reportMonth, '2026-09');
assert.equal(syncResult.issuerRows, 2);
assert.equal(syncResult.lowBaseRowsSuppressed, 1);
assert.equal(publishedValues[5][8], '', 'suppress acceleration for a tiny year-ago base in the public copy');
assert.equal(publishedValues[5][7], '3425111.32', 'retain the source-reported YoY percentage with its base visible');
assert.ok(publishedValues[5][23].includes('below 0.1%'), 'mark the reason beside the issuer row');
assert.match(await readFile(new URL('../worker/index.js', import.meta.url), 'utf8'), /pub\?gid=1&single=true&output=csv/, 'Worker must read the newly published LiveSiteFeed tab');
console.log('Taiwan public feed validation and zero-safe acceleration sort checks passed');
