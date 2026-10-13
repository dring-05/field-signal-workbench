import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = await readFile(new URL('../automation/taiwan-sheets-importer.gs', import.meta.url), 'utf8');
const context = {};
vm.runInNewContext(`${source}\nglobalThis.helpers = {quarterPeriod_, quarterIndex_, finiteDifferencesAtEnd_, yoyMarginSeries_, differencesForQuarterSeries_, marginSignalsMap_, rebuildSiteFeed_};`, context, {timeout: 1000});
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
const marginAuditRows = [];
const marginAuditSheet = {getLastRow: () => 4, getRange: () => ({getDisplayValues: () => [], setValues: rows => marginAuditRows.push(...rows)})};
const feedSheet = {getLastRow: () => 4, getRange: () => ({setValues: rows => {generated = rows}})};
const book = {getSheetByName: name => ({'Taiwan Monthly': monthlySheet, 'Raw Statements': rawSheet, SiteFeed: feedSheet, 'Margin Signals': marginAuditSheet}[name])};
h.rebuildSiteFeed_(book);
assert.equal(generated.length, 1);
assert.equal(generated[0].length, 24);
assert.deepEqual(Array.from(generated[0].slice(7, 10)), [6, 2, 0]);
assert.match(generated[0][22], /Revenue Δ3 available/);

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
assert.equal(marginAuditRows[1][17], 130, 'Q2 standalone revenue must be Q2 YTD less Q1 YTD');
assert.equal(marginAuditRows[3][17], 190, 'Q4 standalone revenue must be annual YTD less Q3 YTD');
assert.match(marginAuditRows[3][24], /cumulative YTD/i);

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
