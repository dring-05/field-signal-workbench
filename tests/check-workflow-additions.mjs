import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const app = await readFile(new URL('../public/app.js', import.meta.url), 'utf8');
const index = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
const helpers = [
  app.match(/function tableRowsFromHeader\(allRows,headerIndex=0\)\{[^\n]*\}/)?.[0],
  app.match(/function createReceipt\(notes,url,savedAt=new Date\(\)\.toISOString\(\)\)\{[^\n]*\}/)?.[0],
].filter(Boolean).join('\n');
assert.equal(helpers.split('\n').length, 2, 'Both data-workflow helpers should be available for validation');
const context = {};
vm.runInNewContext(helpers, context, { timeout: 1000 });

const table = vm.runInNewContext(`tableRowsFromHeader([
  ['Monthly operating data'],
  ['Source note: values revised each release'],
  ['Month', 'Visits', 'Region'],
  ['2026-08', '125', 'East']
], 2)`, context);
assert.equal(table.index, 2);
assert.deepEqual(Array.from(table.headers), ['Month', 'Visits', 'Region']);
assert.deepEqual(Array.from(table.rows[0]), ['2026-08', '125', 'East']);
assert.equal(table.skippedPreamble, 2);

const receipt = vm.runInNewContext(`createReceipt({
  question:'Does capacity delay revenue?', observation:'Two projects moved',
  bridgeSignal:'Utility queue', bridgeKpi:'Energized MW', observedDate:'2026-10-12',
  sourceDate:'September 2026', geography:'Northern Virginia',
  definition:'Announced projects, MW', revision:'Provider revises monthly'
}, 'https://example.org/source', 'saved-at')`, context);
assert.equal(receipt.sourceDate, 'September 2026');
assert.equal(receipt.geography, 'Northern Virginia');
assert.equal(receipt.definition, 'Announced projects, MW');
assert.equal(receipt.revision, 'Provider revises monthly');
assert.equal(receipt.bridgeSignal, 'Utility queue');
assert.equal(receipt.url, 'https://example.org/source');

assert.match(app, /function home\(\)[\s\S]*?trackedSignalList\(\)/, 'Overview should render the followed-source list');
assert.match(app, /data-track-url=/, 'Source cards should expose follow controls');
assert.match(app, /id="capacity-project-form"/, 'Capacity page should include its project evidence register');
assert.match(app, /id="header-row"/, 'Importer should let users select the header row');
const newModules = ['source-freshness.js', 'signal-event-studies.js', 'variant-perception.js', 'capacity-revenue-bridge.js'];
for (const source of newModules) {
  assert(index.includes(`<script src="${source}" defer></script>`), `${source} must load on the site`);
  assert(index.indexOf(`<script src="${source}" defer></script>`) < index.indexOf('<script src="app.js" defer></script>'), `${source} must register before the app boots`);
}
assert.match(app, /Object\.entries\(window\.FieldSignalsModules\|\|\{\}\)/, 'Analyst Tools should discover each registered module');
console.log('Workflow checks passed: import mapping, receipts, followed signals, capacity records, and four new analyst modules.');
