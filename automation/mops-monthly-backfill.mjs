#!/usr/bin/env node

/**
 * Opt-in, serial backfill of MOPS monthly revenue reports.
 *
 * This script never runs as part of the site build or daily Apps Script importer.
 * It writes immutable source HTML blobs and append-only JSONL observations to a
 * caller-selected directory. A bounded request budget and explicit date range
 * are required for every run.
 */
import {createHash} from 'node:crypto';
import {appendFile, mkdir, readFile, stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const ATTRIBUTION = 'Financial Supervisory Commission, Securities and Futures Bureau, Monthly Business Income Summary Table (MOPS), Open Government Data License v1.0, https://data.gov.tw/license';
export const BASE_URL = 'https://mopsov.twse.com.tw/nas/t21';

const MONTH_HEADERS = [
  ['companyCode', ['公司代號', '公司代碼']],
  ['companyName', ['公司名稱']],
  ['revenue', ['當月營收']],
  ['priorMonthRevenue', ['上月營收']],
  ['yearAgoRevenue', ['去年當月營收']],
  ['monthChangePct', ['上月比較增減']],
  ['yearChangePct', ['去年同月增減']],
  ['ytdRevenue', ['當月累計營收']],
  ['priorYearYtdRevenue', ['去年累計營收']],
  ['ytdChangePct', ['前期比較增減']],
  ['notes', ['備註']]
];

const MARKET_PATH = Object.freeze({sii: 'sii', otc: 'otc', rotc: 'rotc', pub: 'pub'});
const MARKET_LABEL = Object.freeze({sii: /上市/, otc: /上櫃|櫃買/, rotc: /興櫃/, pub: /公開發行/});
const ISSUER_TYPE = Object.freeze({0: 'domestic', 1: 'foreign'});

function sha256(buffer) {
  return createHash('sha256').update(buffer).digest('hex');
}

function normalizeText(value) {
  return decodeEntities(String(value || '').replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')).replace(/[\u00a0\s]+/g, ' ').trim();
}

function decodeEntities(value) {
  const named = {nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", '#39': "'"};
  return value.replace(/&(#x[\da-f]+|#\d+|[a-z]+);/gi, (all, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1]?.toLowerCase() === 'x';
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : all;
    }
    return named[entity.toLowerCase()] ?? all;
  });
}

function parseCellAttributes(tag) {
  const attrs = {};
  for (const match of tag.matchAll(/([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) {
    attrs[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return attrs;
}

function parseTableRows(tableHtml) {
  const rowHtml = [...tableHtml.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)].map(m => m[1]);
  const grid = [];
  const occupied = new Map();
  for (let rowIndex = 0; rowIndex < rowHtml.length; rowIndex += 1) {
    const row = [];
    let column = 0;
    const cells = [...rowHtml[rowIndex].matchAll(/<(td|th)\b([^>]*)>([\s\S]*?)<\/\1\s*>/gi)];
    for (const cell of cells) {
      while (occupied.has(`${rowIndex}:${column}`)) column += 1;
      const attrs = parseCellAttributes(cell[2]);
      const colSpan = Math.max(1, Math.min(50, Number.parseInt(attrs.colspan || '1', 10) || 1));
      const rowSpan = Math.max(1, Math.min(50, Number.parseInt(attrs.rowspan || '1', 10) || 1));
      const text = normalizeText(cell[3]);
      for (let offset = 0; offset < colSpan; offset += 1) {
        row[column + offset] = text;
        if (rowSpan > 1) {
          for (let down = 1; down < rowSpan; down += 1) occupied.set(`${rowIndex + down}:${column + offset}`, text);
        }
      }
      column += colSpan;
    }
    for (let c = 0; c < row.length; c += 1) {
      const key = `${rowIndex}:${c}`;
      if (occupied.has(key)) row[c] = occupied.get(key);
    }
    grid.push(row.map(x => x || ''));
  }
  return grid;
}

function expandHeader(rows, endIndex, maxRows = 5) {
  const start = Math.max(0, endIndex - maxRows + 1);
  const candidates = [];
  for (let from = start; from <= endIndex; from += 1) {
    const combined = [];
    for (let i = from; i <= endIndex; i += 1) {
      const row = rows[i] || [];
      for (let col = 0; col < row.length; col += 1) {
        combined[col] = [combined[col], row[col]].filter(Boolean).join(' ');
      }
    }
    candidates.push(combined.map(x => normalizeText(x || '')));
  }
  return candidates;
}

function mapHeader(header) {
  const mapped = {};
  for (let index = 0; index < header.length; index += 1) {
    const cell = header[index].replace(/[\s（）()：:]/g, '');
    for (const [key, aliases] of MONTH_HEADERS) {
      if (mapped[key] !== undefined) continue;
      if (aliases.some(alias => cell.includes(alias.replace(/[\s（）()：:]/g, '')))) mapped[key] = index;
    }
  }
  const required = ['companyCode', 'companyName', 'revenue', 'yearChangePct'];
  return required.every(key => mapped[key] !== undefined) ? mapped : null;
}

function parseNumber(value) {
  const trimmed = normalizeText(value).replace(/,/g, '').replace(/％/g, '%');
  if (!trimmed || /^[-–—－]+$/.test(trimmed)) return null;
  const paren = /^\((.*)\)$/.exec(trimmed);
  const parsed = Number((paren ? `-${paren[1]}` : trimmed).replace(/%$/, ''));
  return Number.isFinite(parsed) ? parsed : null;
}

function rocYearMonth(month) {
  const [year, mm] = month.split('-').map(Number);
  return {year: year - 1911, month: mm};
}

function validateTitle(html, reportMonth, market) {
  const {year, month} = rocYearMonth(reportMonth);
  const titleTags = [...html.matchAll(/<(?:title|h1)\b[^>]*>([\s\S]*?)<\/(?:title|h1)\s*>/gi)].map(m => normalizeText(m[1]));
  const relevantTag = titleTags.find(value => new RegExp(`(?:民國)?\\s*${year}\\s*年`).test(value));
  const sourcePreamble = html.split('本資料由各公司提供')[0];
  const visiblePreamble = normalizeText(sourcePreamble);
  const titlePattern = /((?:上市公司|上櫃公司|興櫃公司|公開發行公司)\s*\d{2,3}\s*年\s*\d{1,2}\s*月份?[^。]{0,60}?營業收入統計表)/g;
  const visibleTitles = [...visiblePreamble.matchAll(titlePattern)].map(m => m[1]);
  const title = relevantTag || visibleTitles.at(-1) || titleTags[0] || '';
  if (!title) throw new Error(`Could not find a MOPS report title containing the requested period ${reportMonth}.`);
  const hasYear = new RegExp(`(?:民國)?\\s*${year}\\s*年`).test(title);
  const hasMonth = new RegExp(`${month}\\s*月`).test(title);
  if (!hasYear || !hasMonth) throw new Error(`MOPS title period does not match ${reportMonth}: ${title}`);
  const marketLabelPresent = MARKET_LABEL[market]?.test(title);
  if (!marketLabelPresent) throw new Error(`MOPS title does not identify the requested ${market} market: ${title}`);
  return title;
}

/** Parse a MOPS monthly report. Fails closed when its period, table headers, or rows are ambiguous. */
export function parseMonthlyReport(html, {reportMonth, market, issuerType}) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(reportMonth)) throw new Error(`Invalid report month: ${reportMonth}`);
  if (!MARKET_PATH[market]) throw new Error(`Unsupported market: ${market}`);
  if (!ISSUER_TYPE[issuerType]) throw new Error(`Unsupported issuer type: ${issuerType}`);
  const title = validateTitle(html, reportMonth, market);
  const tables = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)].map(m => m[1]);
  const byCode = new Map();
  let matchingTables = 0;
  for (const table of tables) {
    const rows = parseTableRows(table);
    let mapped = null;
    let industry = '';
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowText = row.join(' ');
      const industryMatch = /產業別\s*[：:]?\s*([^\s　]+)/.exec(rowText);
      if (industryMatch) industry = industryMatch[1].replace(/單位.*$/, '');
      const rawCode = normalizeText(row[mapped?.companyCode ?? 0]);
      const isCompanyRow = /^[A-Z0-9]{4,6}$/i.test(rawCode);
      if (!isCompanyRow) {
        const header = expandHeader(rows, rowIndex).map(mapHeader).find(Boolean);
        if (header) {
          mapped = header;
          matchingTables += 1;
        }
        continue;
      }
      if (!mapped) continue;
      const code = rawCode.toUpperCase();
      const name = normalizeText(row[mapped.companyName]);
      if (!name || /^(合計|總計|小計)/.test(name)) continue;
      const valueAt = key => mapped[key] === undefined ? null : parseNumber(row[mapped[key]]);
      const record = {
        market,
        issuerType: ISSUER_TYPE[issuerType],
        companyCode: code,
        companyName: name,
        industry,
        reportMonth,
        revenue: valueAt('revenue'),
        priorMonthRevenue: valueAt('priorMonthRevenue'),
        yearAgoRevenue: valueAt('yearAgoRevenue'),
        monthChangePct: valueAt('monthChangePct'),
        yearChangePct: valueAt('yearChangePct'),
        ytdRevenue: valueAt('ytdRevenue'),
        priorYearYtdRevenue: valueAt('priorYearYtdRevenue'),
        ytdChangePct: valueAt('ytdChangePct'),
        notes: mapped.notes === undefined || /^[-–—－]+$/.test(normalizeText(row[mapped.notes])) ? '' : normalizeText(row[mapped.notes]),
        currency: 'TWD',
        unit: 'thousand',
        sourceUrl: reportUrl(market, reportMonth, issuerType),
        sourceAgency: 'Financial Supervisory Commission, Securities and Futures Bureau',
        sourceDataset: 'Monthly Business Income Summary Table (MOPS)',
        license: 'Open Government Data License v1.0',
        attribution: ATTRIBUTION,
        reportTitle: title
      };
      if (record.revenue === null || record.yearChangePct === null) {
        throw new Error(`Company row ${code} lacks revenue or YoY revenue in ${reportMonth}; refusing partial parse.`);
      }
      const prior = byCode.get(code);
      if (prior && JSON.stringify(prior) !== JSON.stringify(record)) {
        throw new Error(`Conflicting duplicate issuer row ${code} in ${reportMonth}; refusing ambiguous parse.`);
      }
      byCode.set(code, record);
    }
  }
  if (!matchingTables || !byCode.size) throw new Error(`No valid company rows found in MOPS monthly report ${reportMonth}.`);
  return {title, records: [...byCode.values()]};
}

export function reportUrl(market, reportMonth, issuerType) {
  if (!MARKET_PATH[market]) throw new Error(`Unsupported market: ${market}`);
  if (!ISSUER_TYPE[issuerType]) throw new Error(`Unsupported issuer type: ${issuerType}`);
  const {year, month} = rocYearMonth(reportMonth);
  return `${BASE_URL}/${MARKET_PATH[market]}/t21sc03_${year}_${month}_${issuerType}.html`;
}

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) throw new Error(`Unexpected argument: ${token}`);
    const [key, inlineValue] = token.slice(2).split('=', 2);
    if (key === 'help') options.help = true;
    else options[key] = inlineValue ?? argv[++i];
  }
  return options;
}

export function backfillOptionsFromCli(options) {
  return {
    from: options.from,
    to: options.to,
    outDir: options.out,
    markets: options.markets ? options.markets.split(',') : ['sii', 'otc', 'rotc', 'pub'],
    issuerTypes: options['issuer-types'] ? options['issuer-types'].split(',') : ['0', '1'],
    maxRequests: options['max-requests'] ? Number(options['max-requests']) : 8,
    delayMs: options['delay-ms'] ? Number(options['delay-ms']) : 3000,
    retries: options.retries ? Number(options.retries) : 3,
    recheckCompleted: Boolean(options['recheck-completed'])
  };
}

function monthsBetween(from, to) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(from || '') || !/^\d{4}-(0[1-9]|1[0-2])$/.test(to || '')) {
    throw new Error('Both --from and --to are required in YYYY-MM format.');
  }
  if (from > to) throw new Error('--from must be on or before --to.');
  const out = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  for (let y = fy, m = fm; y < ty || (y === ty && m <= tm);) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return out;
}

function splitOption(value, allowed, name, defaults) {
  const items = value ? String(value).split(',').map(s => s.trim()).filter(Boolean) : defaults;
  if (!items.length || items.some(item => !allowed.includes(item))) throw new Error(`Invalid --${name}; supported values: ${allowed.join(',')}`);
  return [...new Set(items)];
}

async function readLines(filename) {
  try { return (await readFile(filename, 'utf8')).split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line)); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
}

async function appendJsonl(filename, rows) {
  if (!rows.length) return;
  await appendFile(filename, rows.map(row => JSON.stringify(row)).join('\n') + '\n', {encoding: 'utf8', flag: 'a'});
}

async function exists(filename) {
  try { await stat(filename); return true; } catch (error) { if (error.code === 'ENOENT') return false; throw error; }
}

function contentDecoder(headers, buffer) {
  const charset = /charset\s*=\s*["']?([^;"']+)/i.exec(headers.get('content-type') || '')?.[1]?.trim();
  if (charset) return new TextDecoder(charset);
  const utf8 = new TextDecoder('utf-8').decode(buffer);
  const replacementCount = (utf8.match(/\uFFFD/g) || []).length;
  if (replacementCount < 5) return new TextDecoder('utf-8');
  return new TextDecoder('big5');
}

async function fetchWithRetry(url, {retries, fetchImpl, onAttempt}) {
  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    await onAttempt();
    try {
      const response = await fetchImpl(url, {headers: {'User-Agent': 'Field Signals historical research backfill'}});
      const bytes = Buffer.from(await response.arrayBuffer());
      if (response.status === 429 || response.status >= 500) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterSeconds = Number(retryAfterHeader);
        const retryAfterDate = retryAfterHeader ? Date.parse(retryAfterHeader) - Date.now() : NaN;
        const retryAfterMs = Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
          ? retryAfterSeconds * 1000
          : Number.isFinite(retryAfterDate) && retryAfterDate > 0 ? retryAfterDate : NaN;
        const waitMs = Number.isFinite(retryAfterMs) ? Math.min(120000, retryAfterMs) : Math.min(30000, 1000 * 2 ** attempt);
        if (attempt < retries) { await new Promise(resolve => setTimeout(resolve, waitMs)); continue; }
        throw new Error(`HTTP ${response.status} from ${url}`);
      }
      if (!response.ok) throw new Error(`HTTP ${response.status} from ${url}`);
      if (bytes.length < 1000) throw new Error(`Short response (${bytes.length} bytes) from ${url}`);
      const text = contentDecoder(response.headers, bytes).decode(bytes);
      return {bytes, text};
    } catch (error) {
      lastError = error;
      if (attempt < retries && !/^Error: HTTP 4\d\d/.test(String(error))) {
        await new Promise(resolve => setTimeout(resolve, Math.min(30000, 1000 * 2 ** attempt)));
        continue;
      }
      break;
    }
  }
  throw lastError || new Error(`Request failed: ${url}`);
}

export async function runBackfill({
  from, to, outDir, markets = ['sii', 'otc', 'rotc', 'pub'], issuerTypes = ['0', '1'], maxRequests = 8,
  delayMs = 3000, retries = 3, recheckCompleted = false,
  fetchImpl = globalThis.fetch, sleep = ms => new Promise(resolve => setTimeout(resolve, ms))
}) {
  const months = monthsBetween(from, to);
  if (!outDir) throw new Error('--out is required. Choose a separate directory for this historical backfill.');
  if (!Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 200) throw new Error('--max-requests must be between 1 and 200.');
  if (!Number.isInteger(delayMs) || delayMs < 1000) throw new Error('--delay-ms must be at least 1000.');
  if (!Number.isInteger(retries) || retries < 0 || retries > 5) throw new Error('--retries must be between 0 and 5.');
  if (typeof fetchImpl !== 'function') throw new Error('This Node runtime does not provide fetch.');
  const selectedMarkets = splitOption(markets.join(','), Object.keys(MARKET_PATH), 'markets', []);
  const selectedTypes = splitOption(issuerTypes.join(','), Object.keys(ISSUER_TYPE), 'issuer-types', []);
  const root = path.resolve(outDir);
  const rawDir = path.join(root, 'raw');
  const recordsPath = path.join(root, 'records.jsonl');
  const checkpointsPath = path.join(root, 'checkpoints.jsonl');
  await mkdir(rawDir, {recursive: true});
  const records = await readLines(recordsPath);
  const recordSignatures = new Set(records.map(row => row.recordSignature).filter(Boolean));
  const checkpoints = new Map();
  for (const entry of await readLines(checkpointsPath)) checkpoints.set(entry.key, entry);
  const totalJobs = months.length * selectedMarkets.length * selectedTypes.length;
  let attempts = 0;
  let completed = 0;
  let addedRecords = 0;
  let skipped = 0;
  let previousAttemptAt = 0;
  for (const reportMonth of months) {
    for (const market of selectedMarkets) {
      for (const issuerType of selectedTypes) {
        const url = reportUrl(market, reportMonth, issuerType);
        const key = `${market}|${reportMonth}|${issuerType}`;
        const prior = checkpoints.get(key);
        if (prior?.status === 'complete' && !recheckCompleted) { skipped += 1; continue; }
        if (attempts >= maxRequests) return {result: 'budget-exhausted', totalJobs, completed, skipped, attempts, addedRecords, remainingJobs: totalJobs - completed - skipped};
        const fetched = await fetchWithRetry(url, {
          retries, fetchImpl,
          onAttempt: async () => {
            if (attempts >= maxRequests) throw new Error('Request budget exhausted before retry; rerun with the same range to resume.');
            const wait = Math.max(0, delayMs - (Date.now() - previousAttemptAt));
            if (previousAttemptAt && wait) await sleep(wait);
            previousAttemptAt = Date.now();
            attempts += 1;
          }
        });
        const sourceHash = sha256(fetched.bytes);
        const parsed = parseMonthlyReport(fetched.text, {reportMonth, market, issuerType});
        const rawPath = path.join(rawDir, market, reportMonth.slice(0, 4), `${reportMonth}-${ISSUER_TYPE[issuerType]}-${sourceHash}.html`);
        await mkdir(path.dirname(rawPath), {recursive: true});
        if (!await exists(rawPath)) await appendFile(rawPath, fetched.bytes, {flag: 'wx'});
        const retrievedAt = new Date().toISOString();
        const newRows = [];
        for (const row of parsed.records) {
          const normalized = {...row, retrievedAt, sourceSha256: sourceHash, rawResponsePath: path.relative(root, rawPath)};
          const signature = sha256(Buffer.from(JSON.stringify(row)));
          normalized.recordSignature = signature;
          if (recordSignatures.has(signature)) continue;
          recordSignatures.add(signature);
          newRows.push(normalized);
        }
        await appendJsonl(recordsPath, newRows);
        addedRecords += newRows.length;
        const checkpoint = {
          key, status: 'complete', market, reportMonth, issuerType,
          sourceUrl: url, sourceSha256: sourceHash, recordCount: parsed.records.length,
          recordsAdded: newRows.length, retrievedAt, rawResponsePath: path.relative(root, rawPath)
        };
        await appendJsonl(checkpointsPath, [checkpoint]);
        checkpoints.set(key, checkpoint);
        completed += 1;
      }
    }
  }
  return {result: 'complete', totalJobs, completed, skipped, attempts, addedRecords, remainingJobs: 0};
}

export const HELP = `Usage: node automation/mops-monthly-backfill.mjs --from YYYY-MM --to YYYY-MM --out PATH [options]

Options:
  --markets sii,otc,rotc,pub Official MOPS report families, default all four
  --issuer-types 0,1         0 domestic, 1 foreign, default both populations
  --max-requests N           Per-run request cap, default 8, maximum 200
  --delay-ms N               Minimum serial delay between requests, default 3000
  --retries N                Bounded transient retries, default 3, maximum 5
  --recheck-completed        Re-fetch saved partitions to capture revisions
  --help                     Show this help

Output files are append-only: records.jsonl, checkpoints.jsonl, and raw HTML
snapshots named by SHA-256. Run again with the same range to resume. The script
does not write to the live Google Sheet or the public site.
`;

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) { console.log(HELP); return; }
  if (!options.from || !options.to || !options.out) throw new Error(HELP);
  const result = await runBackfill(backfillOptionsFromCli(options));
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
