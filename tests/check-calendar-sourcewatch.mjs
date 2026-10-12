import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { normalizeEvent, normalizeCheck, safeUrl, EVENT_KEY, CHECK_KEY } = require('../public/calendar-sourcewatch.js');

assert.equal(safeUrl('javascript:alert(1)'), '');
assert.equal(safeUrl('https://example.com/a'), 'https://example.com/a');
assert.deepEqual(normalizeEvent({ eventDate: '2026-99-99', company: 'A', catalyst: 'B' }), { error: 'Use a valid YYYY-MM-DD event date.' });
assert.deepEqual(normalizeEvent({ eventDate: '2026-10-12', company: 'A', catalyst: 'B', sourceUrls: 'https://one.example\njavascript:alert(1)' }), {
  eventDate: '2026-10-12', company: 'A', catalyst: 'B', expectedMetric: '', relatedSignals: '', sources: ['https://one.example/'], createdAt: ''
});
assert.deepEqual(normalizeCheck({ status: 'auto-detected', sourceName: 'Example' }), { error: 'Choose changed, stale, or unchanged.' });
assert.equal(normalizeCheck({ status: 'changed', sourceName: 'Example', checkedDate: '2026-10-12', priorNote: 'Prior', latestNote: 'Latest' }).status, 'changed');

const source = await readFile(new URL('../public/calendar-sourcewatch.js', import.meta.url), 'utf8');
assert.match(source, /window/);
const saved = new Map();
const values = {
  eventDate: { value: '' }, company: { value: 'Acme' }, catalyst: { value: 'Earnings' }, expectedMetric: { value: 'Units' }, relatedSignals: { value: 'Shipments' }, eventSources: { value: 'https://example.com' },
  sourceName: { value: 'Provider' }, checkedDate: { value: '' }, sourceUrl: { value: 'https://provider.example' }, status: { value: 'changed' }, priorNote: { value: 'Old note' }, latestNote: { value: 'New note' },
  events: { innerHTML: '' }, checks: { innerHTML: '' }, eventStatus: { textContent: '' }, checkStatus: { textContent: '' }
};
const forms = {};
const container = { querySelector(selector) { return values[selector.match(/"([^"]+)"/)[1]]; } };
for (const formName of ['eventForm', 'checkForm']) forms[formName] = { addEventListener(name, fn) { assert.equal(name, 'submit'); this.handler = fn; } };
values.eventForm = forms.eventForm;
values.checkForm = forms.checkForm;
for (const form of Object.values(forms)) form.reset = () => {};
const browser = { URL, window: { localStorage: { getItem(key) { return saved.get(key) ?? null; }, setItem(key, value) { saved.set(key, value); } } } };
vm.runInNewContext(source, browser, { timeout: 1000 });
const moduleApi = browser.window.FieldSignalsModules.calendarWatch;
assert.equal(moduleApi.title, 'Catalyst and source watch');
assert.match(moduleApi.render(), /Catalyst calendar/);
assert.match(moduleApi.render(), /Nothing polls providers/);
moduleApi.attach(container);
const fakeEvent = { preventDefault() {}, target: forms.eventForm };
forms.eventForm.handler(fakeEvent);
assert.equal(JSON.parse(saved.get(EVENT_KEY)).length, 1);
assert.match(values.events.innerHTML, /Acme/);
assert.match(values.events.innerHTML, /example.com/);
const fakeCheck = { preventDefault() {}, target: forms.checkForm };
forms.checkForm.handler(fakeCheck);
const check = JSON.parse(saved.get(CHECK_KEY))[0];
assert.equal(check.status, 'changed');
assert.equal(check.priorNote, 'Old note');
assert.equal(check.latestNote, 'New note');
assert.match(values.checks.innerHTML, /Provider/);
assert.match(values.checks.innerHTML, /changed/);
console.log('Catalyst and source-watch checks passed: validation, safe links, manual status records, browser storage, and rendered lists.');
