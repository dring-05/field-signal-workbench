import assert from 'node:assert/strict';
import {mkdtemp, readFile, readdir, rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {MARKETS, requestForm, runProbe, validateHtmlResponse} from '../automation/taiwan-quarterly-backfill.mjs';

const form = requestForm('sii', 2024, 1);
assert.equal(form.get('TYPEK'), 'sii');
assert.equal(form.get('year'), '113');
assert.equal(form.get('season'), '01');
assert.equal(form.get('isQuery'), 'Y');
assert.equal(requestForm('otc', 2026, 4).get('season'), '04');
assert.throws(() => requestForm('unknown', 2024, 1), /Unsupported market/);
assert.throws(() => validateHtmlResponse('<html>' + 'gateway timeout '.repeat(50) + '</html>', {market: 'sii', period: '2024-Q1'}), /issuer-code header/);
await assert.rejects(runProbe({out: '/tmp/unused', from: '2024-Q1', to: '2026-Q2', markets: ['sii', 'otc'], maxRequests: 1}), /exceeding/);
assert.equal(MARKETS.rotc.cadence, 'semiannual');

const out = await mkdtemp(path.join(os.tmpdir(), 'taiwan-mops-probe-'));
try {
  const calls = [];
  const fakeFetch = async (url, options) => {
    const body = new URLSearchParams(options.body);
    calls.push({url, method: options.method, market: body.get('TYPEK'), year: body.get('year'), quarter: body.get('season')});
    return new Response('<html><table><tr><th>公司代號</th><th>公司名稱</th></tr><tr><td>2330</td><td>台積電</td></tr><tr><td>說明</td><td>' + '回應內容 '.repeat(80) + '</td></tr></table></html>', {status: 200});
  };
  const result = await runProbe({out, from: '2024-Q1', to: '2024-Q2', markets: ['sii', 'otc', 'rotc', 'pub'], maxRequests: 6, delayMs: 1000}, fakeFetch);
  assert.equal(result.planned, 6, 'R/P should only request their reported Q2 and Q4 periods');
  assert.equal(result.added, 6);
  assert.equal(calls.length, 6);
  assert.ok(calls.every(call => call.method === 'POST'));
  assert.equal(calls.filter(call => ['rotc', 'pub'].includes(call.market) && call.quarter === '01').length, 0);
  assert.equal(calls.filter(call => ['rotc', 'pub'].includes(call.market) && call.quarter === '02').length, 2);
  assert.ok(result.results.some(row => row.observationCadence === 'semiannual'));
  assert.ok(result.results.every(row => row.extractionStatus === 'not-parsed-live-shape-unverified'));
  const files = await readdir(out);
  assert.equal(files.filter(name => name.endsWith('.html')).length, 6);
  const manifest = await readFile(path.join(out, 'probe-manifest.jsonl'), 'utf8');
  assert.equal(manifest.trim().split('\n').length, 6);
  const rerun = await runProbe({out, from: '2024-Q1', to: '2024-Q2', markets: ['sii', 'otc', 'rotc', 'pub'], maxRequests: 6, delayMs: 1000}, fakeFetch);
  assert.equal(rerun.added, 0, 'existing successful report partitions should resume without re-fetching');
  assert.equal(calls.length, 6);
} finally {
  await rm(out, {recursive: true, force: true});
}

console.log('Taiwan quarterly MOPS probe checks passed. These tests use a synthetic response and do not validate the live provider response schema.');
