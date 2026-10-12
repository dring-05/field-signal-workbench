import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = await readFile(new URL('../public/retail-pricing.js', import.meta.url), 'utf8');
const store = new Map();
const context = { window: {}, localStorage: { getItem: key => store.get(key) ?? null, setItem: (key,value) => store.set(key,value) }, URL };
vm.runInNewContext(source, context, { timeout: 1000 });
const panel = context.window.FieldSignalsModules.retailPricing;
assert.equal(panel.title, 'Retail traffic and pricing');
const html = panel.render();
assert.match(html, /Retail traffic monitor/);
assert.match(html, /Pricing and promotion tracker/);
assert.match(html, /Winter’s Starbucks Everywhere tracks store openings and closures, not customer traffic/);
assert.match(html, /Manual observations only/);
assert.match(html, /Source period/);
assert.match(html, /Promotion/);
assert.doesNotMatch(html, /latest live visits|real-time visits/i);
console.log('Retail and pricing checks passed: separate manual series and source limits are visible.');
