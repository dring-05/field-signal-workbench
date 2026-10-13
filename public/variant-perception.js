/*
 * Variant-perception ledger. No network requests. Entries remain in this browser profile.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) {
    root.FieldSignalsModules = root.FieldSignalsModules || {};
    root.FieldSignalsModules.variantPerception = {
      title: 'Variant-perception ledger',
      render: api.render,
      attach: api.attach,
    };
    root.FieldSignalsVariantPerceptionLogic = api.logic;
  }
})(typeof window !== 'undefined' ? window : null, function () {
  const STORAGE_KEY = 'field-signals-variant-ledger-v1';
  const MAX_ENTRIES = 500;
  const MAX_FIELD_LENGTH = 12000;
  const fields = [
    ['company', 'Company', 'Company name', 'text'],
    ['ticker', 'Ticker or identifier', 'Ticker, exchange, or other identifier', 'text'],
    ['asOfDate', 'View date', '', 'date'],
    ['horizon', 'Forecast horizon', 'For example: FY2027 or next 12 months', 'text'],
    ['metric', 'Key operating or financial metric', 'For example: units, revenue, gross margin', 'text'],
    ['unit', 'Unit', 'For example: USD millions, %, MW', 'text'],
    ['ownForecast', 'Your forecast', 'State the value, range, and assumptions', 'textarea'],
    ['marketExpectation', 'Market-implied expectation', 'State the estimate or source and date. Leave blank if unknown.', 'textarea'],
    ['variant', 'Where your view differs', 'What do you think consensus is missing or misjudging?', 'textarea'],
    ['evidence', 'Evidence and source links', 'Include source, date, observation, unit, geography, and URL where possible.', 'textarea'],
    ['falsifier', 'What would change your mind?', 'Name an observable result and a threshold or time window.', 'textarea'],
    ['confidence', 'Confidence', '', 'select'],
    ['outcome', 'Outcome or later result', 'Record the reported result and period when available.', 'textarea'],
    ['reviewNotes', 'Review notes', 'What was right, wrong, or still uncertain?', 'textarea'],
  ];
  const entryFields = fields.map(([key]) => key);

  function clean(value, max = MAX_FIELD_LENGTH) {
    return String(value == null ? '' : value).trim().slice(0, max);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
    })[char]);
  }

  function normalizeEntry(input, now = new Date().toISOString()) {
    const entry = {};
    for (const key of entryFields) entry[key] = clean(input && input[key], key === 'evidence' ? 20000 : MAX_FIELD_LENGTH);
    entry.company = clean(entry.company, 180);
    entry.ticker = clean(entry.ticker, 60).toUpperCase();
    entry.horizon = clean(entry.horizon, 180);
    entry.metric = clean(entry.metric, 180);
    entry.unit = clean(entry.unit, 80);
    entry.confidence = ['Low', 'Medium', 'High'].includes(entry.confidence) ? entry.confidence : '';
    entry.status = input && input.status === 'exited' ? 'exited' : 'active';
    entry.id = clean(input && input.id, 100) || makeId();
    entry.createdAt = clean(input && input.createdAt, 80) || now;
    entry.updatedAt = now;
    entry.exitDate = entry.status === 'exited' ? (clean(input && input.exitDate, 40) || now.slice(0, 10)) : '';
    entry.reviewedAt = clean(input && input.reviewedAt, 40);
    return entry;
  }

  function makeId() {
    return `vp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  }

  function validateEntry(input) {
    const entry = normalizeEntry(input);
    const errors = [];
    if (!entry.company && !entry.ticker) errors.push('Add a company name or ticker.');
    if (!entry.asOfDate) errors.push('Add the date for this view.');
    if (!entry.ownForecast) errors.push('Add your forecast.');
    if (!entry.variant) errors.push('Describe where your view differs.');
    if (!entry.falsifier) errors.push('Add a result that would change your mind.');
    return { entry, errors };
  }

  function parseEntries(value) {
    try {
      const parsed = JSON.parse(value || '[]');
      const rows = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.entries) ? parsed.entries : [];
      return rows.slice(0, MAX_ENTRIES).filter(item => item && typeof item === 'object').map(item => normalizeEntry(item));
    } catch {
      return [];
    }
  }

  function escapeForDownload(content, type, filename) {
    try {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = filename; link.click();
      URL.revokeObjectURL(url);
    } catch { /* Keep the ledger usable if downloads are blocked. */ }
  }

  function storageGet() {
    try { return localStorage.getItem(STORAGE_KEY) || '[]'; } catch { return '[]'; }
  }

  function storageSet(entries) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(entries)); return true; } catch { return false; }
  }

  function render() {
    return `<section class="vp-module" aria-label="Variant-perception ledger">
      <style>
        .vp-module{max-width:1080px;margin:0 auto;padding:clamp(12px,3vw,28px);color:#14233e}
        .vp-module h1{margin:0 0 8px;font-size:clamp(24px,4vw,34px);letter-spacing:-.04em}
        .vp-intro,.vp-note,.vp-status{color:#5c6d85;line-height:1.5;font-size:.9rem}
        .vp-card{border:1px solid #dbe3ee;border-radius:13px;background:#fff;padding:clamp(14px,2.5vw,22px);margin:14px 0;box-shadow:0 4px 14px rgba(26,55,98,.04)}
        .vp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
        .vp-field{display:flex;flex-direction:column;gap:5px;min-width:0;color:#263955;font-size:.88rem;font-weight:650}
        .vp-field.wide{grid-column:1/-1}
        .vp-field input,.vp-field textarea,.vp-field select{box-sizing:border-box;width:100%;border:1px solid #c7d2e2;border-radius:8px;padding:10px 11px;font:inherit;font-weight:400;color:#14233e;background:#fff}
        .vp-field textarea{min-height:86px;resize:vertical;line-height:1.45}
        .vp-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:13px}
        .vp-button{appearance:none;border:1px solid #b7c6dc;background:#f7faff;color:#173665;border-radius:8px;padding:9px 12px;font:inherit;font-weight:650;cursor:pointer}
        .vp-button.primary{background:#2458c5;border-color:#2458c5;color:#fff}
        .vp-button:focus-visible,.vp-field input:focus-visible,.vp-field textarea:focus-visible,.vp-field select:focus-visible{outline:3px solid #a9c7ff;outline-offset:2px}
        .vp-entry{border-top:1px solid #e4eaf2;padding:14px 0}
        .vp-entry:first-child{border-top:0}
        .vp-entry h3{margin:0;color:#172b4b;font-size:1.05rem}
        .vp-meta{color:#687991;font-size:.82rem;margin:4px 0 10px}
        .vp-detail{white-space:pre-wrap;overflow-wrap:anywhere;font-size:.9rem;line-height:1.48;margin:8px 0}
        .vp-detail strong{color:#344b6c}
        .vp-pill{display:inline-block;border:1px solid #d4dfed;border-radius:99px;padding:2px 8px;margin-left:6px;font-size:.73rem;color:#526783;vertical-align:2px}
        @media(max-width:640px){.vp-grid{grid-template-columns:1fr}.vp-field.wide{grid-column:auto}.vp-actions .vp-button{flex:1 1 100%}}
      </style>
      <h1>Variant-perception ledger</h1>
      <p class="vp-intro">Record what you expect, what the market appears to expect, the evidence behind the difference, and what happened later. Entries stay in this browser profile. Export a backup before changing devices or clearing browser data.</p>
      <section class="vp-card">
        <h2 data-vp-form-title>New view</h2>
        <form data-vp-form><input type="hidden" name="id"><input type="hidden" name="createdAt"><input type="hidden" name="status"><input type="hidden" name="exitDate"><input type="hidden" name="reviewedAt">
          <div class="vp-grid">${fields.map(([key, label, placeholder, type]) => {
            const wide = ['ownForecast', 'marketExpectation', 'variant', 'evidence', 'falsifier', 'outcome', 'reviewNotes'].includes(key);
            const control = type === 'textarea' ? `<textarea name="${key}" placeholder="${escapeHtml(placeholder)}"></textarea>` : type === 'select' ? `<select name="${key}"><option value="">Choose</option><option>Low</option><option>Medium</option><option>High</option></select>` : `<input name="${key}" type="${type}"${placeholder ? ` placeholder="${escapeHtml(placeholder)}"` : ''}>`;
            return `<label class="vp-field${wide ? ' wide' : ''}">${escapeHtml(label)}${control}</label>`;
          }).join('')}</div>
          <div class="vp-actions"><button class="vp-button primary" type="submit">Save view</button><button class="vp-button" type="button" data-vp-cancel hidden>Cancel edit</button><button class="vp-button" type="button" data-vp-export>Export backup</button><label class="vp-button" for="vp-import-file">Import backup</label><input id="vp-import-file" data-vp-import type="file" accept="application/json,.json" hidden></div>
          <p class="vp-status" data-vp-status aria-live="polite"></p>
        </form>
      </section>
      <section class="vp-card"><h2>Saved views</h2><div data-vp-list></div></section>
      <p class="vp-note">Market expectations are entered by you and are not fetched or verified here. This ledger does not calculate returns or make trade recommendations. It is local to this browser profile, not password protected, encrypted, backed up, or synced.</p>
    </section>`;
  }

  function attach(container) {
    if (!container) return;
    const form = container.querySelector('[data-vp-form]');
    const list = container.querySelector('[data-vp-list]');
    const status = container.querySelector('[data-vp-status]');
    const title = container.querySelector('[data-vp-form-title]');
    const cancel = container.querySelector('[data-vp-cancel]');
    let entries = parseEntries(storageGet());

    function setForm(entry) {
      for (const key of [...entryFields, 'id', 'createdAt', 'status', 'exitDate', 'reviewedAt']) {
        const field = form.elements.namedItem(key);
        if (field) field.value = entry && entry[key] || '';
      }
      title.textContent = entry ? 'Edit view and review' : 'New view';
      cancel.hidden = !entry;
    }

    function showEntries() {
      if (!entries.length) { list.innerHTML = '<p class="vp-note">No views saved yet.</p>'; return; }
      list.innerHTML = entries.map(entry => {
        const label = [entry.company, entry.ticker].filter(Boolean).join(' · ') || 'Unnamed view';
        const details = [
          ['Your forecast', entry.ownForecast], ['Market-implied expectation', entry.marketExpectation],
          ['Where your view differs', entry.variant], ['Evidence and sources', entry.evidence],
          ['Falsifier', entry.falsifier], ['Outcome', entry.outcome], ['Review notes', entry.reviewNotes],
        ].filter(([, value]) => value).map(([name, value]) => `<p class="vp-detail"><strong>${name}:</strong> ${escapeHtml(value)}</p>`).join('');
        const state = entry.status === 'exited' ? `Exited ${escapeHtml(entry.exitDate || '')}` : 'Active';
        return `<article class="vp-entry" data-vp-entry="${escapeHtml(entry.id)}"><h3>${escapeHtml(label)}<span class="vp-pill">${state}</span></h3><p class="vp-meta">View ${escapeHtml(entry.asOfDate || 'date not set')} · ${escapeHtml(entry.horizon || 'horizon not set')} · ${escapeHtml(entry.metric || 'metric not set')}${entry.unit ? ` (${escapeHtml(entry.unit)})` : ''}${entry.confidence ? ` · ${escapeHtml(entry.confidence)} confidence` : ''}${entry.reviewedAt ? ` · Reviewed ${escapeHtml(entry.reviewedAt)}` : ''}</p>${details}<div class="vp-actions"><button class="vp-button" type="button" data-vp-edit="${escapeHtml(entry.id)}">Edit</button>${entry.status === 'active' ? `<button class="vp-button" type="button" data-vp-exit="${escapeHtml(entry.id)}">Mark exited</button>` : ''}</div></article>`;
      }).join('');
    }

    showEntries();
    form?.addEventListener('submit', event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const { entry, errors } = validateEntry(data);
      if (errors.length) { status.textContent = errors.join(' '); return; }
      const index = entries.findIndex(item => item.id === data.id);
      if (index >= 0) {
        entry.createdAt = entries[index].createdAt;
        if (entry.status !== 'exited') entry.exitDate = '';
        if (entry.outcome || entry.reviewNotes) entry.reviewedAt = entry.reviewedAt || new Date().toISOString().slice(0, 10);
        entries[index] = entry;
      } else entries.unshift(entry);
      entries = entries.slice(0, MAX_ENTRIES);
      const saved = storageSet(entries);
      status.textContent = saved ? 'Saved on this device.' : 'Browser storage is unavailable or full. Export the visible ledger before leaving this page.';
      showEntries(); setForm(null);
    });
    cancel?.addEventListener('click', () => { setForm(null); status.textContent = ''; });
    list?.addEventListener('click', event => {
      const edit = event.target.closest('[data-vp-edit]');
      const exit = event.target.closest('[data-vp-exit]');
      if (edit) {
        const entry = entries.find(item => item.id === edit.dataset.vpEdit);
        if (entry) { setForm(entry); title.scrollIntoView?.({ behavior: 'smooth', block: 'start' }); }
      }
      if (exit) {
        const index = entries.findIndex(item => item.id === exit.dataset.vpExit);
        if (index < 0) return;
        entries[index] = { ...entries[index], status: 'exited', exitDate: new Date().toISOString().slice(0, 10), updatedAt: new Date().toISOString() };
        status.textContent = storageSet(entries) ? 'Marked exited. The record remains in the ledger.' : 'Could not save this change to browser storage.';
        showEntries();
      }
    });
    container.querySelector('[data-vp-export]')?.addEventListener('click', () => escapeForDownload(JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries }, null, 2), 'application/json', 'field-signals-variant-ledger.json'));
    container.querySelector('[data-vp-import]')?.addEventListener('change', async event => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        const imported = parseEntries(await file.text());
        if (!imported.length) { status.textContent = 'No valid entries found in that backup.'; return; }
        const merged = new Map(entries.map(item => [item.id, item]));
        for (const item of imported) if (!merged.has(item.id)) merged.set(item.id, item);
        entries = [...merged.values()].slice(0, MAX_ENTRIES);
        status.textContent = storageSet(entries) ? `Imported ${imported.length} entries. Existing IDs were kept.` : 'Could not save imported entries to browser storage.';
        showEntries();
      } catch { status.textContent = 'Could not read that backup file.'; }
      event.target.value = '';
    });
  }

  return {
    render,
    attach,
    logic: { STORAGE_KEY, MAX_ENTRIES, fields, normalizeEntry, validateEntry, parseEntries, escapeHtml },
  };
});
