#!/usr/bin/env node
/**
 * Korea OpenDART disclosure screen for human review. It identifies selected
 * AI-business language and corporate-name changes; it does not make investment
 * conclusions. API calls are made only when explicitly run with a supplied key.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';

const BASE = 'https://opendart.fss.or.kr/api';
const LIST_URL = `${BASE}/list.json`;
const REGISTRY_URL = `${BASE}/corpCode.xml`;
const DOCUMENT_URL = `${BASE}/document.xml`;
const MAX_ZIP_BYTES = 32 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED = 80 * 1024 * 1024;
const AI_TERMS = [
  /artificial intelligence/gi, /generative\s+AI/gi, /large language models?/gi,
  /\bAI[- ](?:business|service|product|platform|solution|model|infrastructure|chip|semiconductor|data center|computing)\b/gi,
  /인공지능/g, /생성형\s*AI/g, /대규모\s*언어\s*모델/g, /AI\s*(?:사업|서비스|제품|플랫폼|솔루션|모델|인프라|반도체|데이터센터|컴퓨팅)/gi,
];
const BUSINESS_CONTEXT = /customer|commercial|revenue|product|service|business|segment|contract|facility|compute|GPU|operation|deploy|capital|manufactur|sales|사업|매출|고객|제품|서비스|계약|공급|판매|개발|시설|투자|플랫폼|데이터센터|반도체|생산|수주|양산|영업|출시|운영|구축/i;
const RISK_CONTEXT = /risk factors|forward-looking statements|위험요인|위험 요소|미래예측정보/i;
const AI_NEGATION = /\b(?:not|never|no longer|does not|do not|did not|has not|have not|had not|will not|cannot|without|no|not yet)\b|(?:하지\s*않|되지\s*않|있지\s*않|없(?:다|습니다|음|는|으며|고)?|아니(?:다|라고|며)?|미제공|중단)/i;
const NAME_CHANGE_CONTEXT = /상호.{0,20}(?:변경|정정)|회사명.{0,20}(?:변경|정정)|name change|change of (?:the )?company name|changed its name/i;

function safeDate(value, label) {
  if (!/^\d{8}$/.test(value ?? '')) throw new Error(`${label} must use YYYYMMDD`);
  const y = Number(value.slice(0, 4)), m = Number(value.slice(4, 6)), d = Number(value.slice(6, 8));
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) throw new Error(`${label} is not a valid date`);
  return date;
}
const ymd = date => date.toISOString().slice(0, 10);
const compactDate = date => ymd(date).replaceAll('-', '');

export function parseDisclosureList(payload) {
  if (!payload || !['000', '013'].includes(String(payload.status))) {
    if (payload?.status === '013') return [];
    throw new Error(`OpenDART disclosure search failed (status ${String(payload?.status ?? 'missing')}); verify key, date range and request limits`);
  }
  return (payload.list ?? []).flatMap(row => {
    const receipt = String(row.rcept_no ?? '');
    const corpCode = String(row.corp_code ?? '').padStart(8, '0');
    if (!/^\d{14}$/.test(receipt) || !/^\d{8}$/.test(corpCode)) return [];
    return [{
      corpCode, company: String(row.corp_name ?? '').trim(), stockCode: String(row.stock_code ?? '').trim(),
      exchangeClass: String(row.corp_cls ?? ''), report: String(row.report_nm ?? '').trim(),
      receipt, filingDate: String(row.rcept_dt ?? ''), filer: String(row.flr_nm ?? '').trim(),
      remarks: String(row.rm ?? '').trim(),
    }];
  });
}

function xmlDecode(value) {
  return String(value).replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

export function parseCorpRegistry(xml) {
  const records = [];
  for (const match of String(xml ?? '').matchAll(/<list>([\s\S]*?)<\/list>/gi)) {
    const fields = Object.fromEntries([...match[1].matchAll(/<(corp_code|corp_name|corp_eng_name|stock_code|modify_date)>([\s\S]*?)<\/\1>/gi)]
      .map(([, key, value]) => [key, xmlDecode(value.trim())]));
    if (!/^\d{8}$/.test(fields.corp_code ?? '') || !fields.corp_name) continue;
    records.push({ corpCode: fields.corp_code, company: fields.corp_name, companyEnglish: fields.corp_eng_name ?? '', stockCode: fields.stock_code ?? '', modifyDate: fields.modify_date ?? '' });
  }
  return records;
}

export function plainText(input) {
  return String(input ?? '').replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Read simple, non-Zip64, unencrypted ZIP records from OpenDART's archive. */
export function unzipTextEntries(buffer) {
  const zip = Buffer.from(buffer);
  if (!zip.length || zip.length > MAX_ZIP_BYTES) throw new Error('OpenDART document archive is empty or exceeds the 32 MB safety limit');
  const eocd = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  if (eocd < 0 || eocd + 22 > zip.length) throw new Error('OpenDART document response was not a supported ZIP archive');
  const count = zip.readUInt16LE(eocd + 10);
  let cursor = zip.readUInt32LE(eocd + 16);
  const entries = [];
  let total = 0;
  for (let i = 0; i < count; i++) {
    if (zip.readUInt32LE(cursor) !== 0x02014b50) throw new Error('Malformed ZIP central directory');
    const flags = zip.readUInt16LE(cursor + 8), method = zip.readUInt16LE(cursor + 10);
    const compressedSize = zip.readUInt32LE(cursor + 20), size = zip.readUInt32LE(cursor + 24);
    const nameLength = zip.readUInt16LE(cursor + 28), extraLength = zip.readUInt16LE(cursor + 30), commentLength = zip.readUInt16LE(cursor + 32);
    const localOffset = zip.readUInt32LE(cursor + 42);
    const name = zip.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8');
    cursor += 46 + nameLength + extraLength + commentLength;
    if ((flags & 1) || ![0, 8].includes(method)) continue;
    if (!/\.(?:html?|xml|txt)$/i.test(name) || name.endsWith('/')) continue;
    total += size;
    if (total > MAX_TOTAL_UNCOMPRESSED) throw new Error('OpenDART archive exceeds the 80 MB uncompressed safety limit');
    if (zip.readUInt32LE(localOffset) !== 0x04034b50) throw new Error('Malformed ZIP local-file header');
    const localNameLen = zip.readUInt16LE(localOffset + 26), localExtraLen = zip.readUInt16LE(localOffset + 28);
    const start = localOffset + 30 + localNameLen + localExtraLen;
    const compressed = zip.subarray(start, start + compressedSize);
    const bytes = method === 0 ? compressed : inflateRawSync(compressed, { maxOutputLength: Math.min(size + 1, MAX_TOTAL_UNCOMPRESSED) });
    if (bytes.length !== size) throw new Error(`ZIP size mismatch for ${name}`);
    const header = bytes.subarray(0, 512).toString('ascii');
    const encoding = /encoding\s*=\s*["'](?:euc-kr|ks_c_5601-1987)/i.test(header) || /charset\s*=\s*["']?euc-kr/i.test(header) ? 'euc-kr' : 'utf-8';
    const decoded = new TextDecoder(encoding, { fatal: false }).decode(bytes);
    entries.push({ name, raw: decoded, text: plainText(decoded) });
  }
  return entries;
}

function sentenceAround(text, index, length) {
  const left = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('。', index), text.lastIndexOf('!', index), text.lastIndexOf('?', index)) + 1;
  const ends = ['.', '。', '!', '?'].map(mark => text.indexOf(mark, index + length)).filter(pos => pos >= 0);
  const right = ends.length ? Math.min(...ends) : Math.min(text.length, index + length + 450);
  return text.slice(left, right).trim().slice(0, 700);
}

export function analyzeAiBusinessText(text) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ');
  const hits = [];
  for (const pattern of AI_TERMS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(normalized))) {
      const context = normalized.slice(Math.max(0, match.index - 230), Math.min(normalized.length, match.index + match[0].length + 230));
      const sentence = sentenceAround(normalized, match.index, match[0].length);
      if (!BUSINESS_CONTEXT.test(sentence) || RISK_CONTEXT.test(sentence)) continue;
      if (isExplicitlyNegatedAiPassage(sentence, match[0])) continue;
      if (!hits.some(hit => hit.sentence === sentence)) hits.push({ term: match[0], sentence, context: context.trim() });
      if (hits.length >= 30) return hits;
    }
  }
  return hits;
}

function isExplicitlyNegatedAiPassage(sentence, term) {
  const clauses = String(sentence ?? '').split(/[;,。]|\b(?:but|though|however|although|whereas|while|except|unless)\b|(?:하지만|그러나|반면|다만|단,)/i);
  return clauses.some(clause => {
    const value = clause.trim();
    if (!value.toLowerCase().includes(String(term ?? '').toLowerCase())) return false;
    const negation = value.match(AI_NEGATION);
    return Boolean(negation && Math.abs(value.toLowerCase().indexOf(String(term).toLowerCase()) - negation.index) <= 180);
  });
}

const tokens = hit => new Set((String(hit.sentence ?? '').toLowerCase().match(/[a-z][a-z0-9-]{2,}|[가-힣]{2,}/g) ?? [])
  .filter(word => !['company', 'business', '사업', '회사', '계획', '예정'].includes(word)));

export function novelAiEvidence(current, previous) {
  if (!current?.length || previous === null) return [];
  if (!previous.length) return current;
  const older = previous.map(tokens).filter(set => set.size >= 2);
  return current.filter(hit => {
    const now = tokens(hit);
    if (now.size < 2) return false;
    let best = 0, minNew = now.size;
    for (const before of older) {
      const shared = [...now].filter(word => before.has(word)).length;
      const similarity = shared / new Set([...now, ...before]).size;
      best = Math.max(best, similarity); minNew = Math.min(minNew, now.size - shared);
    }
    return minNew >= 2 && best < 0.55;
  });
}

export function confirmsNameChange(text, change) {
  if (!change || !NAME_CHANGE_CONTEXT.test(String(text ?? ''))) return false;
  const normalized = String(text).toLocaleLowerCase();
  const oldName = String(change.oldName ?? '').toLocaleLowerCase();
  const newName = String(change.newName ?? '').toLocaleLowerCase();
  return Boolean(oldName && newName && normalized.includes(oldName) && normalized.includes(newName));
}

function formatReportFamily(report) {
  const normalized = report.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/사업보고서/.test(normalized)) return 'annual';
  if (/반기보고서/.test(normalized)) return 'half-year';
  if (/분기보고서/.test(normalized)) return `quarter-${normalized.match(/(1|2|3)분기/)?.[1] ?? 'unknown'}`;
  return normalized.replace(/\b\d{4}\b/g, '#').slice(0, 120);
}

export function filingUrl(receipt) { return `https://dart.fss.or.kr/dsaf001/main.do?rcpNo=${encodeURIComponent(receipt)}`; }

/** Keep the newest filings when a busy date range exceeds the request budget. */
export function latestFilings(rows, maxFilings) {
  const limit = Math.max(0, Math.min(1000, Number(maxFilings) || 0));
  return limit ? rows.slice(-limit) : [];
}

function leadFor(row, aiHits, novelHits, priorAvailable, nameChange) {
  const changeLabel = nameChange ? `Official registry name differs from the saved baseline: ${nameChange.oldName} → ${nameChange.newName}. Verify effective date and legal change in the linked filing.` : '';
  let aiLabel = '';
  if (aiHits.length) {
    if (priorAvailable && novelHits.length) aiLabel = 'New AI-business wording versus the comparable prior filing. Language screen only; review the source filing.';
    else if (!priorAvailable) aiLabel = 'AI-business language detected; comparable prior filing unavailable. Review the source filing.';
  }
  if (!changeLabel && !aiLabel) return null;
  const label = [changeLabel, aiLabel].filter(Boolean).join(' ');
  return {
    source: 'OpenDART', market: 'KRX', issuerId: row.corpCode, corpCode: row.corpCode,
    company: row.company, mappedCompany: row.company, ticker: row.stockCode,
    stockCode: row.stockCode, exchange: row.exchangeClass, form: row.report,
    filingDate: `${row.filingDate.slice(0, 4)}-${row.filingDate.slice(4, 6)}-${row.filingDate.slice(6, 8)}`,
    accession: row.receipt, filingUrl: filingUrl(row.receipt), leadType: nameChange && aiLabel ? 'name-change-and-ai-language' : nameChange ? 'possible-name-change' : 'ai-language-change',
    label, evidence: novelHits.length ? novelHits.slice(0, 5).map(hit => hit.sentence) : aiHits.slice(0, 5).map(hit => hit.sentence),
    currentAiMentions: aiHits.length, priorComparableAiMentions: priorAvailable ? (row.priorHits?.length ?? 0) : null,
    reviewedByHuman: false,
  };
}

async function requestJson(fetchImpl, url) {
  const response = await fetchImpl(url, { headers: { Accept: 'application/json, application/xml, application/zip' }, signal: AbortSignal.timeout(45000) });
  if (!response.ok) throw new Error(`OpenDART request failed (${response.status})`);
  return response;
}

export async function scanOpenDart({ apiKey, fetchImpl = fetch, feed = {}, from, to, maxFilings = 150, maxApiCalls = 1200, now = new Date() } = {}) {
  if (typeof apiKey !== 'string' || apiKey.trim().length < 8) throw new Error('Set OPENDART_API_KEY to a key obtained by the user from OpenDART. The key is never saved in the output.');
  const end = to ? safeDate(to, 'to') : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const start = from ? safeDate(from, 'from') : new Date(end.getTime() - 6 * 86400000);
  const days = Math.ceil((end - start) / 86400000);
  if (days < 0 || days > 90) throw new Error('Date range must be ordered and no longer than 90 days');
  const call = async (base, params = {}) => {
    if (++callCount > maxApiCalls) throw new Error(`OpenDART API call cap reached (${maxApiCalls})`);
    const url = new URL(base);
    url.searchParams.set('crtfc_key', apiKey.trim());
    for (const [key, value] of Object.entries(params)) if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    return requestJson(fetchImpl, url);
  };
  let callCount = 0;
  const registryResponse = await call(REGISTRY_URL);
  const registryBuffer = Buffer.from(await registryResponse.arrayBuffer());
  if (registryBuffer.length > MAX_ZIP_BYTES) throw new Error('OpenDART company registry archive exceeds the 32 MB safety limit');
  const registryZip = unzipTextEntries(registryBuffer);
  // OpenDART's corpCode.xml is normally UTF-8. Registry archive XML is parsed as text.
  const registryText = registryZip.map(item => item.raw ?? item.text).join('\n');
  const registry = parseCorpRegistry(registryText).filter(item => item.stockCode);
  const previousRegistry = new Map((feed.corpRegistry ?? []).map(item => [item.corpCode, item]));
  const registryChanges = registry.flatMap(item => {
    const previous = previousRegistry.get(item.corpCode);
    return previous && previous.company !== item.company ? [{ corpCode: item.corpCode, oldName: previous.company, newName: item.company, stockCode: item.stockCode, modifyDate: item.modifyDate }] : [];
  });
  const changesByCode = new Map(registryChanges.map(item => [item.corpCode, item]));
  const registryByCode = new Map(registry.map(item => [item.corpCode, item]));
  const classTypes = ['Y', 'K', 'N'];
  const listings = new Map();
  const alreadyChecked = new Set(feed.checkedReceipts ?? []);
  for (const corpClass of classTypes) {
    let page = 1;
    while (page <= 100) {
      const response = await call(LIST_URL, { bgn_de: compactDate(start), end_de: compactDate(end), corp_cls: corpClass, page_no: page, page_count: 100, sort: 'date', sort_mth: 'desc' });
      const payload = await response.json();
      const rows = parseDisclosureList(payload);
      for (const row of rows) if (!alreadyChecked.has(row.receipt) && !listings.has(row.receipt)) listings.set(row.receipt, row);
      const totalPages = Number(payload.total_page ?? 1);
      if (!rows.length || page >= totalPages) break;
      page++;
    }
  }
  const ordered = [...listings.values()].sort((a, b) => a.filingDate.localeCompare(b.filingDate) || a.receipt.localeCompare(b.receipt));
  const selected = latestFilings(ordered, maxFilings);
  const checked = [...alreadyChecked];
  const newLeads = [];
  const docCache = new Map();
  const getDocHits = async receipt => {
    if (docCache.has(receipt)) return docCache.get(receipt);
    const response = await call(DOCUMENT_URL, { rcept_no: receipt });
    const buffer = Buffer.from(await response.arrayBuffer());
    const entries = unzipTextEntries(buffer);
    const texts = entries.map(entry => entry.text);
    const hits = texts.flatMap(text => analyzeAiBusinessText(text));
    const result = { hits, text: texts.join('\n') };
    docCache.set(receipt, result);
    return result;
  };
  const reportsByCorp = new Map();
  for (const row of ordered) {
    if (!reportsByCorp.has(row.corpCode)) reportsByCorp.set(row.corpCode, []);
    reportsByCorp.get(row.corpCode).push(row);
  }
  const priorLookupCache = new Map();
  const findPrior = async row => {
    const cacheKey = `${row.corpCode}:${formatReportFamily(row.report)}:${row.filingDate}`;
    if (priorLookupCache.has(cacheKey)) return priorLookupCache.get(cacheKey);
    // Comparable annual and same-quarter filings are usually about a year apart.
    // OpenDART limits a corp-specific query to a three-month interval, so search
    // a 90-day window centered on the prior-year filing date.
    const [year, month, day] = row.filingDate.match(/^([0-9]{4})([0-9]{2})([0-9]{2})$/)?.slice(1).map(Number) ?? [];
    const expectedPrior = new Date(Date.UTC(year - 1, month - 1, day));
    const beginPrior = new Date(expectedPrior.getTime() - 45 * 86400000);
    const endPrior = new Date(expectedPrior.getTime() + 45 * 86400000);
    const response = await call(LIST_URL, { corp_code: row.corpCode, bgn_de: compactDate(beginPrior), end_de: compactDate(endPrior), page_no: 1, page_count: 100, sort: 'date', sort_mth: 'desc' });
    const payload = await response.json();
    const candidates = parseDisclosureList(payload).filter(item => item.filingDate < row.filingDate && formatReportFamily(item.report) === formatReportFamily(row.report));
    candidates.sort((a, b) => b.filingDate.localeCompare(a.filingDate));
    const prior = candidates[0] ?? null;
    priorLookupCache.set(cacheKey, prior);
    return prior;
  };
  for (const row of selected) {
    let current;
    try { current = await getDocHits(row.receipt); }
    catch { continue; }
    checked.push(row.receipt);
    const aiHits = current.hits;
    let previousAvailable = false, priorHits = null, novelHits = [];
    if (aiHits.length) {
      let prior = (reportsByCorp.get(row.corpCode) ?? []).filter(item => item.filingDate < row.filingDate && formatReportFamily(item.report) === formatReportFamily(row.report)).at(-1);
      if (!prior) prior = await findPrior(row);
      if (prior) {
        try { priorHits = (await getDocHits(prior.receipt)).hits; previousAvailable = true; novelHits = novelAiEvidence(aiHits, priorHits); }
        catch { /* A failed prior download is explicitly treated as unavailable. */ }
      }
    }
    const official = registryByCode.get(row.corpCode);
    const registryNameChange = changesByCode.get(row.corpCode);
    const nameChange = confirmsNameChange(current.text, registryNameChange) ? registryNameChange : null;
    const enriched = { ...row, company: official?.company ?? row.company, stockCode: row.stockCode || official?.stockCode || '', priorHits };
    const lead = leadFor(enriched, aiHits, novelHits, previousAvailable, nameChange);
    if (lead) newLeads.push(lead);
  }
  // Name changes are surfaced only when linked to an observed filing from the same date window.
  // A registry name difference is only a lead if a downloaded original filing corroborates it.
  const retained = feed.leads ?? [];
  const unique = new Map([...retained, ...newLeads].map(lead => [lead.accession, lead]));
  const cutoff = new Date(end.getTime() - 180 * 86400000);
  const leads = [...unique.values()].filter(lead => lead.filingDate >= ymd(cutoff)).sort((a, b) => b.filingDate.localeCompare(a.filingDate)).slice(0, 1000);
  const corpRegistry = registry.map(({ corpCode, company, companyEnglish, stockCode, modifyDate }) => ({ corpCode, company, companyEnglish, stockCode, modifyDate }));
  return {
    schemaVersion: 1, source: 'OpenDART', generatedAt: now.toISOString(),
    coverage: 'Korean listed issuers represented in OpenDART KOSPI, KOSDAQ and KONEX classes Y, K and N. Scans disclosure metadata and selected original filing text. Most filings are Korean; the phrase screen is incomplete and may miss relevant language.',
    limitations: ['Requires a user-registered OpenDART API key. No key is included in this output.', 'Registry name changes are detected only by comparing with a previously saved registry snapshot and corroborating both names plus name-change wording in an original filing. First run creates a baseline and cannot identify historical changes.', 'Registry modify_date indicates a profile update, not proof that a legal name changed. A name difference requires review in the original filing.', 'AI language detection is keyword/context screening. It does not establish a new business, material revenue, commercial success, or an investment conclusion.', 'Filing text extraction ignores PDFs and unsupported ZIP formats. A document download or comparison failure can cause a missed lead.', 'Without corp_code, OpenDART disclosure search is limited to a three-month search interval. This adapter uses a maximum 90-day interval.'],
    scanWindowStart: ymd(start), scanWindowEnd: ymd(end),
    sources: [LIST_URL, REGISTRY_URL, DOCUMENT_URL, 'https://dart.fss.or.kr/'],
    leads, corpRegistry, checkedReceipts: [...new Set(checked)].slice(-20000),
    scanStats: { registryListedCompanies: registry.length, filingsFound: ordered.length, filingsSelected: selected.length, apiCalls: callCount, truncated: ordered.length > selected.length || selected.length < ordered.length },
  };
}

export async function main(args = process.argv.slice(2)) {
  if (args.includes('--self-test')) { console.log('OpenDART module self-tests are in tests/check-open-dart-ai-screen.mjs'); return; }
  const val = key => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : null; };
  const feedPath = resolve(val('--feed') ?? 'public/open-dart-ai-watch.json');
  let feed = { leads: [], checkedReceipts: [], corpRegistry: [] };
  try { feed = JSON.parse(await readFile(feedPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = await scanOpenDart({ apiKey: process.env.OPENDART_API_KEY, feed, from: val('--from'), to: val('--to'), maxFilings: Number(val('--max-filings') ?? 150), maxApiCalls: Number(val('--max-api-calls') ?? 1200) });
  await writeFile(feedPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`OpenDART scan complete: ${result.leads.length} retained leads, ${result.scanStats.filingsSelected} filings selected, ${result.scanStats.apiCalls} API calls.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error.message.replaceAll(process.env.OPENDART_API_KEY ?? '\u0000', '[redacted]')); process.exitCode = 1; });
