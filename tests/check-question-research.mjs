import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';

const source = await readFile(new URL('../public/question-research.js', import.meta.url), 'utf8');
const sandbox = { module: { exports: {} }, exports: {}, window: null };
vm.runInNewContext(source, sandbox, { timeout: 1000 });
const api = sandbox.module.exports;
assert.equal(typeof api.render, 'function');
assert.equal(typeof api.attach, 'function');
assert.equal(api.logic.PLAN_KEY, 'field-signals-qr-plans-v1');
assert.equal(api.logic.PROMPT_KEY, 'field-signals-qr-prompt-v1');

const plan = api.logic.normalizePlan({
  question: '  Is regional power availability constraining data-center builds?  ',
  metric: 'Interconnection queue capacity',
  unit: 'MW',
  geography: 'PJM',
  window: 'Quarterly, 2024-2026',
  direction: 'Longer queues and delays',
  falsifier: 'Projects energize on schedule despite queue backlogs',
  unused: 'ignored',
});
assert.equal(plan.question, 'Is regional power availability constraining data-center builds?');
assert.equal(plan.metric, 'Interconnection queue capacity');
assert.equal(plan.unit, 'MW');
assert.equal(plan.geography, 'PJM');
assert.equal(plan.window, 'Quarterly, 2024-2026');
assert.equal(plan.direction, 'Longer queues and delays');
assert.equal(plan.falsifier, 'Projects energize on schedule despite queue backlogs');
assert.equal('unused' in plan, false);

const prompt = api.logic.buildResearchPrompt(
  'Did airline delays worsen?',
  '[R1] BTS on-time data, observed 2026-08, https://www.transtats.bts.gov/',
  'Separate weather from staffing effects',
);
assert.match(prompt, /Did airline delays worsen\?/);
assert.match(prompt, /\[R1\].*2026-08.*https:\/\/www\.transtats\.bts\.gov\//);
assert.match(prompt, /Observations/);
assert.match(prompt, /Inference/);
assert.match(prompt, /do not invent data, dates, coverage, definitions, or citations/i);
assert.match(prompt, /Separate weather from staffing effects/);
assert.match(prompt, /Do not describe a source as real time unless a receipt establishes/);
assert.match(prompt, /what source should be checked/);

const registered = { localStorage: { getItem: () => null }, FieldSignalsModules: {} };
vm.runInNewContext(source, { window: registered, module: undefined }, { timeout: 1000 });
assert.equal(registered.FieldSignalsModules.questionResearch.title, 'Question tools');
assert.equal(typeof registered.FieldSignalsModules.questionResearch.render, 'function');
assert.equal(typeof registered.FieldSignalsModules.questionResearch.attach, 'function');
assert.match(registered.FieldSignalsModules.questionResearch.render(), /Question to measure/);

console.log('Question research checks passed: plan normalization, prompt evidence rules, and module registration.');
