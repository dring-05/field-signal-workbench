import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = await readFile(new URL('../automation/taiwan-sheets-importer.gs', import.meta.url), 'utf8');
const context = {};
vm.runInNewContext(`${source}\nglobalThis.helpers = {quarterPeriod_, quarterIndex_, finiteDifferencesAtEnd_, yoyMarginSeries_, differencesForQuarterSeries_, rebuildSiteFeed_};`, context, {timeout: 1000});
const h = context.helpers;

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
  row[5] = 100 + i; row[9] = [10, 12, 16, 22][i]; row[14] = 'https://example.test/monthly'; row[16] = '{}';
  return row;
});
let generated = [];
const monthlySheet = {getLastRow: () => 8, getRange: () => ({getValues: () => monthRows})};
const rawSheet = {getLastRow: () => 4};
const feedSheet = {getLastRow: () => 4, getRange: () => ({setValues: rows => {generated = rows}})};
const book = {getSheetByName: name => ({'Taiwan Monthly': monthlySheet, 'Raw Statements': rawSheet, SiteFeed: feedSheet}[name])};
h.rebuildSiteFeed_(book);
assert.equal(generated.length, 1);
assert.equal(generated[0].length, 24);
assert.deepEqual(Array.from(generated[0].slice(7, 10)), [6, 2, 0]);
assert.match(generated[0][22], /Revenue Δ3 available/);

console.log('Taiwan signal math checks passed: ROC quarter normalization, finite differences, quarter matching, feed shape, and status generation.');
