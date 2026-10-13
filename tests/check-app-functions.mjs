import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const modules = await readFile(new URL('../public/industry-modules.js', import.meta.url), 'utf8');
const context = { window: {}, sources: [] };
vm.runInNewContext(modules, context, { timeout: 1000 });

const dateFunction = app.match(/function normalizedDate\(value,mode='auto'\)\{[\s\S]*?\n\}/)?.[0];
const sourceFunction = app.match(/function sourcesForQuestion\(text\)\{[^\n]*\}/)?.[0];
const numberFunction = app.match(/function numberValue\(value,mode='auto'\)\{[^\n]*\}/)?.[0];
const escapeFunction = app.match(/const esc=s=>[^\n]*;/)?.[0];
const paperSourceFunction = app.match(/function renderPaperSources\(query\)\{[^\n]*\}/)?.[0];
const csvFunctions = app.match(/function csvCell\(value\)\{[^\n]*\}\nfunction cleanedSeriesCsv\(data,group\)\{[^\n]*\}/)?.[0];
assert(dateFunction, 'Could not locate normalizedDate');
assert(sourceFunction, 'Could not locate sourcesForQuestion');
assert(numberFunction, 'Could not locate numberValue');
assert(escapeFunction, 'Could not locate HTML escaping helper');
assert(paperSourceFunction, 'Could not locate paper-book source finder');
assert(csvFunctions, 'Could not locate cleaned CSV functions');
vm.runInNewContext(`${dateFunction}\n${numberFunction}\n${sourceFunction}\n${csvFunctions}`, context, { timeout: 1000 });

const date = (value, mode = 'auto') => vm.runInNewContext(`normalizedDate(${JSON.stringify(value)}, ${JSON.stringify(mode)})`, context);
assert.equal(date('2026-09-30'), '2026-09-30');
assert.equal(date('2026-09'), '2026-09', 'Monthly periods should not be relabeled as the first day of the month');
assert.equal(date('2026'), '2026', 'Annual periods should retain year precision');
assert.equal(date('09/30/2026'), '2026-09-30', 'Unambiguous month-first dates should parse in auto mode');
assert.equal(date('30/09/2026'), '2026-09-30', 'Unambiguous day-first dates should parse in auto mode');
assert.equal(date('01/02/2026'), '', 'Ambiguous dates should require an explicit choice');
assert.equal(date('45292'), '', 'Excel serials should not become far-future years in auto mode');
assert.equal(date('45292', 'excel'), '2024-01-01');
assert.equal(date('2026-02-30'), '', 'Impossible ISO dates should be rejected');
assert.equal(vm.runInNewContext('numberValue("1,234.56", "auto")', context), 1234.56);
assert.equal(vm.runInNewContext('numberValue("1.234,56", "eu")', context), 1234.56);
assert.equal(vm.runInNewContext('numberValue("12%", "auto")', context), 12, 'Percent values remain percentage points');
const csv = vm.runInNewContext(`cleanedSeriesCsv({sourceName:'Store "A"',url:'https://example.org',unit:'visits',geography:'US',rows:[{date:'2026-09',group:'East',value:12},{date:'2026-10',group:'West',value:14}]},'East')`, context);
assert.match(csv, /"Store ""A"""/);
assert.match(csv, /"2026-09","East","12"/);
assert.doesNotMatch(csv, /2026-10/, 'CSV export should include only the selected category');

const expected = [
  ['GPU cloud pricing', 'computepulse-gpu-prices'],
  ['semiconductor wafer sales', 'sia-wsts-monthly-sales'],
  ['streaming engagement', 'nielsen-the-gauge'],
  ['retail category sales', 'census-monthly-retail-trade'],
  ['weekly oil petroleum', 'eia-weekly-petroleum-status'],
  ['lithium mineral supply', 'usgs-mineral-statistics'],
  ['port container shipping', 'port-la-container-statistics'],
  ['BEA PCE spending', 'bea-personal-consumption-expenditures'],
  ['grocery egg features', 'usda-egg-feature-activity'],
  ['clinical drug trials', 'clinicaltrials-gov-registry'],
  ['bank deposit credit', 'fdic-bankfind-financial-reports'],
  ['power plant generation', 'eia-923-plant-operations'],
  ['housing rent data', 'zillow-research-housing-data'],
  ['broadband fiber access', 'fcc-national-broadband-map'],
  ['semiconductor production output', 'fed-semiconductor-industrial-production'],
  ['data center power grid capacity', 'eia-hourly-grid-monitor'],
  ['data center planned generator supply', 'eia-860m-generator-inventory'],
  ['utility hourly electricity supply', 'eia-hourly-grid-monitor'],
  ['healthcare medicare drug uptake', 'cms-quarterly-partd-spending'],
  ['bank weekly deposit balances', 'federal-reserve-h8-bank-assets-liabilities'],
  ['airline flight delays', 'bts-airline-on-time-performance'],
  ['manufacturing orders backlog', 'census-m3-orders-inventories'],
  ['natural gas storage', 'eia-weekly-natural-gas-storage'],
];
for (const [question, expectedId] of expected) {
  const ids = vm.runInNewContext(`sourcesForQuestion(${JSON.stringify(question)}).map(x => x.id)`, context);
  assert(ids.includes(expectedId), `${question} did not match ${expectedId}`);
}
assert.equal(vm.runInNewContext('sourcesForQuestion("custom question without a sector keyword").length', context), 0);
const resultsBox = { innerHTML: '' };
context.document = { querySelector: selector => selector === '#paper-source-results' ? resultsBox : null };
vm.runInNewContext(`${escapeFunction}\n${sourceFunction}\n${paperSourceFunction}\nrenderPaperSources("TSMC semiconductor wafer sales")`, context, { timeout: 1000 });
assert.match(resultsBox.innerHTML, /TSMC monthly revenue/);
assert.match(resultsBox.innerHTML, /Global semiconductor sales/);
assert.match(resultsBox.innerHTML, /Candidate industry context/);
assert.match(app, /The search runs in this browser\. It does not save or send your idea details\./);
assert.match(app, /data-sector-target="\$\{esc\(sector\.id\)\}"/, 'Sector navigation links must target sections without changing the page route');
assert.match(app, /document\.getElementById\(a\.dataset\.sectorTarget\)\?\.scrollIntoView/, 'Sector navigation must scroll to the selected section');
assert.doesNotMatch(app, /document\.querySelector\(a\.getAttribute\('href'\)\)/, 'Sector filtering must not interpret section IDs as routes');
console.log('App-function checks passed: date handling, source routing, and paper-book source suggestions.');
