/**
 * Paper Book helper: refresh standardized fundamentals from SEC Company Facts.
 *
 * Install this file alongside any existing workbook Apps Script project code.
 * Set Script Properties PAPER_BOOK_SPREADSHEET_ID and SEC_USER_AGENT before use.
 * Price and every user-entered thesis/book field remain manual and untouched.
 */
const PAPER_SEC = {
  ideasSheet: 'Ideas',
  valuationSheet: 'Valuation Inputs',
  headerRow: 5,
  firstDataRow: 6,
  tickerMapUrl: 'https://www.sec.gov/files/company_tickers_exchange.json',
  factsUrl: 'https://data.sec.gov/api/xbrl/companyfacts/CIK',
  tickerCacheKey: 'paper-sec-ticker-map-v1',
  allowedFacts: [
    'Shares outstanding', 'Share-count date/source', 'TTM net income',
    'Cash & equivalents', 'Total debt', 'TTM EBITDA', 'TTM revenue',
    'Total equity', 'Fundamentals source and period'
  ]
};

function paperBookAddMenu_() {
  SpreadsheetApp.getUi().createMenu('Paper Book')
    .addItem('Create valuation row for selected idea', 'createSelectedIdeaValuationRow')
    .addItem('Refresh selected idea from SEC', 'refreshSelectedIdeaFromSec')
    .addSeparator()
    .addItem('Install idea-entry trigger', 'installPaperBookEditTrigger')
    .addToUi();
}

function installPaperBookEditTrigger() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('PAPER_BOOK_SPREADSHEET_ID');
  if (!spreadsheetId) throw new Error('Set Script Property PAPER_BOOK_SPREADSHEET_ID to the private Paper Book spreadsheet ID.');
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book || book.getId() !== spreadsheetId) throw new Error('Open the private Paper Book spreadsheet before using this menu.');
  const triggers = ScriptApp.getProjectTriggers().filter(trigger => trigger.getHandlerFunction() === 'paperBookOnEdit');
  if (!triggers.length) ScriptApp.newTrigger('paperBookOnEdit').forSpreadsheet(book).onEdit().create();
  SpreadsheetApp.getUi().alert('Idea-entry trigger installed. When an Ideas row has both an Idea ID and ticker, it creates a linked Valuation Inputs row once.');
}

function paperBookOnEdit(event) {
  if (!event || !event.range) return;
  const editedSheet = event.range.getSheet();
  if (editedSheet.getName() !== PAPER_SEC.ideasSheet || event.range.getRow() + event.range.getNumRows() - 1 < PAPER_SEC.firstDataRow) return;
  const headers = headerMap_(editedSheet, PAPER_SEC.headerRow);
  const ideaIdCol = headers['Idea ID'];
  const tickerCol = headers.Ticker;
  const companyCol = headers['Company name'];
  if (!ideaIdCol || !tickerCol || !companyCol) return;
  const firstCol = event.range.getColumn();
  const lastCol = firstCol + event.range.getNumColumns() - 1;
  if ((companyCol < firstCol || companyCol > lastCol) && (tickerCol < firstCol || tickerCol > lastCol)) return;
  const firstRow = Math.max(event.range.getRow(), PAPER_SEC.firstDataRow);
  const lastRow = event.range.getRow() + event.range.getNumRows() - 1;
  const lock = LockService.getDocumentLock();
  lock.waitLock(10000);
  try {
    for (let rowNumber = firstRow; rowNumber <= lastRow; rowNumber++) {
      const rowValues = editedSheet.getRange(rowNumber, 1, 1, editedSheet.getLastColumn()).getDisplayValues()[0];
      const idea = {
        ideaId: valueForHeader_(rowValues, headers, 'Idea ID'),
        company: valueForHeader_(rowValues, headers, 'Company name'),
        ticker: valueForHeader_(rowValues, headers, 'Ticker'),
        exchange: valueForHeader_(rowValues, headers, 'Exchange')
      };
      if (!idea.company || !idea.ticker) continue;
      if (!idea.ideaId) {
        idea.ideaId = generateIdeaId_();
        editedSheet.getRange(rowNumber, ideaIdCol).setValue(idea.ideaId);
      }
      const valuationRow = findOrCreateValuationRow_(event.source, idea);
      const properties = PropertiesService.getScriptProperties();
      const configuredId = properties.getProperty('PAPER_BOOK_SPREADSHEET_ID');
      const userAgent = properties.getProperty('SEC_USER_AGENT');
      if (!configuredId || configuredId !== event.source.getId()) {
        writeFundamentalsStatus_(valuationRow.sheet, valuationRow.rowNumber, 'SEC refresh skipped: set PAPER_BOOK_SPREADSHEET_ID to this private workbook ID.');
        event.source.toast('Idea linked. Set PAPER_BOOK_SPREADSHEET_ID before SEC refresh.', 'Paper Book', 8);
        continue;
      }
      if (!userAgent || !/@/.test(userAgent)) {
        writeFundamentalsStatus_(valuationRow.sheet, valuationRow.rowNumber, 'SEC refresh not run: set Script Property SEC_USER_AGENT with an identifying label and real contact email.');
        event.source.toast('Idea linked. Set SEC_USER_AGENT before automatic SEC refresh.', 'Paper Book', 8);
        continue;
      }
      try {
        const result = refreshIdeaFromSec_(idea, valuationRow, userAgent);
        const exchangeWarning = result.match.exchange && idea.exchange && !sameExchange_(result.match.exchange, idea.exchange);
        if (exchangeWarning) writeFundamentalsStatus_(valuationRow.sheet, valuationRow.rowNumber, result.result.sourceNote + '; WARNING: SEC ticker exchange differs from the saved exchange. Check the share class.');
        event.source.toast('Idea linked and SEC fundamentals refreshed for ' + idea.ticker + '.', 'Paper Book', 8);
      } catch (error) {
        const message = String(error && error.message || error);
        writeFundamentalsStatus_(valuationRow.sheet, valuationRow.rowNumber, 'SEC refresh failed: ' + message);
        event.source.toast('Idea linked, but SEC refresh failed for ' + idea.ticker + ': ' + message, 'Paper Book', 10);
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function generateIdeaId_() {
  return 'IDEA-' + Utilities.getUuid().replace(/-/g, '').slice(0, 12).toUpperCase();
}

function refreshIdeaFromSec_(idea, valuationRow, userAgent) {
  const match = resolveSecTicker_(idea.ticker, idea.exchange, userAgent);
  if (!match) throw new Error('No SEC ticker match for ' + idea.ticker + '. SEC Company Facts covers SEC reporting issuers only.');
  const facts = fetchCompanyFacts_(match.cik, userAgent);
  const result = deriveSecFundamentals_(facts, new Date());
  writeSecFields_(valuationRow.sheet, valuationRow.rowNumber, result);
  return {match, result};
}

function writeFundamentalsStatus_(sheet, rowNumber, message) {
  const headers = headerMap_(sheet, PAPER_SEC.headerRow);
  if (headers['Fundamentals source and period']) sheet.getRange(rowNumber, headers['Fundamentals source and period']).setValue(message);
}

function createSelectedIdeaValuationRow() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = book.getActiveSheet();
  const rowNumber = book.getActiveRange() ? book.getActiveRange().getRow() : 0;
  if (sheet.getName() !== PAPER_SEC.ideasSheet || rowNumber < PAPER_SEC.firstDataRow) throw new Error('Select an idea row on Ideas first.');
  const idea = readSelectedIdea_(book, sheet.getName(), rowNumber);
  if (!idea.ideaId || !idea.ticker) throw new Error('The selected row needs a saved Idea ID and ticker.');
  const row = findOrCreateValuationRow_(book, idea);
  SpreadsheetApp.getUi().alert('Valuation record linked: ' + idea.ideaId + (row.created ? '' : ' (it already existed).'));
}

function refreshSelectedIdeaFromSec() {
  const props = PropertiesService.getScriptProperties();
  const spreadsheetId = props.getProperty('PAPER_BOOK_SPREADSHEET_ID');
  const userAgent = props.getProperty('SEC_USER_AGENT');
  if (!spreadsheetId) throw new Error('Set Script Property PAPER_BOOK_SPREADSHEET_ID to the private Paper Book spreadsheet ID.');
  if (!userAgent || !/@/.test(userAgent)) throw new Error('Set Script Property SEC_USER_AGENT to an identifying label and a real contact email. Do not put the email in source code.');

  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book || book.getId() !== spreadsheetId) throw new Error('Open the private Paper Book spreadsheet before using this menu.');
  const active = book.getActiveSheet();
  const rowNumber = book.getActiveRange() ? book.getActiveRange().getRow() : 0;
  if (rowNumber < PAPER_SEC.firstDataRow) throw new Error('Select a company row in Ideas, or a valuation row, then use Paper Book > Refresh selected idea from SEC.');
  const idea = readSelectedIdea_(book, active.getName(), rowNumber);
  if (!idea || !idea.ideaId || !idea.ticker) throw new Error('The selected row needs a saved Idea ID and ticker.');

  const match = resolveSecTicker_(idea.ticker, idea.exchange, userAgent);
  if (!match) throw new Error('No SEC ticker match for ' + idea.ticker + '. SEC Company Facts covers SEC reporting issuers only.');
  const facts = fetchCompanyFacts_(match.cik, userAgent);
  const result = deriveSecFundamentals_(facts, new Date());
  const row = findOrCreateValuationRow_(book, idea);
  writeSecFields_(row.sheet, row.rowNumber, result);

  const limitations = result.missing.length ? '\nMissing or unavailable: ' + result.missing.join('; ') : '';
  SpreadsheetApp.getUi().alert(
    'SEC facts refreshed for ' + idea.ticker + ' (' + match.name + ').\n' +
    'Only SEC-derived fields and source notes were updated. Price remains manual.' + limitations +
    (match.exchange && idea.exchange && !sameExchange_(match.exchange, idea.exchange) ? '\nSEC exchange listing differs from the saved exchange. Check share-class/ticker mapping.' : '')
  );
}

function readSelectedIdea_(book, sheetName, rowNumber) {
  if (sheetName === PAPER_SEC.ideasSheet) {
    const sheet = book.getSheetByName(PAPER_SEC.ideasSheet);
    const headers = headerMap_(sheet, PAPER_SEC.headerRow);
    const values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    return {
      ideaId: valueForHeader_(values, headers, 'Idea ID'),
      company: valueForHeader_(values, headers, 'Company name'),
      ticker: valueForHeader_(values, headers, 'Ticker'),
      exchange: valueForHeader_(values, headers, 'Exchange'),
      sector: valueForHeader_(values, headers, 'Sector')
    };
  }
  if (sheetName === PAPER_SEC.valuationSheet) {
    const sheet = book.getSheetByName(PAPER_SEC.valuationSheet);
    const headers = headerMap_(sheet, PAPER_SEC.headerRow);
    const values = sheet.getRange(rowNumber, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
    const ideaId = valueForHeader_(values, headers, 'Idea ID');
    const sourceIdea = findIdeaById_(book, ideaId);
    if (sourceIdea) return sourceIdea;
    const tickerCell = valueForHeader_(values, headers, 'Ticker / exchange');
    const parts = String(tickerCell || '').split('/').map(x => x.trim());
    return {ideaId, ticker: parts[0] || '', exchange: parts[1] || '', company: ''};
  }
  throw new Error('Select a row on Ideas or Valuation Inputs.');
}

function findIdeaById_(book, ideaId) {
  const sheet = book.getSheetByName(PAPER_SEC.ideasSheet);
  if (!sheet || !ideaId || sheet.getLastRow() < PAPER_SEC.firstDataRow) return null;
  const headers = headerMap_(sheet, PAPER_SEC.headerRow);
  if (!headers['Idea ID']) return null;
  const values = sheet.getRange(PAPER_SEC.firstDataRow, 1, sheet.getLastRow() - PAPER_SEC.firstDataRow + 1, sheet.getLastColumn()).getDisplayValues();
  const index = values.findIndex(row => String(row[headers['Idea ID'] - 1]).trim() === String(ideaId).trim());
  if (index < 0) return null;
  const row = values[index];
  return {
    ideaId: valueForHeader_(row, headers, 'Idea ID'),
    company: valueForHeader_(row, headers, 'Company name'),
    ticker: valueForHeader_(row, headers, 'Ticker'),
    exchange: valueForHeader_(row, headers, 'Exchange'),
    sector: valueForHeader_(row, headers, 'Sector')
  };
}

function findOrCreateValuationRow_(book, idea) {
  const sheet = book.getSheetByName(PAPER_SEC.valuationSheet);
  if (!sheet) throw new Error('Missing Valuation Inputs tab.');
  const headers = headerMap_(sheet, PAPER_SEC.headerRow);
  ['Valuation record ID', 'Idea ID', 'Ticker / exchange'].forEach(h => requireHeader_(headers, h));
  const ideaCol = headers['Idea ID'];
  const lastRow = sheet.getLastRow();
  let rowNumber = 0;
  let lastOccupiedRow = PAPER_SEC.firstDataRow - 1;
  if (lastRow >= PAPER_SEC.firstDataRow) {
    const count = lastRow - PAPER_SEC.firstDataRow + 1;
    const dataRange = sheet.getRange(PAPER_SEC.firstDataRow, 1, count, sheet.getLastColumn());
    const values = dataRange.getDisplayValues();
    const formulas = dataRange.getFormulas();
    for (let i = 0; i < count; i++) {
      const currentRow = PAPER_SEC.firstDataRow + i;
      const ideaId = String(values[i][ideaCol - 1] || '').trim();
      if (ideaId === idea.ideaId) {
        const recordIdCol = headers['Valuation record ID'];
        const tickerCol = headers['Ticker / exchange'];
        if (recordIdCol && !String(values[i][recordIdCol - 1] || '').trim()) sheet.getRange(currentRow, recordIdCol).setValue('VAL-' + idea.ideaId);
        const tickerValue = idea.ticker + (idea.exchange ? ' / ' + idea.exchange : '');
        if (tickerCol && String(values[i][tickerCol - 1] || '').trim() !== tickerValue) sheet.getRange(currentRow, tickerCol).setValue(tickerValue);
        return {sheet, rowNumber: currentRow, created: false};
      }
      const hasUserValues = rowHasUserValues_(values[i], formulas[i]);
      if (hasUserValues) lastOccupiedRow = currentRow;
      if (!rowNumber && !ideaId && !hasUserValues) rowNumber = currentRow;
    }
  }
  if (!rowNumber) rowNumber = Math.max(lastOccupiedRow + 1, PAPER_SEC.firstDataRow);
  copyValuationRowFormat_(sheet, rowNumber, sheet.getLastColumn());
  const recordId = 'VAL-' + idea.ideaId;
  const newValues = new Array(sheet.getLastColumn()).fill('');
  newValues[headers['Valuation record ID'] - 1] = recordId;
  newValues[headers['Idea ID'] - 1] = idea.ideaId;
  newValues[headers['Ticker / exchange'] - 1] = idea.ticker + (idea.exchange ? ' / ' + idea.exchange : '');
  sheet.getRange(rowNumber, 1, 1, newValues.length).setValues([newValues]);
  seedValuationFormulas_(sheet, rowNumber, headers);
  return {sheet, rowNumber, created: true};
}

function seedValuationFormulas_(sheet, rowNumber, headers) {
  const formulaHeaders = ['Market cap', 'P/E TTM', 'Enterprise value', 'EV / EBITDA', 'P / Sales', 'P / Book', 'P / FFO', 'Suggested metric', 'Suggested multiple'];
  const firstDataRow = rowNumber > PAPER_SEC.firstDataRow ? PAPER_SEC.firstDataRow : 0;
  formulaHeaders.forEach(header => {
    const col = headers[header];
    if (!col) return;
    if (firstDataRow) {
      const template = sheet.getRange(firstDataRow, col).getFormulaR1C1();
      if (template) {
        sheet.getRange(rowNumber, col).setFormulaR1C1(template);
        return;
      }
    }
    const defaults = {
      'Market cap': '=IF(OR(RC[-4]="",RC[-2]=""),"",RC[-4]*RC[-2])',
      'P/E TTM': '=IFERROR(IF(OR(RC[-2]="",RC[-1]="",RC[-1]=0),"",RC[-2]/RC[-1]),"")',
      'Enterprise value': '=IF(RC[-6]="","",RC[-6]+N(RC[-2])-N(RC[-3]))',
      'EV / EBITDA': '=IFERROR(IF(OR(RC[-1]="",RC[-2]="",RC[-2]=0),"",RC[-1]/RC[-2]),"")',
      'P / Sales': '=IFERROR(IF(OR(RC[-12]="",RC[-3]="",RC[-3]=0),"",RC[-12]/RC[-3]),"")',
      'P / Book': '=IFERROR(IF(OR(RC[-13]="",RC[-3]="",RC[-3]=0),"",RC[-13]/RC[-3]),"")',
      'P / FFO': '=IFERROR(IF(OR(RC[-14]="",RC[-3]="",RC[-3]=0),"",RC[-14]/RC[-3]),"")'
    };
    if (defaults[header]) sheet.getRange(rowNumber, col).setFormulaR1C1(defaults[header]);
  });
}

function rowHasUserValues_(values, formulas) {
  return values.some((value, index) => !formulas[index] && String(value || '').trim() !== '');
}

function copyValuationRowFormat_(sheet, rowNumber, lastColumn) {
  if (rowNumber === PAPER_SEC.firstDataRow) return;
  const template = sheet.getRange(PAPER_SEC.firstDataRow, 1, 1, lastColumn);
  const target = sheet.getRange(rowNumber, 1, 1, lastColumn);
  template.copyTo(target, {formatOnly: true});
  target.setDataValidations(template.getDataValidations());
}

function writeSecFields_(sheet, rowNumber, result) {
  const headers = headerMap_(sheet, PAPER_SEC.headerRow);
  const columns = {
    'Shares outstanding': result.sharesOutstanding,
    'Share-count date/source': result.shareCountSource,
    'TTM net income': result.ttmNetIncome,
    'Cash & equivalents': result.cash,
    'Total debt': result.totalDebt,
    'TTM EBITDA': result.ttmEbitda,
    'TTM revenue': result.ttmRevenue,
    'Total equity': result.totalEquity,
    'Fundamentals source and period': result.sourceNote
  };
  Object.keys(columns).forEach(header => {
    const col = headers[header];
    if (!col) throw new Error('Valuation Inputs is missing expected header: ' + header);
    sheet.getRange(rowNumber, col).setValue(columns[header]);
  });
}

function resolveSecTicker_(ticker, exchange, userAgent) {
  const cache = CacheService.getScriptCache();
  let rows = null;
  const cached = cache.get(PAPER_SEC.tickerCacheKey);
  if (cached) rows = JSON.parse(cached);
  if (!rows) {
    const response = UrlFetchApp.fetch(PAPER_SEC.tickerMapUrl, secFetchOptions_(userAgent));
    rows = parseTickerMap_(JSON.parse(response.getContentText()));
    cache.put(PAPER_SEC.tickerCacheKey, JSON.stringify(rows), 21600);
  }
  return resolveTickerFromRows_(rows, ticker, exchange);
}

function fetchCompanyFacts_(cik, userAgent) {
  const response = UrlFetchApp.fetch(PAPER_SEC.factsUrl + String(cik).padStart(10, '0') + '.json', secFetchOptions_(userAgent));
  return JSON.parse(response.getContentText());
}

function secFetchOptions_(userAgent) {
  return {method: 'get', headers: {'User-Agent': userAgent, 'Accept-Encoding': 'gzip, deflate', Accept: 'application/json'}, muteHttpExceptions: false};
}

function parseTickerMap_(json) {
  const source = Array.isArray(json) ? json : Array.isArray(json.data) ? json.data : Object.keys(json || {}).filter(key => /^\d+$/.test(key)).map(key => json[key]);
  const fields = Array.isArray(json.fields) ? json.fields : [];
  return source.map(row => {
    let record = row;
    if (Array.isArray(row)) {
      record = {};
      fields.forEach((field, index) => { record[field] = row[index]; });
    }
    const cik = record.cik || record.cik_str || record.CIK;
    return {
      cik: cik == null ? '' : String(cik).replace(/^0+/, ''),
      ticker: String(record.ticker || record.symbol || '').trim(),
      name: String(record.name || record.title || record.company || '').trim(),
      exchange: String(record.exchange || '').trim()
    };
  }).filter(row => row.cik && row.ticker);
}

function deriveSecFundamentals_(companyFacts, asOf) {
  const tags = (companyFacts.facts && companyFacts.facts['us-gaap']) || {};
  const chosen = {};
  const missing = [];
  function duration(names, label) {
    for (let i = 0; i < names.length; i++) {
      const fact = getConcept_(tags, names[i]);
      const series = fact ? ttmSeries_(fact) : null;
      if (series) { chosen[label] = series; return series.value; }
    }
    missing.push(label + ' lacks four comparable reported quarters or a usable concept tag');
    return '';
  }
  function instant(names, label) {
    for (let i = 0; i < names.length; i++) {
      const point = latestInstant_(getConcept_(tags, names[i]));
      if (point) { chosen[label] = point; return point.value; }
    }
    missing.push(label + ' tag is unavailable');
    return '';
  }

  const shares = instant(['EntityCommonStockSharesOutstanding', 'CommonStockSharesOutstanding'], 'shares');
  const netIncome = duration(['NetIncomeLossAvailableToCommonStockholdersBasic', 'NetIncomeLoss', 'ProfitLoss'], 'net income');
  const revenue = duration(['RevenueFromContractWithCustomerExcludingAssessedTax', 'SalesRevenueNet', 'Revenues', 'RevenueFromContractWithCustomerIncludingAssessedTax', 'SalesRevenueGoodsNet'], 'revenue');
  const operatingIncome = duration(['OperatingIncomeLoss'], 'operating income');
  const depreciation = duration(['DepreciationDepletionAndAmortization', 'DepreciationDepletionAndAmortizationPropertyPlantAndEquipment'], 'depreciation and amortization');
  const cash = instant(['CashAndCashEquivalentsAtCarryingValue', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents', 'CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalentsIncludingDisposalGroupAndDiscontinuedOperation'], 'cash and equivalents');
  const debtPoint = latestDebt_(tags);
  const debt = debtPoint ? debtPoint.value : '';
  if (!debtPoint) missing.push('total debt could not be built from a complete, non-overlapping SEC debt tag set');
  const equity = instant(['StockholdersEquity', 'StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest'], 'total equity');
  let ebitda = '';
  let ebitdaPeriod = '';
  if (typeof operatingIncome === 'number' && typeof depreciation === 'number') {
    if (chosen['operating income'].period === chosen['depreciation and amortization'].period) {
      ebitda = operatingIncome + depreciation;
      ebitdaPeriod = chosen['operating income'].period;
    } else {
      missing.push('TTM EBITDA unavailable because operating income and depreciation periods do not match');
    }
  } else {
    missing.push('TTM EBITDA unavailable because operating income or depreciation and amortization is missing');
  }
  const dates = Object.keys(chosen).map(key => chosen[key].filed || chosen[key].date).filter(Boolean).sort();
  const shareDate = chosen.shares ? chosen.shares.date : '';
  const latestDate = dates.length ? dates[dates.length - 1] : '';
  const sources = Object.keys(chosen).map(key => key + ': ' + chosen[key].tag + ' ' + chosen[key].period);
  const sourceNote = [
    'SEC Company Facts, retrieved ' + formatDate_(asOf),
    'CIK ' + String(companyFacts.cik || '').padStart(10, '0'),
    'Facts JSON https://data.sec.gov/api/xbrl/companyfacts/CIK' + String(companyFacts.cik || '').padStart(10, '0') + '.json',
    'Latest contributing filing ' + (latestDate || 'unavailable'),
    sources.join('; '),
    'TTM EBITDA period ' + (ebitdaPeriod || 'unavailable'),
    missing.length ? 'Limitations: ' + missing.join('; ') : ''
  ].filter(Boolean).join('; ');
  return {
    sharesOutstanding: shares,
    shareCountSource: shareDate ? 'SEC Company Facts; instant fact date ' + shareDate + (chosen.shares.tag ? '; ' + chosen.shares.tag : '') : 'SEC shares outstanding tag unavailable',
    ttmNetIncome: netIncome,
    cash,
    totalDebt: debt,
    ttmEbitda: ebitda,
    ttmRevenue: revenue,
    totalEquity: equity,
    sourceNote,
    missing
  };
}

function ttmSeries_(concept) {
  if (!concept || !concept.units) return null;
  const unitKey = preferredUnit_(concept.units);
  if (!unitKey) return null;
  const points = dedupeDurations_(concept.units[unitKey]).filter(point => validDate_(point.start) && validDate_(point.end));
  const quarters = new Map();
  points.forEach(point => {
    const days = dayCount_(point.start, point.end) + 1;
    if (days >= 70 && days <= 110) keepLatest_(quarters, point.end, point);
  });
  const byFiscalStart = new Map();
  points.filter(point => {
    const days = dayCount_(point.start, point.end) + 1;
    return days >= 70 && days <= 390;
  }).forEach(point => {
    const fiscalStart = point.start;
    if (!byFiscalStart.has(fiscalStart)) byFiscalStart.set(fiscalStart, []);
    byFiscalStart.get(fiscalStart).push(point);
  });
  byFiscalStart.forEach(group => {
    group.sort((a, b) => a.end.localeCompare(b.end));
    group.forEach(point => {
      const duration = dayCount_(point.start, point.end) + 1;
      let quarter = null;
      if (duration >= 140 && duration <= 205) {
        const prior = group.find(x => x.end < point.end && dayCount_(x.start, x.end) + 1 >= 70 && dayCount_(x.start, x.end) + 1 <= 110);
        if (prior && prior.start === point.start) quarter = subtractPeriod_(point, prior);
      } else if (duration >= 230 && duration <= 305) {
        const prior = group.filter(x => x.end < point.end && dayCount_(x.start, x.end) + 1 >= 140 && dayCount_(x.start, x.end) + 1 <= 205).sort((a, b) => b.end.localeCompare(a.end))[0];
        if (prior && prior.start === point.start) quarter = subtractPeriod_(point, prior);
      } else if (duration >= 330 && duration <= 390) {
        const prior = group.filter(x => x.end < point.end && dayCount_(x.start, x.end) + 1 >= 230 && dayCount_(x.start, x.end) + 1 <= 305).sort((a, b) => b.end.localeCompare(a.end))[0];
        if (prior && prior.start === point.start) quarter = subtractPeriod_(point, prior);
      }
      if (quarter) {
        const direct = quarters.get(quarter.end);
        if (!direct) keepLatest_(quarters, quarter.end, quarter);
      }
    });
  });
  const latestFour = [...quarters.values()].sort((a, b) => a.end.localeCompare(b.end)).slice(-4);
  if (latestFour.length !== 4) return null;
  for (let i = 1; i < latestFour.length; i++) {
    const gap = dayCount_(latestFour[i - 1].end, latestFour[i].end);
    if (gap < 70 || gap > 120) return null;
  }
  return {
    value: latestFour.reduce((sum, point) => sum + point.val, 0),
    period: latestFour[0].start + ' to ' + latestFour[3].end,
    filed: latestFour.map(point => point.filed || '').sort().pop() || '',
    tag: concept.label || '',
    accessions: latestFour.map(point => point.accn || '')
  };
}

function latestInstant_(concept) {
  if (!concept || !concept.units) return null;
  const unitKey = preferredUnit_(concept.units);
  if (!unitKey) return null;
  const points = concept.units[unitKey].filter(point => !point.start && validDate_(point.end) && Number.isFinite(Number(point.val)) && allowedForm_(point.form));
  if (!points.length) return null;
  points.sort((a, b) => a.end.localeCompare(b.end) || String(a.filed).localeCompare(String(b.filed)));
  const p = points[points.length - 1];
  return {value: Number(p.val), date: p.end, filed: p.filed || '', tag: concept.label || '', period: p.end};
}

function latestDebt_(tags) {
  const debtPairs = [
    ['LongTermDebtAndFinanceLeaseObligationsCurrent', 'LongTermDebtAndFinanceLeaseObligationsNoncurrent'],
    ['LongTermDebtCurrent', 'LongTermDebtNoncurrent'],
    ['ShortTermBorrowings', 'LongTermDebt']
  ];
  for (let i = 0; i < debtPairs.length; i++) {
    const current = latestInstant_(getConcept_(tags, debtPairs[i][0]));
    const noncurrent = latestInstant_(getConcept_(tags, debtPairs[i][1]));
    if (current && noncurrent && current.date === noncurrent.date) {
      return {value: current.value + noncurrent.value, date: current.date, filed: [current.filed, noncurrent.filed].sort().pop(), tag: debtPairs[i].join(' + '), period: current.date};
    }
  }
  const total = latestInstant_(getConcept_(tags, 'LongTermDebtAndCapitalLeaseObligations'));
  if (total) return total;
  const combined = latestInstant_(getConcept_(tags, 'LongTermDebtAndFinanceLeaseObligations'));
  if (combined) return combined;
  return null;
}

function getConcept_(tags, name) {
  const concept = tags[name];
  if (!concept) return null;
  concept.label = name;
  return concept;
}

function dedupeDurations_(points) {
  const byPeriod = new Map();
  (points || []).filter(point => point.start && point.end && Number.isFinite(Number(point.val)) && allowedForm_(point.form)).forEach(point => {
    const key = point.start + '|' + point.end;
    const prior = byPeriod.get(key);
    if (!prior || String(point.filed || '') > String(prior.filed || '')) byPeriod.set(key, Object.assign({}, point, {val: Number(point.val)}));
  });
  return [...byPeriod.values()];
}

function subtractPeriod_(current, prior) {
  return {
    start: prior.end,
    end: current.end,
    val: current.val - prior.val,
    filed: [current.filed || '', prior.filed || ''].sort().pop(),
    form: current.form,
    accn: current.accn,
    derived: true
  };
}

function keepLatest_(map, key, point) {
  const prior = map.get(key);
  if (!prior || String(point.filed || '') > String(prior.filed || '')) map.set(key, point);
}

function preferredUnit_(units) {
  const keys = Object.keys(units || {});
  if (keys.indexOf('USD') >= 0) return 'USD';
  if (keys.indexOf('shares') >= 0) return 'shares';
  if (keys.indexOf('USD-per-share') >= 0) return 'USD-per-share';
  return keys.length === 1 ? keys[0] : '';
}

function allowedForm_(form) {
  return ['10-Q', '10-K', '20-F', '40-F', '6-K', '8-K'].indexOf(String(form || '').replace(/\/A$/, '')) >= 0;
}

function headerMap_(sheet, row) {
  const labels = sheet.getRange(row, 1, 1, sheet.getLastColumn()).getDisplayValues()[0];
  const map = {};
  labels.forEach((label, index) => { if (label) map[String(label).trim()] = index + 1; });
  return map;
}

function valueForHeader_(values, headers, label) {
  return headers[label] ? String(values[headers[label] - 1] || '').trim() : '';
}

function requireHeader_(headers, label) {
  if (!headers[label]) throw new Error('Missing required column: ' + label);
}

function normalizeTicker_(ticker) {
  return String(ticker || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function sameExchange_(left, right) {
  const normalize = value => String(value || '').toUpperCase().replace(/[^A-Z]/g, '');
  const aliases = {NYSE: 'NYSE', NEWYORKSTOCKEXCHANGE: 'NYSE', NASDAQ: 'NASDAQ', NASDAQGLOBALSELECTMARKET: 'NASDAQ', NASDAQGLOBALMARKET: 'NASDAQ', NASDAQCAPITALMARKET: 'NASDAQ', NYSEAMERICAN: 'NYSEAMERICAN', AMEX: 'NYSEAMERICAN'};
  return (aliases[normalize(left)] || normalize(left)) === (aliases[normalize(right)] || normalize(right));
}

function dayCount_(from, to) {
  return Math.round((Date.parse(to + 'T00:00:00Z') - Date.parse(from + 'T00:00:00Z')) / 86400000);
}

function validDate_(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) && Number.isFinite(Date.parse(value));
}

function formatDate_(date) { return new Date(date).toISOString().slice(0, 16).replace('T', ' ') + ' UTC'; }

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    parseTickerMap_, normalizeTicker_, sameExchange_, resolveTickerFromRows_,
    ttmSeries_, latestInstant_, latestDebt_, deriveSecFundamentals_, dedupeDurations_,
    writeSecFields_, findOrCreateValuationRow_, paperBookOnEdit, PAPER_SEC
  };
}

function resolveTickerFromRows_(rows, ticker, exchange) {
  const wanted = normalizeTicker_(ticker);
  const exact = rows.filter(row => String(row.ticker).toUpperCase() === String(ticker).trim().toUpperCase());
  let candidates = exact.length ? exact : rows.filter(row => normalizeTicker_(row.ticker) === wanted);
  if (exchange) {
    const same = candidates.filter(row => sameExchange_(row.exchange, exchange));
    if (!same.length && candidates.length) throw new Error('Ticker ' + ticker + ' is found at SEC, but none of its exchange listings match ' + exchange + '. Check the ticker and exchange fields.');
    if (same.length) candidates = same;
  }
  const unique = [...new Map(candidates.map(row => [row.cik, row])).values()];
  if (unique.length > 1) throw new Error('Ambiguous SEC ticker: ' + ticker + '. Use the exchange to select one issuer.');
  return unique[0] || null;
}
