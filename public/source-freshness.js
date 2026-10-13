(function (root) {
  'use strict';

  const STORAGE_KEY = 'fieldSignals.sourceFreshness.v1';
  const CADENCES = new Set(['daily', 'weekly', 'monthly', 'quarterly', 'annual', 'custom', 'event-driven']);
  const DEFAULT_CADENCE_DAYS = { daily: 1, weekly: 7, monthly: 31, quarterly: 92, annual: 366, custom: 30, 'event-driven': 0 };

  function validDate(value) {
    const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const [, year, month, day] = match.map(Number);
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  }

  function esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  }

  function safeUrl(value) {
    try {
      const parsed = new URL(String(value ?? '').trim());
      return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : '';
    } catch (_) { return ''; }
  }

  function dayNumber(value) {
    return validDate(value) ? Math.floor(Date.parse(`${value}T00:00:00Z`) / 86400000) : null;
  }

  function normalizeSource(input, id) {
    const cadence = String(input.cadence ?? '').trim();
    if (!CADENCES.has(cadence)) return { error: 'Choose a provider cadence.' };
    const expectedBy = String(input.expectedBy ?? '').trim();
    if (expectedBy && !validDate(expectedBy)) return { error: 'Use a valid expected release date.' };
    const cadenceDays = cadence === 'custom' ? Number(input.cadenceDays) : DEFAULT_CADENCE_DAYS[cadence];
    if (!Number.isInteger(cadenceDays) || cadenceDays < 0 || cadenceDays > 3650 || (cadence === 'custom' && cadenceDays < 1)) {
      return { error: 'Enter a valid cadence length in days.' };
    }
    const graceDays = Number(input.graceDays ?? 0);
    if (!Number.isInteger(graceDays) || graceDays < 0 || graceDays > 365) return { error: 'Grace days must be a whole number from 0 to 365.' };
    const sourceUrl = safeUrl(input.sourceUrl);
    if (String(input.sourceUrl ?? '').trim() && !sourceUrl) return { error: 'Enter an HTTP or HTTPS evidence link.' };
    const name = String(input.name ?? '').trim();
    if (!name) return { error: 'Enter a source name.' };
    return {
      id: String(id ?? input.id ?? '').trim(), name,
      provider: String(input.provider ?? '').trim(),
      sector: String(input.sector ?? '').trim(),
      cadence, cadenceDays, graceDays,
      expectedPeriod: String(input.expectedPeriod ?? '').trim(), expectedBy,
      sourceUrl, createdAt: String(input.createdAt ?? '').trim()
    };
  }

  function normalizeObservation(input) {
    const checkedOn = String(input.checkedOn ?? '').trim();
    if (!validDate(checkedOn)) return { error: 'Enter the date you checked the source.' };
    const observedPeriod = String(input.observedPeriod ?? '').trim();
    const observationState = String(input.observationState ?? 'observed').trim();
    if (!['observed', 'missing'].includes(observationState)) return { error: 'Choose observed or missing.' };
    if (observationState === 'observed' && !observedPeriod) return { error: 'Enter the latest period visible at the source.' };
    if (observationState === 'missing' && observedPeriod) return { error: 'Leave the observed period blank when recording a missing release.' };
    const evidenceUrl = safeUrl(input.evidenceUrl);
    if (String(input.evidenceUrl ?? '').trim() && !evidenceUrl) return { error: 'Enter an HTTP or HTTPS evidence link.' };
    return {
      checkedOn, observedPeriod, observationState,
      revised: input.revised === true || input.revised === 'true',
      evidenceUrl, note: String(input.note ?? '').trim()
    };
  }

  function getStatus(source, observations, today) {
    const history = Array.isArray(observations) ? observations : [];
    const latest = history[history.length - 1] || null;
    const flags = [];
    const todayDay = dayNumber(today);
    if (latest?.revised) flags.push('revised');
    const dueDay = dayNumber(source.expectedBy);
    const expectedPassed = dueDay !== null && todayDay !== null && dueDay + source.graceDays <= todayDay;
    if (latest?.observationState === 'missing' || (!latest && expectedPassed)) flags.push('missing');
    if (expectedPassed && source.expectedPeriod && latest?.observationState === 'observed' && latest.observedPeriod !== source.expectedPeriod) flags.push('late');
    if (source.cadenceDays > 0 && latest) {
      const checkedDay = dayNumber(latest.checkedOn);
      const staleAfter = source.cadenceDays + source.graceDays;
      if (checkedDay !== null && todayDay !== null && todayDay - checkedDay > staleAfter) flags.push('stale');
    }
    if (!latest && !expectedPassed) flags.push('not-checked');
    return { flags: [...new Set(flags)], latest };
  }

  function readState(storage, key = STORAGE_KEY) {
    try {
      const value = JSON.parse(storage.getItem(key) || '{"sources":[]}');
      if (!value || !Array.isArray(value.sources)) return { sources: [] };
      return { sources: value.sources.filter(item => item && typeof item.id === 'string' && Array.isArray(item.observations)) };
    } catch (_) { return { sources: [] }; }
  }

  function writeState(storage, state, key = STORAGE_KEY) {
    try { storage.setItem(key, JSON.stringify(state)); return true; }
    catch (_) { return false; }
  }

  function statusLabel(flags) {
    if (!flags.length) return 'Current at last check';
    const labels = { revised: 'Revised', missing: 'Missing', late: 'Late', stale: 'Check overdue', 'not-checked': 'Not checked' };
    return flags.map(flag => labels[flag] || flag).join(' · ');
  }

  function cadenceLabel(source) {
    return source.cadence === 'custom' ? `Every ${source.cadenceDays} days` : source.cadence.replace('-', ' ');
  }

  function renderCard(source, today) {
    const { flags, latest } = getStatus(source, source.observations, today);
    const status = flags.length ? flags.join(' ') : 'current';
    const observed = latest?.observationState === 'observed' ? latest.observedPeriod : 'No observation recorded';
    const evidenceUrl = safeUrl(latest?.evidenceUrl) || safeUrl(source.sourceUrl);
    return `<article class="sf-card" data-source-id="${esc(source.id)}"><div class="sf-card-head"><div><p class="sf-meta">${esc([source.sector, source.provider].filter(Boolean).join(' · ') || 'Source')}</p><h3>${esc(source.name)}</h3></div><span class="sf-badge ${esc(status)}">${esc(statusLabel(flags))}</span></div>
      <dl class="sf-facts"><div><dt>Cadence</dt><dd>${esc(cadenceLabel(source))}${source.graceDays ? ` + ${source.graceDays} grace days` : ''}</dd></div><div><dt>Expected period</dt><dd>${esc(source.expectedPeriod || 'Not set')}${source.expectedBy ? ` · due ${esc(source.expectedBy)}` : ''}</dd></div><div><dt>Latest observed</dt><dd>${esc(observed)}</dd></div><div><dt>Last checked</dt><dd>${esc(latest?.checkedOn || 'Never')}</dd></div></dl>
      ${latest?.note ? `<p class="sf-note">${esc(latest.note)}</p>` : ''}${evidenceUrl ? `<p class="sf-link">Evidence: <a href="${esc(evidenceUrl)}" target="_blank" rel="noopener noreferrer">Open source page ↗</a></p>` : ''}
      <details class="sf-settings"><summary>Edit source schedule and coverage</summary><form data-sf="settings-form" data-id="${esc(source.id)}" class="sf-form"><label>Source name<input data-field="name" maxlength="160" value="${esc(source.name)}" required></label><label>Provider<input data-field="provider" maxlength="120" value="${esc(source.provider)}"></label><label>Sector or coverage<input data-field="sector" maxlength="120" value="${esc(source.sector)}"></label><label>Provider cadence<select data-field="cadence">${['daily','weekly','monthly','quarterly','annual','custom','event-driven'].map(value => `<option value="${value}" ${source.cadence === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label><label data-sf="custom-field" ${source.cadence === 'custom' ? '' : 'hidden'}>Cadence length in days<input data-field="cadenceDays" type="number" min="1" max="3650" value="${source.cadenceDays}"></label><label>Grace days<input data-field="graceDays" type="number" min="0" max="365" value="${source.graceDays}"></label><label>Expected period<input data-field="expectedPeriod" maxlength="80" value="${esc(source.expectedPeriod)}" placeholder="For example, 2026 Q2"></label><label>Expected release date<input data-field="expectedBy" type="date" value="${esc(source.expectedBy)}"></label><label class="sf-wide">Provider page or evidence URL<input data-field="sourceUrl" type="url" value="${esc(source.sourceUrl)}"></label><div class="sf-wide"><button class="sf-button" type="submit">Save source settings</button><p class="sf-status" data-sf="form-status" aria-live="polite"></p></div></form></details>
      <details class="sf-check"><summary>Record a source check</summary><form data-sf="observation-form" data-id="${esc(source.id)}" class="sf-form"><label>Checked on<input data-field="checkedOn" type="date" required></label><label>Observation<select data-field="observationState"><option value="observed">Period found</option><option value="missing">Expected release missing</option></select></label><label>Latest period<input data-field="observedPeriod" maxlength="80" placeholder="For example, 2026 Q2"></label><label>Evidence URL<input data-field="evidenceUrl" type="url" placeholder="Defaults to source page"></label><label class="sf-wide sf-inline"><input data-field="revised" type="checkbox"> This period was revised since the prior check</label><label class="sf-wide">Observation note<textarea data-field="note" maxlength="1200" placeholder="Record the displayed release date, revision, outage, or coverage change"></textarea></label><div class="sf-wide"><button class="sf-button" type="submit">Save check</button><p class="sf-status" data-sf="form-status" aria-live="polite"></p></div></form></details>
      ${source.observations.length > 1 ? `<details class="sf-history"><summary>${source.observations.length} checks recorded</summary>${source.observations.slice(0, -1).slice().reverse().map(item => `<p><strong>${esc(item.checkedOn)}</strong> · ${item.observationState === 'missing' ? 'Release missing' : `Observed ${esc(item.observedPeriod)}`}${item.revised ? ' · revision noted' : ''}${item.note ? `<br>${esc(item.note)}` : ''}</p>`).join('')}</details>` : ''}</article>`;
  }

  const api = {
    title: 'Source freshness monitor',
    render() {
      return `<section class="sf-page"><header class="sf-head"><p class="sf-kicker">Manual source log</p><h1>Source freshness monitor</h1><p>Keep each provider’s stated cadence beside the latest period you can verify. Log late releases, missing periods, revisions, and when you checked.</p></header>
      <form data-sf="source-form" class="sf-form sf-source-form"><label>Source name<input data-field="name" maxlength="160" required></label><label>Provider<input data-field="provider" maxlength="120"></label><label>Sector or coverage<input data-field="sector" maxlength="120" placeholder="Semiconductors, labor, consumer"></label><label>Provider cadence<select data-field="cadence"><option value="">Choose cadence</option><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="quarterly">Quarterly</option><option value="annual">Annual</option><option value="custom">Custom days</option><option value="event-driven">Event driven</option></select></label><label data-sf="custom-field" hidden>Cadence length in days<input data-field="cadenceDays" type="number" min="1" max="3650" value="30"></label><label>Grace days<input data-field="graceDays" type="number" min="0" max="365" value="0"></label><label>Expected period<input data-field="expectedPeriod" maxlength="80" placeholder="For example, 2026 Q2"></label><label>Expected release date<input data-field="expectedBy" type="date"></label><label class="sf-wide">Provider page or evidence URL<input data-field="sourceUrl" type="url" placeholder="https://example.com/data"></label><div class="sf-wide sf-actions"><button class="sf-button" type="submit">Add source</button><p data-sf="source-status" class="sf-status" aria-live="polite"></p></div></form>
      <div class="sf-toolbar"><label>Filter sources<input data-sf="filter" type="search" placeholder="Search provider, sector, period"></label><button data-sf="export" class="sf-button secondary" type="button">Export JSON</button><button data-sf="import-button" class="sf-button secondary" type="button">Import JSON</button><input data-sf="import-file" type="file" accept="application/json,.json" hidden></div><div data-sf="list" class="sf-list"></div>
      <p class="sf-limit">Status is calculated from your manually entered dates and periods. This page does not poll providers, verify release calendars, or identify revisions on its own. A “current” label means only that the last logged check is within the cadence window.</p><p class="sf-storage">Saved in this browser profile only. Export a backup to move the register to another device.</p>
      <style>.sf-page{max-width:1050px;margin:0 auto}.sf-head{border-bottom:1px solid #dce3ed;padding:5px 0 16px}.sf-kicker{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#275bd7;font-weight:700;margin:0}.sf-head h1{font-size:28px;letter-spacing:-.6px;margin:5px 0}.sf-head p:last-child,.sf-limit,.sf-storage{font-size:12px;line-height:1.5;color:#637188}.sf-form{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sf-form [hidden]{display:none}.sf-source-form{padding:15px;background:#fff;border:1px solid #dce3ed;border-radius:9px;margin-top:15px}.sf-form label,.sf-toolbar label{display:grid;gap:4px;font-size:11px;color:#50617a;font-weight:650}.sf-form input,.sf-form select,.sf-form textarea,.sf-toolbar input{width:100%;min-width:0;box-sizing:border-box;border:1px solid #cfd9e6;border-radius:6px;padding:8px 9px;background:#fff;color:#17243a;font:12px/1.4 inherit}.sf-form textarea{min-height:55px;resize:vertical}.sf-wide{grid-column:1/-1}.sf-inline{display:flex!important;align-items:center}.sf-inline input{width:auto}.sf-actions{display:flex;align-items:center;gap:12px}.sf-button{border:0;border-radius:6px;padding:8px 12px;background:#2458d3;color:#fff;font-weight:700;font-size:12px;cursor:pointer}.sf-button.secondary{background:#edf3ff;color:#2853a9;border:1px solid #d8e3f8}.sf-status{font-size:11px;color:#86600e;margin:0}.sf-toolbar{display:flex;align-items:end;gap:8px;margin:16px 0}.sf-toolbar label{flex:1}.sf-list{display:grid;gap:10px}.sf-card{background:white;border:1px solid #dce3ed;border-radius:9px;padding:14px;box-shadow:0 7px 22px #14244008}.sf-card-head{display:flex;align-items:start;justify-content:space-between;gap:12px}.sf-card h3{font-size:16px;margin:3px 0}.sf-meta{font-size:10px;text-transform:uppercase;letter-spacing:.4px;color:#718098;margin:0}.sf-badge{font-size:10px;font-weight:750;padding:4px 7px;border-radius:5px;background:#e8f5ee;color:#176b47;white-space:nowrap}.sf-badge.late,.sf-badge.missing,.sf-badge.stale{background:#fff0e7;color:#a34c22}.sf-badge.revised{background:#fff3d6;color:#8a6100}.sf-badge.not-checked{background:#eef2f7;color:#5d6879}.sf-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin:13px 0}.sf-facts div{min-width:0}.sf-facts dt{font-size:10px;color:#78869a}.sf-facts dd{font-size:12px;margin:3px 0 0;overflow-wrap:anywhere;color:#24334a}.sf-note{font-size:12px;color:#53647d;white-space:pre-wrap}.sf-link{font-size:11px}.sf-card details{border-top:1px solid #edf0f5;padding-top:8px;margin-top:10px}.sf-card summary{font-size:11px;font-weight:700;color:#315aa9;cursor:pointer}.sf-check .sf-form{margin-top:10px}.sf-history p{font-size:11px;color:#5f6d81}.sf-limit{margin:14px 0 0}.sf-storage{font-size:10px}@media(max-width:720px){.sf-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.sf-toolbar{align-items:stretch;flex-wrap:wrap}.sf-toolbar label{flex-basis:100%}}@media(max-width:480px){.sf-head h1{font-size:24px}.sf-source-form,.sf-check .sf-form{grid-template-columns:1fr}.sf-wide{grid-column:auto}.sf-card{padding:12px}.sf-card-head{display:block}.sf-badge{display:inline-block;margin-top:6px}}</style></section>`;
    },
    attach(container) {
      const get = (key, scope = container) => scope.querySelector(`[data-sf="${key}"]`);
      const storage = root.localStorage;
      const today = () => new Date().toISOString().slice(0, 10);
      let state = readState(storage);
      const statusEl = (form, message) => { const el = get('form-status', form); if (el) el.textContent = message; };
      const render = () => {
        const query = String(get('filter')?.value || '').trim().toLowerCase();
        const filtered = state.sources.filter(source => `${source.name} ${source.provider} ${source.sector} ${source.expectedPeriod}`.toLowerCase().includes(query));
        get('list').innerHTML = filtered.length ? filtered.map(source => renderCard(source, today())).join('') : '<p class="sf-empty">No matching sources recorded.</p>';
        container.querySelectorAll('[data-sf="observation-form"]').forEach(form => {
          form.addEventListener('submit', event => {
            event.preventDefault();
            const source = state.sources.find(item => item.id === form.dataset.id);
            if (!source) return;
            const field = name => get(name, form);
            const observation = normalizeObservation({ checkedOn: field('checkedOn').value, observationState: field('observationState').value, observedPeriod: field('observedPeriod').value, evidenceUrl: field('evidenceUrl').value, revised: field('revised').checked, note: field('note').value });
            if (observation.error) { statusEl(form, observation.error); return; }
            source.observations.push(observation);
            const saved = writeState(storage, state);
            statusEl(form, saved ? 'Check saved in this browser.' : 'Could not save. Export or free browser storage space, then retry.');
            if (saved) render();
          });
        });
        container.querySelectorAll('[data-sf="settings-form"]').forEach(form => {
          form.addEventListener('submit', event => {
            event.preventDefault();
            const source = state.sources.find(item => item.id === form.dataset.id);
            if (!source) return;
            const field = name => get(name, form);
            const updated = normalizeSource({ name: field('name').value, provider: field('provider').value, sector: field('sector').value, cadence: field('cadence').value, cadenceDays: field('cadenceDays').value || source.cadenceDays, graceDays: field('graceDays').value, expectedPeriod: field('expectedPeriod').value, expectedBy: field('expectedBy').value, sourceUrl: field('sourceUrl').value, createdAt: source.createdAt }, source.id);
            if (updated.error) { statusEl(form, updated.error); return; }
            Object.assign(source, updated);
            const saved = writeState(storage, state);
            statusEl(form, saved ? 'Settings saved.' : 'Could not save in this browser.');
            if (saved) render();
          });
          get('cadence', form).addEventListener('change', () => { get('custom-field', form).hidden = get('cadence', form).value !== 'custom'; });
        });
      };
      const sourceForm = get('source-form');
      sourceForm.addEventListener('submit', event => {
        event.preventDefault();
        const field = name => get(name, sourceForm);
        const source = normalizeSource({ name: field('name').value, provider: field('provider').value, sector: field('sector').value, cadence: field('cadence').value, cadenceDays: field('cadenceDays').value, graceDays: field('graceDays').value, expectedPeriod: field('expectedPeriod').value, expectedBy: field('expectedBy').value, sourceUrl: field('sourceUrl').value, createdAt: today() }, `sf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
        if (source.error) { get('source-status').textContent = source.error; return; }
        state.sources.unshift({ ...source, observations: [] });
        const saved = writeState(storage, state);
        get('source-status').textContent = saved ? 'Source saved. Record a check when you verify the page.' : 'Could not save in this browser.';
        if (saved) { sourceForm.reset(); render(); }
      });
      get('cadence', sourceForm).addEventListener('change', () => { get('custom-field').hidden = get('cadence', sourceForm).value !== 'custom'; });
      get('filter').addEventListener('input', render);
      get('export').addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), sources: state.sources }, null, 2)], { type: 'application/json' });
        const link = root.document.createElement('a'); link.href = root.URL.createObjectURL(blob); link.download = 'field-signals-source-freshness.json'; link.click(); root.URL.revokeObjectURL(link.href);
      });
      get('import-button').addEventListener('click', () => get('import-file').click());
      get('import-file').addEventListener('change', async event => {
        const file = event.target.files?.[0]; if (!file) return;
        try {
          const parsed = JSON.parse(await file.text());
          if (!parsed || !Array.isArray(parsed.sources)) throw new Error('Expected a JSON object with a sources array.');
          const existingIds = new Set(state.sources.map(item => item.id));
          const additions = [];
          for (const item of parsed.sources) {
            if (!item || typeof item.id !== 'string' || existingIds.has(item.id) || !Array.isArray(item.observations)) continue;
            const source = normalizeSource(item, item.id);
            if (source.error) continue;
            const observations = item.observations.map(normalizeObservation);
            if (observations.some(observation => observation.error)) continue;
            additions.push({ ...source, observations });
            existingIds.add(item.id);
          }
          state.sources = [...additions, ...state.sources];
          get('source-status').textContent = writeState(storage, state) ? `Imported ${additions.length} new source records. Existing IDs were kept.` : 'Could not save imported records.';
          render();
        } catch (error) { get('source-status').textContent = `Import failed: ${error.message}`; }
        event.target.value = '';
      });
      render();
    }
  };

  root.FieldSignalsModules = root.FieldSignalsModules || {};
  root.FieldSignalsModules.sourceFreshness = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = { STORAGE_KEY, CADENCES, validDate, safeUrl, normalizeSource, normalizeObservation, getStatus, readState, writeState, statusLabel };
})(typeof window !== 'undefined' ? window : globalThis);
