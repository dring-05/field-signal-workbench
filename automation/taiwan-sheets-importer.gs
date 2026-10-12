const SIGNALS = {
  spreadsheetId: '1qNrg6QhGKBai0jOa6teL1WNsiCazZQQmRVA4Po5fuIY',
  monthlyUrl: 'https://openapi.twse.com.tw/v1/opendata/t187ap05_P',
  monthlyCsvFallback: 'https://mopsfin.twse.com.tw/opendata/t187ap05_P.csv',
  sourceBase: 'https://openapi.twse.com.tw/v1/opendata/',
  monthlySheet: 'Taiwan Monthly',
  feedSheet: 'SiteFeed',
  rawSheet: 'Raw Statements',
  logSheet: 'Import Log',
  market: 'Taiwan public issuers'
};

const RAW_HEADERS = ['Market', 'Data area', 'Endpoint', 'Company code', 'Company name', 'Report period', 'Retrieved at', 'Raw source record', 'Source URL', 'Record signature'];
const LOG_HEADERS = ['Run time', 'Result', 'Monthly source period', 'Rows received', 'Rows added or revised', 'Raw records added or revised', 'Notes'];

function setupTaiwanSignals() {
  const book = SpreadsheetApp.openById(SIGNALS.spreadsheetId);
  ensureHeader_(book, SIGNALS.monthlySheet, ['Market', 'Company code', 'Company name', 'Industry', 'Report month', 'Revenue current month', 'Revenue prior month', 'Revenue year-ago month', 'MoM growth %', 'YoY growth %', 'YTD revenue', 'Prior-year YTD revenue', 'YTD growth %', 'Currency / unit', 'Source URL', 'Retrieved at', 'Source record']);
  ensureHeader_(book, SIGNALS.feedSheet, ['Market', 'Company code', 'Company name', 'Industry', 'Report month', 'Revenue', 'Revenue YoY %', 'YoY change 1 month (pp)', 'YoY change 2 months (pp)', 'YoY change 3 months (pp)', 'Consecutive monthly observations', 'Gross margin %', 'Gross margin change YoY (pp)', 'Operating margin %', 'Operating margin change YoY (pp)', 'Latest filing date', 'Data status', 'Source URL']);
  ensureHeader_(book, SIGNALS.rawSheet, RAW_HEADERS);
  ensureHeader_(book, SIGNALS.logSheet, LOG_HEADERS);
  const triggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'refreshTaiwanSignals');
  triggers.forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('refreshTaiwanSignals').timeBased().everyDays(1).atHour(7).inTimezone('America/New_York').create();
  writeLog_('Setup complete', '', 0, 0, 0, 'Daily refresh trigger set for about 07:00 America/New_York. Run refreshTaiwanSignals once to authorize and test the official sources.');
}

function refreshTaiwanSignals() {
  const started = new Date();
  let reportMonth = '';
  let received = 0;
  let monthlyAdded = 0;
  let rawAdded = 0;
  const notes = [];
  try {
    const book = SpreadsheetApp.openById(SIGNALS.spreadsheetId);
    const monthlyRows = fetchMonthlyRows_();
    received = monthlyRows.length;
    const normalized = monthlyRows.map(normalizeMonthly_).filter(r => r.code && r.period);
    if (!normalized.length) throw new Error('The monthly revenue feed returned no rows with a company code and report month.');
    reportMonth = normalized.reduce((max, r) => r.period > max ? r.period : max, '');
    monthlyAdded = appendMonthlyRevisions_(book.getSheetByName(SIGNALS.monthlySheet), normalized);
    rawAdded = appendRawStatementRevisions_(book, notes);
    rebuildSiteFeed_(book);
    writeLog_('Success', reportMonth, received, monthlyAdded, rawAdded, notes.join(' '));
    return {result: 'Success', reportMonth, received, monthlyAdded, rawAdded, runtimeSeconds: Math.round((new Date() - started) / 1000)};
  } catch (err) {
    notes.push(String(err && err.message || err));
    writeLog_('Failed', reportMonth, received, monthlyAdded, rawAdded, notes.join(' '));
    throw err;
  }
}

function fetchMonthlyRows_() {
  try {
    return fetchRecords_(SIGNALS.monthlyUrl);
  } catch (firstError) {
    return fetchRecords_(SIGNALS.monthlyCsvFallback);
  }
}

function appendRawStatementRevisions_(book, notes) {
  const raw = book.getSheetByName(SIGNALS.rawSheet);
  const endpoints = [];
  ['basi', 'bd', 'ci', 'fh', 'ins', 'mim'].forEach(suffix => {
    endpoints.push({area: 'Quarterly income statement', endpoint: 't187ap06_X_' + suffix});
    endpoints.push({area: 'Quarterly balance sheet', endpoint: 't187ap07_X_' + suffix});
  });
  endpoints.push({area: 'Director and supervisor ownership', endpoint: 't187ap11_P'});
  const prior = raw.getLastRow() > 4 ? raw.getRange(5, 10, raw.getLastRow() - 4, 1).getDisplayValues().flat() : [];
  const signatures = new Set(prior.filter(Boolean));
  const additions = [];
  endpoints.forEach(item => {
    const url = SIGNALS.sourceBase + item.endpoint;
    try {
      fetchRecords_(url).forEach(record => {
        const code = textField_(record, ['公司代號', '公司代碼', '公司編號', 'SecuritiesCompanyCode', '公司代碼(公司代號)']);
        const name = textField_(record, ['公司名稱', '公司簡稱', 'CompanyName', 'CompanyNameEnglish']);
        const period = reportPeriod_(textField_(record, ['資料年月', '年月', '年度', '季別', '報告年度', 'ReportPeriod', 'Date']));
        const rawJson = JSON.stringify(record);
        const signature = [item.endpoint, code, period, rawJson].join('|');
        if (signatures.has(signature)) return;
        signatures.add(signature);
        additions.push([SIGNALS.market, item.area, item.endpoint, code, name, period, new Date(), rawJson, url, signature]);
      });
    } catch (err) {
      notes.push(item.endpoint + ': ' + String(err && err.message || err));
    }
  });
  if (additions.length) raw.getRange(raw.getLastRow() + 1, 1, additions.length, RAW_HEADERS.length).setValues(additions);
  return additions.length;
}

function appendMonthlyRevisions_(sheet, rows) {
  const existing = sheet.getLastRow() > 4 ? sheet.getRange(5, 1, sheet.getLastRow() - 4, 17).getValues() : [];
  const signatures = new Set(existing.map(row => String(row[1]) + '|' + String(row[4]) + '|' + String(row[16])));
  const additions = [];
  rows.forEach(r => {
    const rawJson = JSON.stringify(r.raw);
    const signature = r.code + '|' + r.period + '|' + rawJson;
    if (signatures.has(signature)) return;
    signatures.add(signature);
    additions.push([SIGNALS.market, r.code, r.name, r.industry, r.period, r.current, r.prior, r.yearAgo, r.mom, r.yoy, r.ytd, r.priorYtd, r.ytdGrowth, 'As published', SIGNALS.monthlyUrl, new Date(), rawJson]);
  });
  if (additions.length) sheet.getRange(sheet.getLastRow() + 1, 1, additions.length, 17).setValues(additions);
  return additions.length;
}

function rebuildSiteFeed_(book) {
  const monthly = book.getSheetByName(SIGNALS.monthlySheet);
  const feed = book.getSheetByName(SIGNALS.feedSheet);
  const values = monthly.getLastRow() > 4 ? monthly.getRange(5, 1, monthly.getLastRow() - 4, 17).getValues() : [];
  const latestByMonth = new Map();
  values.forEach(row => {
    const code = String(row[1] || '').trim();
    const period = String(row[4] || '').trim();
    if (!code || !period) return;
    latestByMonth.set(code + '|' + period, row);
  });
  const byCode = new Map();
  latestByMonth.forEach(row => {
    const code = String(row[1]);
    if (!byCode.has(code)) byCode.set(code, []);
    byCode.get(code).push(row);
  });
  const output = [];
  byCode.forEach(history => {
    history.sort((a, b) => a[4] < b[4] ? -1 : a[4] > b[4] ? 1 : 0);
    const current = history[history.length - 1];
    const periods = history.map(r => String(r[4]));
    const index = periods.length - 1;
    const y = history.map(r => number_(r[9]));
    const continuous = contiguousMonths_(periods, index);
    const validY = i => typeof y[i] === 'number' && Number.isFinite(y[i]);
    const d1 = continuous >= 14 && validY(index) && validY(index - 1) ? y[index] - y[index - 1] : '';
    const d2 = continuous >= 15 && validY(index) && validY(index - 1) && validY(index - 2) ? y[index] - 2 * y[index - 1] + y[index - 2] : '';
    const d3 = continuous >= 16 && validY(index) && validY(index - 1) && validY(index - 2) && validY(index - 3) ? y[index] - 3 * y[index - 1] + 3 * y[index - 2] - y[index - 3] : '';
    const raw = parseJson_(current[16]);
    const filingDate = textField_(raw, ['出表日期', '公告日期', '發布日期', '發布時間', '發佈時間']);
    const status = d3 !== '' ? '3rd difference available; based on ' + continuous + ' consecutive monthly observations' : 'History: ' + continuous + ' consecutive month(s); 3rd difference needs 16 revenue months';
    output.push([current[0], current[1], current[2], current[3], current[4], number_(current[5]), number_(current[9]), d1, d2, d3, continuous, '', '', '', '', filingDate, status, current[14]]);
  });
  output.sort((a, b) => (Number(b[7]) || -Infinity) - (Number(a[7]) || -Infinity));
  if (feed.getLastRow() > 4) feed.getRange(5, 1, feed.getLastRow() - 4, 18).clearContent();
  if (output.length) feed.getRange(5, 1, output.length, 18).setValues(output);
}

function contiguousMonths_(periods, index) {
  let count = 1;
  for (let i = index; i > 0; i--) {
    if (monthDistance_(periods[i - 1], periods[i]) !== 1) break;
    count++;
  }
  return count;
}

function normalizeMonthly_(raw) {
  return {
    raw,
    code: textField_(raw, ['公司代號', '公司代碼', '公司編號', '證券代號']),
    name: textField_(raw, ['公司名稱', '公司簡稱']),
    industry: textField_(raw, ['產業別', '產業名稱']),
    period: reportPeriod_(textField_(raw, ['資料年月', '年月', '報表年月'])),
    current: numericField_(raw, ['營業收入-當月營收', '當月營收', 'currentmonthrevenue']),
    prior: numericField_(raw, ['營業收入-上月營收', '上月營收', 'previousmonthrevenue']),
    yearAgo: numericField_(raw, ['營業收入-去年當月營收', '去年當月營收', 'yearagomonthrevenue']),
    mom: numericField_(raw, ['營業收入-上月比較增減(%)', '上月比較增減(%)', 'monthovermonthchange']),
    yoy: numericField_(raw, ['營業收入-去年同月增減(%)', '去年同月增減(%)', 'yearoveryearchange']),
    ytd: numericField_(raw, ['累計營業收入-當月累計營收', '當月累計營收', 'year-to-daterevenue']),
    priorYtd: numericField_(raw, ['累計營業收入-去年累計營收', '去年累計營收', 'prioryearytdrevenue']),
    ytdGrowth: numericField_(raw, ['累計營業收入-前期比較增減(%)', '前期比較增減(%)', 'ytdgrowth'])
  };
}

function fetchRecords_(url) {
  const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true, followRedirects: true, headers: {'User-Agent': 'FieldSignals research workbook contact: public-source use'}});
  const code = response.getResponseCode();
  if (code < 200 || code >= 300) throw new Error('HTTP ' + code + ' from ' + url);
  const body = response.getContentText('UTF-8').replace(/^\uFEFF/, '').trim();
  if (!body) throw new Error('Empty response from ' + url);
  if (body[0] === '[') return JSON.parse(body);
  if (body[0] === '{') {
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed.data)) return parsed.data;
    if (Array.isArray(parsed)) return parsed;
    return [parsed];
  }
  const table = Utilities.parseCsv(body);
  if (table.length < 2) throw new Error('Response did not contain tabular records from ' + url);
  const headers = table[0].map(String);
  return table.slice(1).filter(row => row.some(Boolean)).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] || ''])));
}

function ensureHeader_(book, name, headers) {
  let sheet = book.getSheetByName(name);
  if (!sheet) sheet = book.insertSheet(name);
  sheet.getRange(4, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(4);
  sheet.getRange(4, 1, 1, headers.length).setFontWeight('bold').setBackground('#DDE8F4').setWrap(true);
  return sheet;
}

function writeLog_(result, period, received, monthlyAdded, rawAdded, notes) {
  try {
    const book = SpreadsheetApp.openById(SIGNALS.spreadsheetId);
    const sheet = book.getSheetByName(SIGNALS.logSheet) || ensureHeader_(book, SIGNALS.logSheet, LOG_HEADERS);
    if (sheet.getLastRow() < 4) ensureHeader_(book, SIGNALS.logSheet, LOG_HEADERS);
    sheet.appendRow([new Date(), result, period, received, monthlyAdded, rawAdded, notes]);
  } catch (ignored) {
    console.log('Could not write import log: ' + ignored);
  }
}

function textField_(obj, aliases) {
  const keys = Object.keys(obj || {});
  for (const alias of aliases) if (Object.prototype.hasOwnProperty.call(obj, alias)) return String(obj[alias] == null ? '' : obj[alias]).trim();
  const normalizedAliases = aliases.map(normalizeKey_);
  for (const key of keys) if (normalizedAliases.includes(normalizeKey_(key))) return String(obj[key] == null ? '' : obj[key]).trim();
  return '';
}

function numericField_(obj, aliases) {
  const value = textField_(obj, aliases);
  return value === '' ? '' : number_(value);
}

function number_(value) {
  if (value === '' || value == null) return '';
  const n = Number(String(value).replace(/[,%\s]/g, ''));
  return Number.isFinite(n) ? n : '';
}

function reportPeriod_(value) {
  const s = String(value || '').trim();
  let m = s.match(/^(\d{3})(\d{2})$/);
  if (m) return String(Number(m[1]) + 1911) + '-' + m[2];
  m = s.match(/^(\d{4})[-/]?(\d{2})$/);
  return m ? m[1] + '-' + m[2] : s;
}

function monthDistance_(a, b) {
  const pa = String(a).match(/^(\d{4})-(\d{2})$/);
  const pb = String(b).match(/^(\d{4})-(\d{2})$/);
  if (!pa || !pb) return NaN;
  return (Number(pb[1]) * 12 + Number(pb[2])) - (Number(pa[1]) * 12 + Number(pa[2]));
}

function normalizeKey_(key) {
  return String(key).toLowerCase().replace(/[\s\p{P}\p{S}_]/gu, '');
}

function parseJson_(value) {
  try { return JSON.parse(String(value || '{}')); } catch (err) { return {}; }
}
