/*
 * Event-centered operating signal study.
 * Runs in the browser, makes no network requests, and does not save pasted data.
 */
(function (root) {
  'use strict';

  const PERIOD = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

  function parsePeriod(raw) {
    const value = String(raw ?? '').trim();
    const match = value.match(PERIOD);
    if (!match) return null;
    const [, y, m, d] = match;
    if (m && (+m < 1 || +m > 12)) return null;
    if (d) {
      const check = new Date(Date.UTC(+y, +m - 1, +d));
      if (check.getUTCFullYear() !== +y || check.getUTCMonth() !== +m - 1 || check.getUTCDate() !== +d) return null;
    }
    return { key: value, frequency: d ? 'daily' : m ? 'monthly' : 'annual' };
  }

  function splitLine(line, delimiter) {
    const result = [];
    let value = '', quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (quoted && line[i + 1] === '"') { value += '"'; i += 1; }
        else quoted = !quoted;
      } else if (ch === delimiter && !quoted) { result.push(value.trim()); value = ''; }
      else value += ch;
    }
    result.push(value.trim());
    return result;
  }

  function numeric(raw) {
    const text = String(raw ?? '').trim().replace(/[$,%\s]/g, '').replace(/,/g, '');
    if (!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
    const n = Number(text);
    return Number.isFinite(n) ? n : null;
  }

  function parseTable(text, kind) {
    const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) return { rows: [], errors: { blank: 0, invalid: 0, duplicates: [], input: 0 }, frequencies: [] };
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const matrix = lines.map(line => splitLine(line, delimiter));
    const header = matrix[0].map(cell => cell.trim().toLowerCase());
    const dateIdx = header.findIndex(cell => /^(date|period|month|quarter|year|event date)$/.test(cell));
    const valueIdx = kind === 'series' ? header.findIndex(cell => /^(value|metric|amount|index|observation|return)$/.test(cell)) : -1;
    const labelIdx = kind === 'events' ? header.findIndex(cell => /^(event|label|name|catalyst)$/.test(cell)) : -1;
    const hasHeader = dateIdx >= 0 || valueIdx >= 0 || labelIdx >= 0;
    const data = matrix.slice(hasHeader ? 1 : 0);
    const dateColumn = hasHeader && dateIdx >= 0 ? dateIdx : 0;
    const valueColumn = hasHeader && valueIdx >= 0 ? valueIdx : 1;
    const counts = { blank: 0, invalid: 0, duplicates: [], input: data.length };
    const frequencies = new Set();
    const rows = [];
    for (const cells of data) {
      const period = parsePeriod(cells[dateColumn]);
      if (!period) { counts.invalid += 1; continue; }
      frequencies.add(period.frequency);
      if (kind === 'series') {
        const value = numeric(cells[valueColumn]);
        if (value === null) { counts.blank += 1; continue; }
        rows.push({ period: period.key, value });
      } else {
        const label = (labelIdx >= 0 ? cells[labelIdx] : cells[1]) || period.key;
        rows.push({ period: period.key, label });
      }
    }
    const countsByPeriod = new Map();
    rows.forEach(row => countsByPeriod.set(row.period, (countsByPeriod.get(row.period) || 0) + 1));
    counts.duplicates = [...countsByPeriod].filter(([, n]) => n > 1).map(([period, count]) => ({ period, count }));
    const duplicatePeriods = new Set(counts.duplicates.map(item => item.period));
    return {
      rows: rows.filter(row => !duplicatePeriods.has(row.period)).sort((a, b) => a.period.localeCompare(b.period)),
      errors: counts,
      frequencies: [...frequencies]
    };
  }

  function mean(values) { return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null; }
  function median(values) {
    if (!values.length) return null;
    const ordered = [...values].sort((a, b) => a - b), mid = Math.floor(ordered.length / 2);
    return ordered.length % 2 ? ordered[mid] : (ordered[mid - 1] + ordered[mid]) / 2;
  }

  function periodOrdinal(period, frequency) {
    const parsed = parsePeriod(period);
    if (!parsed || parsed.frequency !== frequency) return null;
    if (frequency === 'annual') return Number(period);
    if (frequency === 'monthly') return Number(period.slice(0, 4)) * 12 + Number(period.slice(5, 7)) - 1;
    return null;
  }

  function periodFromOrdinal(value, frequency) {
    if (frequency === 'annual') return String(value).padStart(4, '0');
    const year = Math.floor(value / 12), month = value % 12 + 1;
    return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}`;
  }

  function expandRegularPeriods(rows, frequency) {
    if (!['annual', 'monthly'].includes(frequency) || rows.length < 2) return rows;
    const values = new Map(rows.map(row => [row.period, row.value]));
    const first = periodOrdinal(rows[0].period, frequency), last = periodOrdinal(rows[rows.length - 1].period, frequency);
    if (first == null || last == null) return rows;
    const expanded = [];
    for (let n = first; n <= last; n += 1) {
      const period = periodFromOrdinal(n, frequency);
      expanded.push({ period, value: values.has(period) ? values.get(period) : null });
    }
    return expanded;
  }

  function analyze(seriesParsed, eventsParsed, options = {}) {
    const before = Math.max(1, Math.min(24, Number(options.before) || 3));
    const after = Math.max(1, Math.min(24, Number(options.after) || 3));
    const minimumCoverage = Math.max(0.5, Math.min(1, Number(options.coverage) || 1));
    const baselineMode = options.baseline === 'last' ? 'last' : 'mean';
    const minEvents = Math.max(2, Math.min(20, Number(options.minEvents) || 3));
    const frequency = seriesParsed.frequencies.length === 1 ? seriesParsed.frequencies[0] : '';
    const series = expandRegularPeriods(seriesParsed.rows, frequency);
    const indexByPeriod = new Map(series.map((row, index) => [row.period, index]));
    const frequencyMismatch = seriesParsed.frequencies.length !== 1 || eventsParsed.frequencies.length !== 1 || seriesParsed.frequencies[0] !== eventsParsed.frequencies[0];
    const candidates = eventsParsed.rows.map(event => {
      const index = indexByPeriod.get(event.period);
      if (index === undefined) return { ...event, included: false, reason: 'No signal observation in the event period' };
      const baseIndexes = Array.from({ length: before }, (_, i) => index - before + i);
      const postIndexes = Array.from({ length: after }, (_, i) => index + i);
      const inRange = [...baseIndexes, ...postIndexes].filter(i => i >= 0 && i < series.length);
      if (inRange.length !== before + after) return { ...event, included: false, reason: 'Series does not cover the full requested window', index, window: [index - before, index + after - 1] };
      const baselineValues = baseIndexes.map(i => series[i]?.value).filter(Number.isFinite);
      const postValues = postIndexes.map(i => series[i]?.value).filter(Number.isFinite);
      if (baselineValues.length < Math.ceil(before * minimumCoverage) || postValues.length < Math.ceil(after * minimumCoverage)) {
        return { ...event, included: false, reason: 'Missing observations exceed the coverage setting', index, window: [index - before, index + after - 1] };
      }
      const base = baselineMode === 'last' ? baselineValues[baselineValues.length - 1] : mean(baselineValues);
      const post = mean(postValues);
      if (base === 0 && baselineMode === 'last') return { ...event, included: false, reason: 'Last pre-event baseline is zero', index, window: [index - before, index + after - 1] };
      const change = post - base;
      return {
        ...event, included: true, index, window: [index - before, index + after - 1],
        baseline: base, postMean: post, absoluteChange: change,
        percentChange: base === 0 ? null : change / base * 100,
        baselineN: baselineValues.length, postN: postValues.length
      };
    });

    let accepted = candidates.filter(event => event.included);
    const overlapExcluded = [];
    if (options.excludeOverlaps !== false) {
      const kept = [];
      for (const event of accepted) {
        if (kept.some(prior => event.window[0] <= prior.window[1] && event.window[1] >= prior.window[0])) {
          overlapExcluded.push({ ...event, included: false, reason: 'Overlaps another included event window' });
        } else kept.push(event);
      }
      accepted = kept;
    }
    const excludedIds = new Set(overlapExcluded.map(event => `${event.period}\u0000${event.label}`));
    const rows = candidates.map(event => excludedIds.has(`${event.period}\u0000${event.label}`) ? overlapExcluded.find(item => item.period === event.period && item.label === event.label) : event);
    const changes = accepted.map(event => event.absoluteChange);
    const pctChanges = accepted.map(event => event.percentChange).filter(Number.isFinite);
    return {
      rows, included: accepted, before, after, minimumCoverage, baselineMode,
      summary: { n: accepted.length, meanChange: mean(changes), medianChange: median(changes), meanPercentChange: mean(pctChanges), positiveShare: changes.length ? changes.filter(value => value > 0).length / changes.length * 100 : null },
      warnings: [
        ...(frequencyMismatch ? ['Signal and event periods must use the same single frequency. Confirm that event dates align to the intended period.'] : []),
        ...(accepted.length < minEvents ? [`Only ${accepted.length} independent event${accepted.length === 1 ? '' : 's'} qualify. At least ${minEvents} are required before the aggregate is shown as more than exploratory.`] : []),
        ...(seriesParsed.errors.duplicates.length || eventsParsed.errors.duplicates.length ? ['Duplicate periods were excluded because their correct value or event identity is ambiguous.'] : []),
      ],
      aggregateUsable: accepted.length >= minEvents && !frequencyMismatch,
      minEvents
    };
  }

  function esc(value) { return String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]); }
  function fmt(value, digits = 2) { return Number.isFinite(value) ? value.toFixed(digits) : 'Not calculable'; }

  function render() {
    return `<section class="ses-page"><header class="ses-head"><p class="ses-kicker">Research tools</p><h1>Signal event studies</h1><p>Measure how an operating signal moves around dated events. Paste period/value rows and event dates. Your inputs stay in this browser and are not saved.</p></header>
      <div class="ses-controls"><label>Signal name<input data-ses="signalName" value="Operating metric"></label><label>Unit<input data-ses="unit" placeholder="For example: MW, units, visits, %"></label>
      <label>Periods before event <input data-ses="before" type="number" min="1" max="24" value="3"></label><label>Periods after event, including event period <input data-ses="after" type="number" min="1" max="24" value="3"></label>
      <label>Baseline<select data-ses="baseline"><option value="mean">Mean of pre-event window</option><option value="last">Last pre-event observation</option></select></label><label>Minimum window coverage<select data-ses="coverage"><option value="1">100%</option><option value="0.75">75%</option><option value="0.5">50%</option></select></label>
      <label>Minimum independent events<select data-ses="minEvents"><option>2</option><option selected>3</option><option>5</option><option>8</option></select></label><label class="ses-check"><input type="checkbox" data-ses="excludeOverlaps" checked> Exclude overlapping event windows</label></div>
      <div class="ses-inputs"><label>Signal series, one period and value per row<textarea data-ses="series" spellcheck="false" placeholder="period,value\n2025-01,100\n2025-02,103\n2025-03,101"></textarea></label><label>Events, one period and event name per row<textarea data-ses="events" spellcheck="false" placeholder="date,event\n2025-03,Capacity opened\n2025-08,Price increase"></textarea></label></div>
      <div class="ses-actions"><button type="button" class="ses-run" data-ses="run">Run event study</button><span>Use YYYY, YYYY-MM, or YYYY-MM-DD. Event periods must exactly match a signal period.</span></div><div data-ses="result" aria-live="polite"></div>
      <aside class="ses-caveat"><strong>Interpretation limits.</strong> This is a descriptive event-window comparison. It does not establish causation or stock-price alpha. Event selection, overlapping catalysts, seasonality, revisions, survivorship, and unrelated operating changes can drive the result. Use adjusted definitions and a control series where possible. For market returns, paste a dated return series and identify whether values are decimal or percent.</aside>
      <style>.ses-page{max-width:1080px;margin:auto;color:#172943}.ses-head{padding:8px 0 18px;border-bottom:1px solid #dbe3ef}.ses-head h1{font-size:30px;letter-spacing:-.7px;margin:5px 0}.ses-head p:last-child{margin:5px 0;color:#607089;line-height:1.5}.ses-kicker{margin:0;color:#315da8;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700}.ses-controls{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:16px 0}.ses-controls label,.ses-inputs label{display:grid;gap:5px;color:#4a5c75;font-size:11px;font-weight:650}.ses-controls input,.ses-controls select,.ses-inputs textarea{box-sizing:border-box;width:100%;padding:9px;border:1px solid #cbd6e5;border-radius:7px;background:#fff;color:#172943;font:inherit}.ses-check{display:flex!important;align-items:center}.ses-check input{width:auto}.ses-inputs{display:grid;grid-template-columns:1fr 1fr;gap:12px}.ses-inputs textarea{height:190px;resize:vertical;font:12px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}.ses-actions{display:flex;align-items:center;gap:12px;margin:12px 0 17px;flex-wrap:wrap}.ses-actions span,.ses-small{font-size:11px;color:#66758b}.ses-run{border:0;border-radius:7px;background:#2458c5;color:#fff;padding:10px 15px;font-weight:700;cursor:pointer}.ses-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:14px 0}.ses-stat{border:1px solid #dce4ee;border-radius:8px;padding:11px;background:#f7f9fc}.ses-stat small,.ses-stat strong{display:block}.ses-stat small{color:#61728a;font-size:10px}.ses-stat strong{font-size:17px;margin-top:4px}.ses-table-wrap{overflow:auto;margin:8px 0 16px}.ses-table{border-collapse:collapse;width:100%;font-size:11px}.ses-table th,.ses-table td{text-align:left;padding:7px 9px;border-bottom:1px solid #e5eaf1;white-space:nowrap}.ses-table th{font-size:10px;color:#65748a;text-transform:uppercase}.ses-warn{padding:10px 12px;border-left:3px solid #c28a22;background:#fff8e9;color:#72561c;font-size:11px;line-height:1.5;margin:8px 0}.ses-caveat{margin-top:17px;padding:11px 13px;background:#f4f7fb;border:1px solid #dce4ee;border-radius:8px;color:#53647d;font-size:11px;line-height:1.55}@media(max-width:700px){.ses-controls{grid-template-columns:1fr 1fr}.ses-inputs{grid-template-columns:1fr}.ses-summary{grid-template-columns:1fr 1fr}.ses-head h1{font-size:25px}}@media(max-width:420px){.ses-controls{grid-template-columns:1fr}}</style></section>`;
  }

  function attach(container) {
    const get = key => container.querySelector(`[data-ses="${key}"]`);
    get('run')?.addEventListener('click', () => {
      const series = parseTable(get('series').value, 'series');
      const events = parseTable(get('events').value, 'events');
      const result = analyze(series, events, { before: get('before').value, after: get('after').value, baseline: get('baseline').value, coverage: get('coverage').value, minEvents: get('minEvents').value, excludeOverlaps: get('excludeOverlaps').checked });
      const unit = get('unit').value.trim();
      const unitSuffix = unit ? ` ${esc(unit)}` : '';
      const diagnostics = `<p class="ses-small">Signal rows: ${series.rows.length}; blank or nonnumeric values: ${series.errors.blank}; invalid periods: ${series.errors.invalid}. Event rows: ${events.rows.length}; invalid periods: ${events.errors.invalid}; duplicate periods excluded: ${events.errors.duplicates.length}.</p>`;
      const warnings = result.warnings.map(message => `<div class="ses-warn">${esc(message)}</div>`).join('');
      const s = result.summary;
      const summary = `<div class="ses-summary"><div class="ses-stat"><small>Independent events included</small><strong>${s.n}</strong></div><div class="ses-stat"><small>Mean change in ${esc(get('signalName').value || 'signal')}</small><strong>${fmt(s.meanChange)}${unitSuffix}</strong></div><div class="ses-stat"><small>Median event change</small><strong>${fmt(s.medianChange)}${unitSuffix}</strong></div><div class="ses-stat"><small>Events with positive change</small><strong>${fmt(s.positiveShare, 0)}${s.positiveShare == null ? '' : '%'}</strong></div></div>`;
      const aggregate = result.aggregateUsable ? summary : `<p class="ses-small">Aggregate summary is withheld because the sample or period alignment fails the selected safeguards.</p>`;
      const rows = result.rows.map(row => `<tr><td>${esc(row.period)}</td><td>${esc(row.label)}</td><td>${row.included ? 'Included' : 'Excluded'}</td><td>${fmt(row.baseline)}${row.included ? unitSuffix : ''}</td><td>${fmt(row.postMean)}${row.included ? unitSuffix : ''}</td><td>${fmt(row.absoluteChange)}${row.included ? unitSuffix : ''}</td><td>${fmt(row.percentChange)}${row.percentChange == null ? '' : '%'}</td><td>${esc(row.reason || `${row.baselineN} baseline and ${row.postN} post observations`)}</td></tr>`).join('');
      get('result').innerHTML = `${diagnostics}${warnings}${aggregate}<div class="ses-table-wrap"><table class="ses-table"><thead><tr><th>Event period</th><th>Event</th><th>Status</th><th>Baseline</th><th>Post mean</th><th>Change</th><th>Change %</th><th>Coverage</th></tr></thead><tbody>${rows || '<tr><td colspan="8">No valid events found. Check the pasted data and date formats.</td></tr>'}</tbody></table></div><p class="ses-small">Baseline: ${result.baselineMode === 'mean' ? `${result.before} periods before each event` : 'last pre-event observation'}. Post window: event period plus ${Math.max(0, result.after - 1)} following periods. Changes compare window means. Change percent divides the difference by the absolute baseline. This is not a causal estimate.</p>`;
    });
  }

  const api = { title: 'Signal event studies', render, attach };
  root.FieldSignalsModules = root.FieldSignalsModules || {};
  root.FieldSignalsModules.eventStudy = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = { parsePeriod, parseTable, analyze, mean, median };
})(typeof window !== 'undefined' ? window : globalThis);
