#!/usr/bin/env node

/**
 * Read-only MOPS quarterly history probe.
 *
 * This deliberately preserves raw HTML instead of publishing parsed values.
 * The legacy MOPS form has not been live-tested from the current environment,
 * so extraction must wait until a human verifies real response shapes.
 */
import {createHash} from 'node:crypto';
import {appendFile, mkdir, readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const MOPS_ENDPOINT = 'https://mops.twse.com.tw/mops/web/ajax_t163sb04';
export const MARKETS = Object.freeze({
  sii: {label: 'Listed (TWSE)', cadence: 'quarterly'},
  otc: {label: 'OTC (TPEx)', cadence: 'quarterly'},
  rotc: {label: 'Emerging (MOPS)', cadence: 'semiannual'},
  pub: {label: 'Publicly issued (MOPS)', cadence: 'semiannual'}
});
const USER_AGENT = 'Field Signals Taiwan quarterly history research contact: public-data backfill';

function rocYear(year) {
  const value = Number(year);
  if (!Number.isInteger(value) || value < 1912 || value > 2500) throw new Error(`Invalid Gregorian year: ${year}`);
  return String(value - 1911);
}

function quarterKey(year, quarter) {
  return `${String(year).padStart(4, '0')}-Q${quarter}`;
}

function rangeQuarters(from, to) {
  const parse = value => {
    const match = String(value || '').match(/^(\d{4})-Q([1-4])$/);
    if (!match) throw new Error(`Period must use YYYY-QN format: ${value}`);
    return Number(match[1]) * 4 + Number(match[2]) - 1;
  };
  const start = parse(from);
  const end = parse(to);
  if (end < start) throw new Error('--to must be on or after --from.');
  const periods = [];
  for (let n = start; n <= end; n += 1) {
    const year = Math.floor(n / 4);
    const quarter = n % 4 + 1;
    periods.push({year, quarter, key: quarterKey(year, quarter)});
  }
  return periods;
}

export function requestForm(market, year, quarter) {
  if (!MARKETS[market]) throw new Error(`Unsupported market: ${market}`);
  if (!Number.isInteger(quarter) || quarter < 1 || quarter > 4) throw new Error(`Invalid quarter: ${quarter}`);
  return new URLSearchParams({
    encodeURIComponent: '1', step: '1', firstin: '1', off: '1', isQuery: 'Y',
    TYPEK: market, year: rocYear(year), season: String(quarter).padStart(2, '0')
  });
}

export function validateHtmlResponse(html, {market, period}) {
  const text = String(html || '');
  if (text.length < 500) throw new Error(`MOPS response for ${market} ${period} is unexpectedly short (${text.length} bytes).`);
  if (!/<html|<table/i.test(text)) throw new Error(`MOPS response for ${market} ${period} is not an HTML report.`);
  if (/查無資料|查無符合條件|無符合資料/i.test(text) && !/公司代號/.test(text)) {
    throw new Error(`MOPS returned a no-data message for ${market} ${period}.`);
  }
  if (!/公司代號/.test(text)) throw new Error(`MOPS response for ${market} ${period} has no issuer-code header; refusing to archive a likely error page.`);
  if (!/公司名稱/.test(text)) throw new Error(`MOPS response for ${market} ${period} has no issuer-name header; refusing to archive an unrecognized page.`);
  return {bytes: Buffer.byteLength(text), tables: (text.match(/<table\b/gi) || []).length};
}

function hash(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function fetchReport(fetchImpl, market, period) {
  const response = await fetchImpl(MOPS_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
      'user-agent': USER_AGENT,
      referer: 'https://mops.twse.com.tw/mops/#/web/t163sb04'
    },
    body: requestForm(market, period.year, period.quarter).toString()
  });
  if (!response.ok) throw new Error(`MOPS ${market} ${period.key} returned HTTP ${response.status}.`);
  const html = await response.text();
  const shape = validateHtmlResponse(html, {market, period: period.key});
  return {html, shape, status: response.status};
}

function outputName(market, key, digest) {
  return `${key}-${market}-${digest.slice(0, 16)}.html`;
}

export async function runProbe(options, fetchImpl = globalThis.fetch) {
  const {out, from = '2024-Q1', to, markets = ['sii', 'otc'], maxRequests, delayMs = 2500} = options || {};
  if (!out) throw new Error('--out is required. Choose a dedicated directory for raw probe files.');
  if (!to) throw new Error('--to is required.');
  if (!Number.isInteger(maxRequests) || maxRequests < 1) throw new Error('--max-requests is required and must be positive.');
  if (!Number.isInteger(delayMs) || delayMs < 1000 || delayMs > 60000) throw new Error('--delay-ms must be from 1000 to 60000.');
  if (!Array.isArray(markets) || !markets.length || markets.some(market => !MARKETS[market])) throw new Error('--markets must contain supported market codes.');
  const periods = rangeQuarters(from, to);
  const queue = periods.flatMap(period => markets
    .filter(market => MARKETS[market].cadence === 'quarterly' || [2, 4].includes(period.quarter))
    .map(market => ({market, period})));
  if (queue.length > maxRequests) throw new Error(`Planned ${queue.length} requests, exceeding --max-requests ${maxRequests}. Narrow the range or raise the explicit cap.`);
  const directory = path.resolve(out);
  await mkdir(directory, {recursive: true});
  const manifest = path.join(directory, 'probe-manifest.jsonl');
  const old = await readFile(manifest, 'utf8').catch(() => '');
  const known = new Set(old.split(/\r?\n/).filter(Boolean).map(line => {
    try { return JSON.parse(line).key; } catch { return ''; }
  }).filter(Boolean));
  const results = [];
  for (const [index, item] of queue.entries()) {
    const key = `${item.period.key}|${item.market}`;
    if (known.has(key)) continue;
    if (index > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
    const response = await fetchReport(fetchImpl, item.market, item.period);
    const digest = hash(response.html);
    const file = outputName(item.market, item.period.key, digest);
    await writeFile(path.join(directory, file), response.html, {flag: 'wx'}).catch(async error => {
      if (error.code !== 'EEXIST') throw error;
    });
    const line = {
      key, period: item.period.key, gregorianYear: item.period.year,
      rocYear: Number(rocYear(item.period.year)), quarter: item.period.quarter,
      market: item.market, marketLabel: MARKETS[item.market].label,
      observationCadence: MARKETS[item.market].cadence,
      endpoint: MOPS_ENDPOINT, method: 'POST', fetchedAt: new Date().toISOString(),
      status: response.status, sourceSha256: digest, file,
      responseBytes: response.shape.bytes, tableCount: response.shape.tables,
      extractionStatus: 'not-parsed-live-shape-unverified'
    };
    await appendFile(manifest, JSON.stringify(line) + '\n', 'utf8');
    results.push(line);
  }
  return {planned: queue.length, added: results.length, directory, results};
}

function cliOptions(argv) {
  const values = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) throw new Error(`Unexpected argument: ${arg}`);
    const key = arg.slice(2);
    if (key === 'help') return {help: true};
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`${arg} requires a value.`);
    values[key] = value;
  }
  return {
    out: values.out,
    from: values.from || '2024-Q1',
    to: values.to,
    markets: (values.markets || 'sii,otc').split(',').map(value => value.trim()),
    maxRequests: Number(values['max-requests']),
    delayMs: Number(values['delay-ms'] || 2500)
  };
}

export const HELP = `Usage: node automation/taiwan-quarterly-backfill.mjs --from 2024-Q1 --to 2026-Q2 --out /path/to/raw-mops-probe --max-requests 40 [--markets sii,otc] [--delay-ms 2500]

Read-only MOPS history probe. It stores raw response snapshots and an append-only manifest.
It does not parse financial values, update Sheets, or publish a site feed.
Markets: sii (listed, quarterly), otc (OTC, quarterly), rotc (emerging, semiannual), pub (public issuers, semiannual).
R/P requests are made only for Q2 and Q4. Treat these as H1/H2 filing periods, not standalone calendar quarters.
`;

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  try {
    const options = cliOptions(process.argv.slice(2));
    if (options.help) process.stdout.write(HELP);
    else process.stdout.write(JSON.stringify(await runProbe(options), null, 2) + '\n');
  } catch (error) {
    process.stderr.write(`Taiwan quarterly backfill probe failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}
