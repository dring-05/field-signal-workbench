import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
const index=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
const files=['messy-data-inbox.js','capacity-constraint-tracker.js','hardware-market-change-log.js','thesis-evidence-ledger.js'];
const context=vm.createContext({window:{},URL,Date,Math,JSON,Map,Set,Blob,console});
for(const file of files){
  assert.ok(index.includes(`src="${file}"`),`${file} must load before app.js`);
  const source=await readFile(new URL(`../public/${file}`,import.meta.url),'utf8');
  vm.runInContext(source,context,{timeout:1000,filename:file});
}
const registry=context.window.FieldSignalsModules;
for(const key of ['messyDataInbox','capacityConstraintTracker','hardwareMarketChangeLog','thesisEvidenceLedger'])assert.equal(typeof registry[key]?.attach,'function',`${key} registers an attachable panel`);
assert.match(registry.messyDataInbox.title,/Messy-data staging inbox/);
assert.match(registry.capacityConstraintTracker.title,/Capacity constraint tracker/);
assert.match(registry.hardwareMarketChangeLog.title,/Hardware market change log/);
assert.match(registry.thesisEvidenceLedger.title,/Thesis evidence ledger/);
console.log('Workflow integration checks passed: all four modules load and register before app boot.');
