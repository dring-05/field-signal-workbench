import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const syncSource = await readFile(new URL('../automation/taiwan-public-feed-sync.gs', import.meta.url), 'utf8');
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
const copied = [sourceHeaders, ['Listed (TWSE)', 'TW|2330|台積電', '2330', '台積電', 'Semiconductors', '2026-09', 1, 20, 0, 1, 2, 4, '', '', '', '', '', '', '', '', '', '', '', 'status', 'https://example.test', 'TSMC', 'https://translate.google.com', 1, 2, 3, 4, 5, 6]];
let written = [];
let cleared = null;
const source = {getLastRow: () => 5, getSheetByName: () => null, getRange: (row, col, rows, cols) => ({getValues: () => rows === 1 ? [sourceHeaders] : copied,})};
const target = {getLastRow: () => 8, getMaxColumns: () => 33, getMaxRows: () => 3000, getSheetByName: () => null, getRange: (row, col, rows, cols) => ({clearContent: () => {cleared = [row, col, rows, cols]}, setValues: values => {written = values}})};
const book = id => id === '1qNrg6QhGKBai0jOa6teL1WNsiCazZQQmRVA4Po5fuIY' ? {getSheetByName: () => source} : {getSheetByName: () => target};
const context = {
  LockService: {getScriptLock: () => ({tryLock: () => true, releaseLock: () => {}})},
  SpreadsheetApp: {openById: book},
  writeLog_: (...args) => { context.log = args; }
};
vm.runInNewContext(`${syncSource}\nglobalThis.runSync = syncTaiwanPublicFeed; globalThis.publicConfig = PUBLIC_TAIWAN_FEED;`, context);
const result = context.runSync();
assert.deepEqual(JSON.parse(JSON.stringify(result)), {result: 'success', rows: 1, columns: 33});
assert.equal(written.length, 2, 'copy the schema header and current source rows');
assert.equal(written[0][2], 'Company code');
assert.equal(written[1][2], '2330');
assert.deepEqual(cleared, [4, 1, 5, 33], 'clear stale public rows before writing the latest feed');
assert.equal(context.publicConfig.targetSpreadsheetId, '1bdq1OZ4-lcNMMWNqpGdAIqb3CM1oGDmdIOY1e5KN0cg');
assert.match(context.log[0], /Public feed synced/);

const alteredHeaders = [...sourceHeaders];
alteredHeaders[19] = 'Unapproved source field';
const badBook = id => id === context.publicConfig.sourceSpreadsheetId ? {getSheetByName: () => ({getLastRow: () => 4, getRange: () => ({getValues: () => [alteredHeaders]})})} : {getSheetByName: () => target};
context.SpreadsheetApp.openById = badBook;
assert.throws(() => context.runSync(), /header does not match/, 'refuse to copy even a single unexpected source column');

const emptyBook = id => id === context.publicConfig.sourceSpreadsheetId ? {getSheetByName: () => ({getLastRow: () => 4, getRange: () => ({getValues: () => [sourceHeaders]})})} : {getSheetByName: () => target};
context.SpreadsheetApp.openById = emptyBook;
cleared = null;
assert.throws(() => context.runSync(), /no complete issuer records/, 'do not overwrite a populated public feed with an empty source');
assert.equal(cleared, null, 'keep existing public rows when the source feed is empty');
console.log('Taiwan public feed sync and zero-safe acceleration sort checks passed');
