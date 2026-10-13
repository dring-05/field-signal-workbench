import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { STORAGE_KEY, STAGES, normalizeEntry, readState, writeState, gapsFor, importEntries, renderState } = require('../public/capacity-revenue-bridge.js');
assert.equal(STAGES.length, 8);
assert.equal(STORAGE_KEY, 'field-signals-capacity-revenue-bridge-v1');
const base = { id:'power-1', stage:'power', entity:'Utility A', project:'Site North', measure:'Interconnection request', quantity:'125', unit:'MW', period:'2026 Q3', status:'Applied', confidence:'Medium', sourceName:'Utility queue', sourceUrl:'https://example.org/queue', sourceDate:'Sep 2026', gap:'Need project owner confirmation', notes:'Name in utility filing only' };
const power = normalizeEntry(base, []);
assert.equal(power.error, undefined);
assert.equal(power.quantity, 125);
assert.match(normalizeEntry({ ...base, sourceUrl:'javascript:alert(1)' }, []).error, /URL/);
assert.match(normalizeEntry({ ...base, quantity:'1,2,3' }, []).error, /finite number/);
assert.match(normalizeEntry({ ...base, quantity:'4', unit:'' }, []).error, /unit/);
assert.match(normalizeEntry({ ...base, quantity:'', unit:'MW' }, []).error, /Leave the unit blank/);
assert.match(normalizeEntry({ ...base, predecessorId:'missing' }, []).error, /prior record/);
const selfRecord = { ...power, id:'x' };
assert.match(normalizeEntry({ ...base, id:'x', predecessorId:'x' }, [selfRecord]).error, /itself/);
const equipment = normalizeEntry({ ...base, id:'equipment-1', stage:'equipment', entity:'Operator B', predecessorId:power.id, linkLabel:'Named campus and same quarter', linkConfidence:'Low', gap:'No confirmed delivery date' }, [power]);
assert.equal(equipment.predecessorId, power.id);
assert.equal(gapsFor([power, equipment])[1].gaps.includes('No earlier stage linked'), false);
const noQty = normalizeEntry({ ...base, id:'qual-only', quantity:'', unit:'', stage:'permitting', predecessorId:'', gap:'' }, []);
assert.equal(gapsFor([noQty])[0].gaps.includes('No numeric quantity recorded'), true);
assert.equal(gapsFor([noQty])[0].gaps.includes('No next-step gap note'), true);
const zeroQty = normalizeEntry({ ...base, id:'zero-qty', quantity:'0', stage:'permitting' }, []);
assert.equal(gapsFor([zeroQty])[0].gaps.includes('No numeric quantity recorded'), false, 'a reported zero is still a numeric quantity');

const memory = new Map();
const storage = { getItem:key=>memory.get(key)||null, setItem:(key,value)=>memory.set(key,value) };
assert.equal(writeState(storage,{version:1,entries:[power]}),true);
assert.deepEqual(readState(storage).entries.map(x=>x.id),['power-1']);
assert.deepEqual(readState({getItem:()=>'{broken'}).entries,[]);
const current = [{...power,id:'shared'}];
const imported = [
  {...power,id:'shared',stage:'power',predecessorId:''},
  {...equipment,id:'equipment-import',predecessorId:'shared'}
];
const merged = importEntries(current, imported);
assert.equal(merged.added,2);
assert.notEqual(merged.entries[1].id, 'shared', 'imported collisions receive new ids');
assert.equal(merged.entries.at(-1).predecessorId, merged.entries[1].id, 'internal references follow the remapped imported record');
const duplicateIdBackup = importEntries([], [{...power,id:'duplicate'}, {...equipment,id:'duplicate',predecessorId:'duplicate'}]);
assert.equal(duplicateIdBackup.added,1,'duplicate IDs in one backup do not overwrite the remapping or add an ambiguous second record');
assert.equal(renderState([power]).includes('Do not add stage quantities'),true);
assert.equal(renderState([power]).includes('No earlier stage linked'),false);

const source = await readFile(new URL('../public/capacity-revenue-bridge.js', import.meta.url),'utf8');
const context = { window:{} };
vm.runInNewContext(source,context,{timeout:1000});
const moduleApi = context.window.FieldSignalsModules.capacityRevenueBridge;
assert.equal(moduleApi.title,'Capacity to revenue bridge');
assert.match(moduleApi.render(),/recognized revenue/i);
assert.match(moduleApi.render(),/Do not add stage quantities/);
console.log('Capacity-to-revenue bridge checks passed: validation, safe URLs, manual links, gap flags, local persistence, backup collision handling, and browser registration.');
