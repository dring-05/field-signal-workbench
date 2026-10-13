const SIGNALS = {
  spreadsheetId: '1qNrg6QhGKBai0jOa6teL1WNsiCazZQQmRVA4Po5fuIY',
  monthlyUrl: 'https://openapi.twse.com.tw/v1/opendata/t187ap05_P',
  monthlyCsvFallback: 'https://mopsfin.twse.com.tw/opendata/t187ap05_P.csv',
  sourceBase: 'https://openapi.twse.com.tw/v1/opendata/',
  monthlySheet: 'Taiwan Monthly',
  feedSheet: 'SiteFeed',
  rawSheet: 'Raw Statements',
  marginAuditSheet: 'Margin Signals',
  logSheet: 'Import Log',
  market: 'Taiwan public issuers'
};

const RAW_HEADERS = ['Market', 'Data area', 'Endpoint', 'Company code', 'Company name', 'Report period', 'Retrieved at', 'Raw source record', 'Source URL', 'Record signature'];
const MARGIN_AUDIT_HEADERS = ['Market', 'Company code', 'Company name', 'Report period', 'Source endpoint', 'Retrieved at', 'Source URL', 'Source signature', 'Prior-quarter source signature', 'Calculation signature', 'Source basis', 'Revenue reported YTD', 'Gross profit reported YTD', 'Operating income reported YTD', 'Prior-quarter revenue YTD', 'Prior-quarter gross profit YTD', 'Prior-quarter operating income YTD', 'Revenue standalone quarter', 'Gross profit standalone quarter', 'Operating income standalone quarter', 'Gross margin %', 'Operating margin %', 'Gross margin YoY change (pp)', 'Operating margin YoY change (pp)', 'Calculation status', 'Raw source record'];
const LOG_HEADERS = ['Run time', 'Result', 'Monthly source period', 'Rows received', 'Rows added or revised', 'Raw records added or revised', 'Notes'];
const FEED_HEADERS = ['Market', 'Company code', 'Company name', 'Industry', 'Report month', 'Revenue', 'Revenue YoY %', 'Revenue YoY Δ1 (pp/month)', 'Revenue YoY Δ2 (pp/month²)', 'Revenue YoY Δ3 (pp/month³)', 'Consecutive monthly observations', 'Gross margin %', 'Gross margin YoY change (pp)', 'Gross margin Δ1 (pp/quarter)', 'Gross margin Δ2 (pp/quarter²)', 'Gross margin Δ3 (pp/quarter³)', 'Operating margin %', 'Operating margin YoY change (pp)', 'Operating margin Δ1 (pp/quarter)', 'Operating margin Δ2 (pp/quarter²)', 'Operating margin Δ3 (pp/quarter³)', 'Latest statement date', 'Data status', 'Monthly source URL'];

function setupTaiwanSignals() {
  const book = SpreadsheetApp.openById(SIGNALS.spreadsheetId);
  ensureHeader_(book, SIGNALS.monthlySheet, ['Market', 'Company code', 'Company name', 'Industry', 'Report month', 'Revenue current month', 'Revenue prior month', 'Revenue year-ago month', 'MoM growth %', 'YoY growth %', 'YTD revenue', 'Prior-year YTD revenue', 'YTD growth %', 'Currency / unit', 'Source URL', 'Retrieved at', 'Source record']);
  ensureHeader_(book, SIGNALS.feedSheet, FEED_HEADERS);
  ensureHeader_(book, SIGNALS.rawSheet, RAW_HEADERS);
  ensureHeader_(book, SIGNALS.marginAuditSheet, MARGIN_AUDIT_HEADERS);
  ensureHeader_(book, SIGNALS.logSheet, LOG_HEADERS);
  const triggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'refreshTaiwanSignals');
  if (!triggers.length) ScriptApp.newTrigger('refreshTaiwanSignals').timeBased().everyDays(1).atHour(7).inTimezone('America/New_York').create();
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
    const monthlyFeed = fetchMonthlyRows_();
    received = monthlyFeed.records.length;
    const normalized = monthlyFeed.records.map(record => normalizeMonthly_(record, monthlyFeed.url)).filter(r => r.code && r.period);
    if (!normalized.length) throw new Error('The monthly revenue feed returned no rows with a company code and report month.');
    reportMonth = normalized.reduce((max, r) => r.period > max ? r.period : max, '');
    monthlyAdded = appendMonthlyRevisions_(book.getSheetByName(SIGNALS.monthlySheet), normalized);
    rawAdded = appendRawStatementRevisions_(book, notes);
    rebuildSiteFeed_(book);
    const result = notes.length ? 'Partial success' : 'Success';
    writeLog_(result, reportMonth, received, monthlyAdded, rawAdded, notes.join(' '));
    return {result, reportMonth, received, monthlyAdded, rawAdded, runtimeSeconds: Math.round((new Date() - started) / 1000), notes};
  } catch (err) {
    notes.push(String(err && err.message || err));
    writeLog_('Failed', reportMonth, received, monthlyAdded, rawAdded, notes.join(' '));
    throw err;
  }
}

function fetchMonthlyRows_() {
  try {
    return {records: fetchRecords_(SIGNALS.monthlyUrl), url: SIGNALS.monthlyUrl};
  } catch (firstError) {
    return {records: fetchRecords_(SIGNALS.monthlyCsvFallback), url: SIGNALS.monthlyCsvFallback};
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
        const period = item.area.indexOf('Quarterly') === 0 ? quarterPeriod_(record) : reportPeriod_(textField_(record, ['資料年月', '年月', '年度', '報告年度', 'ReportPeriod', 'Date']));
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
    additions.push([SIGNALS.market, r.code, r.name, r.industry, r.period, r.current, r.prior, r.yearAgo, r.mom, r.yoy, r.ytd, r.priorYtd, r.ytdGrowth, 'As published', r.sourceUrl, new Date(), rawJson]);
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
  const marginMap = marginSignalsMap_(book);
  const output = [];
  byCode.forEach((history, code) => {
    history.sort((a, b) => a[4] < b[4] ? -1 : a[4] > b[4] ? 1 : 0);
    const current = history[history.length - 1];
    const periods = history.map(r => String(r[4]));
    const index = periods.length - 1;
    const y = history.map(r => number_(r[9]));
    const continuous = contiguousMonths_(periods, index);
    const diffs = finiteDifferencesAtEnd_(y, continuous);
    const margin = marginMap.get(code) || emptyMarginSignals_();
    if (/金融|保險|證券|期貨|金控|financial|insurance|securities|bank/i.test(String(current[3] || ''))) {
      margin.status = 'Generic gross and operating margins are not comparable for financial-sector issuers; use sector-specific indicators instead';
    }
    const status = [
      diffs.d3 !== '' ? 'Revenue Δ3 available' : 'Revenue Δ3 needs 4 consecutive monthly YoY observations',
      margin.status
    ].filter(Boolean).join('; ');
    output.push([current[0], current[1], current[2], current[3], current[4], number_(current[5]), number_(current[9]), diffs.d1, diffs.d2, diffs.d3, continuous, margin.gross, margin.grossYoY, margin.grossD1, margin.grossD2, margin.grossD3, margin.operating, margin.operatingYoY, margin.operatingD1, margin.operatingD2, margin.operatingD3, margin.statementDate, status, current[14]]);
  });
  output.sort((a, b) => (Number(b[7]) || -Infinity) - (Number(a[7]) || -Infinity));
  if (feed.getLastRow() > 4) feed.getRange(5, 1, feed.getLastRow() - 4, FEED_HEADERS.length).clearContent();
  if (output.length) feed.getRange(5, 1, output.length, FEED_HEADERS.length).setValues(output);
}

function emptyMarginSignals_() {
  return {gross: '', grossYoY: '', grossD1: '', grossD2: '', grossD3: '', operating: '', operatingYoY: '', operatingD1: '', operatingD2: '', operatingD3: '', statementDate: '', status: 'Quarterly margins need matched general-industry filings'};
}

function marginSignalsMap_(book) {
  const result = new Map();
  const raw = book.getSheetByName(SIGNALS.rawSheet);
  if (!raw || raw.getLastRow() <= 4) return result;
  const values = raw.getRange(5, 1, raw.getLastRow() - 4, RAW_HEADERS.length).getValues();
  const byCompany = new Map();
  const latestByQuarter = new Map();
  values.forEach(row => {
    if (String(row[2]) !== 't187ap06_X_ci') return;
    const companyCode = String(row[3] || '').trim();
    if (!companyCode) return;
    const q = String(row[5] || '');
    if (!/^\d{4}-Q[1-4]$/.test(q)) return;
    const record = parseJson_(row[7]);
    const key = quarterIndex_(q);
    if (!Number.isFinite(key)) return;
    const id = companyCode + '|' + q;
    const retrievedAt = row[6] instanceof Date ? row[6].getTime() : new Date(row[6]).getTime() || 0;
    const prior = latestByQuarter.get(id);
    if (prior && prior.retrievedAt > retrievedAt) return;
    latestByQuarter.set(id, {
      companyCode, q, key,
      name: String(row[4] || ''),
      record,
      raw: String(row[7] || '{}'),
      endpoint: String(row[2]),
      sourceUrl: String(row[8] || ''),
      signature: String(row[9] || ''),
      retrievedAt,
      retrievedAtValue: row[6]
    });
  });
  latestByQuarter.forEach(item => {
    if (!byCompany.has(item.companyCode)) byCompany.set(item.companyCode, new Map());
    byCompany.get(item.companyCode).set(item.key, item);
  });
  const auditRows = [];
  byCompany.forEach((quarterMap, companyCode) => {
    const cumulative = [...quarterMap.values()].sort((a, b) => a.key - b.key);
    const series = [];
    let priorFiscalYear = '';
    let priorCumulative = null;
    cumulative.forEach(item => {
      const revenueYtd = numericField_(item.record, ['營業收入', '營業收入淨額', '收入']);
      const grossYtd = numericField_(item.record, ['營業毛利（毛損）淨額', '營業毛利（毛損）', '營業毛利淨額']);
      const operatingYtd = numericField_(item.record, ['營業利益（損失）', '營業利益損失', '營業利益']);
      const qMatch = item.q.match(/^(\d{4})-Q([1-4])$/);
      const fiscalYear = qMatch ? qMatch[1] : '';
      const qNumber = qMatch ? Number(qMatch[2]) : 0;
      const sameYearPrior = fiscalYear === priorFiscalYear && priorCumulative && item.key - priorCumulative.key === 1;
      const canDerive = qNumber === 1 || sameYearPrior;
      const deriveFlow_ = (current, previous) => {
        if (!canDerive || typeof current !== 'number' || !Number.isFinite(current)) return '';
        if (qNumber === 1) return current;
        return typeof previous === 'number' && Number.isFinite(previous) ? current - previous : '';
      };
      const revenue = deriveFlow_(revenueYtd, sameYearPrior ? priorCumulative.revenueYtd : '');
      const grossProfit = deriveFlow_(grossYtd, sameYearPrior ? priorCumulative.grossYtd : '');
      const operatingIncome = deriveFlow_(operatingYtd, sameYearPrior ? priorCumulative.operatingYtd : '');
      const validDenominator = typeof revenue === 'number' && Number.isFinite(revenue) && revenue > 0;
      const point = {
        ...item,
        revenueYtd, grossYtd, operatingYtd,
        priorRevenueYtd: sameYearPrior ? priorCumulative.revenueYtd : '',
        priorGrossYtd: sameYearPrior ? priorCumulative.grossYtd : '',
        priorOperatingYtd: sameYearPrior ? priorCumulative.operatingYtd : '',
        revenue, grossProfit, operatingIncome,
        gross: validDenominator && typeof grossProfit === 'number' ? grossProfit / revenue * 100 : '',
        operating: validDenominator && typeof operatingIncome === 'number' ? operatingIncome / revenue * 100 : '',
        status: canDerive ? (validDenominator ? 'Standalone quarter derived from cumulative YTD statement values' : 'Standalone quarter derived, but revenue denominator is missing or nonpositive') : 'Standalone quarter unavailable: prior cumulative quarter is missing'
      };
      series.push(point);
      priorFiscalYear = fiscalYear;
      priorCumulative = {key: item.key, revenueYtd, grossYtd, operatingYtd};
    });
    const marginSeries = series.filter(x => x.gross !== '' || x.operating !== '');
    marginSeries.forEach(item => {
      const priorYear = marginSeries.find(x => x.key === item.key - 4);
      item.grossYoY = priorYear && typeof item.gross === 'number' && typeof priorYear.gross === 'number' ? item.gross - priorYear.gross : '';
      item.operatingYoY = priorYear && typeof item.operating === 'number' && typeof priorYear.operating === 'number' ? item.operating - priorYear.operating : '';
    });
    series.forEach(item => {
      auditRows.push([
        SIGNALS.market, companyCode, item.name, item.q, item.endpoint,
        item.retrievedAtValue || '', item.sourceUrl, item.signature,
        sameQuarterPriorSignature_(quarterMap, item),
        ['MARGIN_YTD_DIFF_V1', item.signature, sameQuarterPriorSignature_(quarterMap, item)].join('|'),
        'Cumulative YTD, verified against MOPS financial comparison notes',
        item.revenueYtd, item.grossYtd, item.operatingYtd,
        item.priorRevenueYtd, item.priorGrossYtd, item.priorOperatingYtd,
        item.revenue, item.grossProfit, item.operatingIncome,
        item.gross, item.operating, item.grossYoY, item.operatingYoY,
        item.status, item.raw
      ]);
    });
    if (!series.length) return;
    const last = series[series.length - 1];
    const grossYoY = series.map(x => x.grossYoY);
    const operatingYoY = series.map(x => x.operatingYoY);
    const gm = differencesForQuarterSeries_(series, grossYoY);
    const om = differencesForQuarterSeries_(series, operatingYoY);
    result.set(companyCode, {
      gross: last.gross, grossYoY: last.grossYoY, grossD1: gm.d1, grossD2: gm.d2, grossD3: gm.d3,
      operating: last.operating, operatingYoY: last.operatingYoY, operatingD1: om.d1, operatingD2: om.d2, operatingD3: om.d3,
      statementDate: textField_(last.record, ['出表日期', '公告日期', '發布日期', '發布時間', '發佈時間']),
      status: last.status + '; margin Δ1/Δ2/Δ3 require 6/7/8 consecutive standalone quarter margins and corresponding prior-year quarters'
    });
  });
  appendMarginAudit_(book, auditRows);
  return result;
}

function appendMarginAudit_(book, rows) {
  const sheet = book.getSheetByName(SIGNALS.marginAuditSheet) || ensureHeader_(book, SIGNALS.marginAuditSheet, MARGIN_AUDIT_HEADERS);
  const existing = sheet.getLastRow() > 4 ? new Set(sheet.getRange(5, 10, sheet.getLastRow() - 4, 1).getDisplayValues().flat()) : new Set();
  const additions = rows.filter(row => row[9] && !existing.has(String(row[9])));
  if (additions.length) sheet.getRange(sheet.getLastRow() + 1, 1, additions.length, MARGIN_AUDIT_HEADERS.length).setValues(additions);
}

function sameQuarterPriorSignature_(quarterMap, item) {
  const q = item.q.match(/^(\d{4})-Q([1-4])$/);
  if (!q) return '';
  const quarter = Number(q[2]);
  if (quarter === 1) return '';
  const previous = quarterMap.get(item.key - 1);
  return previous ? previous.signature : '';
}

function yoyMarginSeries_(series, field) {
  const map = new Map(series.map(x => [x.key, x[field]]));
  return series.map(x => {
    const prior = map.get(x.key - 4);
    return typeof x[field] === 'number' && typeof prior === 'number' ? x[field] - prior : '';
  });
}

function differencesForQuarterSeries_(series, yoy) {
  const i = series.length - 1;
  if (i < 0) return {yoy: '', d1: '', d2: '', d3: ''};
  const contiguous = n => {
    if (i - n + 1 < 0) return false;
    for (let j = i - n + 1; j <= i; j++) {
      if (j > i - n + 1 && series[j].key - series[j - 1].key !== 1) return false;
      if (typeof yoy[j] !== 'number' || !Number.isFinite(yoy[j])) return false;
    }
    return true;
  };
  const valid = n => contiguous(n) && series[i].key - series[i - n + 1].key === n - 1;
  const diffs = finiteDifferencesAtEnd_(yoy, Math.max(0, ...[2, 3, 4].filter(valid).map(n => n)));
  return {yoy: yoy[i], d1: diffs.d1, d2: diffs.d2, d3: diffs.d3};
}

function finiteDifferencesAtEnd_(values, contiguousCount) {
  const i = values.length - 1;
  const valid = offset => typeof values[i - offset] === 'number' && Number.isFinite(values[i - offset]);
  const d1 = contiguousCount >= 2 && valid(0) && valid(1) ? values[i] - values[i - 1] : '';
  const d2 = contiguousCount >= 3 && valid(0) && valid(1) && valid(2) ? values[i] - 2 * values[i - 1] + values[i - 2] : '';
  const d3 = contiguousCount >= 4 && valid(0) && valid(1) && valid(2) && valid(3) ? values[i] - 3 * values[i - 1] + 3 * values[i - 2] - values[i - 3] : '';
  return {d1, d2, d3};
}

function contiguousMonths_(periods, index) {
  let count = 1;
  for (let i = index; i > 0; i--) {
    if (monthDistance_(periods[i - 1], periods[i]) !== 1) break;
    count++;
  }
  return count;
}

function normalizeMonthly_(raw, sourceUrl) {
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
    ytdGrowth: numericField_(raw, ['累計營業收入-前期比較增減(%)', '前期比較增減(%)', 'ytdgrowth']),
    sourceUrl: sourceUrl || SIGNALS.monthlyUrl
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

function quarterPeriod_(record) {
  const yearText = textField_(record || {}, ['年度', '報告年度', 'FiscalYear', 'Year']);
  const quarterText = textField_(record || {}, ['季別', '季度', 'Quarter', 'FiscalQuarter']);
  const yearMatch = yearText.match(/\d{3,4}/);
  const quarterMatch = quarterText.match(/[1-4]/);
  if (!yearMatch || !quarterMatch) return '';
  const yearNumber = Number(yearMatch[0]);
  const year = yearNumber < 1911 ? yearNumber + 1911 : yearNumber;
  return String(year) + '-Q' + quarterMatch[0];
}

function quarterIndex_(period) {
  const match = String(period || '').match(/^(\d{4})-Q([1-4])$/);
  return match ? Number(match[1]) * 4 + Number(match[2]) - 1 : NaN;
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
