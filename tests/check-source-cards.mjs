import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = await readFile(new URL('../public/industry-modules.js', import.meta.url), 'utf8');
const context = { window: {} };
vm.runInNewContext(source, context, { timeout: 1000 });
const directory = context.window.industryModules;
assert.match(directory.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(directory.sectors.length, 14, 'Expected the 11 broad sectors plus focused hardware and semiconductor niches');

const expectedBroadSectors = [
  'Information Technology', 'Communication Services', 'Consumer discretionary',
  'Consumer staples', 'Energy', 'Financials', 'Health Care', 'Industrials',
  'Materials', 'Real Estate', 'Utilities',
];
const names = directory.sectors.map((sector) => sector.name.toLowerCase());
for (const label of expectedBroadSectors) {
  assert(names.some((name) => name.includes(label.toLowerCase())), `Missing broad sector: ${label}`);
}

const ids = new Set();
const urls = new Set();
let cardCount = 0;
for (const sector of directory.sectors) {
  assert(sector.id && sector.name && sector.description, `Sector metadata is incomplete: ${sector.id}`);
  assert(Array.isArray(sector.cards) && sector.cards.length > 0, `Sector has no source cards: ${sector.name}`);
  for (const card of sector.cards) {
    cardCount += 1;
    assert(card.id && !ids.has(card.id), `Missing or duplicate card id: ${card.id}`);
    ids.add(card.id);
    assert.match(card.url, /^https:\/\//, `Source must use HTTPS: ${card.id}`);
    assert(!urls.has(card.url), `Duplicate sector-card URL: ${card.url}`);
    urls.add(card.url);
    for (const field of ['title', 'provider', 'whatItMeasures', 'accessAndReuse', 'freshness', 'evidenceReviewed']) {
      assert.equal(typeof card[field], 'string', `Missing ${field}: ${card.id}`);
      assert(card[field].trim().length > 0, `Empty ${field}: ${card.id}`);
    }
    assert(card.operatingMetricBridge?.metric, `Missing bridge metric: ${card.id}`);
    assert(card.operatingMetricBridge?.hypothesis, `Missing bridge hypothesis: ${card.id}`);
    assert(card.operatingMetricBridge?.limits, `Missing bridge limits: ${card.id}`);
    assert(!JSON.stringify(card).includes(String.fromCharCode(0x2014)), `Em dash found in card: ${card.id}`);
  }
}
assert.equal(cardCount, 30, 'Review the expected count when source cards are intentionally added or archived');
console.log(`Source-card checks passed: ${cardCount} cards across ${directory.sectors.length} sector and niche groups.`);
