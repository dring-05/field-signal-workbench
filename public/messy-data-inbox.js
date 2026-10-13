(function (root) {
  'use strict';

  const STORAGE_KEY = 'field-signals-messy-data-inbox-v1';
  const ROLES = [
    ['date', 'Observation date'], ['entity', 'Company or entity'], ['value', 'Value'],
    ['metric', 'Metric'], ['unit', 'Unit'], ['geography', 'Geography']
  ];

  function parseDelimited(text, delimiter) {
    const input = String(text || '').replace(/^\uFEFF/, '');
    const sep = delimiter || guessDelimiter(input);
    const rows = [];
    let row = [], cell = '', quoted = false;
    for (let i = 0; i < input.length; i += 1) {
      const ch = input[i];
      if (quoted) {
        if (ch === '"' && input[i + 1] === '"') { cell += '"'; i += 1; }
        else if (ch === '"') quoted = false;
        else cell += ch;
      } else if (ch === '"' && cell === '') quoted = true;
      else if (ch === sep) { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && input[i + 1] === '\n') i += 1;
        row.push(cell); rows.push(row); row = []; cell = '';
      } else cell += ch;
    }
    if (cell !== '' || row.length || (input && !/[\r\n]$/.test(input))) {
      row.push(cell); rows.push(row);
    }
    while (rows.length && rows[rows.length - 1].every(value => value === '')) rows.pop();
    const headerWidth = rows.find(row => row.some(value => String(value).trim() !== ''))?.length || 0;
    return {delimiter: sep, rows, unclosedQuote: quoted, raggedRows: rows.filter(row => row.some(value => String(value).trim() !== '') && row.length !== headerWidth).length};
  }

  function guessDelimiter(text) {
    const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim()).slice(0, 8);
    const choices = [',', '\t', ';'];
    const count = (line, sep) => {
      let quoted = false, total = 0;
      for (let i = 0; i < line.length; i += 1) {
        if (line[i] === '"' && line[i + 1] === '"' && quoted) i += 1;
        else if (line[i] === '"') quoted = !quoted;
        else if (line[i] === sep && !quoted) total += 1;
      }
      return total;
    };
    return choices.map(sep => ({sep, score: lines.reduce((sum, line) => sum + count(line, sep), 0)}))
      .sort((a, b) => b.score - a.score)[0].sep;
  }

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
  }

  function getStorage() {
    try { return root.localStorage; } catch { return null; }
  }

  function readStore(storage = getStorage()) {
    try {
      const value = JSON.parse(storage.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  function writeStore(batches, storage = getStorage()) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(batches)); return true; }
    catch { return false; }
  }

  function id() {
    return root.crypto && typeof root.crypto.randomUUID === 'function'
      ? root.crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  function makeBatch(preview, headerIndex, mapping, metadata, fileName, createdAt = new Date().toISOString()) {
    const headers = (preview.rows[headerIndex] || []).slice();
    const records = preview.rows.slice(headerIndex + 1)
      .filter(row => row.some(value => String(value).trim() !== ''))
      .map(cells => ({rawCells:cells.slice(), cells:cells.slice()}));
    return {
      id:id(), createdAt, sourceName:metadata.sourceName || fileName || '', fileName:fileName || '',
      sourceUrl:metadata.sourceUrl || '', observationDate:metadata.observationDate || '',
      metricUnit:metadata.metricUnit || '', coverage:metadata.coverage || '', delimiter:preview.delimiter,
      headerIndex, headers, rawRows:preview.rows.map(row => row.slice()), mapping,
      parseWarnings:{unclosedQuote:!!preview.unclosedQuote, raggedRows:Number(preview.raggedRows) || 0},
      records, audit:[]
    };
  }

  function applyCorrection(batch, row, column, after, at = new Date().toISOString()) {
    const record = batch && batch.records && batch.records[row];
    if (!record || !Number.isInteger(column) || column < 0 || column >= record.cells.length) return false;
    const before = String(record.cells[column] ?? '');
    const replacement = String(after ?? '');
    if (before === replacement) return false;
    record.cells[column] = replacement;
    batch.audit.push({at, row, column, columnName:batch.headers[column] || `Column ${column + 1}`, before, after:replacement});
    return true;
  }

  function csvOptionList(headers, selected) {
    return `<option value="">Not mapped</option>${headers.map((header, index) => `<option value="${index}" ${String(selected) === String(index) ? 'selected' : ''}>${esc(header || `Column ${index + 1}`)}</option>`).join('')}`;
  }

  function render(rootEl) {
    const batches = readStore();
    return `<section class="card card-pad section messy-inbox" aria-labelledby="messy-inbox-title">
      <div class="card-head"><div><h2 id="messy-inbox-title">Messy data inbox</h2><p class="sub">Stage rough tables here, map fields, and correct cells while keeping the originals.</p></div><span class="tag gray">This browser only</span></div>
      <p class="callout">Nothing is uploaded. Staged batches stay in this browser until you choose Export. Clearing browser data can erase them, so export a backup if you need one.</p>
      <div class="messy-inbox-meta">
        <label>Source or file name<input data-inbox-meta="sourceName" autocomplete="off" placeholder="Source name"></label>
        <label>Source URL<input data-inbox-meta="sourceUrl" type="url" placeholder="https://..."></label>
        <label>Observation date<input data-inbox-meta="observationDate" type="date"></label>
        <label>Metric or unit<input data-inbox-meta="metricUnit" placeholder="Revenue, MW, hourly wage"></label>
        <label>Coverage or geography<input data-inbox-meta="coverage" placeholder="Issuer, region, or sample scope"></label>
      </div>
      <label class="messy-inbox-paste-label" for="messy-inbox-paste">Paste CSV or tab-separated rows</label>
      <textarea id="messy-inbox-paste" data-inbox-text rows="7" spellcheck="false" placeholder="Paste rows here, including any title or note rows above the table"></textarea>
      <div class="messy-inbox-actions"><label class="button secondary" for="messy-inbox-file">Choose a CSV or TSV file</label><input data-inbox-file id="messy-inbox-file" type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values"><label>Separator<select data-inbox-delimiter><option value="auto">Detect</option><option value=",">Comma</option><option value="&#9;">Tab</option><option value=";">Semicolon</option></select></label><button type="button" data-inbox-preview>Preview rows</button><span data-inbox-status role="status" aria-live="polite"></span></div>
      <div data-inbox-preview-box></div>
      <h3>Saved batches <span class="tag">${batches.length}</span></h3>
      <div data-inbox-batches>${renderBatches(batches)}</div>
    </section>`;
  }

  function renderPreview(preview) {
    if (!preview || !preview.rows.length) return '';
    const maxHeader = Math.min(preview.rows.length - 1, 30);
    const headers = preview.rows[preview.headerIndex] || [];
    const sample = preview.rows.slice(preview.headerIndex + 1, preview.headerIndex + 5);
    return `<div class="messy-inbox-preview"><label>Header row<select data-inbox-header>${Array.from({length: maxHeader + 1}, (_, i) => `<option value="${i}" ${i === preview.headerIndex ? 'selected' : ''}>Row ${i + 1}: ${esc((preview.rows[i] || []).slice(0, 4).join(' · ').slice(0, 90))}</option>`).join('')}</select></label>
      <p>${preview.rows.length} raw rows, ${headers.length} columns. The preview retains title and note rows.${preview.raggedRows ? ` ${preview.raggedRows} rows have a different number of columns.` : ''}${preview.unclosedQuote ? ' The input ends inside a quoted field. Check the source before saving.' : ''}</p>
      <div class="messy-inbox-mapping">${ROLES.map(([key, label]) => `<label>${label}<select data-inbox-map="${key}">${csvOptionList(headers, preview.mapping[key])}</select></label>`).join('')}</div>
      <div class="messy-inbox-table-wrap"><table><thead><tr>${headers.map((h, i) => `<th>${esc(h || `Column ${i + 1}`)}</th>`).join('')}</tr></thead><tbody>${sample.map(row => `<tr>${headers.map((_, i) => `<td>${esc(row[i] || '')}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <button type="button" data-inbox-save>Save raw batch locally</button></div>`;
  }

  function renderBatches(batches) {
    if (!batches.length) return '<p class="sub">No batches staged yet.</p>';
    return batches.map(batch => `<details class="messy-inbox-batch" data-batch="${esc(batch.id)}"><summary>${esc(batch.sourceName || batch.fileName || 'Untitled batch')} <span class="tag">${batch.records.length} rows</span> <small>${esc(batch.observationDate || 'Date not set')} · staged ${esc(batch.createdAt.slice(0, 10))}</small></summary>
      <p>${esc(batch.coverage || 'Coverage not specified')} · ${esc(batch.metricUnit || 'Metric or unit not specified')} · ${safeHttpUrl(batch.sourceUrl) ? `<a href="${esc(safeHttpUrl(batch.sourceUrl))}" target="_blank" rel="noreferrer">${esc(batch.sourceUrl)}</a>` : esc(batch.sourceUrl || 'No source URL')}</p>
      <p>Header row ${batch.headerIndex + 1}. Original source rows and mapped columns are retained with corrections.</p>
      <div class="messy-inbox-table-wrap"><table><thead><tr>${batch.headers.map((h, i) => `<th>${esc(h || `Column ${i + 1}`)}</th>`).join('')}</tr></thead><tbody>${batch.records.slice(0, 100).map((record, rowIndex) => `<tr>${batch.headers.map((header, columnIndex) => `<td><label class="sr-only">Row ${rowIndex + 1}, ${esc(header || `column ${columnIndex + 1}`)}</label><input data-inbox-edit="${rowIndex}" data-inbox-column="${columnIndex}" value="${esc(record.cells[columnIndex] || '')}" aria-label="Row ${rowIndex + 1}, ${esc(header || `column ${columnIndex + 1}`)}"></td>`).join('')}</tr>`).join('')}</tbody></table></div>
      ${batch.records.length > 100 ? `<p>Showing first 100 rows for manual corrections. Export includes all ${batch.records.length} rows.</p>` : ''}
      <button type="button" data-inbox-export="${esc(batch.id)}">Export batch JSON</button>
      <details><summary>Correction history (${batch.audit.length})</summary><ol>${batch.audit.slice(-30).reverse().map(event => `<li>${esc(event.at)} · row ${event.row + 1}, ${esc(event.columnName)}: “${esc(event.before)}” changed to “${esc(event.after)}”</li>`).join('') || '<li>No corrections recorded.</li>'}</ol></details></details>`).join('');
  }

  function attach(container) {
    let preview = null;
    let fileName = '';
    container.innerHTML = render();
    const status = message => { const el = container.querySelector('[data-inbox-status]'); if (el) el.textContent = message; };
    const currentBatches = () => readStore();
    const redrawBatches = () => { const el = container.querySelector('[data-inbox-batches]'); if (el) el.innerHTML = renderBatches(currentBatches()); };
    const currentText = () => container.querySelector('[data-inbox-text]')?.value || '';
    const delimiterChoice = () => container.querySelector('[data-inbox-delimiter]')?.value || 'auto';

    container.addEventListener('change', async event => {
      const target = event.target;
      if (target.matches('[data-inbox-file]')) {
        const file = target.files && target.files[0];
        if (!file) return;
        fileName = file.name;
        const text = await file.text();
        const input = container.querySelector('[data-inbox-text]');
        if (input) input.value = text;
        const name = container.querySelector('[data-inbox-meta="sourceName"]');
        if (name && !name.value) name.value = file.name;
        status(`${file.name} loaded locally. It has not been saved or uploaded.`);
      }
      if (target.matches('[data-inbox-header]') && preview) {
        preview.headerIndex = Number(target.value) || 0;
        preview.mapping = inferMappings(preview.rows[preview.headerIndex] || []);
        container.querySelector('[data-inbox-preview-box]').innerHTML = renderPreview(preview);
      }
      if (target.matches('[data-inbox-map]') && preview) preview.mapping[target.dataset.inboxMap] = target.value === '' ? '' : Number(target.value);
      if (target.matches('[data-inbox-edit]')) correctCell(target);
    });

    container.addEventListener('click', event => {
      const target = event.target.closest('button');
      if (!target) return;
      if (target.matches('[data-inbox-preview]')) {
        const text = currentText();
        const choice = delimiterChoice();
        const delimiter = choice === 'auto' ? undefined : choice;
        const parsed = parseDelimited(text, delimiter);
        if (!parsed.rows.length) { status('Paste or choose a delimited file first.'); return; }
        preview = {rows: parsed.rows, delimiter: parsed.delimiter, unclosedQuote: parsed.unclosedQuote, raggedRows:parsed.raggedRows, headerIndex: 0, mapping: inferMappings(parsed.rows[0])};
        container.querySelector('[data-inbox-preview-box]').innerHTML = renderPreview(preview);
        status(`Preview ready. Separator: ${parsed.delimiter === '\t' ? 'tab' : parsed.delimiter}. Nothing has been saved yet.`);
      } else if (target.matches('[data-inbox-save]')) saveBatch();
      else if (target.matches('[data-inbox-export]')) exportBatch(target.dataset.inboxExport);
    });

    function saveBatch() {
      if (!preview) return;
      const headerIndex = Number(container.querySelector('[data-inbox-header]')?.value || preview.headerIndex);
      const metadata = Object.fromEntries([...container.querySelectorAll('[data-inbox-meta]')].map(input => [input.dataset.inboxMeta, input.value.trim()]));
      const mapping = Object.fromEntries([...container.querySelectorAll('[data-inbox-map]')].map(select => [select.dataset.inboxMap, select.value === '' ? '' : Number(select.value)]));
      const batch = makeBatch(preview, headerIndex, mapping, metadata, fileName);
      if (!batch.records.length) { status('No data rows found below the selected header.'); return; }
      const batches = currentBatches(); batches.unshift(batch);
      if (!writeStore(batches)) { status('Browser storage is full or unavailable. Nothing was saved. Export fewer rows or use a browser with more storage.'); return; }
      preview = null;
      container.querySelector('[data-inbox-preview-box]').innerHTML = '';
      redrawBatches();
      status(`Saved ${batch.records.length} rows locally with the original table and source details.`);
    }

    function correctCell(input) {
      const batches = currentBatches();
      const batch = batches.find(item => item.id === input.closest('[data-batch]')?.dataset.batch);
      if (!batch) return;
      const row = Number(input.dataset.inboxEdit), column = Number(input.dataset.inboxColumn);
      const record = batch.records[row];
      if (!record || !Number.isInteger(column)) return;
      const before = String(record.cells[column] ?? '');
      if (!applyCorrection(batch, row, column, input.value)) return;
      if (!writeStore(batches)) { record.cells[column] = before; batch.audit.pop(); input.value = before; status('Could not save this correction. Browser storage may be full.'); return; }
      status(`Correction saved. Original value remains in the batch record.`);
    }

    function exportBatch(batchId) {
      const batch = currentBatches().find(item => item.id === batchId);
      if (!batch) return;
      const blob = new Blob([JSON.stringify(batch, null, 2)], {type:'application/json'});
      const url = root.URL.createObjectURL(blob);
      const link = root.document.createElement('a'); link.href = url;
      link.download = `field-signals-staged-${safeFilename(batch.sourceName || batch.fileName || 'batch')}.json`;
      link.click(); root.URL.revokeObjectURL(url);
    }
  }

  function inferMappings(headers) {
    const normalized = headers.map(value => String(value).toLowerCase().replace(/[\s_\-()/]+/g, ''));
    const patterns = {
      date: /^(date|day|period|month|quarter|reportdate|observationdate|資料年月|年月|日期|月份|季別)$/,
      entity: /(ticker|symbol|company|issuer|entity|stockcode|companycode|代號|公司名稱|公司代碼)/,
      value: /(value|revenue|sales|amount|price|wage|mw|count|metricvalue|營收|收入|數值|金額)/,
      metric: /(metric|measure|series|indicator|項目|指標)/,
      unit: /(unit|currency|ccy|幣別|單位)/,
      geography: /(geography|region|state|country|location|area|地區|縣市|國家|區域)/
    };
    const mapping = {};
    for (const [role, pattern] of Object.entries(patterns)) mapping[role] = normalized.findIndex(header => pattern.test(header));
    return mapping;
  }

  function safeHttpUrl(value) {
    try { const url = new URL(String(value || '')); return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : ''; }
    catch { return ''; }
  }

  function safeFilename(value) { return String(value).normalize('NFKD').replace(/[^\w.-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'batch'; }

  root.FieldSignalsMessyInbox = Object.freeze({attach, render, parseDelimited, guessDelimiter, inferMappings, makeBatch, applyCorrection, storageKey:STORAGE_KEY});
  root.FieldSignalsModules = root.FieldSignalsModules || {};
  root.FieldSignalsModules.messyDataInbox = {title: 'Messy-data staging inbox', render, attach};
})(typeof window !== 'undefined' ? window : globalThis);
