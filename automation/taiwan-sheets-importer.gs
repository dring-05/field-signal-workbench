const SIGNALS = {
  monthlySources: [
    {market: 'Listed (TWSE)', endpoint: 't187ap05_L', csvUrl: 'https://mopsfin.twse.com.tw/opendata/t187ap05_L.csv'},
    {market: 'OTC (TPEx)', endpoint: 't187ap05_O', csvUrl: 'https://mopsfin.twse.com.tw/opendata/t187ap05_O.csv'},
    {market: 'Emerging (MOPS)', endpoint: 't187ap05_R', csvUrl: 'https://mopsfin.twse.com.tw/opendata/t187ap05_R.csv'},
    {market: 'Publicly issued (MOPS)', endpoint: 't187ap05_P', csvUrl: 'https://mopsfin.twse.com.tw/opendata/t187ap05_P.csv'}
  ],
  sourceBase: 'https://openapi.twse.com.tw/v1/opendata/',
  monthlySheet: 'Taiwan Monthly',
  feedSheet: 'SiteFeed',
  rawSheet: 'Raw Statements',
  marginAuditSheet: 'Margin Signals',
  logSheet: 'Import Log',
  market: 'Taiwan public issuers'
};

// MOPS exposes quarterly statements in separate market and industry tables.
// L is listed, O is OTC, U is emerging, and X is public issuers. The listed
// datasets are exposed by TWSE OpenAPI; MOPSfin publishes the other three as
// CSV downloads. Keep this separate from monthly market codes (where emerging
// and public-issued use R and P).
const QUARTERLY_STATEMENT_MARKETS = [
  {market: 'Listed (TWSE)', code: 'L', source: 'openapi'},
  {market: 'OTC (TPEx)', code: 'O', source: 'mopsfin'},
  {market: 'Emerging (MOPS)', code: 'U', source: 'mopsfin'},
  {market: 'Publicly issued (MOPS)', code: 'X', source: 'mopsfin'}
];
const QUARTERLY_STATEMENT_INDUSTRIES = ['basi', 'bd', 'ci', 'fh', 'ins', 'mim'];

function signalsWorkbook_() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Bind this script to your private Taiwan Monthly Signals workbook before running it.');
  const expectedId = PropertiesService.getScriptProperties().getProperty('TAIWAN_WORKBOOK_ID');
  if (expectedId && book.getId() !== expectedId) throw new Error('This script is locked to a different Taiwan workbook. Refusing to write to the active spreadsheet.');
  return book;
}

const RAW_HEADERS = ['Market', 'Data area', 'Endpoint', 'Company code', 'Company name', 'Report period', 'Retrieved at', 'Raw source record', 'Source URL', 'Record signature'];
const MARGIN_AUDIT_HEADERS = ['Market', 'Company code', 'Company name', 'Report period', 'Source endpoint', 'Retrieved at', 'Source URL', 'Source signature', 'Margin dependency signatures', 'Calculation signature', 'Source basis', 'Revenue reported YTD', 'Gross profit reported YTD', 'Operating income reported YTD', 'Prior-quarter revenue YTD', 'Prior-quarter gross profit YTD', 'Prior-quarter operating income YTD', 'Revenue standalone quarter', 'Gross profit standalone quarter', 'Operating income standalone quarter', 'Gross margin %', 'Operating margin %', 'Gross margin YoY change (pp)', 'Operating margin YoY change (pp)', 'Calculation status', 'Raw source record'];
const LOG_HEADERS = ['Run time', 'Result', 'Monthly source period', 'Rows received', 'Rows added or revised', 'Raw records added or revised', 'Notes', 'Monthly feed status'];
const FEED_HEADERS = ['Market', 'Issuer series key', 'Company code', 'Company name', 'Industry', 'Report month', 'Revenue', 'Revenue YoY %', 'Revenue YoY Δ1 (pp/month)', 'Revenue YoY Δ2 (pp/month²)', 'Revenue YoY Δ3 (pp/month³)', 'Consecutive monthly observations', 'Gross margin %', 'Gross margin YoY change (pp)', 'Gross margin Δ1 (pp/quarter)', 'Gross margin Δ2 (pp/quarter²)', 'Gross margin Δ3 (pp/quarter³)', 'Operating margin %', 'Operating margin YoY change (pp)', 'Operating margin Δ1 (pp/quarter)', 'Operating margin Δ2 (pp/quarter²)', 'Operating margin Δ3 (pp/quarter³)', 'Latest statement date', 'Data status', 'Monthly source URL', 'English company name or official abbreviation', 'Mandarin pronunciation lookup', 'Revenue prior month', 'Revenue year-ago month', 'Revenue MoM %', 'Revenue YTD', 'Revenue prior-year YTD', 'Revenue YTD growth %', 'Year-ago base / current revenue %', 'Revenue denominator quality', 'Revenue growth outlier status', 'Market latest report month', 'Freshness status'];

function onOpen() {
  SpreadsheetApp.getUi().createMenu('Taiwan Signals')
    .addItem('Set up workbook and daily updates', 'setupTaiwanSignals')
    .addItem('Import 16-month MOPS history', 'importTaiwanMopsHistory')
    .addItem('Refresh current issuer snapshot', 'refreshTaiwanSignals')
    .addItem('Check public SiteFeed tab', 'validateTaiwanPublicFeed')
    .addToUi();
}

function setupTaiwanSignals() {
  const book = signalsWorkbook_();
  const properties = PropertiesService.getScriptProperties();
  if (!properties.getProperty('TAIWAN_WORKBOOK_ID')) properties.setProperty('TAIWAN_WORKBOOK_ID', book.getId());
  ensureHeader_(book, SIGNALS.monthlySheet, ['Market', 'Company code', 'Company name', 'Industry', 'Report month', 'Revenue current month', 'Revenue prior month', 'Revenue year-ago month', 'MoM growth %', 'YoY growth %', 'YTD revenue', 'Prior-year YTD revenue', 'YTD growth %', 'Currency / unit', 'Source URL', 'Retrieved at', 'Source record']);
  ensureHeader_(book, SIGNALS.feedSheet, FEED_HEADERS);
  ensureHeader_(book, SIGNALS.rawSheet, RAW_HEADERS);
  ensureHeader_(book, SIGNALS.marginAuditSheet, MARGIN_AUDIT_HEADERS);
  ensureHeader_(book, SIGNALS.logSheet, LOG_HEADERS);
  const triggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'refreshTaiwanSignals');
  if (!triggers.length) ScriptApp.newTrigger('refreshTaiwanSignals').timeBased().everyDays(1).atHour(7).inTimezone('America/New_York').create();
  const archiveTriggers = ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'refreshRecentTaiwanMopsArchive');
  if (!archiveTriggers.length) ScriptApp.newTrigger('refreshRecentTaiwanMopsArchive').timeBased().everyDays(1).atHour(10).inTimezone('Asia/Taipei').create();
  writeLog_('Setup complete', '', 0, 0, 0, 'Daily snapshot refresh is set for about 07:00 America/New_York. Daily MOPS archive refresh is set for about 10:00 Asia/Taipei. Run refreshTaiwanSignals and refreshRecentTaiwanMopsArchive once to authorize and test the official sources.');
}

function refreshTaiwanSignals() {
  const started = new Date();
  let reportMonth = '';
  let received = 0;
  let monthlyAdded = 0;
  let rawAdded = 0;
  const notes = [];
  let sourceStatus = [];
  try {
    const book = signalsWorkbook_();
    const monthlyFeed = fetchMonthlyRows_();
    sourceStatus = monthlyFeed.sources.map(source => `${source.market}: ${source.status}, ${source.rows} rows${source.error ? ` (${source.error})` : ''}`);
    monthlyFeed.sources.filter(source => source.status !== 'success').forEach(source => notes.push(`${source.market} monthly feed failed: ${source.error}`));
    received = monthlyFeed.records.length;
    const normalized = monthlyFeed.records.map(item => normalizeMonthly_(item.record, item.url, item.market)).filter(r => r.code && r.period);
    if (!normalized.length) throw new Error('The monthly revenue feed returned no rows with a company code and report month.');
    reportMonth = normalized.reduce((max, r) => r.period > max ? r.period : max, '');
    monthlyAdded = appendMonthlyRevisions_(book.getSheetByName(SIGNALS.monthlySheet), normalized);
    rawAdded = appendRawStatementRevisions_(book, notes);
    rebuildSiteFeed_(book, monthlyFeed.sources);
    const result = notes.length ? 'Partial success' : 'Success';
    writeLog_(result, reportMonth, received, monthlyAdded, rawAdded, notes.join(' '), sourceStatus.join('; '));
    return {result, reportMonth, received, monthlyAdded, rawAdded, runtimeSeconds: Math.round((new Date() - started) / 1000), notes};
  } catch (err) {
    notes.push(String(err && err.message || err));
    writeLog_('Failed', reportMonth, received, monthlyAdded, rawAdded, notes.join(' '), sourceStatus.join('; '));
    throw err;
  }
}

function previewTaiwanMopsHistory() {
  const months = recentTaiwanMopsHistoryMonths_();
  const reports = fetchTaiwanMopsHistory_(months);
  const summary = reports.map(report => ({market: report.market, month: report.month, rows: report.records.length, url: report.url}));
  console.log(JSON.stringify({result: 'validated preview only', reports: summary, totalRows: reports.reduce((sum, report) => sum + report.records.length, 0)}));
  return summary;
}

function importTaiwanMopsHistory() {
  // A third difference of monthly YoY revenue needs sixteen monthly revenue
  // observations: twelve months to form the first YoY point, then four
  // consecutive YoY points. The rolling refresh remains a two-month repair.
  const months = taiwanMopsBackfillMonths_(16);
  const reports = fetchTaiwanMopsHistory_(months);
  return importTaiwanMopsReports_(reports);
}

function taiwanMopsBackfillMonths_(monthCount, now) {
  if (!Number.isInteger(monthCount) || monthCount < 1 || monthCount > 24) throw new Error('Taiwan MOPS backfill length must be between 1 and 24 completed months.');
  const current = Utilities.formatDate(now || new Date(), 'Asia/Taipei', 'yyyy-MM');
  const match = current.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('Could not determine the current Taiwan calendar month.');
  const endIndex = Number(match[1]) * 12 + Number(match[2]) - 2;
  return Array.from({length: monthCount}, (_, offset) => {
    const index = endIndex - monthCount + 1 + offset;
    return String(Math.floor(index / 12)).padStart(4, '0') + '-' + String(index % 12 + 1).padStart(2, '0');
  });
}

function refreshRecentTaiwanMopsArchive() {
  // Fetch and validate the complete rolling window before opening the workbook
  // or writing monthly rows. A missing or malformed report therefore leaves
  // the existing history and public feed unchanged.
  const months = recentTaiwanMopsHistoryMonths_();
  const reports = fetchTaiwanMopsHistory_(months);
  return importTaiwanMopsReports_(reports);
}

function recentTaiwanMopsHistoryMonths_(now) {
  const current = Utilities.formatDate(now || new Date(), 'Asia/Taipei', 'yyyy-MM');
  const match = current.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('Could not determine the current Taiwan calendar month.');
  const currentMonthIndex = Number(match[1]) * 12 + Number(match[2]) - 1;
  return [2, 1].map(offset => {
    const index = currentMonthIndex - offset;
    const year = Math.floor(index / 12);
    const month = index % 12 + 1;
    return String(year).padStart(4, '0') + '-' + String(month).padStart(2, '0');
  });
}

function importTaiwanMopsReports_(reports) {
  const started = new Date();
  const book = signalsWorkbook_();
  const sheet = book.getSheetByName(SIGNALS.monthlySheet);
  if (!sheet) throw new Error('Taiwan Monthly sheet is missing.');
  const existing = sheet.getLastRow() > 4 ? sheet.getRange(5, 1, sheet.getLastRow() - 4, 17).getValues() : [];
  const seen = new Set();
  existing.forEach(row => seen.add(mopsHistoryDataKey_(row[0], row[1], row[2], row[4], row.slice(5, 13))));
  const additions = [];
  let unchanged = 0;
  reports.forEach(report => report.records.forEach(record => {
    const values = [record.current, record.prior, record.yearAgo, record.mom, record.yoy, record.ytd, record.priorYtd, record.ytdGrowth];
    const key = mopsHistoryDataKey_(report.market, record.code, record.name, record.month, values);
    if (seen.has(key)) { unchanged += 1; return; }
    seen.add(key);
    const raw = {
      '公司代號': record.code, '公司名稱': record.name, '產業別': record.industry,
      '資料年月': record.month, '營業收入-當月營收': record.current,
      '營業收入-上月營收': record.prior, '營業收入-去年當月營收': record.yearAgo,
      '營業收入-上月比較增減(%)': record.mom, '營業收入-去年同月增減(%)': record.yoy,
      '累計營業收入-當月累計營收': record.ytd, '累計營業收入-去年累計營收': record.priorYtd,
      '累計營業收入-前期比較增減(%)': record.ytdGrowth,
      '來源說明': 'MOPS monthly archive suffix _0, combined domestic and foreign issuer report'
    };
    additions.push([report.market, record.code, record.name, record.industry, record.month,
      record.current, record.prior, record.yearAgo, record.mom, record.yoy,
      record.ytd, record.priorYtd, record.ytdGrowth, 'TWD thousands, as published', report.url,
      new Date(), JSON.stringify(raw)]);
  }));
  if (additions.length) {
    ensureSheetSize_(sheet, sheet.getLastRow() + additions.length, 17);
    sheet.getRange(sheet.getLastRow() + 1, 1, additions.length, 17).setValues(additions);
  }
  rebuildSiteFeed_(book);
  refreshTaiwanCompanyNames();
  const totalRows = reports.reduce((sum, report) => sum + report.records.length, 0);
  const months = [...new Set(reports.map(report => report.month))].sort();
  writeLog_('MOPS history imported', months.join(', '), totalRows, additions.length, 0,
    'Four official MOPS report families, combined domestic and foreign populations. Exact economic duplicates were skipped. Runtime seconds: ' + Math.round((new Date() - started) / 1000),
    reports.map(report => report.market + ' ' + report.month + ': ' + report.records.length + ' rows').join('; '));
  return {result: 'success', reports: reports.length, received: totalRows, added: additions.length, unchanged, months};
}

function fetchTaiwanMopsHistory_(months) {
  months = months || recentTaiwanMopsHistoryMonths_();
  if (!Array.isArray(months) || !months.length || months.some(month => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month))) throw new Error('MOPS history months must be a non-empty list of YYYY-MM periods.');
  const groups = [
    {path: 'sii', market: 'Listed (TWSE)', title: /上市公司/},
    {path: 'otc', market: 'OTC (TPEx)', title: /上櫃公司/},
    {path: 'rotc', market: 'Emerging (MOPS)', title: /興櫃公司/},
    {path: 'pub', market: 'Publicly issued (MOPS)', title: /公開發行公司/}
  ];
  const reports = [];
  groups.forEach(group => months.forEach(month => {
    const parts = month.split('-').map(Number);
    const rocYear = parts[0] - 1911;
    const monthNumber = parts[1];
    const url = 'https://mopsov.twse.com.tw/nas/t21/' + group.path + '/t21sc03_' + rocYear + '_' + monthNumber + '_0.html';
    if (reports.length) Utilities.sleep(1000);
    const response = UrlFetchApp.fetch(url, {muteHttpExceptions: true, followRedirects: true});
    const status = response.getResponseCode();
    if (status < 200 || status >= 300) throw new Error('MOPS history request failed with HTTP ' + status + ': ' + url);
    const html = response.getContentText('Big5');
    const parsed = parseTaiwanMopsArchive_(html, month, group);
    if (parsed.records.length < 20) throw new Error('MOPS archive unexpectedly contains only ' + parsed.records.length + ' rows for ' + group.market + ' ' + month + '.');
    reports.push({market: group.market, month, url, records: parsed.records});
  }));
  return reports;
}

function parseTaiwanMopsArchive_(html, month, group) {
  const rocYear = Number(month.slice(0, 4)) - 1911;
  const monthNumber = Number(month.slice(5));
  const titleText = (html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || html.slice(0, 12000);
  const title = decodeTaiwanHtml_(titleText);
  if (!group.title.test(title) || !new RegExp(rocYear + '年\\s*' + monthNumber + '月份?').test(title) || !/營業收入統計表/.test(title)) {
    throw new Error('MOPS title did not match ' + group.market + ' ' + month + ': ' + title.slice(0, 160));
  }
  const tableMatches = [...html.matchAll(/<table\b[^>]*>([\s\S]*?)<\/table\s*>/gi)];
  const records = new Map();
  let headerTables = 0;
  tableMatches.forEach(tableMatch => {
    const table = tableMatch[1];
    const rowMatches = [...table.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr\s*>/gi)];
    let industry = '';
    let columns = null;
    rowMatches.forEach(rowMatch => {
      const cells = [...rowMatch[1].matchAll(/<(td|th)\b[^>]*>([\s\S]*?)<\/\1\s*>/gi)].map(cell => decodeTaiwanHtml_(cell[2]));
      if (!cells.length) return;
      const industryText = cells.join(' ');
      const industryMatch = /產業別\s*[：:]?\s*([^\s　]+)/.exec(industryText);
      if (industryMatch) industry = industryMatch[1].replace(/單位.*$/, '');
      if (cells.some(cell => /公司\s*代號|公司代碼/.test(cell)) && cells.some(cell => /公司名稱/.test(cell)) && cells.some(cell => /當月營收/.test(cell))) {
        columns = {
          code: cells.findIndex(cell => /公司\s*代號|公司代碼/.test(cell)),
          name: cells.findIndex(cell => /公司名稱/.test(cell)),
          current: cells.findIndex(cell => /當月營收/.test(cell)),
          prior: cells.findIndex(cell => /上月營收/.test(cell)),
          yearAgo: cells.findIndex(cell => /去年當月營收/.test(cell)),
          mom: cells.findIndex(cell => /上月比較/.test(cell)),
          yoy: cells.findIndex(cell => /去年同月/.test(cell)),
          ytd: cells.findIndex(cell => /當月累計營收/.test(cell)),
          priorYtd: cells.findIndex(cell => /去年累計營收/.test(cell)),
          ytdGrowth: cells.findIndex(cell => /前期比較/.test(cell))
        };
        headerTables += 1;
        return;
      }
      if (!columns) return;
      const code = String(cells[columns.code] || '').trim().toUpperCase();
      // Some publicly issued firms use alphanumeric codes such as 0009A0.
      // Keep the code as text so leading zeroes and suffixes remain intact.
      if (!/^[A-Z0-9]{4,6}$/.test(code)) return;
      const name = String(cells[columns.name] || '').trim();
      const current = numberOrBlankTaiwan_(cells[columns.current]);
      if (!name || current === '') throw new Error('Malformed MOPS company row ' + code + ' in ' + month + '.');
      const record = {
        code, name, industry, month, current,
        prior: numberOrBlankTaiwan_(cells[columns.prior]),
        yearAgo: numberOrBlankTaiwan_(cells[columns.yearAgo]),
        mom: numberOrBlankTaiwan_(cells[columns.mom]),
        yoy: numberOrBlankTaiwan_(cells[columns.yoy]),
        ytd: numberOrBlankTaiwan_(cells[columns.ytd]),
        priorYtd: numberOrBlankTaiwan_(cells[columns.priorYtd]),
        ytdGrowth: numberOrBlankTaiwan_(cells[columns.ytdGrowth])
      };
      const previous = records.get(code);
      if (previous && JSON.stringify(previous) !== JSON.stringify(record)) throw new Error('Conflicting duplicate MOPS issuer row ' + code + ' in ' + month + '.');
      records.set(code, record);
    });
  });
  if (!headerTables || !records.size) throw new Error('No MOPS company rows found for ' + group.market + ' ' + month + '.');
  return {title, headerTables, records: [...records.values()]};
}

function decodeTaiwanHtml_(value) {
  return String(value || '').replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&lt;/gi, '<').replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([\da-f]+);/gi, (_, code) => String.fromCharCode(parseInt(code, 16)))
    .replace(/[\u00a0\s]+/g, ' ').trim();
}

function numberOrBlankTaiwan_(value) {
  const text = decodeTaiwanHtml_(value).replace(/,/g, '').replace(/[％%]/g, '').trim();
  if (!text || /^[-–—－]+$/.test(text)) return '';
  const number = Number(text.replace(/^\((.*)\)$/, '-$1'));
  return Number.isFinite(number) ? number : '';
}

function mopsHistoryDataKey_(market, code, name, month, values) {
  return [String(market).trim(), String(code).trim(), normalizeIssuerName_(name), normalizeMonthlyPeriod_(month)]
    .concat(values.map((value, index) => {
      if (value === '' || value == null) return '';
      const number = Number(value);
      return String([3, 4, 7].includes(index) ? Math.round(number * 100) / 100 : number);
    })).join('|');
}

function fetchMonthlyRows_() {
  const sources = [];
  const records = [];
  SIGNALS.monthlySources.forEach(source => {
    const apiUrl = SIGNALS.sourceBase + source.endpoint;
    try {
      const sourceRecords = fetchRecords_(apiUrl);
      if (!sourceRecords.length) throw new Error('API returned no records');
      records.push(...sourceRecords.map(record => ({record, market: source.market, url: apiUrl})));
      sources.push({market: source.market, status: 'success', rows: sourceRecords.length, url: apiUrl, error: ''});
    } catch (apiError) {
      const fallbackUrl = source.csvUrl;
      try {
        const sourceRecords = fetchRecords_(fallbackUrl);
        if (!sourceRecords.length) throw new Error('CSV returned no records');
        records.push(...sourceRecords.map(record => ({record, market: source.market, url: fallbackUrl})));
        sources.push({market: source.market, status: 'success', rows: sourceRecords.length, url: fallbackUrl, error: ''});
      } catch (csvError) {
        sources.push({market: source.market, status: 'failed', rows: 0, url: fallbackUrl, error: `API: ${String(apiError && apiError.message || apiError)}; CSV: ${String(csvError && csvError.message || csvError)}`});
      }
    }
  });
  return {records, sources};
}

function appendRawStatementRevisions_(book, notes) {
  const raw = book.getSheetByName(SIGNALS.rawSheet);
  const endpoints = [];
  // Margin calculations use general-industry income statements. Keep the
  // existing broader X-family raw statement collection for compatibility.
  QUARTERLY_STATEMENT_MARKETS.forEach(market => {
    endpoints.push({area: 'Quarterly income statement', endpoint: 't187ap06_' + market.code + '_ci', market: market.market, source: market.source});
  });
  QUARTERLY_STATEMENT_INDUSTRIES.forEach(suffix => {
    if (suffix !== 'ci') endpoints.push({area: 'Quarterly income statement', endpoint: 't187ap06_X_' + suffix, market: 'Publicly issued (MOPS)', source: 'openapi'});
    endpoints.push({area: 'Quarterly balance sheet', endpoint: 't187ap07_X_' + suffix, market: 'Publicly issued (MOPS)', source: 'openapi'});
  });
  endpoints.push({area: 'Director and supervisor ownership', endpoint: 't187ap11_P'});
  const prior = raw.getLastRow() > 4 ? raw.getRange(5, 2, raw.getLastRow() - 4, 7).getValues() : [];
  const signatures = new Set();
  prior.forEach(row => {
    const endpoint = String(row[1] || '').trim();
    const code = String(row[2] || '').trim();
    const period = String(row[4] || '').trim();
    const rawRecord = parseJson_(row[6]);
    if (endpoint && code && period) signatures.add([endpoint, code, period, stableRawRecordJson_(rawRecord)].join('|'));
  });
  const additions = [];
  endpoints.forEach(item => {
    const url = statementSourceUrl_(item);
    try {
      fetchRecords_(url).forEach(record => {
        const code = textField_(record, ['公司代號', '公司代碼', '公司編號', 'SecuritiesCompanyCode', '公司代碼(公司代號)']);
        const name = textField_(record, ['公司名稱', '公司簡稱', 'CompanyName', 'CompanyNameEnglish']);
        const period = item.area.indexOf('Quarterly') === 0 ? quarterPeriod_(record) : reportPeriod_(textField_(record, ['資料年月', '年月', '年度', '報告年度', 'ReportPeriod', 'Date']));
        const rawJson = JSON.stringify(record);
        const signature = [item.endpoint, code, period, stableRawRecordJson_(record)].join('|');
        if (signatures.has(signature)) return;
        signatures.add(signature);
        additions.push([item.market || SIGNALS.market, item.area, item.endpoint, code, name, period, new Date(), rawJson, url, signature]);
      });
    } catch (err) {
      notes.push(item.endpoint + ': ' + String(err && err.message || err));
    }
  });
  if (additions.length) {
    ensureSheetSize_(raw, raw.getLastRow() + additions.length, RAW_HEADERS.length);
    raw.getRange(raw.getLastRow() + 1, 1, additions.length, RAW_HEADERS.length).setValues(additions);
  }
  return additions.length;
}

function appendMonthlyRevisions_(sheet, rows) {
  const existing = sheet.getLastRow() > 4 ? sheet.getRange(5, 1, sheet.getLastRow() - 4, 17).getValues() : [];
  const signatures = new Set();
  existing.forEach(row => {
    const market = normalizeMonthlyMarket_(row[0]);
    const code = String(row[1]);
    // Google Sheets stores YYYY-MM values as date serials. Normalize the
    // stored value before comparing it with the API's normalized YYYY-MM.
    const period = normalizeMonthlyPeriod_(row[4]);
    signatures.add(monthlyEconomicSignature_(market, code, row[2], row[3], period, row.slice(5, 13)));
    // Before source-market labels were added, the append-only signature omitted market.
    if (String(row[0]).trim() === 'Taiwan public issuers') {
      signatures.add(monthlyEconomicSignature_('', code, row[2], row[3], period, row.slice(5, 13)));
    }
  });
  const additions = [];
  rows.forEach(r => {
    const rawJson = JSON.stringify(r.raw);
    const signature = monthlyEconomicSignature_(r.market, r.code, r.name, r.industry, r.period,
      [r.current, r.prior, r.yearAgo, r.mom, r.yoy, r.ytd, r.priorYtd, r.ytdGrowth]);
    if (signatures.has(signature)) return;
    signatures.add(signature);
    additions.push([r.market, r.code, r.name, r.industry, r.period, r.current, r.prior, r.yearAgo, r.mom, r.yoy, r.ytd, r.priorYtd, r.ytdGrowth, 'TWD thousands, as published', r.sourceUrl, new Date(), rawJson]);
  });
  if (additions.length) {
    ensureSheetSize_(sheet, sheet.getLastRow() + additions.length, 17);
    sheet.getRange(sheet.getLastRow() + 1, 1, additions.length, 17).setValues(additions);
  }
  return additions.length;
}

function monthlyEconomicSignature_(market, code, name, industry, period, values) {
  const numbers = values.map(value => {
    if (value === '' || value == null) return '';
    const number = Number(String(value).replace(/[%,\s]/g, ''));
    return Number.isFinite(number) ? String(number) : String(value).trim();
  });
  return [normalizeMonthlyMarket_(market), String(code || '').trim(), normalizeIssuerName_(name),
    String(industry || '').trim(), normalizeMonthlyPeriod_(period), ...numbers].join('|');
}

function rebuildSiteFeed_(book, sourceStatuses) {
  const monthly = book.getSheetByName(SIGNALS.monthlySheet);
  const feed = book.getSheetByName(SIGNALS.feedSheet);
  if (feed.getMaxColumns && feed.getMaxColumns() < FEED_HEADERS.length) feed.insertColumnsAfter(feed.getMaxColumns(), FEED_HEADERS.length - feed.getMaxColumns());
  // Keep the public schema in sync with the row builder. Older sheets may have
  // stopped at older schemas. Refreshing the header on every rebuild makes
  // the appended quality and freshness fields addressable
  // by name for both the CSV export and the dashboard.
  feed.getRange(4, 1, 1, FEED_HEADERS.length).setValues([FEED_HEADERS]);
  const values = monthly.getLastRow() > 4 ? monthly.getRange(5, 1, monthly.getLastRow() - 4, 17).getValues() : [];
  // Keep the source partitions separate unless code and normalized company name
  // agree. The public-issued feed overlaps listed markets, but a code alone is
  // not a globally unique issuer ID across market partitions.
  const namesByCode = new Map();
  values.forEach(row => {
    const code = String(row[1] || '').trim();
    const name = normalizeIssuerName_(row[2]);
    if (!code || !name) return;
    if (!namesByCode.has(code)) namesByCode.set(code, new Set());
    namesByCode.get(code).add(name);
  });
  const latestByMonth = new Map();
  values.forEach(row => {
    const normalizedRow = row.slice();
    normalizedRow[0] = normalizeMonthlyMarket_(row[0]);
    // Sheets coerces the YYYY-MM period into a date cell. Convert it back to
    // a stable month key before de-duplication and continuity calculations.
    normalizedRow[4] = normalizeMonthlyPeriod_(row[4]);
    const market = String(normalizedRow[0] || '').trim();
    const code = String(row[1] || '').trim();
    const period = String(normalizedRow[4] || '').trim();
    if (!code || !period) return;
    const nameVariants = namesByCode.get(code) || new Set();
    const mergeVerified = nameVariants.size === 1;
    const issuerKey = 'TW|' + issuerIdentityKey_(code, row[2]);
    const key = issuerKey + '|' + period;
    const candidate = {row: normalizedRow, issuerKey, mergeVerified, priority: monthlyMarketPriority_(market), retrievedAt: new Date(row[15]).getTime() || 0};
    const previous = latestByMonth.get(key);
    if (!previous || candidate.priority < previous.priority || (candidate.priority === previous.priority && candidate.retrievedAt >= previous.retrievedAt)) {
      latestByMonth.set(key, candidate);
    }
  });
  const byIssuer = new Map();
  latestByMonth.forEach(({row, issuerKey, mergeVerified}) => {
    const market = String(row[0] || '');
    const code = String(row[1]);
    if (!byIssuer.has(issuerKey)) byIssuer.set(issuerKey, {code, mergeVerified, rows: []});
    byIssuer.get(issuerKey).rows.push(row);
  });
  const marginMap = marginSignalsMap_(book);
  const marketLatestPeriods = new Map();
  let feedLatestPeriod = '';
  latestByMonth.forEach(({row}) => {
    const market = String(row[0] || '');
    const period = String(row[4] || '');
    if (!marketLatestPeriods.has(market) || period > marketLatestPeriods.get(market)) marketLatestPeriods.set(market, period);
    if (period > feedLatestPeriod) feedLatestPeriod = period;
  });
  const sourceStatusByMarket = new Map((sourceStatuses || []).map(item => [normalizeMonthlyMarket_(item.market), item]));
  const output = [];
  byIssuer.forEach(({code, mergeVerified, rows: history}, issuerKey) => {
    history.sort((a, b) => a[4] < b[4] ? -1 : a[4] > b[4] ? 1 : 0);
    const current = history[history.length - 1];
    const periods = history.map(r => String(r[4]));
    const index = periods.length - 1;
    // Keep the source-reported YoY percentage visible, but do not treat a
    // near-zero comparison base as a stable operating trend for derivatives.
    const y = history.map(r => monthlyYoYBaseIsTiny_(r[5], r[7]) ? '' : number_(r[9]));
    const continuous = contiguousMonthlyObservations_(periods, y, index);
    const diffs = finiteDifferencesAtEnd_(y, continuous);
    // Prefer the exact name match. The code-only fallback is populated only
    // when the quarterly source has one verified issuer identity for that code.
    const identityKey = issuerIdentityKey_(current[1], current[2]);
    const marketIdentityKey = quarterlyMarginIdentity_(current[0], identityKey);
    const marketCodeKey = quarterlyMarginIdentity_(current[0], current[1]);
    const exactMargin = marginMap.get(marketIdentityKey);
    const codeMargin = marginMap.get(marketCodeKey);
    const hasSameCodeDifferentIdentity = !exactMargin && !codeMargin && [...marginMap.keys()].some(key => key.startsWith(marketCodeKey + '|'));
    const margin = {...(exactMargin || codeMargin || emptyMarginSignals_())};
    if (hasSameCodeDifferentIdentity) {
      margin.identityMismatch = true;
      margin.status = 'Quarterly statement rows use a different issuer name for this code; margin series left blank pending identity review';
    }
    if (/金融|保險|證券|期貨|金控|financial|insurance|securities|bank/i.test(String(current[3] || ''))) {
      margin.gross = ''; margin.grossYoY = ''; margin.grossD1 = ''; margin.grossD2 = ''; margin.grossD3 = '';
      margin.operating = ''; margin.operatingYoY = ''; margin.operatingD1 = ''; margin.operatingD2 = ''; margin.operatingD3 = '';
      margin.status = 'Generic gross and operating margins are not comparable for financial-sector issuers; use sector-specific indicators instead';
    }
    const status = [
      diffs.d1 !== '' && diffs.d2 !== '' && diffs.d3 !== '' ? 'Revenue Δ1/Δ2/Δ3 available' : `Revenue trend history: ${continuous}/4 consecutive monthly YoY observations`,
      monthlyYoYBaseIsTiny_(current[5], current[7]) ? 'YoY percentage kept as reported; comparison base is missing, nonpositive, or below 1% of current-month revenue, so trend derivatives are suppressed' : '',
      mergeVerified ? '' : 'Issuer code appears with different names across sources or dates; histories are split until the issuer identity is verified',
      margin.identityMismatch ? 'Quarterly issuer identity did not match monthly feed; margin series left blank' : '',
      margin.status
    ].filter(Boolean).join('; ');
    const denominator = revenueDenominatorQuality_(current[5], current[7]);
    const outlier = revenueGrowthOutlierStatus_(current[9]);
    const marketLatest = marketLatestPeriods.get(String(current[0])) || '';
    const sourceStatus = sourceStatusByMarket.get(String(current[0]));
    let freshness = 'Current by available report periods; source refresh not checked';
    if (sourceStatuses) {
      if (sourceStatus && sourceStatus.status !== 'success') freshness = `Source refresh failed; latest stored month ${marketLatest || 'unknown'}`;
      else if (marketLatest && marketLatest < feedLatestPeriod) freshness = `Stale partition; this market through ${marketLatest}, feed maximum ${feedLatestPeriod}`;
      else if (current[4] < marketLatest) freshness = `Issuer report lags its market partition by ${monthDistance_(current[4], marketLatest)} month(s)`;
      else freshness = 'Current';
    } else if (marketLatest && marketLatest < feedLatestPeriod) {
      freshness = `Stale partition; this market through ${marketLatest}, feed maximum ${feedLatestPeriod}`;
    } else if (current[4] < marketLatest) {
      freshness = `Issuer report lags its market partition by ${monthDistance_(current[4], marketLatest)} month(s)`;
    }
    output.push([current[0], issuerKey, current[1], current[2], current[3], current[4], number_(current[5]), number_(current[9]), diffs.d1, diffs.d2, diffs.d3, continuous, margin.gross, margin.grossYoY, margin.grossD1, margin.grossD2, margin.grossD3, margin.operating, margin.operatingYoY, margin.operatingD1, margin.operatingD2, margin.operatingD3, margin.statementDate, status, current[14], '', '', number_(current[6]), number_(current[7]), number_(current[8]), number_(current[10]), number_(current[11]), number_(current[12]), denominator.ratioPct, denominator.status, outlier, marketLatest, freshness]);
  });
  output.sort((a, b) => (Number(b[7]) || -Infinity) - (Number(a[7]) || -Infinity));
  if (!output.length) throw new Error('The Taiwan source history produced no feed rows; the existing SiteFeed was left unchanged.');
  const previousRows = Math.max(0, feed.getLastRow() - 4);
  // Replace first, then trim. If the write fails, the last known-good source
  // feed stays intact for the public sync and the analyst dashboard.
  ensureSheetSize_(feed, 4 + output.length, FEED_HEADERS.length);
  feed.getRange(5, 1, output.length, FEED_HEADERS.length).setValues(output);
  if (previousRows > output.length) feed.getRange(5 + output.length, 1, previousRows - output.length, FEED_HEADERS.length).clearContent();
}

function monthlyMarketPriority_(market) {
  if (market === 'Listed (TWSE)') return 0;
  if (market === 'OTC (TPEx)') return 1;
  if (market === 'Emerging (MOPS)') return 2;
  if (market === 'Publicly issued (MOPS)') return 3;
  return 4;
}

function emptyMarginSignals_() {
  return {gross: '', grossYoY: '', grossD1: '', grossD2: '', grossD3: '', operating: '', operatingYoY: '', operatingD1: '', operatingD2: '', operatingD3: '', statementDate: '', status: 'Quarterly margin series unavailable: no matched general-industry statements in local history', identityMismatch: false};
}

function marginSignalsMap_(book) {
  const result = new Map();
  const raw = book.getSheetByName(SIGNALS.rawSheet);
  if (!raw || raw.getLastRow() <= 4) return result;
  const values = raw.getRange(5, 1, raw.getLastRow() - 4, RAW_HEADERS.length).getValues();
  const byCompany = new Map();
  const latestByQuarter = new Map();
  values.forEach(row => {
    const endpoint = String(row[2] || '').trim();
    if (!/^t187ap06_[LOUX]_ci$/.test(endpoint)) return;
    const market = quarterlyStatementMarket_(endpoint, row[0]);
    const companyCode = String(row[3] || '').trim();
    const companyName = String(row[4] || '').trim();
    if (!companyCode || !companyName) return;
    const q = String(row[5] || '');
    if (!/^\d{4}-Q[1-4]$/.test(q)) return;
    const record = parseJson_(row[7]);
    const key = quarterIndex_(q);
    if (!Number.isFinite(key)) return;
    const companyKey = issuerIdentityKey_(companyCode, companyName);
    const id = market + '|' + companyKey + '|' + q;
    const retrievedAt = row[6] instanceof Date ? row[6].getTime() : new Date(row[6]).getTime() || 0;
    const prior = latestByQuarter.get(id);
    if (prior && prior.retrievedAt > retrievedAt) return;
    latestByQuarter.set(id, {
      market, companyCode, companyKey, q, key,
      name: companyName,
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
    const identity = quarterlyMarginIdentity_(item.market, item.companyKey);
    if (!byCompany.has(identity)) byCompany.set(identity, new Map());
    byCompany.get(identity).set(item.key, item);
  });
  const identitiesByCode = new Map();
  byCompany.forEach((_, identity) => {
    const [market, companyCode] = identity.split('|');
    const key = quarterlyMarginIdentity_(market, companyCode);
    if (!identitiesByCode.has(key)) identitiesByCode.set(key, []);
    identitiesByCode.get(key).push(identity);
  });
  const auditRows = [];
  byCompany.forEach((quarterMap, companyIdentity) => {
    const [market, companyCode] = companyIdentity.split('|');
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
        item.market, companyCode, item.name, item.q, item.endpoint,
        item.retrievedAtValue || '', item.sourceUrl, item.signature,
        marginDependencySignatures_(quarterMap, item),
        ['MARGIN_YTD_DIFF_V3', item.market, item.companyKey, item.q, marginDependencySignatures_(quarterMap, item)].join('|'),
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
    const signals = {
      gross: last.gross, grossYoY: last.grossYoY, grossD1: gm.d1, grossD2: gm.d2, grossD3: gm.d3,
      operating: last.operating, operatingYoY: last.operatingYoY, operatingD1: om.d1, operatingD2: om.d2, operatingD3: om.d3,
      statementDate: textField_(last.record, ['出表日期', '公告日期', '發布日期', '發布時間', '發佈時間']),
      status: last.status + '; margin Δ1/Δ2/Δ3 require 6/7/8 consecutive standalone quarter margins and corresponding prior-year quarters',
      matched: true
    };
    result.set(companyIdentity, signals);
    const marketCodeKey = quarterlyMarginIdentity_(market, companyCode);
    result.set(quarterlyMarginIdentity_(market, issuerIdentityKey_(companyCode, last.name)), signals);
    const identities = identitiesByCode.get(marketCodeKey) || [];
    if (identities.length === 1) result.set(marketCodeKey, signals);
    else result.delete(marketCodeKey);
  });
  appendMarginAudit_(book, auditRows);
  return result;
}

function statementSourceUrl_(item) {
  const endpoint = String(item && item.endpoint || '').trim();
  if (endpoint === 't187ap11_P') return SIGNALS.sourceBase + endpoint;
  if (!/^t187ap0[67]_[LOUX]_(basi|bd|ci|fh|ins|mim)$/.test(endpoint)) throw new Error('Unsupported MOPS quarterly statement endpoint: ' + endpoint);
  if (item.source === 'openapi' && endpoint.split('_')[1] === 'L') return SIGNALS.sourceBase + endpoint;
  return 'https://mopsfin.twse.com.tw/opendata/' + endpoint + '.csv';
}

function quarterlyStatementMarket_(endpoint, fallbackMarket) {
  const match = String(endpoint || '').match(/^t187ap0[67]_([LOUX])_/);
  if (!match) return normalizeMonthlyMarket_(fallbackMarket || SIGNALS.market);
  const market = QUARTERLY_STATEMENT_MARKETS.find(item => item.code === match[1]);
  return market ? market.market : normalizeMonthlyMarket_(fallbackMarket || SIGNALS.market);
}

function quarterlyMarginIdentity_(market, companyIdentityOrCode) {
  return normalizeMonthlyMarket_(market) + '|' + String(companyIdentityOrCode || '').trim();
}

function appendMarginAudit_(book, rows) {
  const sheet = book.getSheetByName(SIGNALS.marginAuditSheet) || ensureHeader_(book, SIGNALS.marginAuditSheet, MARGIN_AUDIT_HEADERS);
  const existing = sheet.getLastRow() > 4 ? new Set(sheet.getRange(5, 10, sheet.getLastRow() - 4, 1).getDisplayValues().flat()) : new Set();
  const additions = rows.filter(row => row[9] && !existing.has(String(row[9])));
  if (additions.length) {
    ensureSheetSize_(sheet, sheet.getLastRow() + additions.length, MARGIN_AUDIT_HEADERS.length);
    sheet.getRange(sheet.getLastRow() + 1, 1, additions.length, MARGIN_AUDIT_HEADERS.length).setValues(additions);
  }
}

function marginDependencySignatures_(quarterMap, item) {
  const q = Number(item.q.slice(-1));
  const offsets = q === 1 ? [0, 4] : [0, 1, 4, 5];
  return offsets.map(offset => {
    const dependency = quarterMap.get(item.key - offset);
    return dependency ? `${item.key - offset}:${dependency.signature}` : `${item.key - offset}:missing`;
  }).join('|');
}

function normalizeIssuerName_(value) {
  return String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}]/gu, '');
}

function issuerIdentityKey_(companyCode, companyName) {
  return String(companyCode || '').trim() + '|' + normalizeIssuerName_(companyName);
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

function contiguousMonthlyObservations_(periods, values, index) {
  let count = 0;
  for (let i = index; i >= 0; i--) {
    if (i < index && monthDistance_(periods[i], periods[i + 1]) !== 1) break;
    if (typeof values[i] !== 'number' || !Number.isFinite(values[i])) break;
    count++;
  }
  return count;
}

function monthlyYoYBaseIsTiny_(currentRevenue, yearAgoRevenue) {
  if (yearAgoRevenue === '' || yearAgoRevenue == null) return true;
  const current = Number(currentRevenue);
  const base = Number(yearAgoRevenue);
  if (!Number.isFinite(current) || !Number.isFinite(base)) return true;
  if (current <= 0 || base <= 0) return true;
  return base / current < 0.01;
}

function revenueDenominatorQuality_(currentRevenue, yearAgoRevenue) {
  const current = Number(currentRevenue);
  const base = yearAgoRevenue === '' || yearAgoRevenue == null ? NaN : Number(yearAgoRevenue);
  const ratioPct = Number.isFinite(current) && current > 0 && Number.isFinite(base) ? base / current * 100 : '';
  if (!Number.isFinite(current) || current <= 0 || !Number.isFinite(base)) return {ratioPct, status: 'Missing or invalid comparison base'};
  if (base <= 0) return {ratioPct, status: 'Zero or negative comparison base'};
  if (ratioPct < 1) return {ratioPct, status: 'Low base below 1% of current revenue'};
  return {ratioPct, status: 'Usable'};
}

function revenueGrowthOutlierStatus_(reportedYoY) {
  const value = Number(reportedYoY);
  if (reportedYoY === '' || reportedYoY == null || !Number.isFinite(value)) return 'Not available';
  return Math.abs(value) >= 500 ? 'Review outlier: absolute reported YoY growth at least 500%' : 'None';
}

function normalizeMonthly_(raw, sourceUrl, sourceMarket) {
  return {
    raw,
    market: normalizeMonthlyMarket_(sourceMarket || SIGNALS.market),
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
    sourceUrl: sourceUrl || ''
  };
}

function normalizeMonthlyMarket_(market) {
  const value = String(market || '').trim();
  return value === 'Taiwan public issuers' ? 'Publicly issued (MOPS)' : value;
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
  ensureSheetSize_(sheet, 4, headers.length);
  sheet.getRange(4, 1, 1, headers.length).setValues([headers]);
  sheet.setFrozenRows(4);
  sheet.getRange(4, 1, 1, headers.length).setFontWeight('bold').setBackground('#DDE8F4').setWrap(true);
  return sheet;
}

function ensureSheetSize_(sheet, rows, columns) {
  const maxRows = typeof sheet.getMaxRows === 'function' ? sheet.getMaxRows() : rows;
  const maxColumns = typeof sheet.getMaxColumns === 'function' ? sheet.getMaxColumns() : columns;
  if (rows > maxRows && typeof sheet.insertRowsAfter === 'function') sheet.insertRowsAfter(maxRows, rows - maxRows);
  if (columns > maxColumns && typeof sheet.insertColumnsAfter === 'function') sheet.insertColumnsAfter(maxColumns, columns - maxColumns);
}

function writeLog_(result, period, received, monthlyAdded, rawAdded, notes, monthlyStatus) {
  try {
    const book = signalsWorkbook_();
    const sheet = ensureHeader_(book, SIGNALS.logSheet, LOG_HEADERS);
    sheet.appendRow([new Date(), result, period, received, monthlyAdded, rawAdded, notes, monthlyStatus || '']);
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

function normalizeMonthlyPeriod_(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && Number.isFinite(value.getTime())) {
    return value.getFullYear() + '-' + String(value.getMonth() + 1).padStart(2, '0');
  }
  // The Sheets API can expose a date as its serial number instead of a Date.
  if (typeof value === 'number' && Number.isFinite(value) && value > 20000 && value < 100000) {
    const date = new Date(Math.round((value - 25569) * 86400000));
    return date.getUTCFullYear() + '-' + String(date.getUTCMonth() + 1).padStart(2, '0');
  }
  return reportPeriod_(value);
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
  const pa = normalizeMonthlyPeriod_(a).match(/^(\d{4})-(\d{2})$/);
  const pb = normalizeMonthlyPeriod_(b).match(/^(\d{4})-(\d{2})$/);
  if (!pa || !pb) return NaN;
  return (Number(pb[1]) * 12 + Number(pb[2])) - (Number(pa[1]) * 12 + Number(pa[2]));
}

function normalizeKey_(key) {
  return String(key).toLowerCase().replace(/[\s\p{P}\p{S}_]/gu, '');
}

function stableRawRecordJson_(record) {
  const volatileKeys = new Set(['出表日期', '更新日期', '更新時間', '資料更新時間', '發布時間', '資料時間',
    'retrievedat', 'updatedat', 'exportdate', 'updatedate', 'publisheddate']);
  const stable = {};
  Object.keys(record || {}).sort().forEach(key => {
    if (!volatileKeys.has(normalizeKey_(key))) stable[key] = record[key];
  });
  return JSON.stringify(stable);
}

function parseJson_(value) {
  try { return JSON.parse(String(value || '{}')); } catch (err) { return {}; }
}

function refreshTaiwanCompanyNames() {
  const book = signalsWorkbook_();
  const feed = book.getSheetByName(SIGNALS.feedSheet);
  if (!feed || feed.getLastRow() < 5) throw new Error('SiteFeed has no issuer rows to enrich.');
  const sources = [
    {market: 'Listed (TWSE)', urls: ['https://openapi.twse.com.tw/v1/opendata/t187ap03_L']},
    {market: 'OTC (TPEx)', urls: ['https://mopsfin.twse.com.tw/opendata/t187ap03_O.csv']},
    {market: 'Emerging (MOPS)', urls: ['https://mopsfin.twse.com.tw/opendata/t187ap03_R.csv']},
    {market: 'Publicly issued (MOPS)', urls: ['https://mopsfin.twse.com.tw/opendata/t187ap03_P.csv']}
  ];
  const byMarket = new Map();
  const byCode = new Map();
  const notes = [];
  let profileRows = 0;
  sources.forEach(source => {
    let records = [];
    for (const url of source.urls) {
      try { records = fetchRecords_(url); break; }
      catch (err) { notes.push(source.market + ' profile feed: ' + String(err && err.message || err)); }
    }
    profileRows += records.length;
    records.forEach(record => {
      const code = textField_(record, ['公司代號', '公司代碼', '股票代號', '證券代號', 'CompanyCode', 'SecuritiesCompanyCode']);
      const english = textField_(record, ['公司英文名稱', '公司英文簡稱', '英文公司名稱', '英文簡稱', '英文名稱', '公司英文縮寫', 'CompanyEnglishName', 'EnglishCompanyName', 'CompanyNameEnglish', 'EnglishAbbreviation']);
      if (!code || !english) return;
      byMarket.set(source.market + '|' + code, english);
      if (!byCode.has(code)) byCode.set(code, new Set());
      byCode.get(code).add(english);
    });
  });
  const last = feed.getLastRow();
  if (feed.getMaxColumns() < 27) feed.insertColumnsAfter(feed.getMaxColumns(), 27 - feed.getMaxColumns());
  feed.getRange(4, 26, 1, 2).setValues([['English company name or official abbreviation', 'Mandarin pronunciation lookup']]);
  feed.getRange(4, 26, 1, 2).setFontWeight('bold').setBackground('#DDE8F4').setWrap(true);
  const rows = feed.getRange(5, 1, last - 4, 4).getDisplayValues();
  const output = rows.map(row => {
    const market = String(row[0] || '').trim();
    const code = String(row[2] || '').trim();
    const chinese = String(row[3] || '').trim();
    let english = byMarket.get(market + '|' + code) || '';
    if (!english && byCode.get(code) && byCode.get(code).size === 1) english = [...byCode.get(code)][0];
    const pronunciation = chinese ? 'https://translate.google.com/?sl=zh-TW&tl=en&text=' + encodeURIComponent(chinese) + '&op=translate' : '';
    return [english, pronunciation];
  });
  if (output.length) feed.getRange(5, 26, output.length, 2).setValues(output);
  const matched = output.filter(row => row[0]).length;
  const triggerExists = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'refreshTaiwanCompanyNames');
  if (!triggerExists) ScriptApp.newTrigger('refreshTaiwanCompanyNames').timeBased().everyDays(1).atHour(8).inTimezone('America/New_York').create();
  writeLog_('Names refreshed', '', profileRows, matched, 0, notes.join(' '), 'English names matched ' + matched + ' of ' + output.length + ' SiteFeed issuers; pronunciation links added for Chinese names. Profile feeds used: ' + sources.map(s => s.market).join(', '));
  return {profileRows, matched, issuers: output.length, notes};
}
