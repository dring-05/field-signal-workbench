import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { periodKey, parseSeries, pearson, compareSeries } = require('../public/divergence-validation.js');

assert.equal(periodKey('2026-02'), '2026-02');
assert.equal(periodKey('2026-02-30'), '');
assert.equal(periodKey('09/30/2026'), '');

const parsed = parseSeries('period,value\n2026-01,"1,000"\n2026-02,\n2026-02,3\n2026-02,4\nwrong,5\n,6');
assert.equal(parsed.inputRows, 6);
assert.equal(parsed.missingValues, 1);
assert.equal(parsed.invalidDates, 1);
assert.equal(parsed.missingDates, 1);
assert.deepEqual(parsed.duplicates, [{ period: '2026-02', count: 2 }]);
assert.equal(parsed.excludedDuplicates, 2, 'all duplicate-period values are excluded rather than choosing one arbitrarily');
assert.deepEqual(parsed.rows, [{ period: '2026-01', value: 1000 }]);
assert.deepEqual(parsed.periodFrequencies, ['monthly']);

const a = parseSeries('date,value\n2026-01,10\n2026-02,20\n2026-03,30\n2026-04,40');
const b = parseSeries('date,value\n2026-01,1\n2026-02,2\n2026-03,3\n2026-04,4');
assert.equal(pearson([[1, 2], [2, 4], [3, 6]]), 1);
assert.equal(pearson([[1, 2], [1, 3]]), null, 'constant inputs do not produce a spurious correlation');
const comparison = compareSeries(a, b, 1);
assert.equal(comparison.alignedCount, 4);
assert.equal(comparison.levelCorrelation, 1);
assert.equal(comparison.growthCorrelation, 1);
assert.deepEqual(comparison.missingA, []);
assert.deepEqual(comparison.missingB, []);
assert.equal(comparison.lagCorrelations.length, 3);
assert.equal(comparison.lagCorrelations.find(row => row.lag === 1).n, 3);

const unaligned = compareSeries(a, parseSeries('date,value\n2026-02,5\n2026-04,8'), 0);
assert.equal(unaligned.alignedCount, 2);
assert.deepEqual(unaligned.missingA, []);
assert.deepEqual(unaligned.missingB, ['2026-01', '2026-03']);
assert.deepEqual(parseSeries('period,value\n2026,10\n2026-02,12').periodFrequencies, ['annual', 'monthly']);

const moduleSource = await readFile(new URL('../public/divergence-validation.js', import.meta.url), 'utf8');
assert.match(moduleSource, /root\.FieldSignalsModules\.divergence = moduleApi/);
assert.match(moduleSource, /render\(\)/);
assert.match(moduleSource, /attach\(container\)/);
assert.match(moduleSource, /false alarm/i);
const browserContext = { window: {} };
vm.runInNewContext(moduleSource, browserContext, { timeout: 1000 });
const browserModule = browserContext.window.FieldSignalsModules.divergence;
assert.equal(browserModule.title, 'Peer divergence and validation');
assert.match(browserModule.render(), /data-dv="seriesA"/);
const values = {
  nameA: { value: 'Company A' }, nameB: { value: 'Company B' },
  seriesA: { value: '2026-01,1\n2026-02,2' },
  seriesB: { value: '2026-01,2\n2026-02,4' },
  maxLag: { value: '1' }, result: { innerHTML: '' }
};
let clickHandler;
const fakeContainer = {
  querySelector(selector) { return values[selector.match(/"([^"]+)"/)[1]]; }
};
values.run = { addEventListener(event, handler) { assert.equal(event, 'click'); clickHandler = handler; } };
browserModule.attach(fakeContainer);
clickHandler();
assert.match(values.result.innerHTML, /Periods in common/);
assert.match(values.result.innerHTML, /Only 2 aligned observations/);
console.log('Divergence and validation checks passed: parsing, duplicate exclusion, missingness, alignment, correlations, and lag counts.');
