/* Manual register for capacity constraints. No web requests or automatic matching. */
(function (root) {
  'use strict';
  const STORAGE_KEY = 'field-signals-capacity-constraints-v1';
  const TYPES = [
    ['power', 'Power and grid'], ['permitting', 'Permits and construction'],
    ['equipment', 'Equipment lead times'], ['labor', 'Skilled labor']
  ];
  const STATES = ['Reported', 'Queued', 'Applied', 'Approved', 'Ordered', 'Hiring', 'Under construction', 'Delayed', 'Commissioning', 'Operating', 'Withdrawn', 'Unknown'];
  const CONFIDENCE = ['Low', 'Medium', 'High'];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const makeId = () => `cct-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const safeUrl = value => { try { const url = new URL(String(value ?? '').trim()); return ['http:', 'https:'].includes(url.protocol) ? url.href : ''; } catch { return ''; } };
  const validDate = value => {
    const match = String(value ?? '').match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!match) return false;
    const [, y, m, d] = match.map(Number), date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const typeLabel = key => TYPES.find(([id]) => id === key)?.[1] || 'Unknown';
  const blank = () => ({ version: 1, entries: [] });

  function normalize(input, entries = []) {
    const type = String(input.type ?? '').trim();
    if (!TYPES.some(([key]) => key === type)) return { error: 'Choose a constraint area.' };
    const subject = String(input.subject ?? '').trim();
    const geography = String(input.geography ?? '').trim();
    const signal = String(input.signal ?? '').trim();
    const sourceName = String(input.sourceName ?? '').trim();
    const sourceUrl = safeUrl(input.sourceUrl);
    if (!subject || !geography || !signal || !sourceName || !sourceUrl) return { error: 'Enter a company, project, or institution; geography; measure or issue; source name; and HTTP or HTTPS evidence URL.' };
    const sourceDate = String(input.sourceDate ?? '').trim();
    const checkedOn = String(input.checkedOn ?? '').trim();
    const nextCheck = String(input.nextCheck ?? '').trim();
    if (!validDate(sourceDate) || !validDate(checkedOn) || !validDate(nextCheck)) return { error: 'Enter valid source date, checked date, and next check date.' };
    if (sourceDate > checkedOn) return { error: 'Source date cannot be after the date you checked it.' };
    if (nextCheck < checkedOn) return { error: 'Next check date cannot precede the date you checked the source.' };
    const status = String(input.status ?? '').trim();
    if (!STATES.includes(status)) return { error: 'Choose a status.' };
    const confidence = String(input.confidence ?? '').trim();
    if (!CONFIDENCE.includes(confidence)) return { error: 'Choose evidence confidence.' };
    const rawValue = String(input.value ?? '').trim();
    const unit = String(input.unit ?? '').trim();
    let value = null;
    if (rawValue) {
      const valid = /^[+-]?(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)$/.test(rawValue);
      const numeric = valid ? rawValue.replace(/,/g, '') : '';
      if (!numeric || !Number.isFinite(Number(numeric))) return { error: 'Value must be numeric. Use commas only as thousands separators.' };
      if (!unit) return { error: 'Enter a unit with a numeric value.' };
      value = Number(numeric);
    } else if (unit) return { error: 'Leave the unit blank when no numeric value is recorded.' };
    const priorId = String(input.priorId ?? '').trim();
    if (priorId && !entries.some(entry => entry.id === priorId)) return { error: 'The selected prior observation is not available.' };
    if (priorId === String(input.id ?? '')) return { error: 'An observation cannot link to itself.' };
    return {
      id: String(input.id || makeId()), type, subject, geography, signal, value, unit,
      period: String(input.period ?? '').trim(), status, sourceDate, checkedOn, nextCheck,
      confidence, sourceName, sourceUrl, priorId,
      relationship: String(input.relationship ?? '').trim(), gap: String(input.gap ?? '').trim(),
      caveat: String(input.caveat ?? '').trim(), recordedAt: String(input.recordedAt || new Date().toISOString())
    };
  }

  function read(storage) {
    try {
      const parsed = JSON.parse(storage.getItem(STORAGE_KEY) || 'null');
      if (!parsed || !Array.isArray(parsed.entries)) return blank();
      const ids = new Set();
      return { version: 1, entries: parsed.entries.filter(item => item && typeof item.id === 'string' && !ids.has(item.id) && TYPES.some(([key]) => key === item.type) && validDate(item.sourceDate) && validDate(item.checkedOn) && validDate(item.nextCheck) && safeUrl(item.sourceUrl) && (ids.add(item.id), true)) };
    } catch { return blank(); }
  }
  function write(storage, state) { try { storage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; } catch { return false; } }
  function reviewFlag(entry, asOf = today()) {
    if (!validDate(asOf) || !validDate(entry.nextCheck)) return 'Check date missing';
    return entry.nextCheck <= asOf ? 'Review due' : 'Scheduled';
  }
  function ageDays(entry, asOf = today()) {
    if (!validDate(entry.sourceDate) || !validDate(asOf)) return null;
    return Math.floor((Date.parse(`${asOf}T00:00:00Z`) - Date.parse(`${entry.sourceDate}T00:00:00Z`)) / 86400000);
  }
  function entriesWithGaps(entries) {
    return entries.map(item => {
      const gaps = [];
      if (item.value == null) gaps.push('No numeric reading');
      if (!item.period) gaps.push('Source period not specified');
      if (!item.gap) gaps.push('No named missing link or follow-up question');
      return { id: item.id, gaps };
    });
  }
  function importRecords(current, imported) {
    if (!Array.isArray(imported)) return { error: 'Backup must contain an entries array.' };
    const combined = [...current], used = new Set(current.map(item => item.id)), idMap = new Map(), acceptedIds = new Set();
    for (const raw of imported) {
      if (!raw || typeof raw !== 'object') continue;
      const oldId = String(raw.id || '');
      if (!oldId || acceptedIds.has(oldId)) continue;
      acceptedIds.add(oldId);
      let nextId = oldId;
      if (used.has(nextId)) nextId = makeId();
      used.add(nextId); idMap.set(oldId, nextId);
    }
    let added = 0;
    for (const raw of imported) {
      if (!raw || typeof raw !== 'object' || !idMap.has(String(raw.id || ''))) continue;
      const sourceId = String(raw.id);
      idMap.delete(sourceId); // Only the first instance of a duplicate source ID is imported.
      const item = { ...raw, id: idMap.get(sourceId) || [...used].find(candidate => candidate === sourceId) || sourceId };
      // Restore the reserved remapped ID if source ID collided with local data.
      const reserved = [...used].filter(candidate => candidate !== sourceId && candidate.startsWith('cct-')).at(-1);
      if (used.has(sourceId) && current.some(existing => existing.id === sourceId)) item.id = reserved || makeId();
      item.priorId = idMap.get(String(raw.priorId || '')) || String(raw.priorId || '');
      const normalized = normalize(item, combined);
      if (normalized.error) continue;
      combined.push(normalized); added += 1;
    }
    return { entries: combined, added };
  }

  const valueField = (label, name, extra = '') => `<label>${esc(label)}<input name="${esc(name)}" ${extra}></label>`;
  function renderState(entries, message = '') {
    const sorted = [...entries].sort((a,b) => String(a.nextCheck).localeCompare(String(b.nextCheck)) || String(b.sourceDate).localeCompare(String(a.sourceDate)));
    const byId = new Map(entries.map(entry => [entry.id, entry]));
    const gapsById = new Map(entriesWithGaps(entries).map(row => [row.id, row.gaps]));
    const priorOptions = ['<option value="">No prior observation linked</option>', ...sorted.map(item => `<option value="${esc(item.id)}">${esc(`${typeLabel(item.type)} · ${item.subject} · ${item.signal} · ${item.sourceDate}`)}</option>`)].join('');
    const cards = TYPES.map(([type, label]) => {
      const group = sorted.filter(item => item.type === type);
      return `<section class="cct-group"><h3>${esc(label)} <small>${group.length}</small></h3>${group.length ? group.map(item => {
        const prior = byId.get(item.priorId), gaps = gapsById.get(item.id) || [], age = ageDays(item);
        const review = reviewFlag(item);
        return `<article class="cct-card"><div class="cct-top"><strong>${esc(item.subject)}${item.geography ? ` · ${esc(item.geography)}` : ''}</strong><span class="cct-tag ${review === 'Review due' ? 'due' : ''}">${review === 'Review due' ? 'Review date reached' : 'Review scheduled'} · ${esc(item.nextCheck)}</span></div><div class="cct-metric">${esc(item.signal)}${item.value == null ? '' : ` · ${esc(item.value)} ${esc(item.unit)}`} · ${esc(item.status)} · ${esc(item.confidence)} confidence</div><div class="cct-source"><a href="${esc(item.sourceUrl)}" target="_blank" rel="noopener noreferrer">${esc(item.sourceName)} ↗</a> · source date ${esc(item.sourceDate)} · checked ${esc(item.checkedOn)}${item.period ? ` · period ${esc(item.period)}` : ''}${age != null ? ` · ${age} days since source date` : ''}</div>${prior ? `<p class="cct-link">Manual prior-observation link: ${esc(typeLabel(prior.type))}, ${esc(prior.subject)}, ${esc(prior.sourceDate)}${item.relationship ? ` · ${esc(item.relationship)}` : ''}</p>` : ''}${item.gap ? `<p class="cct-gap"><strong>Open gap:</strong> ${esc(item.gap)}</p>` : ''}${item.caveat ? `<p class="cct-note">${esc(item.caveat)}</p>` : ''}${gaps.length ? `<p class="cct-gap">Review record: ${gaps.map(esc).join(' · ')}</p>` : ''}</article>`;
      }).join('') : '<p class="cct-empty">No observations recorded in this area.</p>'}</section>`;
    }).join('');
    return `<style>
      .cct-wrap{max-width:1040px;margin:auto;color:#172943}.cct-wrap *{box-sizing:border-box}.cct-head{border-bottom:1px solid #dce3ed;padding:6px 0 14px}.cct-kicker{font-size:10px;letter-spacing:1px;text-transform:uppercase;color:#315da8;font-weight:750;margin:0}.cct-head h1{font-size:27px;letter-spacing:-.5px;margin:5px 0}.cct-intro,.cct-muted{font-size:12px;color:#62718a;line-height:1.5}.cct-callout{padding:10px 12px;border-left:3px solid #c18b2d;background:#fff8e9;color:#72561c;font-size:11px;line-height:1.5}.cct-local{padding:8px 10px;border:1px solid #dce5f1;border-radius:6px;background:#f3f7fc;color:#596b82;font-size:11px}.cct-form{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;padding:13px;margin:12px 0;border:1px solid #dce3ed;border-radius:8px;background:white}.cct-form label{display:grid;gap:4px;font-size:11px;font-weight:650;color:#50617a}.cct-form input,.cct-form select,.cct-form textarea{width:100%;min-width:0;padding:8px;border:1px solid #cbd6e4;border-radius:6px;background:#fff;color:#172943;font:inherit;font-size:12px;line-height:1.4}.cct-form textarea{min-height:52px;resize:vertical}.cct-wide{grid-column:1/-1}.cct-form button,.cct-toolbar button{border:0;border-radius:6px;padding:9px 12px;background:#2458c5;color:white;font-weight:700;font-size:12px;cursor:pointer}.cct-toolbar{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:12px 0}.cct-toolbar button.secondary{background:#edf3ff;color:#2853a9;border:1px solid #d8e3f8}.cct-status{font-size:11px;color:#805b0d}.cct-groups{display:grid;gap:9px}.cct-group{background:#f8faff;border:1px solid #dce3ed;border-radius:8px;padding:10px}.cct-group h3{font-size:13px;color:#27456f;margin:0 0 8px;display:flex;justify-content:space-between}.cct-group h3 small{color:#7a8798}.cct-card{background:#fff;border:1px solid #e0e6ef;border-radius:7px;padding:10px;margin:7px 0}.cct-top{display:flex;justify-content:space-between;gap:8px;font-size:12px}.cct-tag{font-size:10px;color:#405d83;background:#eef4fc;padding:4px 6px;border-radius:5px;white-space:nowrap}.cct-tag.due{color:#8e5120;background:#fff0e6}.cct-metric{font-size:12px;color:#293b57;margin-top:6px}.cct-source,.cct-link,.cct-gap,.cct-note{font-size:11px;line-height:1.45;color:#5c6b81;margin:5px 0 0;overflow-wrap:anywhere}.cct-source a{color:#2458b3}.cct-gap{color:#8a5d0e}.cct-empty{font-size:11px;color:#78869a;margin:4px}.cct-small{font-size:10px;color:#697991}@media(max-width:760px){.cct-form{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:480px){.cct-form{grid-template-columns:1fr}.cct-wide{grid-column:auto}.cct-top{display:block}.cct-tag{display:inline-block;margin-top:4px}.cct-head h1{font-size:24px}}
    </style><section class="cct-wrap"><header class="cct-head"><p class="cct-kicker">Analyst-maintained constraint log</p><h1>Capacity constraint tracker</h1><p class="cct-intro">Record where capacity may be constrained by grid access, permits and construction, equipment availability, or skilled labor. Keep the reported observation and the next date you plan to recheck it beside its source.</p></header><p class="cct-callout"><strong>Manual review reminders, not live monitoring.</strong> A reached next-check date means the record is due for your review. It does not prove the source is stale, the constraint remains, or the project is delayed. Similar companies, locations, or timing are not automatic matches.</p><p class="cct-local">Entries stay in this browser profile. Nothing is fetched, refreshed, or uploaded. Export a JSON backup before changing devices.</p><form class="cct-form" data-cct="form"><label>Constraint area<select name="type">${TYPES.map(([key,label])=>`<option value="${key}">${esc(label)}</option>`).join('')}</select></label>${valueField('Company, project, or institution','subject','maxlength="180" required')}${valueField('Geography or site','geography','maxlength="140" required')}${valueField('Constraint measure or issue','signal','maxlength="180" required placeholder="Queue position, permit milestone, transformer lead time"')}<label>Reported value<input name="value" inputmode="decimal" placeholder="Leave blank for qualitative records"></label>${valueField('Unit','unit','maxlength="50" placeholder="MW, weeks, workers, USD/hour"')}<label>Status<select name="status">${STATES.map(state=>`<option>${esc(state)}</option>`).join('')}</select></label><label>Confidence in source evidence<select name="confidence">${CONFIDENCE.map(x=>`<option>${x}</option>`).join('')}</select></label><label>Source period<input name="period" maxlength="80" placeholder="2026 Q3, Sep 2026, as of date"></label><label>Source date<input name="sourceDate" type="date" required></label><label>Date you checked source<input name="checkedOn" type="date" value="${esc(today())}" required></label><label>Next check date<input name="nextCheck" type="date" value="${esc(today())}" required></label>${valueField('Source name','sourceName','maxlength="160" required')}${valueField('Evidence URL','sourceUrl','type="url" placeholder="https://..." required')}<label>Prior observation, if manually linked<select name="priorId">${priorOptions}</select></label>${valueField('Why link these observations?','relationship','maxlength="240" placeholder="Same named project and milestone"')}<label class="cct-wide">What is still unknown or needs follow-up?<textarea name="gap" maxlength="1200" placeholder="For example, no confirmed energization date"></textarea></label><label class="cct-wide">Scope, definition, or source caveat<textarea name="caveat" maxlength="1600" placeholder="Coverage, estimates versus reported figures, revisions, or definitions"></textarea></label><button type="submit">Save constraint observation</button><p class="cct-status" data-cct="status" role="status" aria-live="polite">${esc(message)}</p></form><div class="cct-toolbar"><button type="button" class="secondary" data-cct="export">Export JSON backup</button><button type="button" class="secondary" data-cct="import">Import JSON backup</button><input type="file" data-cct="file" accept="application/json,.json" hidden><span class="cct-small">Import adds valid records and keeps current records.</span></div><div class="cct-groups">${cards}</div><p class="cct-small">High confidence describes the source evidence as entered. It does not establish project attribution or future completion. Equipment capacity, megawatts, worker counts, and contract values are not added across records.</p></section>`;
  }

  function importRecords(current, imported) {
    if (!Array.isArray(imported)) return { error: 'Backup must contain an entries array.' };
    const combined = [...current], used = new Set(current.map(entry => entry.id)), firstByOldId = new Map(), pairs = [];
    for (const raw of imported) {
      if (!raw || typeof raw !== 'object') continue;
      const oldId = String(raw.id || '');
      if (!oldId || firstByOldId.has(oldId)) continue;
      const nextId = used.has(oldId) ? makeId() : oldId;
      used.add(nextId); firstByOldId.set(oldId, nextId); pairs.push([oldId, raw]);
    }
    let added = 0;
    for (const [oldId, raw] of pairs) {
      const item = { ...raw, id: firstByOldId.get(oldId), priorId: firstByOldId.get(String(raw.priorId || '')) || String(raw.priorId || '') };
      const normalized = normalize(item, combined);
      if (normalized.error) continue;
      combined.push(normalized); added += 1;
    }
    return { entries: combined, added };
  }

  function attach(container) {
    let storage; try { storage = root.localStorage; } catch { storage = null; }
    let state = storage ? read(storage) : blank();
    const persist = () => storage ? write(storage, state) : false;
    const paint = message => { container.innerHTML = renderState(state.entries, message || ''); bind(); };
    const bind = () => {
      container.querySelector('[data-cct="form"]')?.addEventListener('submit', event => {
        event.preventDefault(); const form = event.currentTarget, input = Object.fromEntries(new FormData(form).entries());
        const record = normalize(input, state.entries), status = container.querySelector('[data-cct="status"]');
        if (record.error) { status.textContent = record.error; return; }
        state.entries.push(record);
        if (!persist()) { state.entries.pop(); status.textContent = 'Could not save locally. Export a backup or free browser storage, then retry.'; return; }
        paint('Saved in this browser. The next check date is a reminder, not an automatic source check.');
      });
      container.querySelector('[data-cct="export"]')?.addEventListener('click', () => {
        const blob = new Blob([JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), entries: state.entries }, null, 2)], { type: 'application/json' });
        const link = root.document.createElement('a'); link.href = root.URL.createObjectURL(blob); link.download = 'field-signals-capacity-constraints.json'; link.click(); root.URL.revokeObjectURL(link.href);
      });
      container.querySelector('[data-cct="import"]')?.addEventListener('click', () => container.querySelector('[data-cct="file"]').click());
      container.querySelector('[data-cct="file"]')?.addEventListener('change', async event => {
        const file = event.target.files?.[0]; if (!file) return;
        try {
          const result = importRecords(state.entries, JSON.parse(await file.text()).entries);
          if (result.error) { paint(result.error); return; }
          const previous = state; state = { version: 1, entries: result.entries };
          if (!persist()) { state = previous; paint('Could not save imported entries. Existing entries were preserved.'); return; }
          paint(`Imported ${result.added} valid records. Current entries were retained.`);
        } catch { paint('Could not read that JSON backup. Existing entries were preserved.'); }
      });
    };
    paint(storage ? '' : 'Browser storage is unavailable. Entries will not persist after this page closes.');
  }

  const api = { title: 'Capacity constraint tracker', render: () => renderState([], ''), attach };
  root.FieldSignalsModules = root.FieldSignalsModules || {};
  root.FieldSignalsModules.capacityConstraintTracker = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = { STORAGE_KEY, TYPES, STATES, CONFIDENCE, validDate, safeUrl, normalize, read, write, reviewFlag, ageDays, entriesWithGaps, importRecords, renderState };
})(typeof window !== 'undefined' ? window : globalThis);
