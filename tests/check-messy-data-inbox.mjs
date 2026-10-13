import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../public/messy-data-inbox.js', import.meta.url), 'utf8');
const context = {Date, Math, JSON, Object, String, Array, Map, RegExp};
vm.runInNewContext(source, context, {timeout:1000});
const inbox = context.FieldSignalsMessyInbox;

assert.deepEqual(JSON.parse(JSON.stringify(inbox.parseDelimited('\uFEFFReport,Monthly\r\nDate,Value,Note\r\n2026-09,12,"said ""up, 4"""').rows)), [
  ['Report','Monthly'], ['Date','Value','Note'], ['2026-09','12','said "up, 4"']
]);
assert.equal(inbox.parseDelimited('Date\tValue\n2026-09\t12').delimiter, '\t');
assert.equal(inbox.parseDelimited('Name;Value\nA;1').delimiter, ';');
assert.deepEqual(JSON.parse(JSON.stringify(inbox.inferMappings(['Report date','Ticker','Revenue USD','Region']))), {
  date:0, entity:1, value:2, metric:-1, unit:-1, geography:3
});
const parsedBatch = inbox.parseDelimited('Notes,,,,\nDate,Ticker,Revenue,Unit\n2026-09,2330,100,TWD');
const batch = inbox.makeBatch(parsedBatch, 1, {date:0,entity:1,value:2,unit:3}, {sourceName:'MOPS',sourceUrl:'https://example.test/data',observationDate:'2026-09-10'}, 'monthly.csv', '2026-09-13T12:00:00.000Z');
assert.deepEqual(JSON.parse(JSON.stringify(batch.rawRows)), [['Notes','','','',''], ['Date','Ticker','Revenue','Unit'], ['2026-09','2330','100','TWD']]);
assert.deepEqual(JSON.parse(JSON.stringify(batch.records[0].rawCells)), ['2026-09','2330','100','TWD']);
assert.equal(batch.sourceUrl, 'https://example.test/data');
assert.equal(batch.observationDate, '2026-09-10');
assert.equal(inbox.applyCorrection(batch, 0, 2, '101', '2026-09-13T13:00:00.000Z'), true);
assert.equal(batch.records[0].rawCells[2], '100', 'correction must preserve the source value');
assert.equal(batch.records[0].cells[2], '101');
assert.deepEqual(JSON.parse(JSON.stringify(batch.audit[0])), {at:'2026-09-13T13:00:00.000Z',row:0,column:2,columnName:'Revenue',before:'100',after:'101'});
assert.equal(inbox.applyCorrection(batch, 0, 2, '101'), false, 'no-op edits should not create audit noise');
assert.match(inbox.render(), /Nothing is uploaded/);
assert.equal(inbox.storageKey, 'field-signals-messy-data-inbox-v1');
assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|sendBeacon|WebSocket/);

console.log('Messy data inbox checks passed: quoted CSV, TSV, semicolon, mappings, local-only copy and no network transport.');
