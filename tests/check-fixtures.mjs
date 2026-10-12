import { readFile, readdir } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const files = new Set(await readdir(here));
const expected = [
  '01_quoted_fields.csv',
  '02_utf8_bom.csv',
  '03_locale_numbers.csv',
  '04_dates_and_missing.csv',
  '05_duplicates_and_ragged.csv',
  '06_wide_table.csv',
  '07_tab_separated.tsv',
  '08_unclosed_quote.csv',
];
for (const name of expected) assert(files.has(name), `Missing fixture: ${name}`);

const text = async (name) => (await readFile(join(here, name), 'utf8')).replace(/^\uFEFF/, '');
const quoted = await text('01_quoted_fields.csv');
assert.match(quoted, /"Washington, DC"/);
assert.match(quoted, /"Source note: ""sample"" value"/);
assert.match(quoted, /line one\r?\nline two/);

const bom = await readFile(join(here, '02_utf8_bom.csv'));
assert.deepEqual([...bom.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM fixture must begin with EF BB BF');

const numbers = await text('03_locale_numbers.csv');
for (const sample of ['"1,234.50"', '"1.234,50"', '"($1,245.75)"', '"12.5%"']) {
  assert(numbers.includes(sample), `Missing numeric-format sample ${sample}`);
}

const dates = await text('04_dates_and_missing.csv');
for (const sample of ['2026-09-01', '09/30/2026', '01/02/2026', '45292', 'Sep 2026']) {
  assert(dates.includes(sample), `Missing date sample ${sample}`);
}

const messy = await text('05_duplicates_and_ragged.csv');
assert.equal((messy.match(/2026-10-01,26,/g) || []).length, 2, 'Expected same-date/local duplicate');
assert.match(messy, /2026-10-03,26,62\.00,unexpected extra field/);
assert.match(messy, /2026-10-02,26,$/m, 'Expected missing value');

const wide = await text('06_wide_table.csv');
assert.match(wide, /period,Local 26,Local 48,Local 134/);

const tsv = await text('07_tab_separated.tsv');
assert.match(tsv, /date\tlocal\topen_calls\twage_usd_hour/);
assert.equal((tsv.match(/\n/g) || []).length, 4, 'Expected header and three TSV observations');

const unclosed = await text('08_unclosed_quote.csv');
assert.match(unclosed, /"unterminated/);

console.log(`Fixture integrity passed: ${expected.length} synthetic CSV/TSV files.`);
console.log(`Browser acceptance steps: ${basename(join(here, 'README.md'))}`);
