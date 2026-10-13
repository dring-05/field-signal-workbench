/* Analyst-maintained, source-linked capacity-to-revenue evidence bridge.
 * Local only. Rows are never automatically matched, joined, or summed.
 */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'field-signals-capacity-revenue-bridge-v1';
  const STAGES = [
    ['power', 'Power and grid'], ['permitting', 'Permitting'], ['equipment', 'Equipment'],
    ['labor', 'Labor and construction'], ['commissioning', 'Commissioning'],
    ['utilization', 'Utilization'], ['contracts', 'Customer contracts'], ['revenue', 'Recognized revenue']
  ];
  const STATUSES = ['Announced', 'Applied', 'Approved', 'Ordered', 'Delivered', 'Under construction', 'Commissioning', 'Operating', 'Contracted', 'Reported', 'Delayed', 'Cancelled', 'Unverified'];
  const CONFIDENCE = ['Low', 'Medium', 'High'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const id = () => `crb-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const validUrl = value => { try { const u = new URL(String(value ?? '').trim()); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const stageName = key => STAGES.find(([id]) => id === key)?.[1] || 'Unknown stage';
  const blankState = () => ({ version: 1, entries: [] });

  function normalizeEntry(input, entries = []) {
    const stage = String(input.stage ?? '').trim();
    if (!STAGES.some(([key]) => key === stage)) return { error: 'Choose a bridge stage.' };
    const entity = String(input.entity ?? '').trim();
    const period = String(input.period ?? '').trim();
    const sourceName = String(input.sourceName ?? '').trim();
    const sourceUrl = validUrl(input.sourceUrl);
    if (!entity || !period || !sourceName || !sourceUrl) return { error: 'Add the company or project, source period, source name, and an HTTP or HTTPS evidence URL.' };
    const status = String(input.status ?? '').trim();
    if (!STATUSES.includes(status)) return { error: 'Choose a status.' };
    const confidence = String(input.confidence ?? '').trim();
    if (!CONFIDENCE.includes(confidence)) return { error: 'Choose evidence confidence.' };
    const rawQuantity = String(input.quantity ?? '').trim();
    const unit = String(input.unit ?? '').trim();
    let quantity = null;
    if (rawQuantity) {
      const validNumber = /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(rawQuantity);
      const normalized = validNumber ? rawQuantity.replace(/,/g, '') : '';
      if (!normalized || !Number.isFinite(Number(normalized))) return { error: 'Quantity must be a finite number. Use commas only as thousands separators.' };
      if (!unit) return { error: 'Enter a unit when you enter a quantity.' };
      quantity = Number(normalized);
    } else if (unit) return { error: 'Leave the unit blank when no quantity is recorded.' };
    const predecessorId = String(input.predecessorId ?? '').trim();
    if (predecessorId && !entries.some(entry => entry.id === predecessorId)) return { error: 'The selected prior record is no longer available. Choose another record or leave it blank.' };
    if (predecessorId === input.id) return { error: 'A record cannot link to itself.' };
    const linkConfidence = String(input.linkConfidence ?? 'Low').trim();
    if (!CONFIDENCE.includes(linkConfidence)) return { error: 'Choose confidence for the analyst-entered link.' };
    return {
      id: String(input.id || id()), stage, entity, project: String(input.project ?? '').trim(),
      measure: String(input.measure ?? '').trim(), quantity, unit, period, status,
      confidence, sourceName, sourceUrl, sourceDate: String(input.sourceDate ?? '').trim(),
      predecessorId, linkLabel: String(input.linkLabel ?? '').trim(), linkConfidence,
      gap: String(input.gap ?? '').trim(), notes: String(input.notes ?? '').trim(),
      recordedAt: String(input.recordedAt || new Date().toISOString()),
      supersedes: String(input.supersedes ?? '').trim()
    };
  }

  function readState(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || !Array.isArray(parsed.entries)) return blankState();
      const ids = new Set();
      const entries = parsed.entries.filter(entry => entry && typeof entry.id === 'string' && !ids.has(entry.id) && STAGES.some(([key]) => key === entry.stage) && validUrl(entry.sourceUrl) && (ids.add(entry.id), true));
      return { version: 1, entries };
    } catch { return blankState(); }
  }

  function gapsFor(entries) {
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    return entries.map(entry => {
      const gaps = [];
      if (entry.stage !== 'power' && !entry.predecessorId) gaps.push('No earlier stage linked');
      if (entry.predecessorId && !byId.has(entry.predecessorId)) gaps.push('Linked record is missing');
      if (entry.quantity == null) gaps.push('No numeric quantity recorded');
      if (entry.stage !== 'revenue' && !entry.gap) gaps.push('No next-step gap note');
      return { id: entry.id, gaps };
    });
  }

  function writeState(storage, state) {
    try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
    catch { return false; }
  }

  const field = (label, name, value = '', extra = '') => `<label>${esc(label)}<input name="${esc(name)}" value="${esc(value)}" ${extra}></label>`;
  function renderState(entries, message = '') {
    const ordered = [...entries].sort((a,b) => STAGES.findIndex(x=>x[0]===a.stage)-STAGES.findIndex(x=>x[0]===b.stage) || String(a.period).localeCompare(String(b.period)) || String(a.entity).localeCompare(String(b.entity)));
    const byId = new Map(ordered.map(entry => [entry.id, entry]));
    const gaps = gapsFor(entries);
    const gapsById = new Map(gaps.map(item => [item.id, item.gaps]));
    const predecessorOptions = [`<option value="">No link recorded</option>`, ...ordered.map(entry => `<option value="${esc(entry.id)}">${esc(`${stageName(entry.stage)} · ${entry.entity}${entry.project ? ` / ${entry.project}` : ''} · ${entry.period}`)}</option>`)].join('');
    const records = STAGES.map(([stage, label]) => {
      const rows = ordered.filter(entry => entry.stage === stage);
      return `<section class="crb-stage"><h3>${esc(label)} <small>${rows.length}</small></h3>${rows.length ? rows.map(entry => {
        const prior = byId.get(entry.predecessorId);
        const gapList = gapsById.get(entry.id) || [];
        return `<article class="crb-record"><div class="crb-record-head"><strong>${esc(entry.entity)}${entry.project ? ` · ${esc(entry.project)}` : ''}</strong><span>${esc(entry.status)} · ${esc(entry.confidence)} evidence</span></div><div class="crb-measure">${entry.quantity == null ? 'Quantity not recorded' : `${esc(entry.quantity)} ${esc(entry.unit)}`}${entry.measure ? ` · ${esc(entry.measure)}` : ''} · ${esc(entry.period)}</div><div class="crb-source"><a href="${esc(entry.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(entry.sourceName)} ↗</a>${entry.sourceDate ? ` · source date ${esc(entry.sourceDate)}` : ''} · logged ${esc(entry.recordedAt.slice(0,10))}</div>${entry.predecessorId ? `<p class="crb-link">Manual link to ${esc(prior ? `${stageName(prior.stage)}: ${prior.entity}${prior.project ? ` / ${prior.project}` : ''}` : 'missing record')} · ${esc(entry.linkConfidence)} confidence${entry.linkLabel ? ` · ${esc(entry.linkLabel)}` : ''}</p>` : ''}${entry.gap ? `<p class="crb-gap"><b>Open question:</b> ${esc(entry.gap)}</p>` : ''}${entry.notes ? `<p class="crb-notes">${esc(entry.notes)}</p>` : ''}${gapList.length ? `<p class="crb-flags">Review: ${gapList.map(esc).join(' · ')}</p>` : ''}${entry.supersedes ? `<p class="crb-muted">Correction record, supersedes ${esc(entry.supersedes)}. Earlier record retained.</p>` : ''}</article>`;
      }).join('') : '<p class="crb-empty">No evidence recorded at this stage.</p>'}</section>`;
    }).join('');
    const exportJson = JSON.stringify({ exportedAt: new Date().toISOString(), entries }, null, 2);
    return `<style>
      .crb-wrap{max-width:1050px;margin:auto;color:#172943}.crb-wrap *{box-sizing:border-box}.crb-head{padding:7px 0 15px;border-bottom:1px solid #dce3ed}.crb-eyebrow{margin:0;color:#315da8;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:750}.crb-head h1{font-size:28px;letter-spacing:-.5px;margin:5px 0}.crb-intro,.crb-note,.crb-muted{font-size:12px;line-height:1.5;color:#607089}.crb-note{padding:10px 12px;background:#fff8e9;border-left:3px solid #bd8423;color:#72561c}.crb-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;padding:13px;margin:13px 0;border:1px solid #dce3ed;border-radius:8px;background:#fff}.crb-form label{display:grid;gap:4px;color:#50617a;font-size:11px;font-weight:650}.crb-form input,.crb-form select,.crb-form textarea{min-width:0;width:100%;padding:8px;border:1px solid #cbd6e4;border-radius:6px;background:white;color:#172943;font:12px/1.4 inherit}.crb-wide{grid-column:1/-1}.crb-form textarea{min-height:55px;resize:vertical}.crb-form button,.crb-toolbar button{border:0;border-radius:6px;padding:9px 12px;background:#2458c5;color:#fff;font-size:12px;font-weight:700;cursor:pointer}.crb-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0}.crb-toolbar button.secondary{background:#edf3ff;color:#2853a9;border:1px solid #d8e3f8}.crb-message{font-size:11px;color:#805b0d}.crb-sequence{display:grid;gap:9px}.crb-stage{border:1px solid #dce3ed;border-radius:8px;background:#f8faff;padding:11px}.crb-stage h3{display:flex;justify-content:space-between;margin:0 0 8px;color:#27456f;font-size:13px}.crb-stage h3 small{color:#77869b}.crb-record{border:1px solid #e0e6ef;border-radius:7px;background:#fff;padding:10px;margin:7px 0}.crb-record-head{display:flex;justify-content:space-between;gap:8px;font-size:12px}.crb-record-head span{font-size:10px;color:#586985}.crb-measure{font-size:12px;font-weight:650;color:#263a58;margin-top:6px}.crb-source,.crb-muted,.crb-link,.crb-gap,.crb-notes,.crb-flags{font-size:11px;line-height:1.45;color:#596b82;margin:5px 0 0;overflow-wrap:anywhere}.crb-source a{color:#2458b3}.crb-gap,.crb-flags{color:#8a5d0e}.crb-empty{font-size:11px;color:#79869a;margin:4px}.crb-small{font-size:10px;color:#697991}.crb-local{padding:8px 10px;background:#f2f6fc;border:1px solid #dce5f1;border-radius:6px;font-size:11px;color:#596b82}@media(max-width:760px){.crb-form{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.crb-form{grid-template-columns:1fr}.crb-wide{grid-column:auto}.crb-record-head{display:block}.crb-record-head span{display:block;margin-top:3px}.crb-head h1{font-size:24px}}
    </style><section class="crb-wrap"><header class="crb-head"><p class="crb-eyebrow">Manual operating evidence</p><h1>Capacity to revenue bridge</h1><p class="crb-intro">Keep sourced observations across the path from power and permits to equipment, labor, commissioning, utilization, contracts, and reported revenue. Link records only when you can explain why they belong together.</p></header><p class="crb-note"><strong>Do not add stage quantities.</strong> The same capacity may appear in a utility queue, equipment order, project announcement, and customer contract. These records are evidence at different points, not separate capacity. Links are analyst-entered and do not prove causation. Recognized revenue is recorded only from a cited company or filing source.</p><p class="crb-local">Saved in this browser profile only. This register does not fetch, match, or upload source data. Export a backup before changing browsers.</p><form class="crb-form" data-crb="form"><label>Stage<select name="stage" required>${STAGES.map(([key,label])=>`<option value="${key}">${esc(label)}</option>`).join('')}</select></label>${field('Company, operator, or counterparty','entity','','maxlength="140" required')}${field('Project, site, or facility','project','','maxlength="160"')}${field('Measure','measure','','maxlength="120" placeholder="MW, transformers, openings, revenue"')}<label>Quantity<input name="quantity" inputmode="decimal" placeholder="Leave blank if qualitative"></label>${field('Unit','unit','','maxlength="50" placeholder="MW, units, workers, USD m"')}<label>Source period<input name="period" maxlength="80" placeholder="e.g. 2026 Q3 or Sep 2026" required></label><label>Status<select name="status">${STATUSES.map(x=>`<option>${esc(x)}</option>`).join('')}</select></label><label>Evidence confidence<select name="confidence">${CONFIDENCE.map(x=>`<option>${x}</option>`).join('')}</select></label>${field('Source name','sourceName','','maxlength="160" required')}${field('Evidence URL','sourceUrl','','type="url" placeholder="https://..." required')}${field('Source date or filing period','sourceDate','','maxlength="80" placeholder="As shown at source"') }<label>Links to prior record<select name="predecessorId">${predecessorOptions}</select></label><label>Link confidence<select name="linkConfidence">${CONFIDENCE.map(x=>`<option>${x}</option>`).join('')}</select></label>${field('Why do these records connect?','linkLabel','','maxlength="220" placeholder="Same named project, matching site and period"')}<label class="crb-wide">Missing link or next-step question<textarea name="gap" maxlength="1200" placeholder="What evidence is needed to connect this stage to the next?"></textarea></label><label class="crb-wide">Notes<textarea name="notes" maxlength="1600" placeholder="Definitions, scope, caveats, revisions, or analyst interpretation"></textarea></label><button type="submit">Save evidence record</button><p class="crb-message" data-crb="message" role="status" aria-live="polite">${esc(message)}</p></form><div class="crb-toolbar"><button type="button" class="secondary" data-crb="export">Export JSON backup</button><button type="button" class="secondary" data-crb="import">Import JSON backup</button><input type="file" data-crb="file" accept="application/json,.json" hidden><span class="crb-small">Import adds new records. It does not overwrite or delete existing entries.</span></div><div class="crb-sequence">${records}</div><p class="crb-small">Evidence confidence rates the source record. Link confidence rates your manual connection to an earlier record. A “High” rating is still an analyst judgment. Similar entity names, shared regions, or timing alone do not establish a project match.</p></section>`;
  }

  function importEntries(current, imported) {
    if (!Array.isArray(imported)) return { error: 'Backup must contain an entries array.' };
    const combined = [...current];
    const seen = new Set(current.map(entry => entry.id));
    const idMap = new Map();
    const importedIds = new Set();
    for (const raw of imported) {
      if (!raw || typeof raw !== 'object') continue;
      const oldId = String(raw.id || '');
      if (oldId && !importedIds.has(oldId)) {
        importedIds.add(oldId);
        idMap.set(oldId, seen.has(oldId) ? id() : oldId);
      }
    }
    importedIds.clear();
    let added = 0;
    for (const raw of imported) {
      if (!raw || typeof raw !== 'object') continue;
      const oldId = String(raw.id || '');
      if (oldId && importedIds.has(oldId)) continue;
      if (oldId) importedIds.add(oldId);
      const item = { ...raw, id: idMap.get(oldId) || id(), predecessorId: idMap.get(String(raw.predecessorId || '')) || String(raw.predecessorId || '') };
      const normalized = normalizeEntry(item, combined);
      if (normalized.error) continue;
      combined.push(normalized); seen.add(normalized.id); added += 1;
    }
    return { entries: combined, added };
  }

  function attach(container) {
    let storage;
    try { storage = root.localStorage; } catch { storage = null; }
    let state = storage ? readState(storage) : blankState();
    const persist = () => storage ? writeState(storage, state) : false;
    const paint = message => { container.innerHTML = renderState(state.entries, message || ''); bind(); };
    const bind = () => {
      const form = container.querySelector('[data-crb="form"]');
      form?.addEventListener('submit', event => {
        event.preventDefault();
        const value = Object.fromEntries(new FormData(form).entries());
        const row = normalizeEntry(value, state.entries);
        const status = container.querySelector('[data-crb="message"]');
        if (row.error) { status.textContent = row.error; return; }
        state.entries.push(row);
        if (!persist()) { state.entries.pop(); status.textContent = 'Could not save locally. Export or free browser storage and retry.'; return; }
        paint('Record saved in this browser. No records were automatically matched or added together.');
      });
      container.querySelector('[data-crb="export"]')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries: state.entries }, null, 2)], { type: 'application/json' });
        const link = root.document.createElement('a'); link.href = root.URL.createObjectURL(blob); link.download = 'field-signals-capacity-revenue-bridge.json'; link.click(); root.URL.revokeObjectURL(link.href);
      });
      container.querySelector('[data-crb="import"]')?.addEventListener('click', () => container.querySelector('[data-crb="file"]').click());
      container.querySelector('[data-crb="file"]')?.addEventListener('change', async event => {
        const file = event.target.files?.[0]; if (!file) return;
        try {
          const parsed = JSON.parse(await file.text());
          const result = importEntries(state.entries, parsed.entries);
          if (result.error) { paint(result.error); return; }
          const old = state; state = { version: 1, entries: result.entries };
          if (!persist()) { state = old; paint('Could not save imported records. Existing entries were preserved.'); return; }
          paint(`Imported ${result.added} valid records. Existing entries were retained.`);
        } catch { paint('Could not read that JSON backup. Existing entries were preserved.'); }
      });
    };
    paint(storage ? '' : 'Browser storage is unavailable. Changes will not persist after this page closes.');
  }

  const api = { title: 'Capacity to revenue bridge', render: () => renderState([], ''), attach };
  root.FieldSignalsModules = root.FieldSignalsModules || {};
  root.FieldSignalsModules.capacityRevenueBridge = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = { STORAGE_KEY, STAGES, STATUSES, CONFIDENCE, validUrl, normalizeEntry, readState, writeState, gapsFor, importEntries, renderState };
})(typeof window !== 'undefined' ? window : globalThis);
