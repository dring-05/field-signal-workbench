import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const sourcePath = new URL('../automation/taiwan-sheets-importer.gs', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const context = vm.createContext({console, Date, JSON, Math, Number, Object, Set, String, RegExp});
vm.runInContext(source, context, {filename: 'taiwan-sheets-importer.gs'});

const existing = [
  'Listed (TWSE)', '2330', '台積電', 'Semiconductors', '2026-09',
  1000000, 980000, 800000, 2.04, 25, 9000000, 7000000, 28.57,
  'TWD thousands, as published', 'https://example.test/monthly.csv', new Date('2026-10-12T00:00:00Z'),
  JSON.stringify({'公司代號':'2330','公司名稱':'台積電','資料年月':'11509','出表日期':'2026/10/12','營業收入-當月營收':'1000000'})
];

function makeSheet(rows) {
  const writes = [];
  return {
    writes,
    getLastRow: () => rows.length + 4,
    getRange(row, column, count, width) {
      return {
        getValues: () => rows.slice(row - 5, row - 5 + count).map(value => value.slice(column - 1, column - 1 + width)),
        setValues(values) { writes.push({row, column, values}); }
      };
    }
  };
}

const sameEconomicsSheet = makeSheet([existing]);
const unchanged = context.appendMonthlyRevisions_(sameEconomicsSheet, [{
  market: 'Listed (TWSE)', code: '2330', name: '台積電', industry: 'Semiconductors', period: '2026-09',
  // Provider formatting and export metadata may change between daily reads.
  // Neither should turn the same monthly economic observation into a revision.
  current: '1,000,000', prior: '980 000', yearAgo: 800000, mom: 2.04, yoy: 25,
  ytd: 9000000, priorYtd: 7000000, ytdGrowth: 28.57,
  sourceUrl: 'https://example.test/monthly.csv',
  raw: {'公司代號':'2330','公司名稱':'台積電','資料年月':'11509','出表日期':'2026/10/18','匯出時間':'later','營業收入-當月營收':'1000000'}
}]);
assert.equal(unchanged, 0, 'a changed export date or extra metadata must not create a new economic revision');
assert.equal(sameEconomicsSheet.writes.length, 0);

const changedEconomicsSheet = makeSheet([existing]);
const revised = context.appendMonthlyRevisions_(changedEconomicsSheet, [{
  market: 'Listed (TWSE)', code: '2330', name: '台積電', industry: 'Semiconductors', period: '2026-09',
  current: 1000001, prior: 980000, yearAgo: 800000, mom: 2.04, yoy: 25,
  ytd: 9000000, priorYtd: 7000000, ytdGrowth: 28.57,
  sourceUrl: 'https://example.test/monthly.csv', raw: {'公司代號':'2330','營業收入-當月營收':'1000001'}
}]);
assert.equal(revised, 1, 'a changed reported economic value must remain an append-only revision');
assert.equal(changedEconomicsSheet.writes[0].values[0][5], 1000001);

const stableRaw = context.stableRawRecordJson_({b: 2, '出表日期': '2026/10/18', a: 1, '更新時間': 'later'});
assert.equal(stableRaw, '{"a":1,"b":2}', 'volatile export metadata is excluded from raw-record signatures');

console.log('Taiwan importer dedup checks passed.');
