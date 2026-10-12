import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/notebooks-mindchange.js', import.meta.url), 'utf8');
const stored = new Map();
const localStorage = {
  getItem(key) { return stored.has(key) ? stored.get(key) : null; },
  setItem(key, value) { stored.set(key, String(value)); }
};
const window = { localStorage };
vm.runInNewContext(source, { window, URL, Date, Math }, { timeout: 1000 });
const module = window.FieldSignalsModules.notebooks;
assert.equal(module.title, 'Signal notebooks');
assert.match(source, /What would change my mind\?/);
assert.match(source, /Evidence that weakens the thesis/);
assert.match(module.render(), /Saved in this browser only/);
assert.doesNotMatch(source, /fetch\s*\(/, 'Notebook module should not fetch external data');
assert.match(source, /field-signals-nb-/);
assert.doesNotMatch(module.render(), /delete|reset/i, 'Module should not present destructive controls');

function makeContainer() {
  const handlers = {};
  return {
    innerHTML: '',
    addEventListener(name, handler) { handlers[name] = handler; },
    dispatch(name, event) { handlers[name](event); }
  };
}
function form(action, values) {
  return {
    getAttribute(name) { return name === 'data-form' ? action : null; },
    elements: { namedItem(name) { return { value: values[name] ?? '' }; } }
  };
}

const container = makeContainer();
module.attach(container);
let prevented = false;
container.dispatch('submit', {
  target: form('create-notebook', {
    'notebook-name': 'GPU supply',
    'research-question': '<script>is quote growth easing?'
  }),
  preventDefault() { prevented = true; }
});
assert.equal(prevented, true);
assert.match(container.innerHTML, /GPU supply/);
assert.doesNotMatch(container.innerHTML, /<script>/, 'Notebook titles and questions must be escaped');
assert.match(container.innerHTML, /&lt;script&gt;/);

container.dispatch('submit', {
  target: form('add-entry', {
    date: '2026-10-12',
    'source-url': 'https://example.com/quotes',
    observation: 'Quoted H100 rates fell 8 percent.',
    support: 'Lower quotes may reflect more available supply.',
    disconfirming: 'The sample has fewer providers this month.',
    falsifier: 'Several providers report rising utilization while prices fall.'
  }),
  preventDefault() {}
});
assert.match(container.innerHTML, /Quoted H100 rates fell 8 percent\./);
assert.match(container.innerHTML, /Lower quotes may reflect more available supply\./);
assert.match(container.innerHTML, /The sample has fewer providers this month\./);
assert.match(container.innerHTML, /Several providers report rising utilization while prices fall\./);
assert.match(container.innerHTML, /<a href="https:\/\/example\.com\/quotes/);
assert.equal(stored.size, 1);
assert.equal([...stored.keys()][0], 'field-signals-nb-notebooks-v1');
const firstNotebookId = JSON.parse(stored.get('field-signals-nb-notebooks-v1')).notebooks[0].id;
container.dispatch('submit', {
  target: form('create-notebook', {
    'notebook-name': 'Store traffic',
    'research-question': 'Are visits gaining across the peer set?'
  }),
  preventDefault() {}
});
const stateWithTwo = JSON.parse(stored.get('field-signals-nb-notebooks-v1'));
assert.equal(stateWithTwo.notebooks.length, 2);
container.dispatch('change', { target: { name: 'active-notebook', value: firstNotebookId } });
assert.match(container.innerHTML, /GPU supply/);
assert.match(container.innerHTML, /Quoted H100 rates fell 8 percent\./);

const invalidContainer = makeContainer();
module.attach(invalidContainer);
invalidContainer.dispatch('submit', {
  target: form('add-entry', {
    date: '2026-10-12', 'source-url': 'javascript:alert(1)', observation: 'bad link'
  }),
  preventDefault() {}
});
assert.match(invalidContainer.innerHTML, /valid date, observation, and http or https source URL/);
assert.doesNotMatch(invalidContainer.innerHTML, /javascript:/);

const selectionContainer = makeContainer();
module.attach(selectionContainer);
const state = JSON.parse(stored.get('field-signals-nb-notebooks-v1'));
assert.equal(state.notebooks.length, 2);
assert.equal(state.notebooks[0].entries.length, 1);
assert.equal(state.notebooks[0].entries[0].sourceUrl, 'https://example.com/quotes');
selectionContainer.dispatch('change', { target: { name: 'active-notebook', value: state.notebooks[0].id } });
assert.equal(JSON.parse(stored.get('field-signals-nb-notebooks-v1')).activeId, state.notebooks[0].id);

console.log('Signal notebook checks passed: multiple-notebook schema, two-sided evidence, source validation, escaping, local persistence, and selection.');
