import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { STORAGE_KEY, validDate, safeUrl, normalizeSource, normalizeObservation, getStatus, readState, writeState } = require('../public/source-freshness.js');

assert.equal(validDate('2026-10-12'), true);
assert.equal(validDate('2026-02-31'), false);
assert.equal(safeUrl('javascript:alert(1)'), '');
assert.equal(safeUrl('https://provider.example/report'), 'https://provider.example/report');

const source = normalizeSource({ name: 'Monthly revenue filing', provider: 'Issuer regulator', sector: 'Taiwan semiconductors', cadence: 'monthly', expectedPeriod: '2026-09', expectedBy: '2026-10-10', graceDays: '5', sourceUrl: 'https://provider.example' }, 'source-1');
assert.equal(source.cadenceDays, 31);
assert.equal(source.expectedPeriod, '2026-09');
assert.match(normalizeSource({ name: 'x', cadence: 'custom', cadenceDays: '0', graceDays: 0 }, 'x').error, /cadence length/);
assert.match(normalizeSource({ name: 'x', cadence: 'weekly', expectedBy: '2026-02-31' }, 'x').error, /expected release date/);
assert.match(normalizeSource({ name: 'x', cadence: 'weekly', sourceUrl: 'javascript:alert(1)' }, 'x').error, /HTTP or HTTPS/);

const onTime = normalizeObservation({ checkedOn: '2026-10-12', observedPeriod: '2026-09', observationState: 'observed', evidenceUrl: 'https://provider.example/data', note: 'Release posted this morning.' });
const oldCheck = normalizeObservation({ checkedOn: '2026-08-01', observedPeriod: '2026-06', observationState: 'observed' });
const revision = normalizeObservation({ checkedOn: '2026-10-12', observedPeriod: '2026-09', observationState: 'observed', revised: true });
const missing = normalizeObservation({ checkedOn: '2026-10-12', observationState: 'missing' });
assert.equal(normalizeObservation({ checkedOn: 'bad', observedPeriod: 'Q2' }).error, 'Enter the date you checked the source.');
assert.match(normalizeObservation({ checkedOn: '2026-10-12', observationState: 'observed' }).error, /latest period/);

assert.deepEqual(getStatus({ ...source, cadenceDays: 31 }, [onTime], '2026-10-12').flags, []);
assert.deepEqual(getStatus({ ...source, cadenceDays: 31 }, [oldCheck], '2026-10-20').flags, ['late', 'stale']);
assert.deepEqual(getStatus({ ...source, cadenceDays: 31 }, [revision], '2026-10-20').flags, ['revised']);
assert.deepEqual(getStatus({ ...source, cadenceDays: 31 }, [missing], '2026-10-20').flags, ['missing']);
assert.deepEqual(getStatus({ ...source, cadenceDays: 31 }, [], '2026-10-20').flags, ['missing']);
assert.deepEqual(getStatus({ ...source, cadenceDays: 31 }, [], '2026-10-12').flags, ['not-checked']);
assert.deepEqual(getStatus({ ...source, cadenceDays: 31 }, [], '2026-10-14').flags, ['not-checked']);
assert.deepEqual(getStatus({ ...source, cadenceDays: 31 }, [], '2026-10-15').flags, ['missing']);
assert.deepEqual(getStatus({ ...source, expectedBy: '2026-10-20', cadenceDays: 31 }, [], '2026-10-12').flags, ['not-checked']);
assert.deepEqual(getStatus({ ...source, cadence: 'event-driven', cadenceDays: 0, expectedPeriod: '', expectedBy: '' }, [oldCheck], '2026-10-12').flags, []);

const storage = new Map();
const fakeStorage = { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value) };
assert.deepEqual(readState(fakeStorage).sources, []);
const state = { sources: [{ ...source, observations: [onTime] }] };
assert.equal(writeState(fakeStorage, state), true);
assert.equal(readState(fakeStorage).sources[0].observations[0].observedPeriod, '2026-09');
assert.equal(STORAGE_KEY, 'fieldSignals.sourceFreshness.v1');

const sourceText = await readFile(new URL('../public/source-freshness.js', import.meta.url), 'utf8');
const browserStorage = new Map();
const browser = { window: { localStorage: { getItem: key => browserStorage.get(key) ?? null, setItem: (key, value) => browserStorage.set(key, value) }, URL, document: { createElement: () => ({ click() {}, set href(value) { this.savedHref = value; }, set download(value) { this.savedName = value; } }) }, Blob: globalThis.Blob } };
vm.runInNewContext(sourceText, browser, { timeout: 1000 });
assert.equal(browser.window.FieldSignalsModules.sourceFreshness.title, 'Source freshness monitor');
assert.match(browser.window.FieldSignalsModules.sourceFreshness.render(), /does not poll providers/);
assert.equal(typeof browser.window.FieldSignalsModules.sourceFreshness.attach, 'function');
console.log('Source freshness checks passed: cadence inputs, date and URL validation, late/missing/revised/stale states, local storage, and module registration.');
