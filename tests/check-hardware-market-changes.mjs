import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const data = JSON.parse(await readFile(new URL('../public/hardware-market-changes.json', import.meta.url), 'utf8'));
assert.equal(data.schemaVersion, 1);
assert.match(data.reviewedAt, /^\d{4}-\d{2}-\d{2}$/);
assert.equal(data.collectionMode, 'manual-source-review');
assert.match(data.automationStatus, /No automated feed/i);
assert.ok(Array.isArray(data.entries) && data.entries.length >= 6, 'Keep useful coverage across requested hardware niches');

const ids = data.entries.map(entry => entry.id);
assert.equal(new Set(ids).size, ids.length, 'Entry IDs must be unique and stable');
const required = ['id', 'niche', 'companyOrMarket', 'changeType', 'eventDate', 'observedAt', 'sourceName', 'sourceUrl', 'sourceKind', 'accessNote', 'evidence', 'operatingMetricImplication', 'status'];
for (const entry of data.entries) {
  for (const field of required) assert.ok(typeof entry[field] === 'string' && entry[field].trim(), `${entry.id ?? 'row'} requires ${field}`);
  assert.match(entry.eventDate, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(entry.observedAt, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Date.parse(`${entry.eventDate}T00:00:00Z`) <= Date.parse(`${entry.observedAt}T00:00:00Z`), `${entry.id} cannot be observed before its event`);
  assert.match(entry.sourceUrl, /^https:\/\//);
  assert.match(entry.status, /manual/);
  assert.doesNotMatch(entry.evidence, /guaranteed|will certainly/i, `${entry.id} must not turn forecasts into certainty`);
}

const find = id => data.entries.find(entry => entry.id === id);
const memory = find('memory-contract-outlook-2026-09-30');
assert.match(memory.evidence, /10-15%.*4Q26/i);
assert.match(memory.evidence, /15-20%/i);
assert.match(memory.accessNote, /open press-center article/i);

const hbm = find('hbm-price-and-stack-mix-outlook-2026-09-29');
assert.match(hbm.evidence, /121% year over year/);
assert.match(hbm.operatingMetricImplication, /stack-height mix/i);

const compute = find('compute-gpu-hour-index-2026-10-13');
assert.match(compute.evidence, /\$2\.78 per GPU-hour/);
assert.match(compute.evidence, /\$6\.19 per GPU-hour/);
assert.match(compute.freshnessCaveat, /No independent API polling/);
assert.match(compute.evidence, /chart data was still loading/);

const mlcc = find('mlcc-oem-price-outlook-2026-08-27');
assert.match(mlcc.sourceKind, /estimate/);
assert.match(mlcc.evidence, /not supplier-confirmed/);
assert.match(mlcc.operatingMetricImplication, /need not mean higher unit volume/);

const product = find('murata-100v-10uf-lead-mlcc-2026-08-27');
assert.match(product.evidence, /mass production began in August 2026/);
assert.match(product.operatingMetricImplication, /not proof of material revenue/);

for (const entry of data.entries.filter(item => item.niche === 'ABF and advanced substrates')) {
  assert.match(entry.accessNote, /does not (?:specify|explicitly identify)/i, 'Do not infer ABF where company notices only say IC substrate');
  assert.match(entry.operatingMetricImplication, /utilization|qualification/i);
}

console.log(`Validated ${data.entries.length} dated, source-linked hardware market updates.`);
