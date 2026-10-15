#!/usr/bin/env node
/**
 * First-pass SEC filing lead screen. Primary sources only; every match needs
 * human review. No investment conclusion is generated.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const SEC = 'https://www.sec.gov';
const DATA = 'https://data.sec.gov';
const TICKER_EXCHANGE_URL = `${SEC}/files/company_tickers_exchange.json`;
const ELIGIBLE_FORMS = new Set(['8-K', '10-K', '10-Q', '6-K', '20-F']);
const AI_PATTERNS = [
  /\bartificial intelligence\b/gi,
  /\bgenerative\s+AI\b/gi,
  /\bmachine learning\b/gi,
  /\bAI[- ](?:powered|enabled|driven|based|infrastructure|computing|data cent(?:er|re)s?)\b/gi,
  /\bAI[- ](?:focused|oriented|related|adjacent|native|first)\b/gi,
  /\bAI\s+(?:platform|business|products?|services?|strategy|operations?|segment|solutions?|systems?|models?|technology|investment|opportunity|initiative|division|focus|roadmap|contract|revenue|customers?)\b/gi,
  /\blarge language models?\b/gi,
];
const NAME_CHANGE = /\b(?:changed|change|changing|changes)\s+(?:(?:its|the company's|the issuer's)\s+)?(?:corporate\s+)?name\s+(?:from\s+.{1,140}?\s+)?to\s+.{1,140}|\bname change\b|\bchange of name\b|\b(?:renamed|re-named)\s+(?:itself\s+)?(?:as|to)\b/gi;
const NAME_CHANGE_EXPLICIT = /\b(?:name change|change of name|changed\s+(?:(?:its|the company's|the issuer's)\s+)?(?:corporate\s+)?name|renamed\s+(?:itself\s+)?(?:as|to))\b/i;
const OPERATIONAL_CONTEXT = /\b(?:customer|commercial|revenue|product|service|business|segment|launch|contract|facility|data cent(?:er|re)|compute|GPU|operations?|strategy|plan|license|licen[cs]e|acquisition|manufactur|deploy|capital|financ)\w*\b/i;
const RISK_HEADING = /\b(?:risk factors|risks related to|forward-looking statements|cautionary statement)\b/i;
const EXPLICIT_RISK_LIST = /\b(?:risks?\s+and\s+uncertainties|uncertainties\s+and\s+risks?)\b/i;
const RISK_SECTION_START = /\b(?:item\s+1a\s*[.:]?\s*)?(?:risk factors|risks related to)\b/gi;
const ITEM_SECTION_HEADING = /\bitem\s+(?:\d{1,2}[a-z]?|[ivx]{1,4})\s*[.:]/gi;
const BIOGRAPHY_CONTEXT = /\b(?:biograph(?:y|ical)|professional background|career history|previously served|formerly served|prior to joining|before joining|appointed to the board|director nominee|board nominee|served as.{0,100}\b(?:at|for)\b|experience\s+(?:with|at)\s+.{1,100}\bspans?\s+over\s+.{1,30}\b(?:years?|decades?)|held\s+(?:a number of\s+)?leadership positions|career\s+(?:at|with)\s+.{1,100}\bover\s+.{1,30}\b(?:years?|decades?))\b/i;
const COMMODITY_AI_DEMAND = /\b(?:critical minerals?|silver|antimony|copper|lithium|nickel|cobalt|rare earths?|semiconductors?|chips?)\b[\s\S]{0,160}\b(?:support(?:s|ing)?|needed to|supply(?:ing|ies)?|meet(?:ing)?|benefit(?:s|ing)? from|driven by|fuel(?:ing|s)?)\b[\s\S]{0,120}\b(?:artificial intelligence|AI)\b/i;
const SEC_TIME_ZONE = 'America/New_York';
const OPERATING_FACTS = {
  'us-gaap': {
    revenue: ['RevenueFromContractWithCustomerExcludingAssessedTax', 'Revenues', 'SalesRevenueNet'],
    grossProfit: ['GrossProfit'],
    operatingIncome: ['OperatingIncomeLoss', 'OperatingIncomeLossContinuingOperations'],
    netIncome: ['NetIncomeLoss'],
  },
  'ifrs-full': {
    revenue: ['Revenue'],
    grossProfit: ['GrossProfit'],
    operatingIncome: ['OperatingProfitLoss'],
    netIncome: ['ProfitLoss'],
  },
};
const INSTANT_FACTS = {
  'us-gaap': {
    cash: ['CashAndCashEquivalentsAtCarryingValue'],
    currentDebt: ['LongTermDebtCurrent', 'ShortTermBorrowings'],
    longTermDebt: ['LongTermDebtNoncurrent'],
  },
  'ifrs-full': {
    cash: ['CashAndCashEquivalents'],
    currentDebt: ['BorrowingsCurrent'],
    longTermDebt: ['BorrowingsNoncurrent'],
  },
};

function insideRiskSection(text, index) {
  const headings = [...text.matchAll(RISK_SECTION_START)];
  let current = null;
  for (const heading of headings) {
    if (heading.index > index) break;
    current = heading;
  }
  if (!current) return false;
  ITEM_SECTION_HEADING.lastIndex = current.index + current[0].length;
  const next = ITEM_SECTION_HEADING.exec(text);
  return !next || index < next.index;
}

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
      const issuerContext = normalized.slice(Math.max(0, match.index - 700), Math.min(normalized.length, match.index + 700));
      const sentence = sentenceAt(normalized, match.index, match[0].length);
      if (!OPERATIONAL_CONTEXT.test(context) || insideRiskSection(normalized, match.index) || RISK_HEADING.test(before.slice(-500)) || EXPLICIT_RISK_LIST.test(sentence) || BIOGRAPHY_CONTEXT.test(issuerContext) || COMMODITY_AI_DEMAND.test(sentence)) continue;
      hits.push({ term: match[0], context: context.trim(), sentence });
      if (hits.length >= 30) return hits;
    }
  }
  return hits;
}

function sentenceAt(text, index, length) {
  const left = Math.max(text.lastIndexOf('.', index), text.lastIndexOf('!', index), text.lastIndexOf('?', index), text.lastIndexOf(';', index)) + 1;
  const ends = ['.', '!', '?', ';'].map(mark => text.indexOf(mark, index + length)).filter(position => position >= 0);
  const right = ends.length ? Math.min(...ends) : text.length;
  return text.slice(left, right).trim();
}

export function isLikelyBiographyEvidence(text) {
  return BIOGRAPHY_CONTEXT.test(String(text ?? ''));
}

export function cleanStoredEvidence(evidence) {
  return (Array.isArray(evidence) ? evidence : []).filter(hit => {
    const text = String(hit?.text ?? '');
    return !isLikelyBiographyEvidence(text)
      && !EXPLICIT_RISK_LIST.test(text)
      && !COMMODITY_AI_DEMAND.test(text);
  });
}

const EVIDENCE_STOPWORDS = new Set([
  'about', 'after', 'also', 'among', 'been', 'being', 'company', 'companies', 'could', 'during',
  'each', 'from', 'have', 'into', 'more', 'most', 'other', 'over', 'their', 'there', 'these',
  'they', 'this', 'those', 'through', 'under', 'upon', 'what', 'when', 'where', 'which', 'while',
  'with', 'within', 'without', 'would', 'shall', 'should', 'will', 'than', 'then', 'were', 'your',
  'artificial', 'intelligence', 'generative', 'plans', 'plan', 'planned', 'expects', 'expected',
  'believes', 'believe', 'intends', 'intended', 'proposes', 'proposed', 'seeks', 'seek', 'may',
  'might', 'must', 'can', 'continue', 'continues', 'continued', 'including', 'include', 'includes',
  'following', 'related', 'based', 'using', 'used', 'currently', 'currently', 'new', 'business',
]);

function evidenceTokens(hit) {
  return new Set(String(hit.sentence ?? hit.context ?? '').toLowerCase().match(/[a-z][a-z0-9-]{2,}/g)
    ?.map(token => token.replaceAll('-', ''))
    .filter(token => token.length >= 4 && !EVIDENCE_STOPWORDS.has(token)) ?? []);
}

/** Find a substantive new AI-business phrase, even when the total hit count is unchanged. */
export function novelAiEvidence(currentHits, priorHits) {
  if (!currentHits?.length || priorHits === null) return [];
  if (!priorHits.length) return currentHits;
  const prior = priorHits.map(evidenceTokens).filter(tokens => tokens.size >= 4);
  return currentHits.filter(hit => {
    const tokens = evidenceTokens(hit);
    if (tokens.size < 4) return false;
    let bestSimilarity = 0;
    let mostNovel = tokens.size;
    for (const previous of prior) {
      const shared = [...tokens].filter(token => previous.has(token)).length;
      const union = new Set([...tokens, ...previous]).size;
      const similarity = union ? shared / union : 0;
      if (similarity > bestSimilarity) bestSimilarity = similarity;
      mostNovel = Math.min(mostNovel, tokens.size - shared);
    }
    return mostNovel >= 3 && bestSimilarity < 0.55;
  });
}

export function isNameChangeLead(text, form) {
  if (!['8-K', '6-K'].includes(form)) return false;
  const normalized = String(text ?? '').replace(/\s+/g, ' ');
  const hasItem503 = form === '8-K' && /item\s+5\.03\b/i.test(normalized);
  NAME_CHANGE.lastIndex = 0;
  const positive = normalized
    .replace(/\b(?:no|not|never|did not|does not|has not|will not|hasn't|didn't|doesn't|won't)\s+(?:change|changed|changing)\s+(?:its\s+)?(?:corporate\s+)?name\b/gi, ' ')
    .replace(/\bno\s+(?:corporate\s+)?name\s+change\b/gi, ' ');
  NAME_CHANGE.lastIndex = 0;
  const hasNameLanguage = NAME_CHANGE.test(positive);
  // Domestic issuers normally identify name changes under Form 8-K Item 5.03.
  // Foreign private issuers report on Form 6-K and do not use that item number,
  // so require explicit name-change wording; submissions history later verifies
  // the actual old/new names and an effective date near the filing.
  return hasNameLanguage && (hasItem503 || (form === '6-K' && NAME_CHANGE_EXPLICIT.test(positive)));
}

export function parseTickerExchange(payload) {
  const fields = Array.isArray(payload?.fields) ? payload.fields : [];
  const data = Array.isArray(payload?.data) ? payload.data : [];
  return data.flatMap(row => {
    const record = Array.isArray(row)
      ? Object.fromEntries(fields.map((field, index) => [field, row[index]]))
      : row;
    const cik = String(record?.cik ?? '').replace(/^0+/, '').padStart(10, '0');
    const ticker = String(record?.ticker ?? '').trim();
    if (!/^\d{10}$/.test(cik) || !ticker) return [];
    return [{cik, name: String(record.name ?? '').trim(), ticker, exchange: String(record.exchange ?? '').trim()}];
  });
}

export function attachListedIssuer(rows, tickerRows) {
  const byCik = new Map();
  for (const item of tickerRows) {
    if (!byCik.has(item.cik)) byCik.set(item.cik, []);
    byCik.get(item.cik).push(item);
  }
  return rows.flatMap(row => {
    const matches = byCik.get(String(row.cik).padStart(10, '0'));
    if (!matches?.length) return [];
    return [{
      ...row,
      ticker: [...new Set(matches.map(item => item.ticker))].join(', '),
      exchange: [...new Set(matches.map(item => item.exchange).filter(Boolean))].join(', '),
      mappedCompany: matches[0].name,
    }];
  });
}

export function parseMasterIndex(text) {
  const rows = String(text ?? '').split(/\r?\n/);
  const header = rows.findIndex(line => /^CIK\|Company Name\|Form Type\|Date Filed\|File ?Name$/i.test(line.trim()));
  if (header < 0) throw new Error('SEC master index header was not found');
  return rows.slice(header + 1).flatMap(line => {
    const parts = line.split('|');
    if (parts.length !== 5) return [];
    const [cik, company, form, rawFiled, filename] = parts.map(part => part.trim());
    if (!ELIGIBLE_FORMS.has(form) || !filename.startsWith('edgar/data/')) return [];
    const filed = /^\d{8}$/.test(rawFiled)
      ? `${rawFiled.slice(0, 4)}-${rawFiled.slice(4, 6)}-${rawFiled.slice(6, 8)}`
      : rawFiled;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(filed)) return [];
    const accessionRaw = filename.match(/(?:^|\/)(\d{10}-\d{2}-\d{6})(?:\.txt)?$/i)?.[1]
      ?? filename.match(/\/(\d{18})\//)?.[1];
    const accession = normalizeAccession(accessionRaw);
    if (!accession) return [];
    return [{ cik: String(cik).replace(/^0+/, '').padStart(10, '0'), company, form, filed, filename, accession }];
  });
}

function normalizeAccession(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (!/^\d{18}$/.test(digits)) return '';
  return `${digits.slice(0, 10)}-${digits.slice(10, 12)}-${digits.slice(12)}`;
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
function addCalendarDays(day, amount) {
  const date = new Date(`${day}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return dateString(date);
}
function dateInTimeZone(date, timeZone = SEC_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}
function weekdayOf(day) { return new Date(`${day}T00:00:00Z`).getUTCDay(); }
function observedFixedHoliday(year, month, day) {
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCDay() === 6) date.setUTCDate(date.getUTCDate() - 1);
  if (date.getUTCDay() === 0) date.setUTCDate(date.getUTCDate() + 1);
  return dateString(date);
}
function nthWeekdayOfMonth(year, month, weekday, nth) {
  const first = new Date(Date.UTC(year, month - 1, 1));
  const delta = (weekday - first.getUTCDay() + 7) % 7;
  return dateString(new Date(Date.UTC(year, month - 1, 1 + delta + 7 * (nth - 1))));
}
function lastWeekdayOfMonth(year, month, weekday) {
  const last = new Date(Date.UTC(year, month, 0));
  const delta = (last.getUTCDay() - weekday + 7) % 7;
  last.setUTCDate(last.getUTCDate() - delta);
  return dateString(last);
}
export function secFederalHolidays(year) {
  return new Set([
    observedFixedHoliday(year, 1, 1),
    nthWeekdayOfMonth(year, 1, 1, 3),
    nthWeekdayOfMonth(year, 2, 1, 3),
    lastWeekdayOfMonth(year, 5, 1),
    observedFixedHoliday(year, 6, 19),
    observedFixedHoliday(year, 7, 4),
    nthWeekdayOfMonth(year, 9, 1, 1),
    nthWeekdayOfMonth(year, 10, 1, 2),
    observedFixedHoliday(year, 11, 11),
    nthWeekdayOfMonth(year, 11, 4, 4),
    observedFixedHoliday(year, 12, 25),
  ]);
}
export function expectedIndexSkipReason(day, currentEasternDate) {
  const weekday = weekdayOf(day);
  if (weekday === 0 || weekday === 6) return 'weekend';
  const year = Number(day.slice(0, 4));
  if (secFederalHolidays(year).has(day) || secFederalHolidays(year - 1).has(day) || secFederalHolidays(year + 1).has(day)) return 'SEC federal holiday';
  if (day === currentEasternDate) return 'current ET date; daily index is published after the filing day closes';
  return null;
}
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
    if (response.status === 403 && url.includes('/Archives/edgar/daily-index/')) {
      return { status: response.status, body: await response.text() };
    }
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

/**
 * Resolve a recent legal-name transition from the SEC's CIK submissions
 * history. `formerNames` is the source of the prior legal name and its
 * effective date; the following historical name, or current `name`, supplies
 * the new legal name. Filing language is only corroboration for this result.
 */
export function legalNameChangeFromSubmissions(data, filed, cik) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(filed ?? ''))) return null;
  const currentName = String(data?.name ?? '').trim();
  const formerNames = Array.isArray(data?.formerNames) ? data.formerNames : [];
  const history = formerNames.flatMap(record => {
    const name = String(record?.name ?? '').trim();
    const from = String(record?.from ?? '').trim();
    const to = String(record?.to ?? '').trim();
    if (!name || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return [];
    return [{ name, from: /^\d{4}-\d{2}-\d{2}$/.test(from) ? from : '', to }];
  }).sort((a, b) => (a.from || a.to).localeCompare(b.from || b.to) || a.to.localeCompare(b.to));
  const filingTime = Date.parse(`${filed}T00:00:00Z`);
  const nearby = history.map((record, index) => ({
    ...record,
    index,
    distanceDays: Math.abs(Date.parse(`${record.to}T00:00:00Z`) - filingTime) / 86400000,
  })).filter(record => record.distanceDays <= 45)
    .sort((a, b) => a.distanceDays - b.distanceDays || b.to.localeCompare(a.to));
  for (const prior of nearby) {
    const nextHistoricalName = history.slice(prior.index + 1).find(record =>
      record.name.toLocaleLowerCase() !== prior.name.toLocaleLowerCase()
      && (!record.from || record.from >= prior.to));
    const newName = String(nextHistoricalName?.name ?? currentName).trim();
    if (!newName || newName.toLocaleLowerCase() === prior.name.toLocaleLowerCase()) continue;
    const normalizedCik = String(cik ?? '').replace(/\D/g, '').padStart(10, '0');
    if (!/^\d{10}$/.test(normalizedCik)) return null;
    return {
      oldName: prior.name,
      newName,
      effectiveDate: prior.to,
      source: 'SEC submissions formerNames history and current name',
      sourceUrl: submissionUrl(normalizedCik),
    };
  }
  return null;
}

async function submissionsForCik(cik, userAgent, cache) {
  const key = String(cik).padStart(10, '0');
  if (cache.has(key)) return cache.get(key);
  const response = await secFetch(submissionUrl(key), userAgent);
  const data = response.status === 404 ? null : JSON.parse(response.body);
  cache.set(key, data);
  return data;
}

export function aiDeltaLabel(currentHits, priorHits) {
  if (!currentHits.length) return '';
  if (priorHits === null) return 'AI-language lead; prior filing comparison unavailable';
  if (priorHits.length === 0) return 'AI language first detected versus prior same-form filing';
  const newPhrases = novelAiEvidence(currentHits, priorHits);
  if (newPhrases.length) return `New AI-business wording versus prior same-form filing (${newPhrases.length} distinct phrase${newPhrases.length === 1 ? '' : 's'})`;
  if (currentHits.length >= Math.max(3, priorHits.length * 2)) return `AI-language mentions increased (${priorHits.length} to ${currentHits.length}) versus prior same-form filing`;
  return '';
}

/** A legal-name transition can describe an AI pivot, but cannot create a lead by itself. */
export function aiPivotLeadType(legalNameChange, aiLabel) {
  if (!aiLabel) return null;
  return legalNameChange ? 'name-change-and-ai-language' : 'ai-language-change';
}

function snippets(hits, max = 3) {
  const seen = new Set();
  return hits.filter(hit => {
    const compact = hit.context.slice(0, 180);
    if (seen.has(compact)) return false;
    seen.add(compact);
    return true;
  }).slice(0, max).map(hit => ({
    term: hit.term,
    text: hit.context.slice(0, 360),
    documentType: hit.documentType ?? null,
    reviewCues: reviewCues(hit.sentence ?? hit.context),
  }));
}

/** Filing-word cues for triage only. They do not establish the AI business has these attributes. */
export function reviewCues(text) {
  const source = String(text ?? '');
  const cues = [];
  if (/\b(?:revenue|sales|gross profit|gross margin|operating income|segment results)\b/i.test(source)) cues.push('financial-results wording');
  if (/\b(?:customer|contract|agreement|purchase order|bookings|backlog|offtake)\b/i.test(source)) cues.push('customer or contract wording');
  if (/\b(?:facility|data cent(?:er|re)|construction|commission(?:ed|ing)?|capacity|MW|GPU|deployed|production)\b/i.test(source)) cues.push('asset, capacity, or deployment wording');
  if (/\b(?:financing|funding|capital raise|offering|dilution|shares|cash burn|liquidity)\b/i.test(source)) cues.push('funding or dilution wording');
  if (/\b(?:may|might|could|expect(?:s|ed|ing)?|plans?|planned|intends?|intended|propos(?:e|es|ed|ing)|seek(?:s|ing)?|potential|subject to)\b/i.test(source)) cues.push('forward-looking wording');
  return cues;
}

function companyFactRows(companyFacts, taxonomy, concepts, cutoffDate, periodType = 'duration') {
  const namespace = companyFacts?.facts?.[taxonomy];
  if (!namespace) return [];
  const rows = [];
  concepts.forEach((tag, tagPriority) => {
    const fact = namespace[tag];
    if (!fact?.units) return;
    Object.entries(fact.units).forEach(([unit, entries]) => {
      (Array.isArray(entries) ? entries : []).forEach(entry => {
        if (entry.val === null || entry.val === undefined || String(entry.val).trim() === '' || !Number.isFinite(Number(entry.val)) || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.end ?? '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(entry.filed ?? '')) || entry.filed > cutoffDate || entry.end > cutoffDate) return;
        const start = String(entry.start ?? '');
        const durationDays = start ? (Date.parse(`${entry.end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1 : 0;
        if (periodType === 'duration' && (!start || durationDays < 28 || durationDays > 400)) return;
        if (periodType === 'instant' && start) return;
        rows.push({taxonomy, tag, tagPriority, unit, value: Number(entry.val), start, end: entry.end, durationDays, filed: entry.filed, form: String(entry.form ?? ''), accession: String(entry.accn ?? '')});
      });
    });
  });
  return rows;
}

/** Build a filing-as-of bridge from standardized, entity-wide XBRL facts only. */
export function operatingBridgeFromCompanyFacts(companyFacts, cutoffDate, cik) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(cutoffDate ?? ''))) return null;
  const revenues = Object.entries(OPERATING_FACTS).flatMap(([taxonomy, concepts]) => companyFactRows(companyFacts, taxonomy, concepts.revenue, cutoffDate));
  if (!revenues.length) return null;
  revenues.sort((a, b) => b.end.localeCompare(a.end) || a.durationDays - b.durationDays || a.tagPriority - b.tagPriority || b.filed.localeCompare(a.filed));
  const revenue = revenues[0];
  // If the same revenue concept and period is presented in multiple currencies,
  // use USD when reported. Otherwise withhold the bridge rather than guess.
  const sameRevenueFacts = revenues.filter(x => x.taxonomy === revenue.taxonomy && x.tag === revenue.tag && x.start === revenue.start && x.end === revenue.end);
  const units = [...new Set(sameRevenueFacts.map(x => x.unit))];
  if (units.length > 1) {
    if (units.includes('USD')) revenue.unit = 'USD';
    else return null;
  }
  const matchingFact = (metric, concepts, periodType = 'duration') => {
    const rows = companyFactRows(companyFacts, revenue.taxonomy, concepts, cutoffDate, periodType)
      .filter(x => (periodType === 'instant' ? !x.start && x.end === revenue.end : x.start === revenue.start && x.end === revenue.end) && x.unit === revenue.unit)
      .sort((a, b) => a.tagPriority - b.tagPriority || b.filed.localeCompare(a.filed));
    if (!rows.length) return null;
    const chosen = rows[0];
    return {metric, value: chosen.value, taxonomy: chosen.taxonomy, tag: chosen.tag, unit: chosen.unit, periodStart: chosen.start, periodEnd: chosen.end, filed: chosen.filed, form: chosen.form, accession: chosen.accession, sourceUrl: factFilingUrl(cik, chosen.accession)};
  };
  const facts = {};
  for (const [metric, concepts] of Object.entries(OPERATING_FACTS[revenue.taxonomy])) facts[metric] = matchingFact(metric, concepts);
  for (const [metric, concepts] of Object.entries(INSTANT_FACTS[revenue.taxonomy] ?? {})) facts[metric] = matchingFact(metric, concepts, 'instant');
  if (!facts.revenue) return null;
  const margin = numerator => {
    const item = facts[numerator];
    return item && Number.isFinite(item.value) && facts.revenue.value !== 0
      ? item.value / facts.revenue.value * 100
      : null;
  };
  return {
    asOfDate: cutoffDate,
    periodStart: revenue.start,
    periodEnd: revenue.end,
    durationDays: revenue.durationDays,
    unit: revenue.unit,
    taxonomy: revenue.taxonomy,
    grossMarginPct: margin('grossProfit'),
    operatingMarginPct: margin('operatingIncome'),
    facts,
  };
}

function factFilingUrl(cik, accession) {
  const normalized = String(accession ?? '').replaceAll('-', '');
  if (!/^\d{10,}$/.test(normalized)) return '';
  return `${SEC}/Archives/edgar/data/${Number(cik)}/${normalized}/${accession}.txt`;
}

async function operatingBridgeForCik(cik, cutoffDate, userAgent, cache) {
  const padded = String(cik).replace(/^0+/, '').padStart(10, '0');
  if (!cache.has(padded)) {
    const response = await secFetch(`${DATA}/api/xbrl/companyfacts/CIK${padded}.json`, userAgent);
    cache.set(padded, response.status === 200 ? JSON.parse(response.body) : null);
  }
  return operatingBridgeFromCompanyFacts(cache.get(padded), cutoffDate, cik);
}

async function previousSameForm(row, userAgent, cache) {
  const data = await submissionsForCik(row.cik, userAgent, cache);
  if (!data) return null;
  const items = entriesFromSubmissions(data, row.accession)
    .filter(item => item.filed < row.filed)
    .sort((a, b) => b.filed.localeCompare(a.filed));
  return items.find(item => item.form === row.form) ?? null;
}

async function scan(options) {
  const userAgent = options.userAgent;
  if (!userAgent || !/\S+@\S+\.\S+/.test(userAgent)) {
    throw new Error('Set SEC_USER_AGENT to an identifying name plus a real contact email, for example "Field Signals research your.name@example.com".');
  }
  const now = new Date();
  const easternToday = dateInTimeZone(now);
  const tickerResponse = await secFetch(TICKER_EXCHANGE_URL, userAgent);
  if (tickerResponse.status !== 200) throw new Error('SEC ticker and exchange map could not be loaded');
  const tickerRows = parseTickerExchange(JSON.parse(tickerResponse.body));
  const listedCiks = new Set(tickerRows.map(item => item.cik));
  const seen = new Set((options.feed.checkedAccessions ?? []).map(normalizeAccession).filter(Boolean));
  const filings = new Map();
  const unavailableIndexDays = [];
  const indexCoverage = [];
  let readableIndexDays = 0;
  for (let offset = options.lookbackDays; offset >= 0; offset--) {
    const dayText = addCalendarDays(easternToday, -offset);
    const expectedSkip = expectedIndexSkipReason(dayText, easternToday);
    if (expectedSkip) {
      indexCoverage.push({date: dayText, status: 'expected-skip', reason: expectedSkip});
      continue;
    }
    try {
      const response = await secFetch(dailyIndexUrl(dayText), userAgent);
      if (response.status !== 200 || /<Code>AccessDenied<\/Code>/i.test(response.body)) {
        unavailableIndexDays.push(dayText);
        indexCoverage.push({date: dayText, status: 'request-failed', httpStatus: response.status, reason: response.status === 404 ? 'No index returned for an expected SEC business day; coverage could not be confirmed.' : 'SEC did not return a readable index; coverage could not be confirmed.'});
        continue;
      }
      const rows = parseMasterIndex(response.body);
      readableIndexDays++;
      indexCoverage.push({date: dayText, status: 'readable'});
      for (const row of rows) {
        if (seen.has(row.accession)) continue;
        filings.set(row.accession, row);
      }
    } catch (error) {
      unavailableIndexDays.push(dayText);
      indexCoverage.push({date: dayText, status: 'request-failed', reason: String(error.message ?? error).slice(0, 240)});
    }
  }
  if (!readableIndexDays) throw new Error('No SEC daily indexes were readable in the scan window; the existing feed was left unchanged.');

  const candidates = [];
  const checked = [...seen];
  const submissionsCache = new Map();
  const companyFactsCache = new Map();
  const sorted = attachListedIssuer(
    [...filings.values()].filter(row => listedCiks.has(row.cik)),
    tickerRows,
  ).sort((a, b) => a.filed.localeCompare(b.filed) || a.accession.localeCompare(b.accession));
  for (const row of sorted) {
    const primaryResponse = await secFetch(fullSubmissionUrl(row), userAgent);
    if (primaryResponse.status === 404) continue;
    checked.push(row.accession);
    const relevant = relevantDocuments(primaryResponse.body, row.form);
    const mainText = relevant.find(doc => doc.type === row.form)?.text ?? plainText(primaryResponse.body);
    const aiHits = relevant.flatMap(doc => analyzeText(doc.text).map(hit => ({ ...hit, documentType: doc.type })));
    const nameEvidence = [mainText, ...relevant.filter(doc => doc.type !== row.form).map(doc => doc.text)].join(' ');
    const nameTextCorroborated = isNameChangeLead(nameEvidence, row.form);
    // Text alone never creates a name-change lead. Confirm both legal names
    // and the date against the SEC's primary CIK submissions history first.
    const submissionData = nameTextCorroborated
      ? await submissionsForCik(row.cik, userAgent, submissionsCache)
      : null;
    const legalNameChange = nameTextCorroborated
      ? legalNameChangeFromSubmissions(submissionData, row.filed, row.cik)
      : null;
    let priorCount = null;
    let priorHits = null;
    let aiLabel = '';
    if (aiHits.length) {
      try {
        const prior = await previousSameForm(row, userAgent, submissionsCache);
        if (prior) {
          const priorUrl = `${SEC}/Archives/edgar/data/${Number(row.cik)}/${prior.accession.replaceAll('-', '')}/${prior.accession}.txt`;
          const priorResponse = await secFetch(priorUrl, userAgent);
          if (priorResponse.status !== 404) {
            const previousDocs = relevantDocuments(priorResponse.body, row.form);
            const priorText = previousDocs.length ? previousDocs.map(doc => doc.text).join(' ') : plainText(priorResponse.body);
            priorHits = analyzeText(priorText);
            priorCount = priorHits.length;
          }
        }
      } catch (error) {
        console.warn(`Prior filing comparison unavailable for ${row.cik}: ${error.message}`);
      }
      aiLabel = aiDeltaLabel(aiHits, priorHits);
    }
    const leadType = aiPivotLeadType(legalNameChange, aiLabel);
    if (!leadType) continue;
    let operatingBridge = null;
    let operatingBridgeStatus = 'No standardized facts available by the filing date';
    try {
      operatingBridge = await operatingBridgeForCik(row.cik, row.filed, userAgent, companyFactsCache);
      if (operatingBridge) operatingBridgeStatus = 'Available';
    } catch (error) {
      operatingBridgeStatus = 'Retry pending';
      console.warn(`CompanyFacts bridge unavailable for ${row.cik}: ${error.message}`);
    }
    candidates.push({
      cik: row.cik,
      company: row.company,
      mappedCompany: row.mappedCompany,
      ticker: row.ticker,
      exchange: row.exchange,
      form: row.form,
      filingDate: row.filed,
      accession: row.accession,
      filingUrl: filingUrl(row.filename),
      leadType,
      reviewStatus: 'automated lead; human review required',
      label: [legalNameChange ? `SEC submissions record a legal name change from ${legalNameChange.oldName} to ${legalNameChange.newName} (history date ${legalNameChange.effectiveDate}); filing text also meets the AI-language screen. Review the filing.` : '', aiLabel].filter(Boolean).join(' '),
      legalNameChange: legalNameChange || null,
      nameChangeTextCorroborated: Boolean(legalNameChange),
      priorSameFormAiMentions: priorCount,
      currentAiMentions: aiHits.length,
      evidence: snippets(aiHits),
      operatingBridge,
      operatingBridgeStatus,
      reviewedByHuman: false,
    });
  }
  const mappedByCik = new Map();
  for (const item of tickerRows) {
    if (!mappedByCik.has(item.cik)) mappedByCik.set(item.cik, []);
    mappedByCik.get(item.cik).push(item);
  }
  const retained = (options.feed.leads ?? []).filter(item => {
    const evidence = Array.isArray(item.evidence) ? item.evidence : [];
    if (evidence.length) item.evidence = cleanStoredEvidence(evidence);
    return !evidence.length || item.evidence.length > 0 || Boolean(item.legalNameChange && item.nameChangeTextCorroborated);
  }).map(item => {
    const mapped = mappedByCik.get(String(item.cik ?? '').padStart(10, '0'));
    return {
      ...item,
      accession: normalizeAccession(item.accession) || item.accession,
      ...(mapped?.length ? {
        ticker: item.ticker || [...new Set(mapped.map(row => row.ticker))].join(', '),
        exchange: item.exchange || [...new Set(mapped.map(row => row.exchange).filter(Boolean))].join(', '),
        mappedCompany: item.mappedCompany || mapped[0].name,
      } : {}),
    };
  });
  const unique = new Map([...retained, ...candidates].map(item => [item.accession, item]));
  const keepAfter = new Date(now);
  keepAfter.setUTCDate(keepAfter.getUTCDate() - 180);
  const leads = [...unique.values()].filter(item => item.filingDate >= dateString(keepAfter)).sort((a, b) => b.filingDate.localeCompare(a.filingDate)).slice(0, 1000);
  // Gradually add filing-as-of bridges to saved leads from before this feature.
  // Cap each daily run so old feed history does not create an unbounded SEC burst.
  const pendingBridges = leads.filter(item => !Object.hasOwn(item, 'operatingBridge') || item.operatingBridgeStatus === 'Retry pending').slice(0, 20);
  for (const item of pendingBridges) {
    try {
      item.operatingBridge = await operatingBridgeForCik(item.cik, item.filingDate, userAgent, companyFactsCache);
      item.operatingBridgeStatus = item.operatingBridge ? 'Available' : 'No standardized facts available by the filing date';
    } catch (error) {
      console.warn(`CompanyFacts backfill unavailable for ${item.cik}: ${error.message}`);
    }
  }
  const checkedAccessions = [...new Set(checked)].slice(-15000);
  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    coverage: 'SEC filers in the SEC company-ticker-exchange association file with recent Forms 8-K, 10-K, 10-Q, 6-K, or 20-F. The SEC says its association file may not be complete or fully accurate. This is not a global listed-company database; many non-US issuers and non-SEC exchanges are outside scope.',
    scanWindowStart: addCalendarDays(easternToday, -options.lookbackDays),
    scanWindowEnd: easternToday,
    unavailableIndexDays,
    indexCoverage: {timeZone: SEC_TIME_ZONE, checkedDays: indexCoverage},
    sources: ['https://www.sec.gov/Archives/edgar/daily-index/', 'https://data.sec.gov/submissions/', TICKER_EXCHANGE_URL],
    leads,
    checkedAccessions,
  };
}

export function selfTest() {
  const index = 'CIK|Company Name|Form Type|Date Filed|Filename\n--------------------------------------------------------------------------------\n100|Example Corp|8-K|2026-10-11|edgar/data/100/000000010026000123/form8-k.htm\n101|Other|S-1|2026-10-11|edgar/data/101/000000010126000001/s1.htm';
  const parsed = parseMasterIndex(index);
  if (parsed.length !== 1 || parsed[0].accession !== '0000000100-26-000123') throw new Error('legacy master index parser self-test failed');
  const currentIndex = 'Description: Daily Index of EDGAR Dissemination Feed\nLast Data Received: Oct 9, 2026\n\nCIK|Company Name|Form Type|Date Filed|File Name\n--------------------------------------------------------------------------------\n1000275|ROYAL BANK OF CANADA|6-K|20261009|edgar/data/1000275/0000950103-26-015425.txt';
  const currentParsed = parseMasterIndex(currentIndex);
  if (currentParsed.length !== 1 || currentParsed[0].accession !== '0000950103-26-015425' || currentParsed[0].filed !== '2026-10-09') throw new Error('current SEC daily index parser self-test failed');
  const text = plainText('<html><body>Item 5.03 Amendments. The Company changed its name from Old Co to New Co.</body></html>');
  if (!isNameChangeLead(text, '8-K') || isNameChangeLead(text, '10-Q')) throw new Error('name-change screen self-test failed');
  if (isNameChangeLead('Item 5.03. There will be no name change.', '8-K')) throw new Error('negated name-change language self-test failed');
  if (!isNameChangeLead('Item 5.03. See attached name change from Old Co to New Co.', '8-K')) throw new Error('exhibit name-change language self-test failed');
  const mapping = parseTickerExchange({fields: ['cik', 'name', 'ticker', 'exchange'], data: [[123, 'Example Inc.', 'EXMP', 'Nasdaq']]});
  const listed = attachListedIssuer(parsed, mapping);
  if (listed.length !== 0) throw new Error('unmapped issuer filter self-test failed');
  const mapped = attachListedIssuer([{...parsed[0], cik: '0000000123'}], mapping);
  if (mapped.length !== 1 || mapped[0].ticker !== 'EXMP' || mapped[0].exchange !== 'Nasdaq') throw new Error('ticker/exchange enrichment self-test failed');
  const ai = analyzeText('The company plans to launch an artificial intelligence data center business for customers.');
  if (!ai.length) throw new Error('AI phrase screen self-test failed');
  if (analyzeText('Risk Factors: our artificial intelligence product may not succeed.').length) throw new Error('risk-section suppression self-test failed');
  if (analyzeText('Americas Gold and Silver Corp., a producer of silver and other critical minerals supporting artificial intelligence, is increasing production.').length) throw new Error('commodity demand mention should not create an AI operating lead');
  if (cleanStoredEvidence([{text: 'The company supplies silver and critical minerals supporting artificial intelligence infrastructure.'}]).length) throw new Error('commodity demand evidence should be removed from retained leads');
  if (cleanStoredEvidence([{text: 'The issuer is launching an AI data center business for customers.'}]).length !== 1) throw new Error('operating AI evidence should remain in retained leads');
  if (!analyzeText('The company is launching an AI data center business and will provide compute capacity to customers.').length) throw new Error('issuer AI operating business language should remain eligible');
  if (expectedIndexSkipReason('2026-10-10', '2026-10-14') !== 'weekend' || expectedIndexSkipReason('2026-10-12', '2026-10-14') !== 'SEC federal holiday' || expectedIndexSkipReason('2026-10-14', '2026-10-14')?.startsWith('current ET date') !== true) throw new Error('SEC index expected-skip calendar self-test failed');
  if (expectedIndexSkipReason('2026-10-13', '2026-10-14') !== null) throw new Error('prior SEC business day should be checked');
  const longRisk = `Item 1A. Risk Factors. ${'Disclosure text without AI terms. '.repeat(80)} Our artificial intelligence data center business will serve customers.`;
  if (analyzeText(longRisk).length) throw new Error('long risk-section suppression self-test failed');
  const afterRisk = `${longRisk} Item 2. Properties. We launched an artificial intelligence data center for customers.`;
  if (!analyzeText(afterRisk).length) throw new Error('risk-section boundary self-test failed');
  const docs = relevantDocuments('<DOCUMENT><TYPE>8-K\n<TEXT><p>Item 5.03</p></TEXT></DOCUMENT><DOCUMENT><TYPE>EX-99.1\n<TEXT><p>AI business</p></TEXT></DOCUMENT><DOCUMENT><TYPE>EX-101.SCH\n<TEXT>AI taxonomy</TEXT></DOCUMENT>', '8-K');
  if (docs.length !== 2 || docs[1].type !== 'EX-99.1') throw new Error('relevant document extraction self-test failed');
  if (aiDeltaLabel(ai, []) !== 'AI language first detected versus prior same-form filing') throw new Error('AI delta self-test failed');
  const priorBusiness = analyzeText('The issuer sells an artificial intelligence customer-support product for banks. AI-powered translation services are also sold to travelers.');
  const currentBusiness = analyzeText('The issuer sells an artificial intelligence customer-support product for banks. AI-powered GPU data center capacity leasing for cloud customers will begin this year.');
  if (priorBusiness.length !== currentBusiness.length) throw new Error('new-language fixture must keep keyword counts steady');
  if (!novelAiEvidence(currentBusiness, priorBusiness).length || !aiDeltaLabel(currentBusiness, priorBusiness).startsWith('New AI-business wording')) throw new Error('new AI-business phrase self-test failed');
  const nearDuplicate = analyzeText('The issuer expects AI-powered data center services for regional cloud customers to expand.');
  const similarPrior = analyzeText('The issuer expects AI-powered data center services for regional cloud clients to expand.');
  if (novelAiEvidence(nearDuplicate, similarPrior).length) throw new Error('near-duplicate AI wording false-positive self-test failed');
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
