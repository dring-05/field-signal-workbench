#!/usr/bin/env node
/**
 * First-pass SEC filing lead screen. Primary sources only; every match needs
 * human review. No investment conclusion is generated.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SEC = 'https://www.sec.gov';
const DATA = 'https://data.sec.gov';
const ELIGIBLE_FORMS = new Set(['8-K', '10-K', '10-Q', '6-K', '20-F']);
const AI_PATTERNS = [
  /\bartificial intelligence\b/gi,
  /\bgenerative\s+AI\b/gi,
  /\bAI[- ](?:powered|enabled|driven|based|infrastructure|computing|data cent(?:er|re)s?)\b/gi,
  /\bAI\s+(?:platform|business|products?|services?|strategy|operations?|segment|solutions?|systems?|models?|technology|investment|opportunity|initiative|division|focus|roadmap|contract|revenue|customers?)\b/gi,
  /\blarge language models?\b/gi,
];
const NAME_CHANGE = /\b(?:changed|change)\s+(?:its\s+)?(?:corporate\s+)?name\s+(?:from\s+.{1,140}?\s+)?to\s+.{1,140}|\bname change\b|\bchange of name\b/gi;
const OPERATIONAL_CONTEXT = /\b(?:customer|commercial|revenue|product|service|business|segment|launch|contract|facility|data cent(?:er|re)|compute|GPU|operations?|strategy|plan|license|licen[cs]e|acquisition|manufactur|deploy|capital|financ)\w*\b/i;
const RISK_HEADING = /\b(?:risk factors|risks related to|forward-looking statements|cautionary statement)\b/i;

export function plainText(html) {
  return String(html ?? '')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&quot;|&#34;/gi, '"').replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([\da-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

export function analyzeText(text) {
  const normalized = String(text ?? '').replace(/\s+/g, ' ');
  const hits = [];
  for (const pattern of AI_PATTERNS) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(normalized))) {
      const start = Math.max(0, match.index - 220);
      const end = Math.min(normalized.length, match.index + match[0].length + 220);
      const context = normalized.slice(start, end);
      const before = normalized.slice(Math.max(0, match.index - 1200), match.index);
      if (!OPERATIONAL_CONTEXT.test(context) || RISK_HEADING.test(before.slice(-500))) continue;
      hits.push({ term: match[0], context: context.trim() });
      if (hits.length >= 30) return hits;
    }
  }
  return hits;
}

export function isNameChangeLead(text, form) {
  if (form !== '8-K') return false;
  const normalized = String(text ?? '').replace(/\s+/g, ' ');
  const hasItem503 = /item\s+5\.03\b/i.test(normalized);
  NAME_CHANGE.lastIndex = 0;
  const hasNameLanguage = NAME_CHANGE.test(normalized);
  return hasItem503 && hasNameLanguage;
}

export function parseMasterIndex(text) {
  const rows = String(text ?? '').split(/\r?\n/);
  const header = rows.findIndex(line => /^CIK\|Company Name\|Form Type\|Date Filed\|Filename$/.test(line.trim()));
  if (header < 0) throw new Error('SEC master index header was not found');
  return rows.slice(header + 1).flatMap(line => {
    const parts = line.split('|');
    if (parts.length !== 5) return [];
    const [cik, company, form, filed, filename] = parts;
    if (!ELIGIBLE_FORMS.has(form) || !/^\d{4}-\d{2}-\d{2}$/.test(filed) || !filename.startsWith('edgar/data/')) return [];
    const accession = filename.match(/\/(\d{10,})\//)?.[1];
    if (!accession) return [];
    return [{ cik: String(cik).padStart(10, '0'), company, form, filed, filename, accession }];
  });
}

export function relevantDocuments(raw, form) {
  const documents = [];
  for (const match of String(raw ?? '').matchAll(/<DOCUMENT>([\s\S]*?)<\/DOCUMENT>/gi)) {
    const block = match[1];
    const type = block.match(/<TYPE>\s*([^\r\n<]+)/i)?.[1]?.trim() ?? '';
    const body = block.match(/<TEXT>([\s\S]*?)<\/TEXT>/i)?.[1] ?? '';
    if (!body) continue;
    if (type.toUpperCase() === form.toUpperCase() || /^EX-99(?:\.\d+)?$/i.test(type)) {
      documents.push({ type: type.toUpperCase(), text: plainText(body) });
    }
  }
  return documents;
}

function dateString(date) { return date.toISOString().slice(0, 10); }
function qtr(date) { return Math.ceil((date.getUTCMonth() + 1) / 3); }
function submissionUrl(cik) { return `${DATA}/submissions/CIK${String(cik).padStart(10, '0')}.json`; }
function filingUrl(filename) { return `${SEC}/Archives/${filename}`; }
function dailyIndexUrl(day) {
  const d = new Date(`${day}T00:00:00Z`);
  return `${SEC}/Archives/edgar/daily-index/${d.getUTCFullYear()}/QTR${qtr(d)}/master.${day.replaceAll('-', '')}.idx`;
}
function fullSubmissionUrl(row) {
  const noHyphens = row.accession.replaceAll('-', '');
  return `${SEC}/Archives/edgar/data/${Number(row.cik)}/${noHyphens}/${row.accession}.txt`;
}

const delay = ms => new Promise(resolveDelay => setTimeout(resolveDelay, ms));
let lastRequestAt = 0;
async function secFetch(url, userAgent) {
  const spacing = 220;
  const wait = Math.max(0, spacing - (Date.now() - lastRequestAt));
  if (wait) await delay(wait);
  lastRequestAt = Date.now();
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(url, {
      headers: { 'User-Agent': userAgent, 'Accept-Encoding': 'gzip, deflate', 'Host': new URL(url).host },
      signal: AbortSignal.timeout(45000),
    });
    if (response.ok) return { status: response.status, body: await response.text() };
    if (response.status === 404) return { status: 404, body: '' };
    if (![429, 500, 502, 503, 504].includes(response.status)) throw new Error(`SEC request failed (${response.status}) for ${url}`);
    if (attempt === 3) throw new Error(`SEC request exhausted retries (${response.status}) for ${url}`);
    const retryAfter = Number(response.headers.get('retry-after'));
    await delay(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 1500 * (attempt + 1));
  }
  throw new Error(`SEC request failed for ${url}`);
}

function entriesFromSubmissions(data, beforeAccession) {
  const recent = data?.filings?.recent;
  if (!recent?.accessionNumber) return [];
  const result = [];
  for (let i = 0; i < recent.accessionNumber.length; i++) {
    const accession = recent.accessionNumber[i];
    if (accession === beforeAccession) continue;
    const form = recent.form[i];
    if (!ELIGIBLE_FORMS.has(form)) continue;
    result.push({ accession, form, filed: recent.filingDate[i], primaryDocument: recent.primaryDocument[i] });
  }
  return result;
}

function aiDeltaLabel(currentHits, priorHits) {
  if (!currentHits.length) return '';
  if (priorHits === null) return 'AI-language lead; prior filing comparison unavailable';
  if (priorHits === 0) return 'AI language first detected versus prior same-form filing';
  if (currentHits.length >= Math.max(3, priorHits * 2)) return `AI-language mentions increased (${priorHits} to ${currentHits.length}) versus prior same-form filing`;
  return '';
}

function snippets(hits, max = 3) {
  const seen = new Set();
  return hits.filter(hit => {
    const compact = hit.context.slice(0, 180);
    if (seen.has(compact)) return false;
    seen.add(compact);
    return true;
  }).slice(0, max).map(hit => ({ term: hit.term, text: hit.context.slice(0, 360), documentType: hit.documentType ?? null }));
}

async function previousSameForm(row, userAgent, cache) {
  if (cache.has(row.cik)) return cache.get(row.cik).find(item => item.form === row.form && item.filed < row.filed) ?? null;
  const response = await secFetch(submissionUrl(row.cik), userAgent);
  if (response.status === 404) { cache.set(row.cik, []); return null; }
  const data = JSON.parse(response.body);
  const items = entriesFromSubmissions(data, row.accession)
    .filter(item => item.filed < row.filed)
    .sort((a, b) => b.filed.localeCompare(a.filed));
  cache.set(row.cik, items);
  return items.find(item => item.form === row.form) ?? null;
}

async function scan(options) {
  const userAgent = options.userAgent;
  if (!userAgent || !/\S+@\S+\.\S+/.test(userAgent)) {
    throw new Error('Set SEC_USER_AGENT to an identifying name plus a real contact email, for example "Field Signals research your.name@example.com".');
  }
  const now = new Date();
  const seen = new Set(options.feed.checkedAccessions ?? []);
  const filings = new Map();
  for (let offset = options.lookbackDays; offset >= 0; offset--) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() - offset);
    const dayText = dateString(day);
    const response = await secFetch(dailyIndexUrl(dayText), userAgent);
    if (response.status === 404) continue;
    for (const row of parseMasterIndex(response.body)) {
      if (seen.has(row.accession)) continue;
      filings.set(row.accession, row);
    }
  }

  const candidates = [];
  const checked = [...seen];
  const priorCache = new Map();
  const sorted = [...filings.values()].sort((a, b) => a.filed.localeCompare(b.filed) || a.accession.localeCompare(b.accession));
  for (const row of sorted) {
    const primaryResponse = await secFetch(fullSubmissionUrl(row), userAgent);
    checked.push(row.accession);
    if (primaryResponse.status === 404) continue;
    const relevant = relevantDocuments(primaryResponse.body, row.form);
    const mainText = relevant.find(doc => doc.type === row.form)?.text ?? plainText(primaryResponse.body);
    const aiHits = relevant.flatMap(doc => analyzeText(doc.text).map(hit => ({ ...hit, documentType: doc.type })));
    const nameLead = isNameChangeLead(mainText, row.form);
    let priorCount = null;
    let aiLabel = '';
    if (aiHits.length) {
      try {
        const prior = await previousSameForm(row, userAgent, priorCache);
        if (prior) {
          const priorUrl = `${SEC}/Archives/edgar/data/${Number(row.cik)}/${prior.accession.replaceAll('-', '')}/${prior.accession}.txt`;
          const priorResponse = await secFetch(priorUrl, userAgent);
          if (priorResponse.status !== 404) {
            const previousDocs = relevantDocuments(priorResponse.body, row.form);
            const priorText = previousDocs.length ? previousDocs.map(doc => doc.text).join(' ') : plainText(priorResponse.body);
            priorCount = analyzeText(priorText).length;
          }
        }
      } catch (error) {
        console.warn(`Prior filing comparison unavailable for ${row.cik}: ${error.message}`);
      }
      aiLabel = aiDeltaLabel(aiHits, priorCount);
    }
    if (!nameLead && !aiLabel) continue;
    candidates.push({
      cik: row.cik,
      company: row.company,
      form: row.form,
      filingDate: row.filed,
      accession: row.accession,
      filingUrl: filingUrl(row.filename),
      leadType: nameLead && aiLabel ? 'name-change-and-ai-language' : nameLead ? 'possible-name-change' : 'ai-language-change',
      label: [nameLead ? 'Possible legal name change: Form 8-K Item 5.03 plus name-change wording; review the filing.' : '', aiLabel].filter(Boolean).join(' '),
      priorSameFormAiMentions: priorCount,
      currentAiMentions: aiHits.length,
      evidence: snippets(aiHits),
      reviewedByHuman: false,
    });
  }
  const unique = new Map([...(options.feed.leads ?? []), ...candidates].map(item => [item.accession, item]));
  const keepAfter = new Date(now);
  keepAfter.setUTCDate(keepAfter.getUTCDate() - 180);
  const leads = [...unique.values()].filter(item => item.filingDate >= dateString(keepAfter)).sort((a, b) => b.filingDate.localeCompare(a.filingDate)).slice(0, 1000);
  const checkedAccessions = [...new Set(checked)].slice(-15000);
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    coverage: 'SEC filers found in EDGAR daily indexes for Forms 8-K, 10-K, 10-Q, 6-K, and 20-F. Exchange-traded mapping is not yet applied; private reporting companies may appear and many non-US issuers are out of scope.',
    scanWindowStart: dateString(new Date(now.getTime() - options.lookbackDays * 86400000)),
    scanWindowEnd: dateString(now),
    sources: ['https://www.sec.gov/Archives/edgar/daily-index/', 'https://data.sec.gov/submissions/'],
    leads,
    checkedAccessions,
  };
}

export function selfTest() {
  const index = 'CIK|Company Name|Form Type|Date Filed|Filename\n--------------------------------------------------------------------------------\n100|Example Corp|8-K|2026-10-11|edgar/data/100/000000010026000123/form8-k.htm\n101|Other|S-1|2026-10-11|edgar/data/101/000000010126000001/s1.htm';
  const parsed = parseMasterIndex(index);
  if (parsed.length !== 1 || parsed[0].accession !== '000000010026000123') throw new Error('master index parser self-test failed');
  const text = plainText('<html><body>Item 5.03 Amendments. The Company changed its name from Old Co to New Co.</body></html>');
  if (!isNameChangeLead(text, '8-K') || isNameChangeLead(text, '10-Q')) throw new Error('name-change screen self-test failed');
  const ai = analyzeText('The company plans to launch an artificial intelligence data center business for customers.');
  if (!ai.length) throw new Error('AI phrase screen self-test failed');
  if (analyzeText('Risk Factors: our artificial intelligence product may not succeed.').length) throw new Error('risk-section suppression self-test failed');
  const docs = relevantDocuments('<DOCUMENT><TYPE>8-K\n<TEXT><p>Item 5.03</p></TEXT></DOCUMENT><DOCUMENT><TYPE>EX-99.1\n<TEXT><p>AI business</p></TEXT></DOCUMENT><DOCUMENT><TYPE>EX-101.SCH\n<TEXT>AI taxonomy</TEXT></DOCUMENT>', '8-K');
  if (docs.length !== 2 || docs[1].type !== 'EX-99.1') throw new Error('relevant document extraction self-test failed');
  if (aiDeltaLabel(ai, 0) !== 'AI language first detected versus prior same-form filing') throw new Error('AI delta self-test failed');
  return true;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) { selfTest(); console.log('SEC filing screen self-tests passed'); return; }
  const value = key => { const i = args.indexOf(key); return i >= 0 ? args[i + 1] : null; };
  const lookbackDays = Number(value('--lookback-days') ?? process.env.SEC_LOOKBACK_DAYS ?? 7);
  if (!Number.isInteger(lookbackDays) || lookbackDays < 1 || lookbackDays > 30) throw new Error('lookback-days must be an integer from 1 to 30');
  const feedPath = resolve(value('--feed') ?? 'public/sec-ai-watch.json');
  let feed = { leads: [], checkedAccessions: [] };
  try { feed = JSON.parse(await readFile(feedPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  const result = await scan({ lookbackDays, feed, userAgent: process.env.SEC_USER_AGENT });
  await writeFile(feedPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(`SEC scan complete. ${result.leads.length} retained leads; ${result.checkedAccessions.length} checked accessions.`);
}

if (import.meta.url === `file://${process.argv[1]}`) main().catch(error => { console.error(error); process.exitCode = 1; });
