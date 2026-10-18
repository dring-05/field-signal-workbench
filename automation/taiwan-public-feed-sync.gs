/**
 * Copies only the curated 33-column SiteFeed into its separate public-feed
 * workbook. Keep the source workbook and all history/audit tabs private.
 */
const PUBLIC_TAIWAN_FEED = {
  sourceSpreadsheetId: '1qNrg6QhGKBai0jOa6teL1WNsiCazZQQmRVA4Po5fuIY',
  targetSpreadsheetId: '1bdq1OZ4-lcNMMWNqpGdAIqb3CM1oGDmdIOY1e5KN0cg',
  sheetName: 'SiteFeed',
  headers: ['Market', 'Issuer series key', 'Company code', 'Company name', 'Industry', 'Report month', 'Revenue', 'Revenue YoY %', 'Revenue YoY Δ1 (pp/month)', 'Revenue YoY Δ2 (pp/month²)', 'Revenue YoY Δ3 (pp/month³)', 'Consecutive monthly observations', 'Gross margin %', 'Gross margin YoY change (pp)', 'Gross margin Δ1 (pp/quarter)', 'Gross margin Δ2 (pp/quarter²)', 'Gross margin Δ3 (pp/quarter³)', 'Operating margin %', 'Operating margin YoY change (pp)', 'Operating margin Δ1 (pp/quarter)', 'Operating margin Δ2 (pp/quarter²)', 'Operating margin Δ3 (pp/quarter³)', 'Latest statement date', 'Data status', 'Monthly source URL', 'English company name or official abbreviation', 'Mandarin pronunciation lookup', 'Revenue prior month', 'Revenue year-ago month', 'Revenue MoM %', 'Revenue YTD', 'Revenue prior-year YTD', 'Revenue YTD growth %']
};

function setupTaiwanPublicFeedSync() {
  const exists = ScriptApp.getProjectTriggers().some(trigger => trigger.getHandlerFunction() === 'syncTaiwanPublicFeed');
  if (!exists) ScriptApp.newTrigger('syncTaiwanPublicFeed').timeBased().everyDays(1).atHour(10).inTimezone('America/New_York').create();
  return {result: 'ready', handler: 'syncTaiwanPublicFeed', schedule: 'Daily, approximately 10:00 America/New_York'};
}

function syncTaiwanPublicFeed() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error('Another Taiwan feed sync is already running.');
  try {
    const sourceBook = SpreadsheetApp.openById(PUBLIC_TAIWAN_FEED.sourceSpreadsheetId);
    const source = sourceBook.getSheetByName(PUBLIC_TAIWAN_FEED.sheetName);
    if (!source || source.getLastRow() < 4) throw new Error('The private SiteFeed source is missing its header row.');

    const width = PUBLIC_TAIWAN_FEED.headers.length;
    const headers = source.getRange(4, 1, 1, width).getValues()[0];
    if (headers.length !== width || headers.some((header, index) => header !== PUBLIC_TAIWAN_FEED.headers[index])) {
      throw new Error('The private SiteFeed header does not match the approved 33-column public schema.');
    }

    const rowCount = source.getLastRow() - 3;
    const values = source.getRange(4, 1, rowCount, width).getValues();
    if (values.length < 2 || values.slice(1).some(row => !row[2] || !row[5])) {
      throw new Error('The private SiteFeed has no complete issuer records. The existing public feed was left unchanged.');
    }
    const targetBook = SpreadsheetApp.openById(PUBLIC_TAIWAN_FEED.targetSpreadsheetId);
    const target = targetBook.getSheetByName(PUBLIC_TAIWAN_FEED.sheetName);
    if (!target) throw new Error('The separate public-only workbook has no SiteFeed tab.');
    if (target.getMaxColumns() < width) target.insertColumnsAfter(target.getMaxColumns(), width - target.getMaxColumns());
    if (target.getMaxRows() < values.length + 3) target.insertRowsAfter(target.getMaxRows(), values.length + 3 - target.getMaxRows());

    const previousRows = Math.max(0, target.getLastRow() - 3);
    if (previousRows) target.getRange(4, 1, previousRows, width).clearContent();
    target.getRange(4, 1, values.length, width).setValues(values);
    writeLog_('Public feed synced', '', Math.max(0, values.length - 1), Math.max(0, values.length - 1), 0,
      'Copied the approved SiteFeed columns to the separate public-only workbook.',
      'Rows including header: ' + values.length + '; source tab: SiteFeed; public fields: ' + width);
    return {result: 'success', rows: Math.max(0, values.length - 1), columns: width};
  } finally {
    lock.releaseLock();
  }
}
