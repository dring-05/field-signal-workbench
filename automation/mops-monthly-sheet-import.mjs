#!/usr/bin/env node

/**
 * Prepare a reviewable, append-only CSV for pasting into Taiwan Monthly.
 * This tool never connects to or writes to Google Sheets.
 */
import {readFile, writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

export const SHEET_HEADERS = [
  'Market', 'Company code', 'Company name', 'Industry', 'Report month',
  'Revenue current month', 'Revenue prior month', 'Revenue year-ago month',
  'MoM growth %', 'YoY growth %', 'YTD revenue', 'Prior-year YTD revenue',
  'YTD growth %', 'Currency / unit', 'Source URL', 'Retrieved at', 'Source record'
];

const MARKETS = Object.freeze({
  sii: 'Listed (TWSE)',
  otc: 'OTC (TPEx)',
  rotc: 'Emerging (MOPS)',
  pub: 'Publicly issued (MOPS)'
});
const ECONOMIC_FIELDS = ['revenue', 'priorMonthRevenue', 'yearAgoRevenue', 'monthChangePct', 'yearChangePct', 'ytdRevenue', 'priorYearYtdRevenue', 'ytdChangePct'];

function csvRows(text) {
  const rows = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { value += '"'; i += 1; }
      else if (char === '"') quoted = false;
      else value += char;
    } else if (char === '"' && value === '') quoted = true;
    else if (char === ',') { row.push(value); value = ''; }
    else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value); rows.push(row); row = []; value = '';
    } else value += char;
  }
  if (quoted) throw new Error('Existing Taiwan Monthly CSV has an unclosed quoted field.');
  if (row.length || value) { row.push(value); rows.push(row); }
  return rows;
}

function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function normalizeName(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function normalizeMarket(value) {
  const market = String(value || '').trim();
  return market === 'Taiwan public issuers' ? 'Publicly issued (MOPS)' : market;
}

function numberKey(value) {
  if (value == null || String(value).trim() === '') return '';
  const number = Number(String(value).replace(/[,%\s]/g, ''));
  return Number.isFinite(number) ? String(number) : `invalid:${String(value).trim()}`;
}

function issuerPeriodKey(row, market) {
  return [market, String(row['Company code'] || '').trim(), normalizeName(row['Company name']), String(row['Report month'] || '').trim()].join('|');
}

function dataSignature(row, market) {
  return issuerPeriodKey(row, market) + '|' + [
    'Revenue current month', 'Revenue prior month', 'Revenue year-ago month', 'MoM growth %',
    'YoY growth %', 'YTD revenue', 'Prior-year YTD revenue', 'YTD growth %'
  ].map(header => numberKey(row[header])).join('|');
}

function existingRowsFromCsv(text) {
  const rows = csvRows(text.replace(/^\uFEFF/, ''));
  const headerIndex = rows.findIndex(row => row.includes('Report month') && row.includes('Company code'));
  if (headerIndex < 0) throw new Error('Could not find the Taiwan Monthly header row in the exported CSV.');
  const headers = rows[headerIndex];
  for (const required of SHEET_HEADERS) {
    if (!headers.includes(required)) throw new Error(`Existing Taiwan Monthly export is missing column: ${required}`);
  }
  return rows.slice(headerIndex + 1).filter(row => row.some(Boolean)).map(values => Object.fromEntries(headers.map((header, index) => [header, values[index] || ''])));
}

function normalizeBackfillRecord(record) {
  const market = MARKETS[record.market];
  if (!market) throw new Error(`Unsupported MOPS market ${record.market || '(blank)'}`);
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(String(record.reportMonth || ''))) throw new Error(`Invalid report month for ${record.companyCode || 'unknown issuer'}`);
  if (!String(record.companyCode || '').trim() || !String(record.companyName || '').trim()) throw new Error('Backfill row is missing company code or name.');
  if (typeof record.revenue !== 'number' || !Number.isFinite(record.revenue) || typeof record.yearChangePct !== 'number' || !Number.isFinite(record.yearChangePct)) {
    throw new Error(`Backfill row ${record.companyCode} ${record.reportMonth} lacks numeric revenue or YoY growth.`);
  }
  const sourceRecord = Object.fromEntries(ECONOMIC_FIELDS.map(key => [key, record[key] ?? null]));
  const row = {
    'Market': market,
    'Company code': String(record.companyCode).trim(),
    'Company name': String(record.companyName).trim(),
    'Industry': String(record.industry || ''),
    'Report month': record.reportMonth,
    'Revenue current month': record.revenue,
    'Revenue prior month': record.priorMonthRevenue ?? '',
    'Revenue year-ago month': record.yearAgoRevenue ?? '',
    'MoM growth %': record.monthChangePct ?? '',
    'YoY growth %': record.yearChangePct,
    'YTD revenue': record.ytdRevenue ?? '',
    'Prior-year YTD revenue': record.priorYearYtdRevenue ?? '',
    'YTD growth %': record.ytdChangePct ?? '',
    'Currency / unit': `${record.currency || 'TWD'} ${record.unit || 'thousand'}`,
    'Source URL': String(record.sourceUrl || ''),
    'Retrieved at': String(record.retrievedAt || ''),
    'Source record': JSON.stringify({sourceDataset: record.sourceDataset || 'MOPS Monthly Business Income Summary Table', sourceSha256: record.sourceSha256 || '', reportTitle: record.reportTitle || '', ...sourceRecord})
  };
  return {row, market};
}

export function prepareSheetImport(records, existingCsv) {
  const existing = existingRowsFromCsv(existingCsv);
  const existingExact = new Set();
  const existingKeys = new Set();
  for (const row of existing) {
    const market = normalizeMarket(row.Market);
    if (!row['Company code'] || !row['Report month']) continue;
    existingExact.add(dataSignature(row, market));
    existingKeys.add(issuerPeriodKey(row, market));
  }
  const output = [];
  const stagedExact = new Set();
  const stagedKeys = new Set();
  let unchanged = 0;
  let duplicateInput = 0;
  let revisions = 0;
  for (const record of records) {
    const {row, market} = normalizeBackfillRecord(record);
    const exact = dataSignature(row, market);
    const key = issuerPeriodKey(row, market);
    if (existingExact.has(exact) || stagedExact.has(exact)) {
      if (stagedExact.has(exact)) duplicateInput += 1;
      else unchanged += 1;
      continue;
    }
    if (existingKeys.has(key) || stagedKeys.has(key)) revisions += 1;
    stagedExact.add(exact);
    stagedKeys.add(key);
    output.push(SHEET_HEADERS.map(header => row[header]));
  }
  return {rows: output, unchanged, duplicateInput, revisions, inputRecords: records.length};
}

export async function prepareImportFiles({recordsPath, existingSheetCsvPath, outPath}) {
  const [recordsText, existingCsv] = await Promise.all([
    readFile(recordsPath, 'utf8'), readFile(existingSheetCsvPath, 'utf8')
  ]);
  const records = recordsText.split(/\r?\n/).filter(Boolean).map((line, index) => {
    try { return JSON.parse(line); }
    catch { throw new Error(`Invalid JSONL at line ${index + 1} in ${recordsPath}`); }
  });
  const result = prepareSheetImport(records, existingCsv);
  const csv = result.rows.map(row => row.map(csvCell).join(',')).join('\r\n');
  await writeFile(outPath, csv ? csv + '\r\n' : '', {encoding: 'utf8', flag: 'wx'});
  return {...result, outPath: path.resolve(outPath)};
}

export const HELP = `Usage: node automation/mops-monthly-sheet-import.mjs --records PATH --existing-sheet-csv PATH --out PATH

Reads an append-only MOPS backfill records.jsonl file and a private CSV export
of the current Taiwan Monthly tab. Writes a reviewable CSV containing only
new observations and changed revisions. The output has no header row so it can
be pasted below the existing Taiwan Monthly rows. Existing output files are
never overwritten. This tool does not connect to or write to Google Sheets.
`;

async function main() {
  const args = {};
  for (let index = 0; index < process.argv.length; index += 1) {
    const arg = process.argv[index];
    if (arg === '--help') { console.log(HELP); return; }
    if (['--records', '--existing-sheet-csv', '--out'].includes(arg)) args[arg.slice(2)] = process.argv[++index];
  }
  if (!args.records || !args['existing-sheet-csv'] || !args.out) throw new Error(HELP);
  const result = await prepareImportFiles({recordsPath: args.records, existingSheetCsvPath: args['existing-sheet-csv'], outPath: args.out});
  console.log(JSON.stringify(result, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
