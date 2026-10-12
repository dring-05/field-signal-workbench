(function (root) {
  'use strict';

  const EVENT_KEY = 'fieldSignals.catalysts.v1';
  const CHECK_KEY = 'fieldSignals.sourceChecks.v1';
  const CHECK_STATES = new Set(['changed', 'stale', 'unchanged']);

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

  function normalizeEvent(input) {
    const eventDate = String(input.eventDate ?? '').trim();
    if (eventDate && !validDate(eventDate)) return { error: 'Use a valid YYYY-MM-DD event date.' };
    const sources = String(input.sourceUrls ?? '').split(/[\n,]+/).map(safeUrl).filter(Boolean);
    return {
      eventDate,
      company: String(input.company ?? '').trim(),
      catalyst: String(input.catalyst ?? '').trim(),
      expectedMetric: String(input.expectedMetric ?? '').trim(),
      relatedSignals: String(input.relatedSignals ?? '').trim(),
      sources,
      createdAt: String(input.createdAt ?? '').trim()
    };
  }

  function normalizeCheck(input) {
    const state = String(input.status ?? '').trim();
    if (!CHECK_STATES.has(state)) return { error: 'Choose changed, stale, or unchanged.' };
    const checkedDate = String(input.checkedDate ?? '').trim();
    if (checkedDate && !validDate(checkedDate)) return { error: 'Use a valid YYYY-MM-DD check date.' };
    return {
      sourceName: String(input.sourceName ?? '').trim(),
      sourceUrl: safeUrl(input.sourceUrl),
      checkedDate,
      status: state,
      priorNote: String(input.priorNote ?? '').trim(),
      latestNote: String(input.latestNote ?? '').trim()
    };
  }

  function readList(storage, key) {
    try {
      const value = JSON.parse(storage.getItem(key) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (_) { return []; }
  }

  function writeList(storage, key, values) {
    try { storage.setItem(key, JSON.stringify(values)); return true; }
    catch (_) { return false; }
  }

  function renderLinks(urls) {
    return urls.map(url => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(new URL(url).hostname)}</a>`).join(' · ');
  }

  const moduleApi = {
    title: 'Catalyst and source watch',
    render() {
      return `<section class="csw-page"><header class="csw-head"><div><p class="csw-kicker">Manual research log</p><h1>Catalyst and source watch</h1><p>Keep dated catalysts beside the operating metrics they may affect. Record source checks when you review a page. Nothing polls providers in the background.</p></div></header>
      <div class="csw-grid"><section class="csw-card"><h2>Catalyst calendar</h2><p class="csw-muted">Add a date, company, catalyst, expected metric, and the signals you plan to watch.</p><form data-csw="eventForm" class="csw-form">
      <label>Event date<input data-csw="eventDate" type="date"></label><label>Company or asset<input data-csw="company" maxlength="120" required></label>
      <label class="csw-wide">Catalyst<textarea data-csw="catalyst" maxlength="600" required placeholder="Earnings, policy decision, product launch, capacity milestone"></textarea></label>
      <label>Expected operating metric<input data-csw="expectedMetric" maxlength="180" placeholder="Shipments, utilization, traffic, pricing"></label><label>Related signals<input data-csw="relatedSignals" maxlength="240" placeholder="Signal names or source IDs"></label>
      <label class="csw-wide">Source URLs, one per line<textarea data-csw="eventSources" placeholder="https://example.com"></textarea></label><div class="csw-wide"><button class="btn primary" type="submit">Add catalyst</button></div><p data-csw="eventStatus" class="csw-status" aria-live="polite"></p></form><div data-csw="events" class="csw-list"></div></section>
      <section class="csw-card"><h2>Source-change checks</h2><p class="csw-muted">Compare your earlier note with what you see now, then mark the result. A status is your assessment, not an automated detection.</p><form data-csw="checkForm" class="csw-form">
      <label>Source name<input data-csw="sourceName" maxlength="140" required></label><label>Page checked<input data-csw="checkedDate" type="date"></label>
      <label class="csw-wide">Source URL<input data-csw="sourceUrl" type="url" placeholder="https://example.com"></label>
      <label>Status<select data-csw="status"><option value="">Choose status</option><option value="changed">Changed</option><option value="stale">Stale or unavailable</option><option value="unchanged">Unchanged</option></select></label>
      <label class="csw-wide">Prior note<textarea data-csw="priorNote" maxlength="1000" placeholder="What did the source say at the last check?"></textarea></label><label class="csw-wide">Latest note<textarea data-csw="latestNote" maxlength="1000" placeholder="What does it say now? Include the source's own date if visible."></textarea></label>
      <div class="csw-wide"><button class="btn primary" type="submit">Save source check</button></div><p data-csw="checkStatus" class="csw-status" aria-live="polite"></p></form><div data-csw="checks" class="csw-list"></div></section></div>
      <p class="csw-storage">Saved in this browser profile only. Dates are left blank until you enter them. No account sync, background checks, or source fetches.</p>
      <style>.csw-page{max-width:1180px;margin:0 auto}.csw-head{padding:6px 0 20px;border-bottom:1px solid #dce3ed}.csw-head h1{font-size:30px;letter-spacing:-.8px;margin:5px 0}.csw-head p:last-child,.csw-muted{font-size:12px;color:#68768c;margin:4px 0 12px}.csw-kicker{color:#275bd7;font-size:10px;text-transform:uppercase;letter-spacing:1px;font-weight:700;margin:0}.csw-grid{display:grid;grid-template-columns:1fr 1fr;gap:15px;margin-top:18px}.csw-card{background:white;border:1px solid #dce3ed;border-radius:9px;padding:16px;min-width:0;box-shadow:0 9px 26px #1424400b}.csw-card h2{font-size:16px;margin:0}.csw-form{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:13px}.csw-form label{display:grid;gap:4px;color:#50617a;font-size:11px;font-weight:650}.csw-form input,.csw-form select,.csw-form textarea{width:100%;min-width:0;border:1px solid #cfd9e6;border-radius:6px;background:#fff;padding:8px 9px;font:12px/1.45 inherit;color:#17243a}.csw-form textarea{min-height:56px;resize:vertical}.csw-wide{grid-column:1/-1}.csw-status{grid-column:1/-1;font-size:11px;color:#98620b;margin:0}.csw-list{display:grid;gap:8px;margin-top:14px}.csw-item{border-top:1px solid #edf0f5;padding:10px 0 2px;font-size:12px;overflow-wrap:anywhere}.csw-item h3{font-size:13px;margin:0 0 4px}.csw-item p{margin:4px 0;color:#53647d}.csw-item small{color:#68768c}.csw-item a{margin-right:6px}.csw-state{display:inline-block;padding:2px 7px;border-radius:4px;background:#edf3ff;color:#395991;font-size:10px;font-weight:700;text-transform:uppercase}.csw-state.changed{background:#fff0e9;color:#995023}.csw-state.stale{background:#fff4dd;color:#98620b}.csw-storage{font-size:11px;color:#68768c;margin-top:14px}@media(max-width:760px){.csw-grid{grid-template-columns:1fr}}@media(max-width:500px){.csw-head h1{font-size:25px}.csw-card{padding:13px}.csw-form{grid-template-columns:1fr}.csw-wide{grid-column:auto}}</style></section>`;
    },
    attach(container) {
      const get = key => container.querySelector(`[data-csw="${key}"]`);
      const storage = root.localStorage;
      const renderEvents = () => {
        const events = readList(storage, EVENT_KEY).sort((a, b) => (a.eventDate || '9999').localeCompare(b.eventDate || '9999'));
        get('events').innerHTML = events.length ? events.map(event => `<article class="csw-item"><h3>${esc(event.eventDate || 'Date not set')} · ${esc(event.company)}</h3><p>${esc(event.catalyst)}</p>${event.expectedMetric ? `<p><strong>Metric:</strong> ${esc(event.expectedMetric)}</p>` : ''}${event.relatedSignals ? `<p><strong>Signals:</strong> ${esc(event.relatedSignals)}</p>` : ''}${event.sources?.length ? `<small>Sources: ${renderLinks(event.sources)}</small>` : ''}</article>`).join('') : '<p class="csw-muted">No catalysts recorded.</p>';
      };
      const renderChecks = () => {
        const checks = readList(storage, CHECK_KEY);
        get('checks').innerHTML = checks.length ? [...checks].reverse().map(check => `<article class="csw-item"><h3>${esc(check.sourceName || 'Unnamed source')} <span class="csw-state ${esc(check.status)}">${esc(check.status)}</span></h3><small>${esc(check.checkedDate || 'Check date not set')}</small>${check.sourceUrl ? `<p><a href="${esc(check.sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source</a></p>` : ''}<p><strong>Prior:</strong> ${esc(check.priorNote || 'No prior note entered')}</p><p><strong>Latest:</strong> ${esc(check.latestNote || 'No latest note entered')}</p></article>`).join('') : '<p class="csw-muted">No source checks recorded.</p>';
      };
      get('eventForm').addEventListener('submit', event => {
        event.preventDefault();
        const item = normalizeEvent({ eventDate: get('eventDate').value, company: get('company').value, catalyst: get('catalyst').value, expectedMetric: get('expectedMetric').value, relatedSignals: get('relatedSignals').value, sourceUrls: get('eventSources').value });
        if (!item.company || !item.catalyst) { get('eventStatus').textContent = 'Enter a company and catalyst.'; return; }
        if (item.error) { get('eventStatus').textContent = item.error; return; }
        const events = readList(storage, EVENT_KEY); events.push(item);
        get('eventStatus').textContent = writeList(storage, EVENT_KEY, events) ? 'Catalyst saved.' : 'Could not save in this browser.';
        event.target.reset(); renderEvents();
      });
      get('checkForm').addEventListener('submit', event => {
        event.preventDefault();
        const item = normalizeCheck({ sourceName: get('sourceName').value, checkedDate: get('checkedDate').value, sourceUrl: get('sourceUrl').value, status: get('status').value, priorNote: get('priorNote').value, latestNote: get('latestNote').value });
        if (!item.sourceName) { get('checkStatus').textContent = 'Enter a source name.'; return; }
        if (get('sourceUrl').value.trim() && !item.sourceUrl) { get('checkStatus').textContent = 'Enter a valid HTTP or HTTPS source URL.'; return; }
        if (item.error) { get('checkStatus').textContent = item.error; return; }
        const checks = readList(storage, CHECK_KEY); checks.push(item);
        get('checkStatus').textContent = writeList(storage, CHECK_KEY, checks) ? 'Source check saved.' : 'Could not save in this browser.';
        event.target.reset(); renderChecks();
      });
      renderEvents(); renderChecks();
    }
  };

  root.FieldSignalsModules = root.FieldSignalsModules || {};
  root.FieldSignalsModules.calendarWatch = moduleApi;
  if (typeof module !== 'undefined' && module.exports) module.exports = { normalizeEvent, normalizeCheck, safeUrl, readList, writeList, EVENT_KEY, CHECK_KEY };
})(typeof window !== 'undefined' ? window : globalThis);
