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
