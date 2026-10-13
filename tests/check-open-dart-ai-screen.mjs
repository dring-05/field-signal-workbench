import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { deflateRawSync } from 'node:zlib';
import {
  analyzeAiBusinessText, confirmsNameChange, filingUrl, novelAiEvidence, parseCorpRegistry,
  latestFilings, parseDisclosureList, scanOpenDart, unzipTextEntries,
} from '../automation/open-dart-ai-screen.mjs';

const fixture = name => readFile(new URL(`./fixtures/${name}`, import.meta.url));
const xml = await fixture('open-dart-corp-registry.xml');
const currentHtml = await fixture('open-dart-ai-current.html');
const priorHtml = await fixture('open-dart-ai-prior.html');

function zipStored(files) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const [name, contents] of Object.entries(files)) {
    const filename = Buffer.from(name), data = Buffer.from(contents);
    const compressed = deflateRawSync(data);
    const local = Buffer.alloc(30 + filename.length);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(filename.length, 26); filename.copy(local, 30);
    locals.push(local, compressed);
    const central = Buffer.alloc(46 + filename.length);
    central.writeUInt32LE(0x02014b50, 0); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24);
    central.writeUInt16LE(filename.length, 28); central.writeUInt32LE(offset, 42); filename.copy(central, 46);
    centrals.push(central); offset += local.length + compressed.length;
  }
  const centralBytes = Buffer.concat(centrals), localBytes = Buffer.concat(locals);
  const eocd = Buffer.alloc(22); eocd.writeUInt32LE(0x06054b50, 0); eocd.writeUInt16LE(centrals.length, 8); eocd.writeUInt16LE(centrals.length, 10);
  eocd.writeUInt32LE(centralBytes.length, 12); eocd.writeUInt32LE(localBytes.length, 16);
  return Buffer.concat([localBytes, centralBytes, eocd]);
}

const corpZip = zipStored({ 'CORPCODE.xml': xml });
const currentZip = zipStored({ '20261012001234.html': currentHtml });
const priorZip = zipStored({ '20251012009876.html': priorHtml });
const currentReceipt = '20261012001234';
const priorReceipt = '20251012009876';
const seenUrls = [];
const mockFetch = async input => {
  const url = new URL(input); seenUrls.push(url);
  assert.equal(url.searchParams.get('crtfc_key'), 'fixture-user-key');
  if (url.pathname.endsWith('/corpCode.xml')) return new Response(corpZip, { status: 200 });
  if (url.pathname.endsWith('/document.xml')) {
    const receipt = url.searchParams.get('rcept_no');
    return new Response(receipt === currentReceipt ? currentZip : receipt === priorReceipt ? priorZip : Buffer.from(''), { status: 200 });
  }
  if (url.pathname.endsWith('/list.json')) {
    const corpCode = url.searchParams.get('corp_code');
    const payload = corpCode
      ? { status: '000', total_page: 1, list: [{ corp_code: '00123456', corp_name: '이전이름주식회사', stock_code: '012345', corp_cls: 'Y', report_nm: '사업보고서', rcept_no: priorReceipt, rcept_dt: '20251012', flr_nm: 'issuer', rm: '' }] }
      : url.searchParams.get('corp_cls') === 'Y'
        ? { status: '000', total_page: 1, list: [{ corp_code: '00123456', corp_name: '새로운AI주식회사', stock_code: '012345', corp_cls: 'Y', report_nm: '사업보고서', rcept_no: currentReceipt, rcept_dt: '20261012', flr_nm: 'issuer', rm: '' }] }
        : { status: '013', list: [] };
    return Response.json(payload);
  }
  throw new Error(`Unexpected test request ${url.pathname}`);
};

const parsedRegistry = parseCorpRegistry(xml.toString('utf8'));
assert.equal(parsedRegistry[0].company, '새로운AI주식회사');
assert.equal(parsedRegistry[0].stockCode, '012345');
assert.equal(parseDisclosureList({ status: '013', list: [] }).length, 0);
assert.equal(parseDisclosureList({ status: '000', list: [{ corp_code: '00123456', rcept_no: currentReceipt, corp_name: 'Issuer', report_nm: '사업보고서', rcept_dt: '20261012' }] }).length, 1);
assert.deepEqual(latestFilings([{ filingDate: '2026-10-10' }, { filingDate: '2026-10-11' }, { filingDate: '2026-10-12' }], 2).map(row => row.filingDate), ['2026-10-11', '2026-10-12']);
assert.deepEqual(latestFilings([{ filingDate: '2026-10-10' }], 0), []);
const extracted = unzipTextEntries(currentZip);
assert.match(extracted[0].text, /인공지능 데이터센터/);
const currentHits = analyzeAiBusinessText(extracted[0].text);
const priorHits = analyzeAiBusinessText(unzipTextEntries(priorZip)[0].text);
assert.ok(currentHits.length > 0);
assert.ok(priorHits.length > 0);
assert.ok(novelAiEvidence(currentHits, priorHits).length > 0);
assert.equal(confirmsNameChange(unzipTextEntries(currentZip)[0].text, { oldName: '이전이름주식회사', newName: '새로운AI주식회사' }), true);
assert.equal(confirmsNameChange('회사 사업 현황 인공지능 서비스 출시', { oldName: 'old', newName: 'new' }), false);
assert.equal(analyzeAiBusinessText('위험요인: 인공지능 사업은 실패할 수 있으며 매출이 없습니다.').length, 0, 'risk-only mention should not count as business evidence');
assert.equal(filingUrl(currentReceipt), `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${currentReceipt}`);

const result = await scanOpenDart({
  apiKey: 'fixture-user-key', fetchImpl: mockFetch, now: new Date('2026-10-12T12:00:00Z'),
  from: '20261010', to: '20261012',
  feed: { leads: [], checkedReceipts: [], corpRegistry: [{ corpCode: '00123456', company: '이전이름주식회사', stockCode: '012345', modifyDate: '20251010' }] },
});
assert.equal(result.source, 'OpenDART');
assert.equal(result.leads.length, 1);
const lead = result.leads[0];
assert.equal(lead.company, '새로운AI주식회사');
assert.equal(lead.ticker, '012345');
assert.equal(lead.market, 'KRX');
assert.equal(lead.accession, currentReceipt);
assert.match(lead.filingUrl, /dart\.fss\.or\.kr/);
assert.equal(lead.leadType, 'name-change-and-ai-language');
assert.match(lead.label, /New AI-business wording/);
assert.match(lead.label, /Verify effective date/);
assert.equal(lead.reviewedByHuman, false);
assert.ok(result.checkedReceipts.includes(currentReceipt));
assert.ok(result.scanStats.apiCalls >= 5);
assert.ok(!JSON.stringify(result).includes('fixture-user-key'), 'the API key must never be persisted');
assert.ok(seenUrls.every(url => url.searchParams.has('crtfc_key')));
const priorSearch = seenUrls.find(url => url.pathname.endsWith('/list.json') && url.searchParams.has('corp_code'));
assert.equal(priorSearch.searchParams.get('bgn_de'), '20250828', 'prior comparable annual filing search must center around the prior year');
assert.equal(priorSearch.searchParams.get('end_de'), '20251126');
assert.equal((Date.parse('2025-11-26') - Date.parse('2025-08-28')) / 86400000, 90, 'prior filing lookup stays within the documented date-window cap');
assert.match(result.limitations.join(' '), /investment conclusion/);
await assert.rejects(scanOpenDart({ apiKey: '', fetchImpl: async () => { throw new Error('must not call'); } }), /OPENDART_API_KEY/);
await assert.rejects(scanOpenDart({ apiKey: 'fixture-user-key', fetchImpl: mockFetch, from: '20260601', to: '20261012' }), /no longer than 90 days/);
console.log('OpenDART adapter checks passed: registry parsing, Korean ZIP extraction, risk filtering, prior-filing comparison, name baseline, lead schema, secret hygiene, and date bounds.');
