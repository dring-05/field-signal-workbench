/**
 * Validates the single curated SiteFeed tab before it is published to the
 * public dashboard. The workbook publishes this one tab as CSV. Raw monthly
 * history, statements, audit rows, and logs stay in this workbook privately.
 */
function validateTaiwanPublicFeed() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  if (!book) throw new Error('Bind this script to the private Taiwan Monthly Signals workbook before checking the feed.');
  const sheet = book.getSheetByName('SiteFeed');
  if (!sheet || sheet.getLastRow() < 6) throw new Error('The SiteFeed tab does not contain a header and issuer rows.');
  const expected = FEED_HEADERS;
  const actual = sheet.getRange(4, 1, 1, expected.length).getValues()[0];
  if (actual.length !== expected.length || actual.some((value, index) => value !== expected[index])) {
    throw new Error('The SiteFeed tab does not match the approved public schema.');
  }
  const rows = sheet.getLastRow() - 4;
  const sample = sheet.getRange(5, 1, 1, 6).getValues()[0];
  if (!sample[2] || !sample[5]) throw new Error('The SiteFeed tab has no complete issuer row.');
  return {result: 'ready to publish', tab: 'SiteFeed', rows, columns: expected.length, note: 'Publish only the SiteFeed tab as CSV. Keep all other tabs private.'};
}

// This file is the local source for the feed synchronizer installed in the
// bound Apps Script project on the Taiwan Public Company Signals workbook.
// It publishes only the reviewed SiteFeed tab into a separate personal feed
// workbook. It does not expose the source workbook or its history tabs.
const TAIWAN_PUBLIC_FEED_SYNC = {
  sourceSheet: 'SiteFeed',
  destinationSheet: 'LiveSiteFeed',
  headerRow: 4,
  expectedRowsMinimum: 500,
  maxRows: 3000,
  columns: 38,
  reportMonthIndex: 5,
  revenueIndex: 6,
  differenceIndexes: [8, 9, 10],
  yearAgoRevenueIndex: 28,
  statusIndex: 23,
  denominatorRatioIndex: 33,
  denominatorStatusIndex: 34,
  outlierStatusIndex: 35,
  marketLatestIndex: 36,
  freshnessIndex: 37
};

function taiwanPublicFeedIds_() {
  const properties = PropertiesService.getScriptProperties();
  const sourceSpreadsheetId = properties.getProperty('TAIWAN_SOURCE_SPREADSHEET_ID');
  const destinationSpreadsheetId = properties.getProperty('TAIWAN_PUBLIC_FEED_SPREADSHEET_ID');
  if (!sourceSpreadsheetId || !destinationSpreadsheetId) {
    throw new Error('Set the source and public-feed spreadsheet IDs in Script Properties before syncing.');
  }
  return {sourceSpreadsheetId, destinationSpreadsheetId};
}

function syncTaiwanPublicFeed() {
  const config = TAIWAN_PUBLIC_FEED_SYNC;
  const ids = taiwanPublicFeedIds_();
  const sourceBook = SpreadsheetApp.openById(ids.sourceSpreadsheetId);
  if (!sourceBook || sourceBook.getId() !== ids.sourceSpreadsheetId) {
    throw new Error('Refusing to publish from an unexpected workbook.');
  }
  const source = sourceBook.getSheetByName(config.sourceSheet);
  if (!source) throw new Error('Source SiteFeed tab is missing.');
  const lastRow = source.getLastRow();
  if (lastRow < config.headerRow + config.expectedRowsMinimum || lastRow > config.maxRows) {
    throw new Error('Unexpected SiteFeed row count: ' + lastRow + '. Public feed left unchanged.');
  }
  const values = source.getRange(1, 1, lastRow, config.columns).getDisplayValues();
  const headers = values[config.headerRow - 1];
  if (headers[2] !== 'Company code' || headers[3] !== 'Company name' ||
      headers[5] !== 'Report month' || headers[10] !== 'Revenue YoY Δ3 (pp/month³)' ||
      headers[28] !== 'Revenue year-ago month' ||
      headers[33] !== 'Year-ago base / current revenue %' ||
      headers[37] !== 'Freshness status') {
    throw new Error('SiteFeed schema check failed. Public feed left unchanged.');
  }
  const rows = values.map(row => row.slice(0, config.columns));
  let maxPeriod = '';
  let maxPeriodOrdinal = -Infinity;
  const maxByMarket = new Map();
  const marketOrdinal = value => {
    const match = String(value || '').match(/^(\d{4})-(\d{2})$/);
    return match ? Number(match[1]) * 12 + Number(match[2]) - 1 : -Infinity;
  };
  let suppressed = 0;
  let issuerRows = 0;
  for (let i = config.headerRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row[2] || !row[config.reportMonthIndex]) continue;
    issuerRows++;
    const period = String(row[config.reportMonthIndex]).trim();
    const periodOrdinal = marketOrdinal(period);
    if (periodOrdinal > maxPeriodOrdinal) {
      maxPeriodOrdinal = periodOrdinal;
      maxPeriod = period;
    }
    const market = String(row[0] || '').trim();
    if (periodOrdinal > (maxByMarket.get(market)?.ordinal ?? -Infinity)) maxByMarket.set(market, {period, ordinal: periodOrdinal});
  }
  for (let i = config.headerRow; i < rows.length; i++) {
    const row = rows[i];
    if (!row[2] || !row[config.reportMonthIndex]) continue;
    const currentText = String(row[config.revenueIndex] || '').replace(/,/g, '').trim();
    const baseText = String(row[config.yearAgoRevenueIndex] || '').replace(/,/g, '').trim();
    const current = currentText ? Number(currentText) : NaN;
    const base = baseText ? Number(baseText) : NaN;
    const ratioPct = Number.isFinite(current) && current > 0 && Number.isFinite(base) ? base / current * 100 : '';
    const denominatorStatus = !Number.isFinite(current) || current <= 0 || !Number.isFinite(base)
      ? 'Missing or invalid comparison base'
      : base <= 0 ? 'Zero or negative comparison base'
      : ratioPct < 1 ? 'Low base below 1% of current revenue' : 'Usable';
    const yoyText = String(row[7] || '').replace(/,/g, '').trim();
    const yoy = yoyText ? Number(yoyText) : NaN;
    const outlierStatus = !Number.isFinite(yoy) ? 'Not available'
      : Math.abs(yoy) >= 500 ? 'Review outlier: absolute reported YoY growth at least 500%' : 'None';
    const market = String(row[0] || '').trim();
    const marketLatest = maxByMarket.get(market)?.period || '';
    const currentOrdinal = marketOrdinal(String(row[config.reportMonthIndex]).trim());
    const marketLatestOrdinal = marketOrdinal(marketLatest);
    const freshness = String(row[config.freshnessIndex] || '').startsWith('Source refresh failed')
      ? row[config.freshnessIndex]
      : marketLatestOrdinal < maxPeriodOrdinal
      ? `Stale partition; this market through ${marketLatest}, feed maximum ${maxPeriod}`
      : currentOrdinal < marketLatestOrdinal
      ? `Issuer report lags its market partition by ${marketLatestOrdinal - currentOrdinal} month(s)`
      : 'Current';
    row[config.denominatorRatioIndex] = ratioPct;
    row[config.denominatorStatusIndex] = denominatorStatus;
    row[config.outlierStatusIndex] = outlierStatus;
    row[config.marketLatestIndex] = marketLatest;
    row[config.freshnessIndex] = freshness;
    if (denominatorStatus !== 'Usable') {
      config.differenceIndexes.forEach(index => row[index] = '');
      const note = 'Public feed: revenue trend differences suppressed because the comparison base is missing, nonpositive, or below 1% of current revenue.';
      row[config.statusIndex] = row[config.statusIndex] ? row[config.statusIndex] + '; ' + note : note;
      suppressed++;
    }
  }
  if (issuerRows < config.expectedRowsMinimum || !maxPeriod) {
    throw new Error('Source rows or report period failed validation. Public feed left unchanged.');
  }
  const destination = SpreadsheetApp.openById(ids.destinationSpreadsheetId);
  const target = destination.getSheetByName(config.destinationSheet);
  if (!target) throw new Error('Destination LiveSiteFeed tab is missing.');
  if (target.getMaxRows() < rows.length) target.insertRowsAfter(target.getMaxRows(), rows.length - target.getMaxRows());
  if (target.getMaxColumns() < config.columns) target.insertColumnsAfter(target.getMaxColumns(), config.columns - target.getMaxColumns());
  target.getRange(1, 1, rows.length, config.columns).setValues(rows);
  if (target.getLastRow() > rows.length) {
    target.getRange(rows.length + 1, 1, target.getLastRow() - rows.length, config.columns).clearContent();
  }
  SpreadsheetApp.flush();
  const result = {
    status: 'success', reportMonth: maxPeriod, issuerRows,
    lowBaseRowsSuppressed: suppressed, destination: destination.getUrl()
  };
  console.log(JSON.stringify(result));
  return result;
}

function setupTaiwanPublicFeedSync() {
  const ids = taiwanPublicFeedIds_();
  const sourceBook = SpreadsheetApp.openById(ids.sourceSpreadsheetId);
  if (!sourceBook || sourceBook.getId() !== ids.sourceSpreadsheetId) {
    throw new Error('Refusing to set up a trigger in an unexpected workbook.');
  }
  const exists = ScriptApp.getProjectTriggers().some(trigger =>
    trigger.getHandlerFunction() === 'syncTaiwanPublicFeed');
  if (!exists) {
    ScriptApp.newTrigger('syncTaiwanPublicFeed').timeBased().everyDays(1)
      .atHour(8).inTimezone('America/New_York').create();
  }
  return syncTaiwanPublicFeed();
}
