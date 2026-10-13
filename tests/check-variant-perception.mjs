import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const api = require('../public/variant-perception.js');

const empty = api.logic.validateEntry({});
assert.equal(empty.errors.length, 5);
const validInput = {
  company: 'Example Corp', ticker: 'exm', asOfDate: '2026-10-12', horizon: 'FY2027',
  metric: 'Revenue', unit: 'USD millions', ownForecast: '$5,000 to $5,300',
  marketExpectation: '$4,800 consensus as of 2026-10-10', variant: 'New capacity ramps sooner',
  evidence: 'Source: filing\nDate: 2026-10-01\nhttps://example.test',
  falsifier: 'Two consecutive months below 90% utilization', confidence: 'Medium',
};
const checked = api.logic.validateEntry(validInput);
assert.deepEqual(checked.errors, []);
assert.equal(checked.entry.ticker, 'EXM');
assert.equal(checked.entry.status, 'active');
assert.equal(checked.entry.exitDate, '');
assert.ok(checked.entry.id);

const exited = api.logic.normalizeEntry({ ...checked.entry, status: 'exited', exitDate: '2026-11-01', outcome: 'Below forecast' }, '2026-11-02T12:00:00.000Z');
assert.equal(exited.status, 'exited');
assert.equal(exited.exitDate, '2026-11-01');
assert.equal(exited.outcome, 'Below forecast');
assert.equal(exited.createdAt, checked.entry.createdAt);
assert.equal(exited.updatedAt, '2026-11-02T12:00:00.000Z');

const imported = api.logic.parseEntries(JSON.stringify({ version: 1, entries: [checked.entry, exited, null] }));
assert.equal(imported.length, 2);
assert.equal(imported[1].status, 'exited');
assert.deepEqual(api.logic.parseEntries('bad json'), []);
assert.deepEqual(api.logic.parseEntries('{"entries":{}}'), []);
assert.match(api.logic.escapeHtml('<script>"x"</script>'), /&lt;script&gt;/);

const moduleSource = await readFile(new URL('../public/variant-perception.js', import.meta.url), 'utf8');
assert.match(moduleSource, /root\.FieldSignalsModules\.variantPerception/);
const context = { window: {} };
vm.runInNewContext(moduleSource, context, { timeout: 1000 });
const browserModule = context.window.FieldSignalsModules.variantPerception;
assert.equal(browserModule.title, 'Variant-perception ledger');
const markup = browserModule.render();
assert.match(markup, /Market-implied expectation/);
assert.match(markup, /What would change your mind/);
assert.match(markup, /Export backup/);
assert.match(markup, /not password protected/);
console.log('Variant-perception ledger checks passed: required fields, normalization, review and exit retention, backup parsing, escaping, and browser registration.');
