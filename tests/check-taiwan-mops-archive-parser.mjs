import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';

const source = await readFile(new URL('../automation/taiwan-sheets-importer.gs', import.meta.url), 'utf8');
const context = vm.createContext({console, Date, JSON, Math, Number, Object, Set, String, RegExp, Map, Array});
vm.runInContext(source, context, {filename: 'taiwan-sheets-importer.gs'});

const html = `<html><title>公開發行公司115年9月份營業收入統計表</title><table>
<tr><th>公司代號</th><th>公司名稱</th><th>當月營收</th><th>上月營收</th><th>去年當月營收</th><th>上月比較增減</th><th>去年同月增減</th><th>當月累計營收</th><th>去年累計營收</th><th>前期比較增減</th></tr>
<tr><td>0009A0</td><td>永豐金證</td><td>1,000</td><td>900</td><td>800</td><td>11.11</td><td>25</td><td>8,000</td><td>7,000</td><td>14.29</td></tr>
<tr><td>0009B0</td><td>台新證券</td><td>2,000</td><td>1,900</td><td>1,800</td><td>5.26</td><td>11.11</td><td>16,000</td><td>15,000</td><td>6.67</td></tr>
<tr><td>2330</td><td>台積電</td><td>3,000</td><td>2,900</td><td>2,800</td><td>3.45</td><td>7.14</td><td>24,000</td><td>23,000</td><td>4.35</td></tr>
</table></html>`;
const result = context.parseTaiwanMopsArchive_(html, '2026-09', {market: 'Publicly issued (MOPS)', title: /公開發行公司/});
assert.deepEqual(Array.from(result.records, row => row.code), ['0009A0', '0009B0', '2330']);
assert.equal(result.records[0].code, '0009A0', 'alphanumeric codes and leading zeroes must remain strings');
assert.equal(result.records[1].code, '0009B0');

console.log('Taiwan MOPS archive parser checks passed: numeric and alphanumeric issuer codes are retained.');
