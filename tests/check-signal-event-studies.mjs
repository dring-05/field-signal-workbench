import assert from 'node:assert/strict';
import { parsePeriod, parseTable, analyze } from '../public/signal-event-studies.js';

assert.equal(parsePeriod('2024-13'), null);
assert.equal(parsePeriod('2024-02-29').frequency, 'daily');

const series = parseTable(`period,value\n2024-01,98\n2024-02,100\n2024-03,102\n2024-04,103\n2024-05,105\n2024-06,104\n2024-07,105\n2024-08,104\n2024-09,110\n2024-10,112\n2024-11,111`, 'series');
const events = parseTable(`date,event\n2024-04,Commissioning\n2024-09,Price increase`, 'events');
const result = analyze(series, events, { before: 2, after: 2, baseline: 'mean', minEvents: 2 });
assert.equal(result.aggregateUsable, true);
assert.equal(result.summary.n, 2);
assert.equal(result.included[0].baseline, 101);
assert.equal(result.included[0].postMean, 104);
assert.equal(result.included[0].absoluteChange, 3);
assert.equal(result.included[1].baseline, 104.5);
assert.equal(result.included[1].postMean, 111);

const lastBaseline = analyze(series, events, { before: 2, after: 1, baseline: 'last', minEvents: 2 });
assert.equal(lastBaseline.included[0].baseline, 102);
assert.equal(lastBaseline.included[0].postMean, 103);

const gapSeries = parseTable(`period,value\n2024-01,10\n2024-02,12\n2024-04,16\n2024-05,18\n2024-06,20\n2024-07,22`, 'series');
const gapEvents = parseTable(`date,event\n2024-04,Event`, 'events');
const strictGap = analyze(gapSeries, gapEvents, { before: 2, after: 2, coverage: 1, minEvents: 2 });
assert.equal(strictGap.rows[0].included, false);
assert.match(strictGap.rows[0].reason, /coverage/);
const permissiveGap = analyze(gapSeries, gapEvents, { before: 2, after: 2, coverage: 0.5, minEvents: 2 });
assert.equal(permissiveGap.rows[0].included, true);
assert.equal(permissiveGap.rows[0].baselineN, 1);

const overlappingEvents = parseTable(`date,event\n2024-04,First\n2024-05,Second`, 'events');
const overlap = analyze(series, overlappingEvents, { before: 1, after: 2, minEvents: 2 });
assert.equal(overlap.included.length, 1);
assert.match(overlap.rows[1].reason, /Overlaps/);
assert.equal(overlap.aggregateUsable, false);

const dailyEvents = parseTable(`date,event\n2024-04-01,Daily`, 'events');
const mismatch = analyze(series, dailyEvents, { before: 1, after: 1, minEvents: 2 });
assert.equal(mismatch.aggregateUsable, false);
assert.ok(mismatch.warnings.some(item => item.includes('same single frequency')));

const duplicated = parseTable(`period,value\n2024-01,1\n2024-01,2\n2024-02,3`, 'series');
assert.deepEqual(duplicated.errors.duplicates, [{ period: '2024-01', count: 2 }]);
assert.equal(duplicated.rows.some(row => row.period === '2024-01'), false);

console.log('Signal event study checks passed: parsing, event windows, baselines, period gaps, overlap exclusions, frequency checks, and minimum sample safeguards.');
