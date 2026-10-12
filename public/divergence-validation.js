(function (root) {
  'use strict';

  const PERIOD = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/;

  function periodKey(value) {
    const raw = String(value ?? '').trim();
    const match = raw.match(PERIOD);
    if (!match) return '';
    const [, year, month, day] = match;
    if (month && (+month < 1 || +month > 12)) return '';
    if (day) {
      const date = new Date(Date.UTC(+year, +month - 1, +day));
      if (date.getUTCFullYear() !== +year || date.getUTCMonth() !== +month - 1 || date.getUTCDate() !== +day) return '';
    }
    return raw;
  }

  function splitLine(line, delimiter) {
    const cells = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i += 1) {
      const char = line[i];
      if (char === '"') {
        if (quoted && line[i + 1] === '"') { cell += '"'; i += 1; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        cells.push(cell.trim()); cell = '';
      } else cell += char;
    }
    cells.push(cell.trim());
    return cells;
  }

  function numeric(value) {
    const text = String(value ?? '').trim().replace(/[$,%\s]/g, '').replace(/,/g, '');
    if (!text || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) return null;
    const number = Number(text);
    return Number.isFinite(number) ? number : null;
  }

  function parseSeries(text) {
    const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
    if (!lines.length) return { rows: [], inputRows: 0, missingDates: 0, missingValues: 0, invalidDates: 0, duplicates: [], excludedDuplicates: 0, periodFrequencies: [] };
    const delimiter = lines[0].includes('\t') ? '\t' : ',';
    const matrix = lines.map(line => splitLine(line, delimiter));
    const first = matrix[0].map(value => value.toLowerCase());
    const dateColumn = first.findIndex(value => /^(date|period|month|quarter|year)$/.test(value));
    const valueColumn = first.findIndex(value => /^(value|metric|amount|index|observation)$/.test(value));
    const hasHeader = dateColumn >= 0 || valueColumn >= 0;
    const dateIndex = hasHeader && dateColumn >= 0 ? dateColumn : 0;
    const valueIndex = hasHeader && valueColumn >= 0 ? valueColumn : (dateIndex === 0 ? 1 : 0);
    const data = matrix.slice(hasHeader ? 1 : 0);
    const counts = { inputRows: data.length, missingDates: 0, missingValues: 0, invalidDates: 0 };
    const occurrences = new Map();
    const candidates = [];
    const periodFrequencies = new Set();
    for (const cells of data) {
      const rawDate = cells[dateIndex] ?? '';
      const rawValue = cells[valueIndex] ?? '';
      if (!rawDate.trim()) { counts.missingDates += 1; continue; }
      const period = periodKey(rawDate);
      if (!period) { counts.invalidDates += 1; continue; }
      periodFrequencies.add(period.length === 4 ? 'annual' : period.length === 7 ? 'monthly' : 'daily');
      if (!String(rawValue).trim()) { counts.missingValues += 1; continue; }
      const value = numeric(rawValue);
      if (value === null) { counts.missingValues += 1; continue; }
      occurrences.set(period, (occurrences.get(period) || 0) + 1);
      candidates.push({ period, value });
    }
    const duplicates = [...occurrences].filter(([, count]) => count > 1).map(([period, count]) => ({ period, count }));
    const duplicateSet = new Set(duplicates.map(item => item.period));
    const rows = candidates.filter(row => !duplicateSet.has(row.period)).sort((a, b) => a.period.localeCompare(b.period));
    return { rows, ...counts, duplicates, excludedDuplicates: candidates.length - rows.length, periodFrequencies: [...periodFrequencies] };
  }

  function pearson(pairs) {
    if (pairs.length < 2) return null;
    const meanA = pairs.reduce((sum, pair) => sum + pair[0], 0) / pairs.length;
    const meanB = pairs.reduce((sum, pair) => sum + pair[1], 0) / pairs.length;
    let covariance = 0, varianceA = 0, varianceB = 0;
    for (const [a, b] of pairs) {
      const da = a - meanA, db = b - meanB;
      covariance += da * db; varianceA += da * da; varianceB += db * db;
    }
    if (!varianceA || !varianceB) return null;
    return covariance / Math.sqrt(varianceA * varianceB);
  }

  function compareSeries(leftParsed, rightParsed, maxLag = 3) {
    const left = new Map(leftParsed.rows.map(row => [row.period, row.value]));
    const right = new Map(rightParsed.rows.map(row => [row.period, row.value]));
    const periods = [...new Set([...left.keys(), ...right.keys()])].sort();
    const aligned = periods.filter(period => left.has(period) && right.has(period)).map(period => ({ period, a: left.get(period), b: right.get(period) }));
    const pairs = aligned.map(row => [row.a, row.b]);
    const changes = [];
    for (let index = 1; index < aligned.length; index += 1) {
      const prev = aligned[index - 1], curr = aligned[index];
      if (prev.a === 0 || prev.b === 0) continue;
      changes.push({ period: curr.period, a: (curr.a / prev.a - 1) * 100, b: (curr.b / prev.b - 1) * 100 });
    }
    const growthPairs = changes.map(row => [row.a, row.b]);
    const divergence = changes.map(row => ({ ...row, spread: row.a - row.b })).sort((a, b) => Math.abs(b.spread) - Math.abs(a.spread));
    const lags = [];
    for (let lag = -maxLag; lag <= maxLag; lag += 1) {
      const lagPairs = [];
      for (let index = 0; index < periods.length; index += 1) {
        const otherIndex = index + lag;
        if (otherIndex < 0 || otherIndex >= periods.length) continue;
        const a = left.get(periods[index]), b = right.get(periods[otherIndex]);
        if (a !== undefined && b !== undefined) lagPairs.push([a, b]);
      }
      lags.push({ lag, n: lagPairs.length, correlation: pearson(lagPairs) });
    }
    return {
      periods, aligned, alignedCount: aligned.length,
      missingA: periods.filter(period => !left.has(period)),
      missingB: periods.filter(period => !right.has(period)),
      levelCorrelation: pearson(pairs),
      growthCorrelation: pearson(growthPairs),
      changes, largestGrowthSpreads: divergence.slice(0, 5),
      lagCorrelations: lags
    };
  }

  function fmt(value) {
    return value == null ? 'Not calculable' : value.toFixed(2);
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function renderTable(compare, nameA, nameB) {
    if (!compare.aligned.length) return '<p class="dv-muted">No exactly aligned periods. Check the pasted dates and frequency.</p>';
    const rows = compare.aligned.map(row => `<tr><td>${esc(row.period)}</td><td>${row.a}</td><td>${row.b}</td></tr>`).join('');
    const spreadRows = compare.largestGrowthSpreads.map(row => `<tr><td>${esc(row.period)}</td><td>${fmt(row.a)}%</td><td>${fmt(row.b)}%</td><td>${row.spread > 0 ? '+' : ''}${fmt(row.spread)} pp</td></tr>`).join('');
    return `<div class="dv-table-wrap"><table class="dv-table"><thead><tr><th>Aligned period</th><th>${esc(nameA)}</th><th>${esc(nameB)}</th></tr></thead><tbody>${rows}</tbody></table></div><h3>Largest growth-rate gaps</h3><p class="dv-muted">Period-over-period percentage change, only between adjacent aligned rows. Spread is A minus B in percentage points. This is descriptive, not causal.</p><div class="dv-table-wrap"><table class="dv-table"><thead><tr><th>Period</th><th>${esc(nameA)} growth</th><th>${esc(nameB)} growth</th><th>Gap</th></tr></thead><tbody>${spreadRows || '<tr><td colspan="4">Not enough nonzero adjacent values.</td></tr>'}</tbody></table></div>`;
  }

  const moduleApi = {
    title: 'Peer divergence and validation',
    render() {
      return `<section class="dv-page"><header class="dv-heading"><div><p class="dv-eyebrow">Research checks</p><h1>Peer divergence and validation</h1><p>Paste two dated series to compare their overlap, missing periods, growth gaps, and shifted correlations. The module runs locally in this browser.</p></div></header>
      <div class="dv-grid"><label class="dv-field">Series A name<input data-dv="nameA" value="Series A"></label><label class="dv-field">Series B name<input data-dv="nameB" value="Series B"></label>
      <label class="dv-field">Series A, one period and value per row<textarea data-dv="seriesA" spellcheck="false" placeholder="period,value\n2026-01,100\n2026-02,104"></textarea></label><label class="dv-field">Series B, same frequency<textarea data-dv="seriesB" spellcheck="false" placeholder="period,value\n2026-01,98\n2026-02,101"></textarea></label></div>
      <div class="dv-actions"><button type="button" class="btn primary" data-dv="run">Compare series</button><label>Maximum shift in periods <select data-dv="maxLag"><option>1</option><option selected>3</option><option>6</option></select></label><span class="dv-muted">Accepted periods: YYYY, YYYY-MM, YYYY-MM-DD</span></div>
      <div data-dv="result" aria-live="polite"></div><aside class="dv-caveat"><strong>Read this carefully.</strong> Correlation and lead-lag patterns are unstable in small samples, can reflect seasonality or common shocks, and do not establish that one metric causes or predicts another. Test different windows, revisions, definitions, market coverage, and plausible lags. A selected highest correlation is especially prone to false alarms.</aside>
      <style>.dv-page{max-width:1100px;margin:auto}.dv-heading{padding:8px 0 20px;border-bottom:1px solid #dce3ed}.dv-heading h1{font-size:30px;letter-spacing:-.8px;margin:5px 0}.dv-heading p:last-child{color:#66758b;margin:5px 0}.dv-eyebrow{color:#315da8;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:0}.dv-grid{display:grid;grid-template-columns:1fr 1fr;gap:13px;margin:18px 0}.dv-field{display:grid;gap:5px;font-size:12px;font-weight:650;color:#4b5b73}.dv-field input,.dv-field textarea,.dv-actions select{width:100%;border:1px solid #ccd6e4;border-radius:6px;padding:9px;background:#fff;font:12px/1.45 inherit}.dv-field textarea{height:160px;resize:vertical;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}.dv-actions{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin:10px 0 16px}.dv-actions label{display:flex;gap:7px;align-items:center;font-size:11px}.dv-actions select{width:auto}.dv-muted{font-size:11px;color:#6a788d}.dv-results{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:12px 0}.dv-stat{border:1px solid #dce3ed;background:#f7f9fc;border-radius:7px;padding:11px}.dv-stat small,.dv-stat strong{display:block}.dv-stat small{font-size:10px;color:#66758b}.dv-stat strong{font-size:17px;margin-top:3px}.dv-table-wrap{overflow:auto;margin:8px 0 16px}.dv-table{border-collapse:collapse;width:100%;font-size:11px}.dv-table th,.dv-table td{padding:7px 9px;border-bottom:1px solid #e7ebf1;text-align:left;white-space:nowrap}.dv-table th{color:#65738a;font-size:10px;text-transform:uppercase}.dv-caveat{border-left:3px solid #c28a22;background:#fff8e9;padding:11px 13px;margin-top:18px;font-size:11px;color:#72561c}.dv-validation{padding:12px;border:1px solid #dce3ed;border-radius:7px;margin:12px 0}.dv-validation ul{padding-left:19px;font-size:11px;color:#53627a}.dv-validation h2{font-size:15px}.dv-positive{color:#237455}.dv-warning{color:#96650e}@media(max-width:650px){.dv-grid{grid-template-columns:1fr}.dv-results{grid-template-columns:1fr 1fr}.dv-heading h1{font-size:25px}}</style></section>`;
    },
    attach(container) {
      const get = key => container.querySelector(`[data-dv="${key}"]`);
      const run = () => {
        const parsedA = parseSeries(get('seriesA').value);
        const parsedB = parseSeries(get('seriesB').value);
        const comparison = compareSeries(parsedA, parsedB, Number(get('maxLag').value));
        const nameA = get('nameA').value.trim() || 'Series A';
        const nameB = get('nameB').value.trim() || 'Series B';
        const quality = (label, parsed) => `<div><strong>${esc(label)}</strong>: ${parsed.rows.length} usable rows; ${parsed.missingValues} blank or nonnumeric values; ${parsed.invalidDates} invalid periods; ${parsed.excludedDuplicates} rows excluded for duplicate periods.</div>`;
        const warnings = [];
        if (comparison.alignedCount < 8) warnings.push(`Only ${comparison.alignedCount} aligned observations. Treat correlations and selected lags as exploratory.`);
        if (parsedA.duplicates.length || parsedB.duplicates.length) warnings.push('Duplicate periods were excluded in full. Resolve them from the source before drawing conclusions.');
        if (parsedA.missingValues || parsedB.missingValues || comparison.missingA.length || comparison.missingB.length) warnings.push('Missing or unaligned observations can change the sample and the apparent relationship.');
        if (parsedA.periodFrequencies.length > 1 || parsedB.periodFrequencies.length > 1 || parsedA.periodFrequencies.join() !== parsedB.periodFrequencies.join()) warnings.push('The two inputs use different or mixed period frequencies. Check that exact-date alignment and lag steps have the intended meaning.');
        const bestLag = comparison.lagCorrelations.filter(item => item.correlation !== null).sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation))[0];
        get('result').innerHTML = `<div class="dv-validation"><h2>Input checks</h2><div class="dv-muted">${quality(nameA, parsedA)}${quality(nameB, parsedB)}</div><ul>${warnings.length ? warnings.map(item => `<li class="dv-warning">${esc(item)}</li>`).join('') : '<li class="dv-positive">No duplicate periods or missing-value flags found in parsed rows. Coverage and definitions still need manual review.</li>'}</ul>${parsedA.duplicates.length || parsedB.duplicates.length ? `<p class="dv-muted">Duplicate periods: ${esc([...parsedA.duplicates, ...parsedB.duplicates].map(item => `${item.period} (${item.count})`).join(', '))}</p>` : ''}</div>
        <div class="dv-results"><div class="dv-stat"><small>Periods in common</small><strong>${comparison.alignedCount}</strong></div><div class="dv-stat"><small>Level correlation</small><strong>${fmt(comparison.levelCorrelation)}</strong></div><div class="dv-stat"><small>Growth correlation</small><strong>${fmt(comparison.growthCorrelation)}</strong></div><div class="dv-stat"><small>Highest absolute lag correlation</small><strong>${bestLag ? `${fmt(bestLag.correlation)} at ${bestLag.lag > 0 ? '+' : ''}${bestLag.lag}` : 'Not calculable'}</strong></div></div>
        <p class="dv-muted">Lag convention: at shift k, Series A at period t is compared with Series B at the kth period after t. Positive shifts compare A earlier with later B. The highest observed lag is selected from several tests and is not evidence of predictive power. Correlations use exact period ordering, not elapsed calendar time.</p><h3>Lag scan</h3><div class="dv-table-wrap"><table class="dv-table"><thead><tr><th>Shift in periods</th><th>Paired rows</th><th>Correlation</th></tr></thead><tbody>${comparison.lagCorrelations.map(item => `<tr><td>${item.lag > 0 ? '+' : ''}${item.lag}</td><td>${item.n}</td><td>${fmt(item.correlation)}</td></tr>`).join('')}</tbody></table></div>${renderTable(comparison, nameA, nameB)}`;
      };
      get('run').addEventListener('click', run);
    }
  };

  root.FieldSignalsModules = root.FieldSignalsModules || {};
  root.FieldSignalsModules.divergence = moduleApi;
  if (typeof module !== 'undefined' && module.exports) module.exports = { periodKey, parseSeries, pearson, compareSeries };
})(typeof window !== 'undefined' ? window : globalThis);
